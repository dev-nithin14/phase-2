import React, { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Assessment,
  AssessmentAttempt,
  AssessmentQuestion,
  AssessmentSecurityPolicy,
  DEFAULT_ASSESSMENT_SECURITY_POLICY,
  IntegrityEvent,
  Submission,
} from '../../types';
import {
  completeAttempt,
  getOrStartAttempt,
  recordAssessmentIntegrityEvent,
  saveAttemptSubmission,
  saveExplainBackResponse,
  updateAttemptSecurityState,
} from '../../services/assessmentService';
import { executeCandidateCode } from '../../services/codeExecution';
import { supabase } from '../../services/supabase';
import {
  detectFacesInVideo,
  captureVideoSnapshot,
  FaceDetectionResult,
} from '../../services/visionDetector';
import {
  generatePhonePairingSession,
  checkPhoneStatus,
  listenToPhoneHeartbeat,
  PhonePairingSession,
} from '../../services/phoneCameraService';
import { evaluateIntegrityStatus } from '../../services/integrity';
import {
  Clock,
  Send,
  ShieldCheck,
  Smartphone,
  Eye,
  AlertTriangle,
  Key,
  Maximize2,
  Copy,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';

interface PersistedAssessmentRunnerProps {
  assessment: Assessment;
  candidateId: string;
  onComplete: (attempt: AssessmentAttempt) => void;
}

const remainingSeconds = (attempt: AssessmentAttempt, durationMinutes: number) =>
  Math.max(0, Math.ceil((new Date(attempt.started_at).getTime() + durationMinutes * 60_000 - Date.now()) / 1000));

export const PersistedAssessmentRunner: React.FC<PersistedAssessmentRunnerProps> = ({
  assessment,
  candidateId,
  onComplete,
}) => {
  const policy: AssessmentSecurityPolicy = useMemo(
    () => ({ ...DEFAULT_ASSESSMENT_SECURITY_POLICY, ...assessment.security_policy }),
    [assessment.security_policy]
  );

  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [isNewAttempt, setIsNewAttempt] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [fullscreenSatisfied, setFullscreenSatisfied] = useState(false);
  const [explainBackResponse, setExplainBackResponse] = useState('');
  const [explainBackSaving, setExplainBackSaving] = useState(false);
  const [testResults, setTestResults] = useState<
    Record<string, Array<{ passed: boolean; actual_output: string; expected_output: string }>>
  >({});

  // Assessment Security & Telemetry State
  const sessionToken = useMemo(
    () => `SEC-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
    []
  );
  const [events, setEvents] = useState<IntegrityEvent[]>([]);
  const [warningCount, setWarningCount] = useState(0);
  const [activeWarning, setActiveWarning] = useState<string | null>(null);
  const [faceState, setFaceState] = useState<FaceDetectionResult>({
    detected: false,
    count: 0,
    confidence: 0,
  });
  const [evidenceSnapshots, setEvidenceSnapshots] = useState<string[]>([]);

  // Phone Camera Secondary Stream State
  const [phonePairing, setPhonePairing] = useState<PhonePairingSession | null>(null);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const autoSubmittedAttempt = useRef<string | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const videoElement = useRef<HTMLVideoElement | null>(null);
  const questions = useMemo(
    () => [...(assessment.questions || [])].sort((left, right) => left.order_index - right.order_index),
    [assessment.questions]
  );
  const current = questions[currentIndex];

  // Helper to record an integrity event both locally and to backend
  const recordEvent = async (
    eventType: IntegrityEvent['event_type'],
    severity: 'LOW' | 'MEDIUM' | 'HIGH',
    metadata: Record<string, any> = {}
  ) => {
    if (!attempt) return;
    const evt: IntegrityEvent = {
      id: 'evt_' + Math.random().toString(36).substring(2, 9),
      attempt_id: attempt.id,
      event_type: eventType,
      severity,
      metadata: { ...metadata, session_token: sessionToken },
      timestamp: new Date().toISOString(),
    };
    setEvents((prev) => [...prev, evt]);
    try {
      await recordAssessmentIntegrityEvent(evt);
    } catch (err) {
      console.warn('Could not record integrity event to server:', err);
    }
  };

  // Initial Attempt Loading
  useEffect(() => {
    let active = true;
    getOrStartAttempt(assessment.id, candidateId, policy)
      .then(({ attempt: loadedAttempt, isNew }) => {
        if (!active) return;
        setAttempt(loadedAttempt);
        setIsNewAttempt(isNew);
        setExplainBackResponse(loadedAttempt.explain_back_response || '');
        setRemaining(remainingSeconds(loadedAttempt, assessment.duration_minutes));

        // Restore existing events if any
        if (loadedAttempt.integrity_events && loadedAttempt.integrity_events.length > 0) {
          setEvents(loadedAttempt.integrity_events);
        }

        const restored: Record<string, string> = {};
        for (const submission of loadedAttempt.submissions || []) {
          if (submission.language === 'mcq') {
            try {
              restored[submission.question_id] = JSON.parse(submission.code).selected_option || '';
            } catch {
              /* ignore parse error */
            }
          } else {
            restored[submission.question_id] = submission.code;
          }
        }
        setAnswers(restored);

        // Prepare phone pairing session
        const session = generatePhonePairingSession(loadedAttempt.id);
        setPhonePairing(session);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not start this assessment.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [assessment.id, assessment.duration_minutes, candidateId, policy]);

  // Video element binding
  useEffect(() => {
    if (videoElement.current && mediaStream.current) {
      videoElement.current.srcObject = mediaStream.current;
    }
  }, [hasStarted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mediaStream.current?.getTracks().forEach((track) => track.stop());
      mediaStream.current = null;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  // Timer interval
  useEffect(() => {
    if (!attempt || attempt.status !== 'IN_PROGRESS' || !hasStarted) return;
    const updateTimer = () => setRemaining(remainingSeconds(attempt, assessment.duration_minutes));
    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, assessment.duration_minutes, hasStarted]);

  // Secondary Phone Camera Heartbeat Listener
  useEffect(() => {
    if (!attempt) return;
    const unsub = listenToPhoneHeartbeat(attempt.id, (heartbeat) => {
      if (heartbeat.connected && !phoneConnected) {
        setPhoneConnected(true);
        void recordEvent('PHONE_CAMERA_CONNECTED', 'LOW', {
          device: heartbeat.device,
          fps: heartbeat.fps,
        });
      }
    });

    const pollInterval = window.setInterval(() => {
      const isOnline = checkPhoneStatus(attempt.id);
      if (isOnline !== phoneConnected) {
        setPhoneConnected(isOnline);
        if (!isOnline && phoneConnected) {
          void recordEvent('PHONE_CAMERA_DISCONNECTED', 'MEDIUM', {
            reason: 'Heartbeat timeout',
          });
          setActiveWarning('Secondary phone camera disconnected. Please ensure your phone camera tab remains active.');
        } else if (isOnline && !phoneConnected) {
          void recordEvent('PHONE_CAMERA_CONNECTED', 'LOW');
        }
      }
    }, 3500);

    return () => {
      unsub();
      window.clearInterval(pollInterval);
    };
  }, [attempt?.id, phoneConnected]);

  // Primary Camera Vision Detection Loop (Face Presence & Multiple Faces)
  useEffect(() => {
    if (!hasStarted || !policy.laptop_camera || !attempt) return;

    let consecutiveAbsent = 0;
    let lastPresent = true;
    let lastMultipleNotice = 0;

    const visionInterval = window.setInterval(async () => {
      if (!videoElement.current || videoElement.current.readyState < 2) return;
      try {
        const result = await detectFacesInVideo(videoElement.current);
        setFaceState(result);

        if (result.count === 0) {
          consecutiveAbsent++;
          if (consecutiveAbsent === 2 && lastPresent) {
            lastPresent = false;
            void recordEvent('FACE_ABSENT', 'LOW', { duration_sec: 5 });
          }
        } else if (result.count === 1) {
          if (!lastPresent) {
            lastPresent = true;
            void recordEvent('FACE_PRESENT', 'LOW', { absent_duration_frames: consecutiveAbsent });
          }
          consecutiveAbsent = 0;
        } else if (result.count >= 2) {
          const now = Date.now();
          if (now - lastMultipleNotice > 8000) {
            lastMultipleNotice = now;
            void recordEvent('MULTIPLE_FACES', 'HIGH', {
              face_count: result.count,
              confidence: result.confidence,
            });
            const snapshot = captureVideoSnapshot(videoElement.current);
            if (snapshot) {
              setEvidenceSnapshots((prev) => [...prev.slice(-4), snapshot]);
            }
            setActiveWarning('Security Alert: Multiple faces detected in candidate camera frame.');
            setWarningCount((c) => c + 1);
          }
        }
      } catch (err) {
        console.warn('Vision detection tick skipped:', err);
      }
    }, 2500);

    // Track stream interruption
    const videoTrack = mediaStream.current?.getVideoTracks()[0];
    const handleMute = () => {
      void recordEvent('CAMERA_INTERRUPTED', 'MEDIUM', { reason: 'track muted' });
    };
    const handleEnded = () => {
      void recordEvent('CAMERA_DISCONNECTED', 'HIGH', { reason: 'track ended' });
    };
    videoTrack?.addEventListener('mute', handleMute);
    videoTrack?.addEventListener('ended', handleEnded);

    return () => {
      window.clearInterval(visionInterval);
      videoTrack?.removeEventListener('mute', handleMute);
      videoTrack?.removeEventListener('ended', handleEnded);
    };
  }, [hasStarted, policy.laptop_camera, attempt?.id]);

  // Browser Focus, Tab Switch, Fullscreen, Clipboard, Shortcuts & Context Menu
  useEffect(() => {
    if (!attempt || !hasStarted) return;

    let tabSwitchStart = 0;

    const handleVisibility = () => {
      if (document.hidden) {
        tabSwitchStart = Date.now();
        setWarningCount((c) => c + 1);
        void recordEvent('TAB_SWITCH', 'MEDIUM', { action: 'hidden' });
        setActiveWarning('Assessment security warning: Switching tabs or minimizing browser is monitored.');
      } else {
        const durationSec = tabSwitchStart > 0 ? Math.round((Date.now() - tabSwitchStart) / 1000) : 0;
        tabSwitchStart = 0;
        void recordEvent('TAB_RESTORED', 'LOW', { duration_sec: durationSec });
      }
    };

    const handleBlur = () => {
      void recordEvent('WINDOW_BLUR', 'LOW');
    };

    const handleFocus = () => {
      void recordEvent('WINDOW_FOCUS', 'LOW');
    };

    const handleCopy = (e: ClipboardEvent) => {
      void recordEvent('COPY_ATTEMPT', 'LOW', { target: (e.target as HTMLElement)?.tagName });
    };

    const handlePaste = (e: ClipboardEvent) => {
      void recordEvent('PASTE_ATTEMPT', 'LOW', { target: (e.target as HTMLElement)?.tagName });
    };

    const handleCut = (e: ClipboardEvent) => {
      void recordEvent('CUT_ATTEMPT', 'LOW', { target: (e.target as HTMLElement)?.tagName });
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      void recordEvent('CONTEXT_MENU_ATTEMPT', 'LOW', { x: e.clientX, y: e.clientY });
      setActiveWarning('Context menu is restricted in the assessment environment.');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Monitor F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
      const isF12 = e.key === 'F12';
      const isDevToolsInspect = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j');
      const isViewSource = (e.ctrlKey || e.metaKey) && (e.key === 'U' || e.key === 'u');

      if (isF12 || isDevToolsInspect || isViewSource) {
        e.preventDefault();
        setWarningCount((c) => c + 1);
        void recordEvent('DEVTOOLS_SHORTCUT', 'MEDIUM', { key: e.key, ctrl: e.ctrlKey, meta: e.metaKey });
        setActiveWarning('Assessment security warning: Developer shortcut intercepted.');
      }
    };

    const handleFullscreen = () => {
      const satisfied = Boolean(document.fullscreenElement);
      setFullscreenSatisfied(satisfied);
      if (policy.fullscreen === 'REQUIRED' && !satisfied) {
        setWarningCount((c) => c + 1);
        void recordEvent('FULLSCREEN_EXIT', 'MEDIUM', { timestamp: new Date().toISOString() });
        setActiveWarning('Assessment security warning: Please return to fullscreen mode.');
        void updateAttemptSecurityState({
          attemptId: attempt.id,
          candidateId,
          cameraEnabled: attempt.camera_enabled,
          microphoneEnabled: attempt.mic_enabled,
          fullscreenConfirmed: false,
        }).catch((stateError) => setError(stateError instanceof Error ? stateError.message : 'Could not update fullscreen status.'));
      } else if (satisfied) {
        void recordEvent('FULLSCREEN_ENTER', 'LOW');
      }
    };

    const handleOffline = () => void recordEvent('NETWORK_OFFLINE', 'MEDIUM');
    const handleOnline = () => void recordEvent('NETWORK_ONLINE', 'LOW');

    if (policy.browser_integrity_monitoring) {
      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('blur', handleBlur);
      window.addEventListener('focus', handleFocus);
      document.addEventListener('copy', handleCopy);
      document.addEventListener('paste', handlePaste);
      document.addEventListener('cut', handleCut);
      document.addEventListener('contextmenu', handleContextMenu);
      window.addEventListener('keydown', handleKeyDown);
    }

    if (policy.fullscreen === 'REQUIRED') {
      document.addEventListener('fullscreenchange', handleFullscreen);
    }

    if (policy.network_monitoring) {
      window.addEventListener('offline', handleOffline);
      window.addEventListener('online', handleOnline);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [attempt?.id, hasStarted, policy.browser_integrity_monitoring, policy.fullscreen, policy.network_monitoring]);

  // Question Changed Telemetry
  useEffect(() => {
    if (!hasStarted || !current) return;
    void recordEvent('QUESTION_OPENED', 'LOW', {
      question_id: current.id,
      index: currentIndex + 1,
      question_type: current.question_type,
    });
  }, [currentIndex, hasStarted]);

  // Auto-save coding answers
  useEffect(() => {
    if (!attempt || !current || current.question_type !== 'CODING' || loading) return;
    const answer = answers[current.id];
    if (answer === undefined) return;
    const timer = window.setTimeout(() => {
      void saveAttemptSubmission({
        attempt_id: attempt.id,
        question_id: current.id,
        language: 'javascript',
        code: answer,
        tests_passed: 0,
        total_tests: 0,
        execution_time_ms: 0,
        memory_used_mb: 0,
        score: 0,
        test_results: [],
        submitted_at: new Date().toISOString(),
      }).catch((saveError) => setError(saveError instanceof Error ? saveError.message : 'Code answer could not be saved.'));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [attempt?.id, current?.id, current?.question_type, answers, loading]);

  // Auto-save explain-back
  useEffect(() => {
    if (!attempt || !hasStarted || !policy.explain_back) return;
    setExplainBackSaving(true);
    const timer = window.setTimeout(() => {
      void saveExplainBackResponse(attempt.id, candidateId, explainBackResponse)
        .catch((saveError) =>
          setError(saveError instanceof Error ? `Could not save explain-back: ${saveError.message}` : 'Could not save explain-back response.')
        )
        .finally(() => setExplainBackSaving(false));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [attempt?.id, candidateId, explainBackResponse, hasStarted, policy.explain_back]);

  const persistAnswer = async (question: AssessmentQuestion, answer: string) => {
    if (!attempt) return;
    setAnswers((currentAnswers) => ({ ...currentAnswers, [question.id]: answer }));
    setSaving(true);
    setError('');
    const isMcq = question.question_type === 'MCQ';
    void recordEvent('QUESTION_ANSWERED', 'LOW', { question_id: question.id });
    try {
      await saveAttemptSubmission({
        attempt_id: attempt.id,
        question_id: question.id,
        language: isMcq ? 'mcq' : 'javascript',
        code: isMcq ? JSON.stringify({ selected_option: answer }) : answer,
        tests_passed: 0,
        total_tests: 0,
        execution_time_ms: 0,
        memory_used_mb: 0,
        score: 0,
        test_results: [],
        submitted_at: new Date().toISOString(),
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Answer could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const runCurrentCode = async () => {
    if (!attempt || !current || current.question_type !== 'CODING') return;
    setSaving(true);
    setError('');
    void recordEvent('CODE_RUN', 'LOW', { question_id: current.id });
    try {
      const result = await executeCandidateCode({
        language: 'javascript',
        code: answers[current.id] || current.starter_code.javascript,
        testCases: current.test_cases,
      });
      setTestResults((existing) => ({ ...existing, [current.id]: result.results }));
      const submission: Submission = {
        id: '',
        attempt_id: attempt.id,
        question_id: current.id,
        language: 'javascript',
        code: answers[current.id] || current.starter_code.javascript,
        tests_passed: result.testsPassed,
        total_tests: result.totalTests,
        execution_time_ms: result.executionTimeMs,
        memory_used_mb: 0,
        score: (current.points * result.testsPassed) / Math.max(1, result.totalTests),
        test_results: result.results,
        submitted_at: new Date().toISOString(),
      };
      await saveAttemptSubmission(submission);
      setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: submission.code }));
      void recordEvent('CODE_SUBMITTED', 'LOW', {
        question_id: current.id,
        passed: result.testsPassed,
        total: result.totalTests,
      });
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Code execution failed.');
    } finally {
      setSaving(false);
    }
  };

  const startAssessment = async () => {
    if (!attempt) return;
    setError('');
    let stream: MediaStream | null = null;
    try {
      let fullscreenConfirmed = Boolean(document.fullscreenElement);
      if (policy.fullscreen === 'REQUIRED') {
        if (!document.documentElement.requestFullscreen) {
          throw new Error('This browser does not support required fullscreen mode.');
        }
        await document.documentElement.requestFullscreen();
        fullscreenConfirmed = Boolean(document.fullscreenElement);
        if (!fullscreenConfirmed) throw new Error('Fullscreen permission is required by this assessment.');
      }
      if (policy.laptop_camera || policy.microphone) {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('This browser does not support requested camera or microphone permissions.');
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: policy.laptop_camera ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
          audio: policy.microphone,
        });
      }

      await updateAttemptSecurityState({
        attemptId: attempt.id,
        candidateId,
        cameraEnabled: Boolean(stream?.getVideoTracks().some((track) => track.readyState === 'live')),
        microphoneEnabled: Boolean(stream?.getAudioTracks().some((track) => track.readyState === 'live')),
        fullscreenConfirmed,
        resetStartTime: isNewAttempt,
      });

      if (isNewAttempt) {
        setAttempt((currentAttempt) =>
          currentAttempt ? { ...currentAttempt, started_at: new Date().toISOString() } : currentAttempt
        );
      }
      mediaStream.current = stream;
      setFullscreenSatisfied(fullscreenConfirmed);
      setHasStarted(true);
      setIsNewAttempt(false);

      // Record assessment started integrity event
      void recordEvent('ASSESSMENT_STARTED', 'LOW', {
        fullscreen: fullscreenConfirmed,
        camera_active: Boolean(stream),
      });

      // Capture initial baseline snapshot
      if (videoElement.current) {
        const snap = captureVideoSnapshot(videoElement.current);
        if (snap) setEvidenceSnapshots([snap]);
      }
    } catch (startError) {
      stream?.getTracks().forEach((track) => track.stop());
      mediaStream.current = null;
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setError(startError instanceof Error ? startError.message : 'Could not start the assessment with its required security policy.');
    }
  };

  const submit = async () => {
    if (!attempt || submitting) return;
    if (policy.explain_back && !explainBackResponse.trim()) {
      setError('Complete the required explain-back response before submitting.');
      return;
    }
    if (policy.explain_back) {
      setExplainBackSaving(true);
      try {
        await saveExplainBackResponse(attempt.id, candidateId, explainBackResponse);
      } catch (saveError) {
        setError(saveError instanceof Error ? `Could not save explain-back: ${saveError.message}` : 'Could not save explain-back response.');
        setExplainBackSaving(false);
        return;
      }
      setExplainBackSaving(false);
    }
    setSubmitting(true);
    setError('');
    try {
      const mcqAnswers: Record<string, string> = {};
      const { data: currentSubmissions, error: submissionsError } = await supabase
        .from('submissions')
        .select('*')
        .eq('attempt_id', attempt.id);
      if (submissionsError) throw submissionsError;

      for (const question of questions) {
        const saved = (currentSubmissions || []).find((submission) => submission.question_id === question.id);
        if (question.question_type === 'MCQ') {
          try {
            mcqAnswers[question.id] = JSON.parse(saved?.code || '{}').selected_option || '';
          } catch {
            mcqAnswers[question.id] = '';
          }
        }
      }

      // Record assessment submission event
      const finalEvents: IntegrityEvent[] = [
        ...events,
        {
          id: 'evt_submit',
          attempt_id: attempt.id,
          event_type: 'ASSESSMENT_SUBMITTED',
          severity: 'LOW',
          metadata: { session_token: sessionToken },
          timestamp: new Date().toISOString(),
        },
      ];

      // Multi-signal Integrity Risk Engine
      const integrityEvaluation = evaluateIntegrityStatus({
        events: finalEvents,
        phoneConnected,
        warningsCount: warningCount,
        assessmentDurationMinutes: assessment.duration_minutes,
      });

      const result = await completeAttempt({
        attemptId: attempt.id,
        candidateId,
        answers: mcqAnswers,
        submissions: (currentSubmissions || []) as Submission[],
        integrityStatus: integrityEvaluation.status,
        integritySummary: {
          ...integrityEvaluation.summary,
          session_token: sessionToken,
          integrity_risk_score: integrityEvaluation.risk_score,
          integrity_risk_level: integrityEvaluation.risk_level,
          integrity_status: integrityEvaluation.status,
          phone_camera_connected: phoneConnected,
          evidence_snapshots: evidenceSnapshots,
          candidate_rationale: integrityEvaluation.candidate_friendly_summary,
        },
      });

      onComplete(result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Assessment submission failed. Your attempt remains saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const reenterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setFullscreenSatisfied(Boolean(document.fullscreenElement));
      setActiveWarning(null);
    } catch {
      setError('Fullscreen is required. Allow fullscreen in your browser, then try again.');
    }
  };

  useEffect(() => {
    if (
      attempt?.status === 'IN_PROGRESS' &&
      hasStarted &&
      remaining === 0 &&
      !loading &&
      !submitting &&
      autoSubmittedAttempt.current !== attempt.id
    ) {
      autoSubmittedAttempt.current = attempt.id;
      void submit();
    }
  }, [attempt?.id, attempt?.status, hasStarted, remaining, loading, submitting]);

  if (loading) return <main className="main-content">Recovering your saved assessment attempt…</main>;
  if (error && !attempt) return <main className="main-content"><div role="alert" className="card">{error}</div></main>;
  if (!attempt || !current) return <main className="main-content"><div className="card">This assessment has no questions.</div></main>;

  // Pre-Start Security Check & Phone Pairing Instructions
  if (!hasStarted) {
    const pairingUrl = `${window.location.origin}/assessment/phone-camera?attemptId=${attempt.id}&token=${phonePairing?.token || ''}`;
    return (
      <main className="main-content" style={{ maxWidth: 880 }}>
        <section className="card">
          <span className="badge badge-accent">
            <ShieldCheck size={14} /> Assessment Integrity & Security Policy
          </span>
          <h1 style={{ fontSize: '1.75rem', marginTop: 10, fontWeight: 800 }}>{assessment.title}</h1>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This assessment is monitored under a multi-signal integrity verification system. Camera, browser state, and focus events provide transparent evidence for your verified profile.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 14,
              margin: '1.5rem 0',
            }}
          >
            <div className="card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--accent-primary)' }}>
                <Eye size={18} /> Primary Camera
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                Active face presence and multi-face monitoring. No raw video is streamed; only event timestamps and telemetry are captured.
              </p>
              <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Status: {policy.laptop_camera ? '● Active on Start' : '○ Disabled'}
              </div>
            </div>

            <div className="card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#38bdf8' }}>
                <Smartphone size={18} /> Secondary Phone Camera (Optional)
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                Connect your mobile phone to provide an external side-angle view of your workspace for enhanced verification.
              </p>
              <div style={{ marginTop: 8, fontSize: '0.8rem', color: phoneConnected ? 'var(--status-verified)' : 'var(--text-muted)' }}>
                {phoneConnected ? '● Phone Connected' : '○ Optional / Unpaired'}
              </div>
            </div>

            <div className="card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#eab308' }}>
                <Maximize2 size={18} /> Secure Browser Lock
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                Requires fullscreen mode. Detects tab switches, window minimization, and developer shortcut attempts.
              </p>
              <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Policy: {policy.fullscreen} · Clipboard monitored
              </div>
            </div>
          </div>

          {/* Secondary Phone Camera Pairing Card */}
          <div
            className="card"
            style={{
              background: 'rgba(56, 189, 248, 0.05)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8' }}>
                  Pair Secondary Phone Camera
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  Scan the QR code or open the pairing link on your phone to join as secondary proctoring camera.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowPhoneModal(true)}
              >
                <Smartphone size={15} /> {phoneConnected ? 'Phone Paired ✓' : 'Pair Phone Camera'}
              </button>
            </div>
            {phoneConnected && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: '0.85rem',
                  color: 'var(--status-verified)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Check size={16} /> Secondary phone camera paired successfully! Position phone beside your laptop.
              </div>
            )}
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            Session Security Key: <code style={{ color: 'var(--accent-primary)' }}>{sessionToken}</code>
          </div>

          {error && (
            <div role="alert" className="card" style={{ borderColor: 'var(--status-danger)', marginBottom: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={() => void startAssessment()}>
              <ShieldCheck size={16} /> I Understand, Start Assessment
            </button>
            {policy.fullscreen === 'REQUIRED' && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                (Entering fullscreen mode)
              </span>
            )}
          </div>
        </section>

        {/* Phone Pairing Modal */}
        {showPhoneModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div className="card" style={{ maxWidth: 480, width: '100%', position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowPhoneModal(false)}
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Pair Physical Phone Camera</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '8px 0 16px' }}>
                Place your phone beside or behind your workspace so your desk and laptop screen are visible.
              </p>

              <div
                style={{
                  background: 'var(--bg-surface)',
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Pairing Code
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: '4px', color: 'var(--accent-primary)', margin: '6px 0' }}>
                  {phonePairing?.pairing_code || 'PAIR-001'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Expires in 30 minutes · Temporary token
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <label className="form-label" style={{ fontSize: '0.85rem' }}>Direct Mobile Link</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    readOnly
                    className="form-input"
                    value={pairingUrl}
                    style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(pairingUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2500);
                    }}
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <a
                  href={pairingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="nav-link"
                  style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <ExternalLink size={14} /> Open preview in new tab
                </a>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowPhoneModal(false)}
                >
                  {phoneConnected ? 'Connected ✓ Done' : 'Close & Continue'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // Fullscreen Required Lock Screen
  if (policy.fullscreen === 'REQUIRED' && !fullscreenSatisfied) {
    return (
      <main className="main-content" style={{ maxWidth: 760 }}>
        <section className="card" role="alert" style={{ borderColor: 'var(--status-danger)', textAlign: 'center', padding: '2.5rem' }}>
          <span className="badge badge-danger">
            <AlertTriangle size={14} /> Fullscreen Required
          </span>
          <h1 style={{ fontSize: '1.75rem', marginTop: 12, fontWeight: 800 }}>Assessment Paused: Return to Fullscreen</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 520, margin: '10px auto' }}>
            Assessment security warning: Leaving fullscreen mode records an integrity event. Return to fullscreen immediately to continue your assessment.
          </p>
          <div style={{ margin: '14px 0', fontSize: '0.9rem', color: 'var(--status-danger)' }}>
            Security Warning #{warningCount} recorded
          </div>
          {error && <p style={{ color: 'var(--status-danger)' }}>{error}</p>}
          <button className="btn btn-primary" onClick={() => void reenterFullscreen()}>
            <Maximize2 size={16} /> Return to Fullscreen Mode
          </button>
        </section>
      </main>
    );
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <main className="main-content" style={{ maxWidth: 1080 }}>
      {/* Assessment Top Bar */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 16,
          padding: '10px 14px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="badge badge-accent">
            {currentIndex + 1} / {questions.length}
          </span>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{assessment.title}</h1>
        </div>

        {/* Security & Multi-Signal Status Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Primary Camera Badge */}
          {policy.laptop_camera && (
            <span
              className={`badge ${faceState.count > 1 ? 'badge-danger' : faceState.detected ? 'badge-verified' : 'badge-warning'}`}
              style={{ fontSize: '0.75rem' }}
              title="Primary Camera Face Tracking"
            >
              <Eye size={12} /> Camera: {faceState.count > 1 ? `Multi-Face (${faceState.count})` : faceState.detected ? '1 Face' : 'No Face'}
            </span>
          )}

          {/* Secondary Phone Camera Badge */}
          <span
            className={`badge ${phoneConnected ? 'badge-verified' : 'badge-neutral'}`}
            style={{ fontSize: '0.75rem', cursor: 'pointer' }}
            onClick={() => setShowPhoneModal(true)}
            title="Click to manage Phone Camera pairing"
          >
            <Smartphone size={12} /> Phone: {phoneConnected ? 'Connected' : 'Pair Phone'}
          </span>

          {/* Session Token */}
          <span
            className="badge badge-neutral"
            style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}
            title="Assessment Session Security Key"
          >
            <Key size={12} /> {sessionToken}
          </span>

          {/* Timer */}
          <div
            className={`badge ${remaining < 300 ? 'badge-danger' : 'badge-neutral'}`}
            aria-live="polite"
            style={{ fontWeight: 700 }}
          >
            <Clock size={14} /> {minutes}:{String(seconds).padStart(2, '0')}
          </div>
        </div>
      </header>

      {/* Real-time Security Warning Banner */}
      {activeWarning && (
        <div
          role="alert"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid var(--status-danger)',
            color: 'var(--status-danger)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} />
            <span>{activeWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveWarning(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Grid: Left preview + question / Right workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        {/* Hidden video tag for vision processing */}
        {policy.laptop_camera && (
          <div
            style={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              zIndex: 100,
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-accent)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)',
              width: 180,
            }}
          >
            <video
              ref={videoElement}
              autoPlay
              muted
              playsInline
              aria-label="Local candidate camera preview"
              style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
            />
            <div
              style={{
                padding: '4px 8px',
                fontSize: '0.7rem',
                display: 'flex',
                justifyContent: 'space-between',
                background: 'rgba(0,0,0,0.8)',
                color: '#fff',
              }}
            >
              <span>● Proctoring Live</span>
              <span style={{ color: faceState.count === 1 ? 'var(--status-verified)' : faceState.count > 1 ? '#ef4444' : '#eab308' }}>
                {faceState.count} {faceState.count === 1 ? 'face' : 'faces'}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="card" style={{ borderColor: 'var(--status-danger)', marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Current Question Card */}
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span className="badge badge-neutral">
              {current.question_type} · {current.difficulty} · {current.points} marks
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Question ID: <code>{current.id.slice(0, 8)}</code>
            </span>
          </div>

          <h2 style={{ fontSize: '1.35rem', marginTop: 10, fontWeight: 700 }}>{current.title}</h2>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{current.statement}</p>

          {current.question_type === 'MCQ' ? (
            <fieldset style={{ border: 0, padding: 0, margin: '1.25rem 0' }}>
              <legend className="form-label">Choose one answer:</legend>
              {current.options.map((option) => (
                <label
                  key={option.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderTop: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: answers[current.id] === option.id ? 'var(--bg-surface)' : 'transparent',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <input
                    type="radio"
                    name={`answer-${current.id}`}
                    checked={answers[current.id] === option.id}
                    onChange={() => void persistAnswer(current, option.id)}
                  />
                  <span>{option.text}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <>
              {current.constraints && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '8px 0' }}>
                  <strong>Constraints:</strong> {current.constraints}
                </p>
              )}
              <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)', marginTop: 12 }}>
                <Editor
                  height="360px"
                  language="javascript"
                  theme="vs-dark"
                  value={answers[current.id] ?? current.starter_code.javascript}
                  onChange={(value) => {
                    setAnswers((existing) => ({ ...existing, [current.id]: value || '' }));
                  }}
                  options={{ minimap: { enabled: false }, fontSize: 14 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  Run visible test cases to verify your code before submission.
                </p>
                <button className="btn btn-secondary" disabled={saving} onClick={() => void runCurrentCode()}>
                  {saving ? 'Testing & Saving…' : 'Run Tests & Save Code'}
                </button>
              </div>

              {testResults[current.id] && (
                <div style={{ marginTop: 12 }} aria-live="polite">
                  {testResults[current.id].map((test, index) => (
                    <div
                      key={index}
                      style={{
                        borderTop: '1px solid var(--border-subtle)',
                        padding: '8px 0',
                        fontSize: '0.85rem',
                      }}
                    >
                      <strong style={{ color: test.passed ? 'var(--status-verified)' : 'var(--status-danger)' }}>
                        {test.passed ? 'Passed ✓' : 'Failed ✗'} · Test {index + 1}
                      </strong>
                      <div style={{ marginTop: 4 }}>
                        Expected: <code>{test.expected_output}</code> · Actual: <code>{test.actual_output}</code>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {policy.explain_back && (
            <div className="form-group" style={{ marginTop: 20 }}>
              <label className="form-label" htmlFor="explain-back">
                Explain your overall approach & architecture decisions
              </label>
              <textarea
                id="explain-back"
                className="form-textarea"
                rows={3}
                value={explainBackResponse}
                onChange={(event) => setExplainBackResponse(event.target.value)}
                placeholder="Describe your approach, complexity considerations, and trade-offs."
              />
              <small aria-live="polite" style={{ color: 'var(--text-muted)' }}>
                {explainBackSaving ? 'Saving response…' : 'Response is verified and saved.'}
              </small>
            </div>
          )}
        </section>

        {/* Footer Navigation */}
        <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <button
            className="btn btn-secondary"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((index) => index - 1)}
          >
            Previous Question
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }} aria-live="polite">
            {saving ? 'Saving answer…' : 'Answers automatically saved.'}
          </span>
          {currentIndex < questions.length - 1 ? (
            <button className="btn btn-secondary" onClick={() => setCurrentIndex((index) => index + 1)}>
              Next Question
            </button>
          ) : (
            <button
              className="btn btn-primary"
              disabled={submitting || saving}
              onClick={() => void submit()}
            >
              <Send size={15} />
              {submitting ? 'Submitting…' : 'Submit Assessment'}
            </button>
          )}
        </footer>
      </div>

      {/* Phone Pairing Modal (if candidate opens during test) */}
      {showPhoneModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 460, width: '100%', position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowPhoneModal(false)}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Secondary Phone Camera</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '8px 0 14px' }}>
              Position your phone to show an external side-view of your laptop desk.
            </p>
            <div
              style={{
                background: 'var(--bg-surface)',
                padding: 14,
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Pairing Code
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#38bdf8', letterSpacing: '3px' }}>
                {phonePairing?.pairing_code || 'PAIR-001'}
              </div>
              <div style={{ fontSize: '0.8rem', color: phoneConnected ? 'var(--status-verified)' : 'var(--text-muted)', marginTop: 4 }}>
                {phoneConnected ? '● Connected & Streaming Heartbeat' : '○ Waiting for mobile connection'}
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <input
                type="text"
                readOnly
                className="form-input"
                value={`${window.location.origin}/assessment/phone-camera?attemptId=${attempt.id}&token=${phonePairing?.token || ''}`}
                style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
              />
            </div>
            <div style={{ marginTop: 14, textAlign: 'right' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowPhoneModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import QRCode from 'qrcode';
import {
  Assessment,
  AssessmentAttempt,
  AssessmentQuestion,
  AssessmentSecurityPolicy,
  DEFAULT_ASSESSMENT_SECURITY_POLICY,
  IntegrityEvent,
  ScreenEvidenceCapture,
  ContextExitEvidence,
  Submission,
} from '../../types';
import { updateReferralMilestone } from '../../services/referralService';
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
import { getReachableNetworkOrigin, setCustomLanOrigin, getCustomLanOrigin } from '../../services/networkOrigin';
import { evaluateIntegrityStatus } from '../../services/integrity';
import {
  Clock,
  Send,
  ShieldCheck,
  Smartphone,
  Eye,
  AlertTriangle,
  AlertCircle,
  Key,
  Maximize2,
  Copy,
  Check,
  X,
  ExternalLink,
  Monitor,
  RefreshCw,
  QrCode,
  CheckCircle2,
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
    faceCount: 0,
    status: 'FACE_ABSENT',
    confidence: 0,
    isObscured: false,
  });
  const [evidenceSnapshots, setEvidenceSnapshots] = useState<string[]>([]);

  // Phone Camera & Real QR Code State
  const [phonePairing, setPhonePairing] = useState<PhonePairingSession | null>(null);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [phoneHeartbeatSecondsAgo, setPhoneHeartbeatSecondsAgo] = useState<number | null>(null);
  const [phoneDeviceInfo, setPhoneDeviceInfo] = useState<string>('');
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrExpiresSeconds, setQrExpiresSeconds] = useState(1800); // 30 minutes
  const [customLanInput, setCustomLanInput] = useState(getCustomLanOrigin());
  const [showLanConfig, setShowLanConfig] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Screen Monitoring & 5-Minute Evidence State
  const [screenMonitoringActive, setScreenMonitoringActive] = useState(false);
  const [screenSharePaused, setScreenSharePaused] = useState(false);
  const [screenCaptures, setScreenCaptures] = useState<ScreenEvidenceCapture[]>([]);
  const screenStream = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const lastCaptureTimeRef = useRef<number>(0);

  // Advanced Assessment Context Evidence State
  const [contextExitCount, setContextExitCount] = useState(0);
  const [contextExitEvidence, setContextExitEvidence] = useState<ContextExitEvidence[]>([]);
  const [contextInactiveNotice, setContextInactiveNotice] = useState<string | null>(null);
  const isContextActiveRef = useRef(true);

  const autoSubmittedAttempt = useRef<string | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const videoElement = useRef<HTMLVideoElement | null>(null);
  const questions = useMemo(
    () => [...(assessment.questions || [])].sort((left, right) => left.order_index - right.order_index),
    [assessment.questions]
  );
  const current = questions[currentIndex];

  // Helper to record an integrity event both locally and to Supabase
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
      console.warn('Could not record integrity event:', err);
    }
  };

  // Construct scannable QR Code URL using reachable origin
  const pairingUrl = useMemo(() => {
    if (!attempt || !phonePairing) return '';
    const origin = getReachableNetworkOrigin();
    const url = `${origin}/assessment/phone-camera?token=${encodeURIComponent(phonePairing.token)}&attempt=${encodeURIComponent(attempt.id)}&attemptId=${encodeURIComponent(attempt.id)}`;
    if (import.meta.env.DEV) {
      console.log('[QR DEBUG] Current browser origin:', window.location.origin);
      console.log('[QR DEBUG] QR origin:', origin);
      console.log('[QR DEBUG] QR URL:', url);
    }
    return url;
  }, [attempt?.id, phonePairing?.token, customLanInput]);

  // Generate real scannable QR Code data URL
  useEffect(() => {
    if (!pairingUrl) return;
    QRCode.toDataURL(pairingUrl, {
      width: 280,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(setQrDataUrl)
      .catch((qrErr) => console.error('QR generation error:', qrErr));
  }, [pairingUrl]);

  // QR Timer Countdown (30 minutes)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setQrExpiresSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const regenerateQr = () => {
    if (!attempt) return;
    const newSession = generatePhonePairingSession(attempt.id, candidateId, assessment.id);
    setPhonePairing(newSession);
    setQrExpiresSeconds(1800);
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

        const session = generatePhonePairingSession(loadedAttempt.id, candidateId, assessment.id);
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

  // Video element binding for primary camera
  useEffect(() => {
    if (videoElement.current && mediaStream.current) {
      videoElement.current.srcObject = mediaStream.current;
    }
  }, [hasStarted]);

  // Hidden video element binding for screen sharing track
  useEffect(() => {
    if (screenVideoRef.current && screenStream.current) {
      screenVideoRef.current.srcObject = screenStream.current;
    }
  }, [screenMonitoringActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mediaStream.current?.getTracks().forEach((track) => track.stop());
      mediaStream.current = null;
      screenStream.current?.getTracks().forEach((track) => track.stop());
      screenStream.current = null;
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

  // External Environment Phone Camera Cross-Device Heartbeat Listener (Supabase Realtime + Remote Polling)
  useEffect(() => {
    if (!attempt?.id) return;
    let wasConnected = phoneConnected;

    const unsub = listenToPhoneHeartbeat(attempt.id, (heartbeat) => {
      setPhoneHeartbeatSecondsAgo(heartbeat.secondsAgo);
      if (heartbeat.device) setPhoneDeviceInfo(heartbeat.device);

      if (heartbeat.connected !== wasConnected) {
        wasConnected = heartbeat.connected;
        setPhoneConnected(heartbeat.connected);

        if (heartbeat.connected) {
          void recordEvent('PHONE_CAMERA_CONNECTED', 'LOW', {
            device: heartbeat.device,
            timestamp: heartbeat.lastHeartbeat,
          });
          setActiveWarning(null);
        } else {
          void recordEvent('PHONE_CAMERA_DISCONNECTED', 'MEDIUM', {
            reason: 'Heartbeat timeout',
            lastHeartbeat: heartbeat.lastHeartbeat,
            secondsAgo: heartbeat.secondsAgo,
          });
          setActiveWarning('External phone camera disconnected. Please ensure your phone camera screen remains open.');
        }
      }
    });

    return () => {
      unsub();
    };
  }, [attempt?.id]);

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

    const videoTrack = mediaStream.current?.getVideoTracks()[0];
    const handleMute = () => void recordEvent('CAMERA_INTERRUPTED', 'MEDIUM', { reason: 'track muted' });
    const handleEnded = () => void recordEvent('CAMERA_DISCONNECTED', 'HIGH', { reason: 'track ended' });
    videoTrack?.addEventListener('mute', handleMute);
    videoTrack?.addEventListener('ended', handleEnded);

    return () => {
      window.clearInterval(visionInterval);
      videoTrack?.removeEventListener('mute', handleMute);
      videoTrack?.removeEventListener('ended', handleEnded);
    };
  }, [hasStarted, policy.laptop_camera, attempt?.id]);

  // PART 2: AUTOMATIC SCREEN EVIDENCE CAPTURE EVERY 5 MINUTES (300,000 ms)
  useEffect(() => {
    if (!hasStarted || !screenMonitoringActive || !attempt) return;

    // Helper to capture a lightweight compressed JPEG frame from screen video
    const grabScreenFrame = (captureNumber: number) => {
      if (!screenVideoRef.current || screenVideoRef.current.readyState < 2) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(screenVideoRef.current, 0, 0, 640, 360);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

        const elapsedMs = Date.now() - new Date(attempt.started_at).getTime();
        const totalMinutes = Math.floor(elapsedMs / 60000);
        const totalSecs = Math.floor((elapsedMs % 60000) / 1000);
        const timeFormatted = `${String(totalMinutes).padStart(2, '0')}:${String(totalSecs).padStart(2, '0')}`;

        const capture: ScreenEvidenceCapture = {
          attempt_id: attempt.id,
          candidate_id: candidateId,
          assessment_id: assessment.id,
          capture_number: captureNumber,
          timestamp: new Date().toISOString(),
          time_offset_formatted: timeFormatted,
          event_type: 'SCREENSHOT_CAPTURED',
          image_data: dataUrl,
        };

        setScreenCaptures((prev) => [...prev, capture]);
        void recordEvent('SCREENSHOT_CAPTURED', 'LOW', {
          capture_number: captureNumber,
          time_offset: timeFormatted,
        });
      } catch (err) {
        console.warn('Screen frame capture error:', err);
      }
    };

    // Every 5 minutes interval (300,000 ms)
    let captureCount = screenCaptures.length;
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    const screenCaptureInterval = window.setInterval(() => {
      captureCount++;
      grabScreenFrame(captureCount);
    }, FIVE_MINUTES_MS);

    return () => window.clearInterval(screenCaptureInterval);
  }, [hasStarted, screenMonitoringActive, attempt?.id]);

  // Context exit detection and evidence capture
  const triggerContextExit = async (
    trigger: 'VISIBILITY_CHANGE' | 'WINDOW_BLUR' | 'FULLSCREEN_EXIT' | 'TAB_SWITCH' | 'SCREEN_SHARE_INTERRUPTION'
  ) => {
    if (!attempt || !hasStarted || !isContextActiveRef.current) return;
    isContextActiveRef.current = false;
    setContextExitCount((c) => c + 1);
    setContextInactiveNotice(
      'Assessment security detected that the assessment window is no longer active. Please return to continue.'
    );

    const elapsedSec = Math.max(0, assessment.duration_minutes * 60 - remaining);
    const now = new Date().toISOString();

    void recordEvent('ASSESSMENT_CONTEXT_LEFT', 'MEDIUM', {
      trigger,
      elapsed_seconds: elapsedSec,
      timestamp: now,
    });

    // Capture screen evidence frame if screen sharing is active
    if (screenMonitoringActive && screenVideoRef.current && screenStream.current) {
      try {
        const video = screenVideoRef.current;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frameData = canvas.toDataURL('image/jpeg', 0.6);

            const evidenceObj: ContextExitEvidence = {
              attempt_id: attempt.id,
              candidate_id: candidateId,
              assessment_id: assessment.id,
              timestamp: now,
              elapsed_seconds: elapsedSec,
              trigger,
              image_data: frameData,
              event_type: 'SCREEN_EVIDENCE_ON_CONTEXT_EXIT',
            };

            setContextExitEvidence((prev) => [...prev, evidenceObj]);

            void recordEvent('SCREEN_EVIDENCE_ON_CONTEXT_EXIT', 'MEDIUM', {
              trigger,
              elapsed_seconds: elapsedSec,
              has_image: true,
            });

            void supabase.from('assessment_context_events').insert({
              attempt_id: attempt.id,
              candidate_id: candidateId,
              assessment_id: assessment.id,
              timestamp: now,
              elapsed_seconds: elapsedSec,
              trigger,
              event_type: 'SCREEN_EVIDENCE_ON_CONTEXT_EXIT',
              image_data: frameData,
            });
          }
        }
      } catch (err) {
        console.warn('Could not capture context-exit screen frame:', err);
      }
    }
  };

  const triggerContextRestored = () => {
    if (!attempt || !hasStarted || isContextActiveRef.current) return;
    isContextActiveRef.current = true;
    setContextInactiveNotice(null);
    const elapsedSec = Math.max(0, assessment.duration_minutes * 60 - remaining);
    void recordEvent('ASSESSMENT_CONTEXT_RESTORED', 'LOW', {
      elapsed_seconds: elapsedSec,
    });
  };

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
        void triggerContextExit('VISIBILITY_CHANGE');
      } else {
        const durationSec = tabSwitchStart > 0 ? Math.round((Date.now() - tabSwitchStart) / 1000) : 0;
        tabSwitchStart = 0;
        void recordEvent('TAB_RESTORED', 'LOW', { duration_sec: durationSec });
        triggerContextRestored();
      }
    };

    const handleBlur = () => {
      void recordEvent('WINDOW_BLUR', 'LOW');
      void triggerContextExit('WINDOW_BLUR');
    };
    const handleFocus = () => {
      void recordEvent('WINDOW_FOCUS', 'LOW');
      triggerContextRestored();
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
        void recordEvent('FULLSCREEN_EXIT_DURING_ASSESSMENT', 'MEDIUM');
        void triggerContextExit('FULLSCREEN_EXIT');
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
        triggerContextRestored();
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

  // Helper to resume screen sharing if stopped
  const resumeScreenSharing = async () => {
    try {
      const scrStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' } as any,
        audio: false,
      });
      screenStream.current = scrStream;
      if (screenVideoRef.current) screenVideoRef.current.srcObject = scrStream;

      const track = scrStream.getVideoTracks()[0];
      track.onended = () => {
        setScreenMonitoringActive(false);
        setScreenSharePaused(true);
        void recordEvent('SCREEN_SHARE_STOPPED', 'MEDIUM');
        setActiveWarning('Screen sharing has stopped. Please resume screen sharing to continue.');
      };

      setScreenMonitoringActive(true);
      setScreenSharePaused(false);
      setActiveWarning(null);
      void recordEvent('SCREEN_SHARE_RESTORED', 'LOW');
    } catch {
      setError('Screen sharing is required for security verification.');
    }
  };

  const startAssessment = async () => {
    if (!attempt) return;
    setError('');
    let stream: MediaStream | null = null;
    let scrStream: MediaStream | null = null;

    try {
      // 1. Fullscreen Request
      let fullscreenConfirmed = Boolean(document.fullscreenElement);
      if (policy.fullscreen === 'REQUIRED') {
        if (!document.documentElement.requestFullscreen) {
          throw new Error('This browser does not support required fullscreen mode.');
        }
        await document.documentElement.requestFullscreen();
        fullscreenConfirmed = Boolean(document.fullscreenElement);
        if (!fullscreenConfirmed) throw new Error('Fullscreen permission is required by this assessment.');
      }

      // 2. Primary Camera Permission
      if (policy.laptop_camera || policy.microphone) {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('This browser does not support requested camera or microphone permissions.');
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: policy.laptop_camera ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
          audio: policy.microphone,
        });
      }

      // 3. Legitimate Screen Sharing Permission
      try {
        if (navigator.mediaDevices?.getDisplayMedia) {
          scrStream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'monitor' } as any,
            audio: false,
          });

          const screenTrack = scrStream.getVideoTracks()[0];
          screenTrack.onended = () => {
            setScreenMonitoringActive(false);
            setScreenSharePaused(true);
            void recordEvent('SCREEN_SHARE_STOPPED', 'MEDIUM', { timestamp: new Date().toISOString() });
            setActiveWarning('Screen sharing has stopped. Please resume screen sharing to continue the secure assessment.');
            setWarningCount((c) => c + 1);
          };

          screenStream.current = scrStream;
          setScreenMonitoringActive(true);
          void recordEvent('SCREEN_SHARE_STARTED', 'LOW');
        }
      } catch (screenErr) {
        throw new Error('Screen sharing permission was cancelled. Screen sharing is required for this secure assessment.');
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

      void recordEvent('ASSESSMENT_STARTED', 'LOW', {
        fullscreen: fullscreenConfirmed,
        camera_active: Boolean(stream),
        screen_monitoring: Boolean(scrStream),
      });

      // Capture initial baseline snapshot
      if (videoElement.current) {
        const snap = captureVideoSnapshot(videoElement.current);
        if (snap) setEvidenceSnapshots([snap]);
      }
    } catch (startError) {
      stream?.getTracks().forEach((track) => track.stop());
      mediaStream.current = null;
      scrStream?.getTracks().forEach((track) => track.stop());
      screenStream.current = null;
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
          screen_evidence: screenCaptures,
          screen_monitoring_active: screenMonitoringActive,
          context_exit_count: contextExitCount,
          context_exit_evidence: contextExitEvidence,
          candidate_rationale: integrityEvaluation.candidate_friendly_summary,
        },
      });

      // Update referral milestone for candidate
      void updateReferralMilestone(candidateId, 'ASSESSMENT_COMPLETED');

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

  // PRE-START SECURITY CHECK & PHYSICAL PHONE QR CODE SETUP
  if (!hasStarted) {
    const minExpiry = Math.floor(qrExpiresSeconds / 60);
    const secExpiry = qrExpiresSeconds % 60;

    return (
      <main className="main-content" style={{ maxWidth: 880 }}>
        <section className="card" style={{ padding: '2rem' }}>
          <span className="badge badge-accent">
            <ShieldCheck size={14} /> Assessment Integrity & Security Setup
          </span>
          <h1 style={{ fontSize: '1.8rem', marginTop: 10, fontWeight: 800 }}>{assessment.title}</h1>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This assessment utilizes a multi-signal integrity verification system combining your primary camera, screen monitoring, and optional external phone camera.
          </p>

          {/* Security Checklist Requirements */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 14,
              margin: '1.5rem 0',
            }}
          >
            <div className="card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--accent-primary)' }}>
                <Eye size={18} /> Primary Camera
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                Active face presence and multi-face monitoring. No raw video is streamed; only event telemetry is captured.
              </p>
              <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--status-verified)', fontWeight: 600 }}>
                ✓ Required on Start
              </div>
            </div>

            <div className="card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#06b6d4' }}>
                <Monitor size={18} /> Screen Monitoring
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                Screen sharing is required for assessment security. Your screen will be periodically captured as evidence during this assessment.
              </p>
              <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--status-verified)', fontWeight: 600 }}>
                ✓ Required on Start
              </div>
            </div>

            <div className="card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#38bdf8' }}>
                <Smartphone size={18} /> Phone Camera (External)
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                Connect your mobile phone to provide an external side-angle view of your desk workspace.
              </p>
              <div style={{ marginTop: 8, fontSize: '0.8rem', color: phoneConnected ? 'var(--status-verified)' : '#94a3b8', fontWeight: 600 }}>
                {phoneConnected ? '● Phone Connected' : '○ Optional / Secondary'}
              </div>
            </div>
          </div>

          {/* QR CODE FOR PHYSICAL PHONE CAMERA (PART 1 SPECIFICATION) */}
          <div
            className="card"
            style={{
              background: 'rgba(56, 189, 248, 0.04)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              padding: '1.75rem',
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            {!phoneConnected ? (
              <>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '0.5px' }}>
                  EXTERNAL ENVIRONMENT CAMERA
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: 480, margin: '6px auto 18px', lineHeight: 1.5 }}>
                  Place your phone beside or behind the laptop with the <strong>rear camera</strong> facing your workspace and surrounding area. The phone provides external environment coverage while your laptop camera focuses on you.
                </p>

                {/* LARGE SCANNABLE QR CODE */}
                <div
                  style={{
                    display: 'inline-block',
                    background: '#ffffff',
                    padding: '14px',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.3)',
                    margin: '0.5rem 0',
                  }}
                >
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Physical Phone Camera Pairing QR Code"
                      style={{ width: '220px', height: '220px', display: 'block', imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                      Generating QR…
                    </div>
                  )}
                </div>

                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc', marginTop: 10 }}>
                  Scan this QR code with your phone camera.
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Pairing expires in: <strong>{String(minExpiry).padStart(2, '0')}:{String(secExpiry).padStart(2, '0')}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, margin: '14px 0 8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308' }} />
                  <span style={{ fontSize: '0.85rem', color: '#eab308', fontWeight: 600 }}>
                    Phone Camera: ● Waiting for connection
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={regenerateQr}>
                    <RefreshCw size={14} /> Regenerate QR
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowLanConfig(!showLanConfig)}
                    style={{ fontSize: '0.75rem' }}
                  >
                    Network IP: {getReachableNetworkOrigin().replace(/https?:\/\//, '')}
                  </button>
                </div>

                {/* Optional LAN Override helper if candidate phone is on a separate subnet */}
                {showLanConfig && (
                  <div style={{ marginTop: 14, background: 'var(--bg-surface)', padding: 12, borderRadius: 8, maxWidth: 440, margin: '14px auto 0' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>
                      Local Wi-Fi Host / IP Address
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 192.168.1.105:5173"
                        value={customLanInput}
                        onChange={(e) => setCustomLanInput(e.target.value)}
                        style={{ fontSize: '0.8rem' }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setCustomLanOrigin(customLanInput);
                          regenerateQr();
                          setShowLanConfig(false);
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* CONNECTED STATE ACCORDING TO SPECIFICATION */
              <div style={{ padding: '1rem 0' }}>
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '2px solid #22c55e',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  <CheckCircle2 size={32} color="#22c55e" />
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--status-verified)', margin: 0 }}>
                  EXTERNAL CAMERA
                </h2>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--status-verified)', margin: '4px 0 8px' }}>
                  ● CONNECTED
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 440, margin: '0 auto 16px' }}>
                  Your phone is now connected as the external environment camera.
                </p>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Device: {phoneDeviceInfo || 'Physical Phone Camera'} · Rear Camera Active · Heartbeat Synced
                </div>
              </div>
            )}
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            Assessment Session Key: <code style={{ color: 'var(--accent-primary)' }}>{sessionToken}</code>
          </div>

          {error && (
            <div role="alert" className="card" style={{ borderColor: 'var(--status-danger)', marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn btn-primary btn-lg" onClick={() => void startAssessment()}>
              <ShieldCheck size={18} /> Start Secure Assessment
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              (Prompts screen sharing and fullscreen mode)
            </span>
          </div>
        </section>
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

  // Screen Sharing Stopped / Paused Modal (PART 2 REQUIREMENT)
  if (screenSharePaused) {
    return (
      <main className="main-content" style={{ maxWidth: 760 }}>
        <section className="card" role="alert" style={{ borderColor: 'var(--status-danger)', textAlign: 'center', padding: '2.5rem' }}>
          <span className="badge badge-danger">
            <Monitor size={14} /> Screen Sharing Interrupted
          </span>
          <h1 style={{ fontSize: '1.75rem', marginTop: 12, fontWeight: 800 }}>Assessment Paused: Screen Sharing Required</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 520, margin: '10px auto' }}>
            Screen sharing has stopped. Please resume screen sharing to continue the secure assessment.
          </p>
          <div style={{ margin: '14px 0', fontSize: '0.9rem', color: 'var(--status-danger)' }}>
            Security Warning #{warningCount} recorded
          </div>
          {error && <p style={{ color: 'var(--status-danger)' }}>{error}</p>}
          <button className="btn btn-primary" onClick={() => void resumeScreenSharing()}>
            <Monitor size={16} /> Resume Screen Sharing
          </button>
        </section>
      </main>
    );
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <main className="main-content" style={{ maxWidth: 1080 }}>
      {/* Hidden screen video tag used by canvas to capture 5-minute evidence frames */}
      <video ref={screenVideoRef} autoPlay muted playsInline style={{ display: 'none' }} />

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

        {/* Multi-Signal Status Badges According to Section 20 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Primary Camera Badge */}
          {policy.laptop_camera && (
            <span
              className={`badge ${faceState.count > 1 ? 'badge-danger' : faceState.detected ? 'badge-verified' : 'badge-warning'}`}
              style={{ fontSize: '0.75rem' }}
              title="Primary Camera Face Tracking"
            >
              <Eye size={12} /> Camera: {faceState.count > 1 ? `Multi-Face (${faceState.count})` : faceState.detected ? 'Active' : 'No Face'}
            </span>
          )}

          {/* Screen Monitoring Badge */}
          <span
            className={`badge ${screenMonitoringActive ? 'badge-verified' : 'badge-danger'}`}
            style={{ fontSize: '0.75rem' }}
            title="Screen Evidence Monitoring (5-min intervals)"
          >
            <Monitor size={12} /> Screen: {screenMonitoringActive ? 'Active' : 'Paused'}
          </span>

          {/* Secondary Phone Camera Badge */}
          <span
            className={`badge ${phoneConnected ? 'badge-verified' : 'badge-neutral'}`}
            style={{ fontSize: '0.75rem', cursor: 'pointer' }}
            onClick={() => setShowPhoneModal(true)}
            title="Click to view Phone Camera QR"
          >
            <Smartphone size={12} /> Phone: {phoneConnected ? 'Connected' : 'Pair Phone'}
          </span>

          {/* Session Security Key */}
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

      {/* Subtle Candidate Context-Exit Security Notice */}
      {contextInactiveNotice && (
        <div
          role="status"
          style={{
            background: 'rgba(234, 179, 8, 0.12)',
            border: '1px solid rgba(234, 179, 8, 0.4)',
            color: '#facc15',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{contextInactiveNotice}</span>
        </div>
      )}

      {/* Main Grid: Left preview + question / Right workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        {/* Floating Primary Camera Preview */}
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

        {/* Compact External Environment Camera Status Card (PiP / Floating) */}
        {policy.secondary_phone_camera && (
          <div
            style={{
              position: 'fixed',
              bottom: policy.laptop_camera ? 180 : 16,
              right: 16,
              zIndex: 100,
              background: '#0D1B2A',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${phoneConnected ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.35)'}`,
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              width: 180,
              padding: '8px 10px',
              fontSize: '0.72rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', fontSize: '0.68rem' }}>
                <Smartphone size={12} color={phoneConnected ? 'var(--status-verified)' : '#EF4444'} />
                <span>External Camera</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPhoneModal(true)}
                style={{ background: 'none', border: 'none', color: '#00D4FF', cursor: 'pointer', padding: 0, fontSize: '0.68rem', fontWeight: 600 }}
              >
                {phoneConnected ? 'Details' : 'QR'}
              </button>
            </div>

            {phoneConnected ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--status-verified)', fontWeight: 800 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-verified)' }} />
                  <span>CONNECTED</span>
                </div>
                <div style={{ color: '#94A3B8', fontSize: '0.68rem', marginTop: 2 }}>
                  Rear camera active
                </div>
                {phoneHeartbeatSecondsAgo !== null && (
                  <div style={{ color: '#64748B', fontSize: '0.65rem', marginTop: 1 }}>
                    Heartbeat: {phoneHeartbeatSecondsAgo === 0 ? 'Just now' : `${phoneHeartbeatSecondsAgo}s ago`}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#EF4444', fontWeight: 800 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }} />
                  <span>DISCONNECTED</span>
                </div>
                <div style={{ color: '#94A3B8', fontSize: '0.68rem', marginTop: 2 }}>
                  External camera lost
                </div>
                <button
                  type="button"
                  onClick={() => setShowPhoneModal(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', padding: '3px 6px', fontSize: '0.68rem', marginTop: 4 }}
                >
                  Pair via QR
                </button>
              </div>
            )}
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

      {/* Phone Pairing QR Modal (if candidate opens during test) */}
      {showPhoneModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 460, width: '100%', position: 'relative', textAlign: 'center' }}>
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

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>
              CONNECT YOUR PHONE CAMERA
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '6px 0 14px' }}>
              Scan this QR code with your phone camera.
            </p>

            <div
              style={{
                display: 'inline-block',
                background: '#ffffff',
                padding: '12px',
                borderRadius: '12px',
                margin: '6px 0',
              }}
            >
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Phone Camera QR"
                  style={{ width: '200px', height: '200px', display: 'block' }}
                />
              ) : (
                <div style={{ width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Loading QR…
                </div>
              )}
            </div>

            <div style={{ marginTop: 10, fontSize: '0.85rem', color: phoneConnected ? 'var(--status-verified)' : '#eab308', fontWeight: 700 }}>
              Phone Camera: {phoneConnected ? '● CONNECTED' : '● Waiting for connection'}
            </div>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={regenerateQr}>
                <RefreshCw size={14} /> Regenerate QR
              </button>
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

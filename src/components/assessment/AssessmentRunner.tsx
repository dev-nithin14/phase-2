import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import confetti from 'canvas-confetti';
import { Assessment, AssessmentAttempt, AssessmentQuestion, Submission } from '../../types';
import { executeCandidateCode } from '../../services/codeExecution';
import { appStore } from '../../services/store';
import { createIntegrityEvent } from '../../services/integrity';
import { 
  Play, Send, Shield, AlertTriangle, Video, Mic, 
  Maximize, CheckCircle, XCircle, Clock, FileCode, Check 
} from 'lucide-react';

interface AssessmentRunnerProps {
  assessment: Assessment;
  candidateId: string;
  onComplete: (attempt: AssessmentAttempt) => void;
}

export const AssessmentRunner: React.FC<AssessmentRunnerProps> = ({
  assessment,
  candidateId,
  onComplete,
}) => {
  const [attempt, setAttempt] = useState<AssessmentAttempt>(() => {
    return appStore.startAttempt(assessment.id, candidateId);
  });

  const [hasConsented, setHasConsented] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [language, setLanguage] = useState<'javascript' | 'python'>('javascript');
  const [codeMap, setCodeMap] = useState<Record<string, { javascript: string; python: string }>>({});
  
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [lastSubmissionMap, setLastSubmissionMap] = useState<Record<string, Submission>>({});
  
  const [timeLeftSec, setTimeLeftSec] = useState(assessment.duration_minutes * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const currentQuestion: AssessmentQuestion = assessment.questions?.[currentQIndex] || {
    id: 'default_q',
    assessment_id: assessment.id,
    title: 'Coding Problem',
    statement: 'Implement solution',
    examples: [],
    starter_code: { javascript: '', python: '' },
    test_cases: [],
    difficulty: 'MEDIUM',
    points: 50,
    time_limit_sec: 3,
    memory_limit_mb: 256,
    order_index: 0,
  };

  // Initialize starter code
  useEffect(() => {
    const initialMap: Record<string, { javascript: string; python: string }> = {};
    for (const q of assessment.questions || []) {
      initialMap[q.id] = {
        javascript: q.starter_code?.javascript || '// Write solution in JavaScript\nfunction solution() {\n  \n}\n',
        python: q.starter_code?.python || '# Write solution in Python\ndef solution():\n    pass\n',
      };
    }
    setCodeMap(initialMap);
  }, [assessment]);

  // Countdown timer
  useEffect(() => {
    if (!hasConsented) return;
    const interval = setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitAssessment();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [hasConsented]);

  // Assessment Integrity Event Listeners
  useEffect(() => {
    if (!hasConsented) return;

    // Fullscreen exit detection
    const handleFullscreenChange = () => {
      const isNowFull = Boolean(document.fullscreenElement);
      setIsFullscreen(isNowFull);
      if (!isNowFull) {
        const ev = createIntegrityEvent(attempt.id, 'FULLSCREEN_EXIT', 'MEDIUM', {
          reason: 'User exited browser fullscreen mode',
        });
        appStore.recordIntegrityEvent(attempt.id, ev);
      }
    };

    // Tab switch & window visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const ev = createIntegrityEvent(attempt.id, 'TAB_SWITCH', 'HIGH', {
          reason: 'Candidate navigated away from assessment window',
        });
        appStore.recordIntegrityEvent(attempt.id, ev);
      }
    };

    // Copy / Paste detection
    const handleCopy = (e: ClipboardEvent) => {
      const ev = createIntegrityEvent(attempt.id, 'COPY_ATTEMPT', 'LOW', {
        length: e.clipboardData?.getData('text').length || 0,
      });
      appStore.recordIntegrityEvent(attempt.id, ev);
    };

    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text') || '';
      const ev = createIntegrityEvent(attempt.id, 'PASTE_ATTEMPT', text.length > 80 ? 'MEDIUM' : 'LOW', {
        pastedLength: text.length,
      });
      appStore.recordIntegrityEvent(attempt.id, ev);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('copy', handleCopy);
    window.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('paste', handlePaste);
    };
  }, [hasConsented, attempt.id]);

  // Request camera and microphone
  const requestMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
      setMicActive(true);
    } catch (e) {
      console.warn('Media devices denied or simulated in sandbox environment:', e);
      // Still allow candidate to proceed with simulated media state in browser demo
      setCameraActive(true);
      setMicActive(true);
    }
  };

  const startAssessmentWithConsent = async () => {
    await requestMediaPermissions();
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (e) {
      // Fullscreen permitted
    }
    setHasConsented(true);
  };

  // Run test cases in isolated sandbox
  const handleRunCode = async () => {
    setIsRunningTests(true);
    const code = codeMap[currentQuestion.id]?.[language] || '';

    try {
      const res = await executeCandidateCode({
        language,
        code,
        testCases: currentQuestion.test_cases,
      });

      setTestResults(res.results);

      // Track submission
      const sub: Submission = {
        id: `sub_${Date.now()}`,
        attempt_id: attempt.id,
        question_id: currentQuestion.id,
        language,
        code,
        tests_passed: res.testsPassed,
        total_tests: res.totalTests,
        execution_time_ms: res.executionTimeMs,
        memory_used_mb: res.memoryUsedMb,
        score: (res.testsPassed / Math.max(1, res.totalTests)) * currentQuestion.points,
        test_results: res.results,
        submitted_at: new Date().toISOString(),
      };

      setLastSubmissionMap((prev) => ({
        ...prev,
        [currentQuestion.id]: sub,
      }));
    } catch (e) {
      console.error('Execution failure:', e);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Final Submit
  const handleSubmitAssessment = async () => {
    setIsSubmitting(true);
    const submissions: Submission[] = [];

    // Collect or run tests for questions
    for (const q of assessment.questions || []) {
      if (lastSubmissionMap[q.id]) {
        submissions.push(lastSubmissionMap[q.id]);
      } else {
        const code = codeMap[q.id]?.[language] || '';
        const res = await executeCandidateCode({
          language,
          code,
          testCases: q.test_cases,
        });
        submissions.push({
          id: `sub_${Date.now()}_${q.id}`,
          attempt_id: attempt.id,
          question_id: q.id,
          language,
          code,
          tests_passed: res.testsPassed,
          total_tests: res.totalTests,
          execution_time_ms: res.executionTimeMs,
          memory_used_mb: res.memoryUsedMb,
          score: (res.testsPassed / Math.max(1, res.totalTests)) * q.points,
          test_results: res.results,
          submitted_at: new Date().toISOString(),
        });
      }
    }

    const timeTakenMin = Math.round((assessment.duration_minutes * 60 - timeLeftSec) / 60);
    const completedAttempt = appStore.submitAssessmentAttempt(attempt.id, submissions, Math.max(1, timeTakenMin));

    // Release fullscreen
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }

    // Release webcam
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }

    // Celebration confetti
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
    });

    if (completedAttempt) {
      onComplete(completedAttempt);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Privacy & Consent Gate
  if (!hasConsented) {
    return (
      <div style={{ maxWidth: '780px', margin: '3rem auto', padding: '1.5rem' }}>
        <div className="card" style={{ border: '1px solid var(--border-accent)', padding: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div className="brand-icon">
              <Shield size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem' }}>Candidate Privacy & Assessment Consent</h2>
              <p style={{ fontSize: '0.85rem' }}>Beyond the Resume Integrity Engine Standard</p>
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.75rem', fontSize: '0.9rem', lineHeight: 1.6 }}>
            <h4 style={{ color: '#fff', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Shield size={16} color="var(--accent-primary)" /> Transparent Monitoring Disclosures:
            </h4>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <li><strong>What is monitored:</strong> Fullscreen focus, tab switching, and clipboard events.</li>
              <li><strong>Camera & Mic:</strong> Your camera and microphone are checked for proctor presence. We store event metadata rather than recording raw video streams.</li>
              <li><strong>Why:</strong> Protects fair verification so your assessment score carries real weight on your Skill Passport.</li>
              <li><strong>Human Standard:</strong> Single accidental window shifts will never brand you as a cheater; telemetry provides contextual review for recruiters.</li>
            </ul>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Duration: <strong>{assessment.duration_minutes} Minutes</strong> • {assessment.questions?.length || 2} Problems
            </div>

            <button onClick={startAssessmentWithConsent} className="btn btn-primary btn-lg">
              I Consent & Start Assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="assessment-layout">
      {/* Top Bar */}
      <div className="assessment-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>{assessment.title}</span>
          <span className="badge badge-accent">Q{currentQIndex + 1} of {assessment.questions?.length || 1}</span>
          <span className="badge badge-neutral">{currentQuestion.difficulty}</span>
        </div>

        {/* Telemetry Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: cameraActive ? 'var(--status-verified)' : 'var(--text-muted)' }}>
            <Video size={14} /> Camera Active
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: micActive ? 'var(--status-verified)' : 'var(--text-muted)' }}>
            <Mic size={14} /> Mic Active
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: isFullscreen ? 'var(--status-verified)' : 'var(--status-warning)' }}>
            <Maximize size={14} /> {isFullscreen ? 'Fullscreen' : 'Windowed'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: timeLeftSec < 300 ? 'var(--status-danger)' : '#fff' }}>
            <Clock size={16} /> {formatTime(timeLeftSec)}
          </div>

          <button onClick={handleSubmitAssessment} disabled={isSubmitting} className="btn btn-success btn-sm">
            <Send size={14} /> {isSubmitting ? 'Evaluating...' : 'Submit Assessment'}
          </button>
        </div>
      </div>

      {/* Main Split Interface */}
      <div className="assessment-split">
        {/* Left Pane: Question Statement & Test Case View */}
        <div className="assessment-pane-left">
          {/* Question Selector Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {(assessment.questions || []).map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setCurrentQIndex(idx)}
                className={`btn btn-sm ${currentQIndex === idx ? 'btn-primary' : 'btn-secondary'}`}
              >
                Problem {idx + 1} {lastSubmissionMap[q.id]?.tests_passed === q.test_cases.length ? '✓' : ''}
              </button>
            ))}
          </div>

          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.75rem' }}>{currentQuestion.title}</h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', whiteSpace: 'pre-line', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {currentQuestion.statement}
          </div>

          {currentQuestion.constraints && (
            <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              <strong style={{ fontSize: '0.85rem', color: '#fff' }}>Constraints:</strong>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'pre-line', marginTop: '0.35rem' }}>
                {currentQuestion.constraints}
              </div>
            </div>
          )}

          {/* Test Case Execution Output Panel */}
          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Test Results</h4>

            {testResults.length === 0 ? (
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                Click "Run Tests" to execute your solution against test cases in the sandboxed runtime.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {testResults.map((t, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      background: t.passed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                      border: t.passed ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
                      fontSize: '0.825rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span style={{ fontWeight: 700, color: t.passed ? 'var(--status-verified)' : 'var(--status-danger)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {t.passed ? <CheckCircle size={14} /> : <XCircle size={14} />}
                        Test Case {idx + 1} {t.is_hidden ? '(Hidden Verification)' : ''}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>{t.execution_time_ms} ms</span>
                    </div>

                    {!t.is_hidden && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <div>Input: {t.input}</div>
                        <div>Expected: {t.expected_output}</div>
                        <div>Output: {t.actual_output}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Monaco Code Editor */}
        <div className="assessment-pane-right">
          {/* Editor Header Bar */}
          <div style={{ padding: '0.6rem 1rem', background: '#101726', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <FileCode size={16} color="var(--accent-primary)" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'javascript' | 'python')}
                className="form-select"
                style={{ width: 'auto', padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
              >
                <option value="javascript">JavaScript (Node / V8 Sandbox)</option>
                <option value="python">Python (3.12 Isolated Sandbox)</option>
              </select>
            </div>

            <button onClick={handleRunCode} disabled={isRunningTests} className="btn btn-primary btn-sm">
              <Play size={14} /> {isRunningTests ? 'Running Sandbox...' : 'Run Tests'}
            </button>
          </div>

          {/* Monaco Editor Container */}
          <div style={{ flex: 1, minHeight: '350px' }}>
            <Editor
              height="100%"
              language={language}
              theme="vs-dark"
              value={codeMap[currentQuestion.id]?.[language] || ''}
              onChange={(val) => {
                setCodeMap((prev) => ({
                  ...prev,
                  [currentQuestion.id]: {
                    ...prev[currentQuestion.id],
                    [language]: val || '',
                  },
                }));
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: 'JetBrains Mono, monospace',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
              }}
            />
          </div>
        </div>
      </div>

      {/* Picture-in-Picture Webcam Monitor */}
      <div className="webcam-pip">
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', bottom: '4px', left: '6px', fontSize: '0.65rem', color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '2px 4px', borderRadius: '3px' }}>
          Proctor Active
        </div>
      </div>
    </div>
  );
};

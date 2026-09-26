import React, { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Assessment, AssessmentAttempt, AssessmentQuestion, Submission } from '../../types';
import { completeAttempt, getOrStartAttempt, saveAttemptSubmission } from '../../services/assessmentService';
import { executeCandidateCode } from '../../services/codeExecution';
import { supabase } from '../../services/supabase';
import { Clock, Send } from 'lucide-react';

interface PersistedAssessmentRunnerProps {
  assessment: Assessment;
  candidateId: string;
  onComplete: (attempt: AssessmentAttempt) => void;
}

const remainingSeconds = (attempt: AssessmentAttempt, durationMinutes: number) =>
  Math.max(0, Math.ceil((new Date(attempt.started_at).getTime() + durationMinutes * 60_000 - Date.now()) / 1000));

export const PersistedAssessmentRunner: React.FC<PersistedAssessmentRunnerProps> = ({ assessment, candidateId, onComplete }) => {
  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [testResults, setTestResults] = useState<Record<string, Array<{ passed: boolean; actual_output: string; expected_output: string }>>>({});
  const autoSubmittedAttempt = useRef<string | null>(null);
  const questions = useMemo(() => [...(assessment.questions || [])].sort((left, right) => left.order_index - right.order_index), [assessment.questions]);
  const current = questions[currentIndex];

  useEffect(() => {
    let active = true;
    getOrStartAttempt(assessment.id, candidateId)
      .then((loadedAttempt) => {
        if (!active) return;
        setAttempt(loadedAttempt);
        setRemaining(remainingSeconds(loadedAttempt, assessment.duration_minutes));
        const restored: Record<string, string> = {};
        for (const submission of loadedAttempt.submissions || []) {
          if (submission.language === 'mcq') {
            try { restored[submission.question_id] = JSON.parse(submission.code).selected_option || ''; } catch { /* old malformed response */ }
          } else {
            restored[submission.question_id] = submission.code;
          }
        }
        setAnswers(restored);
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Could not start this assessment.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [assessment.id, assessment.duration_minutes, candidateId]);

  useEffect(() => {
    if (!attempt || attempt.status !== 'IN_PROGRESS') return;
    const updateTimer = () => setRemaining(remainingSeconds(attempt, assessment.duration_minutes));
    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, assessment.duration_minutes]);

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

  const persistAnswer = async (question: AssessmentQuestion, answer: string) => {
    if (!attempt) return;
    setAnswers((currentAnswers) => ({ ...currentAnswers, [question.id]: answer }));
    setSaving(true);
    setError('');
    const isMcq = question.question_type === 'MCQ';
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
    try {
      const result = await executeCandidateCode({ language: 'javascript', code: answers[current.id] || current.starter_code.javascript, testCases: current.test_cases });
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
        score: current.points * result.testsPassed / Math.max(1, result.totalTests),
        test_results: result.results,
        submitted_at: new Date().toISOString(),
      };
      await saveAttemptSubmission(submission);
      setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: submission.code }));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Code execution failed.');
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!attempt || submitting) return;
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
          try { mcqAnswers[question.id] = JSON.parse(saved?.code || '{}').selected_option || ''; } catch { mcqAnswers[question.id] = ''; }
        }
      }

      const result = await completeAttempt({
        attemptId: attempt.id,
        candidateId,
        answers: mcqAnswers,
        submissions: (currentSubmissions || []) as Submission[],
      });
      onComplete(result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Assessment submission failed. Your attempt remains saved.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (attempt?.status === 'IN_PROGRESS' && remaining === 0 && !loading && !submitting && autoSubmittedAttempt.current !== attempt.id) {
      autoSubmittedAttempt.current = attempt.id;
      void submit();
    }
  }, [attempt?.id, attempt?.status, remaining, loading, submitting]);

  if (loading) return <main className="main-content">Recovering your saved assessment attempt…</main>;
  if (error && !attempt) return <main className="main-content"><div role="alert" className="card">{error}</div></main>;
  if (!attempt || !current) return <main className="main-content"><div className="card">This assessment has no questions.</div></main>;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <main className="main-content" style={{ maxWidth: 1000 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 18 }}>
        <div><span className="badge badge-accent">{currentIndex + 1} / {questions.length}</span><h1 style={{ fontSize: '1.5rem', marginTop: 6 }}>{assessment.title}</h1></div>
        <div className="badge badge-neutral" aria-live="polite"><Clock size={15} /> {minutes}:{String(seconds).padStart(2, '0')}</div>
      </header>
      {error && <div role="alert" className="card" style={{ borderColor: 'var(--status-danger)', marginBottom: 12 }}>{error}</div>}
      <section className="card">
        <span className="badge badge-neutral">{current.question_type} · {current.difficulty} · {current.points} marks</span>
        <h2 style={{ fontSize: '1.3rem', marginTop: 10 }}>{current.title}</h2>
        <p style={{ whiteSpace: 'pre-wrap' }}>{current.statement}</p>
        {current.question_type === 'MCQ' ? (
          <fieldset style={{ border: 0, padding: 0, margin: '1rem 0' }}>
            <legend className="form-label">Choose one answer</legend>
            {current.options.map((option) => <label key={option.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderTop: '1px solid var(--border-subtle)' }}><input type="radio" name={`answer-${current.id}`} checked={answers[current.id] === option.id} onChange={() => void persistAnswer(current, option.id)} />{option.text}</label>)}
          </fieldset>
        ) : (
          <>
            {current.constraints && <p><strong>Constraints:</strong> {current.constraints}</p>}
            <Editor height="340px" language="javascript" theme="vs-dark" value={answers[current.id] ?? current.starter_code.javascript} onChange={(value) => { setAnswers((existing) => ({ ...existing, [current.id]: value || '' })); }} options={{ minimap: { enabled: false }, fontSize: 14 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12 }}><p>Run the visible test cases to record the current result. Final coding evaluation runs in this browser.</p><button className="btn btn-secondary" disabled={saving} onClick={() => void runCurrentCode()}>{saving ? 'Saving…' : 'Run Tests & Save'}</button></div>
            {testResults[current.id] && <div style={{ marginTop: 12 }} aria-live="polite">{testResults[current.id].map((test, index) => <div key={index} style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 0' }}><strong>{test.passed ? 'Passed' : 'Failed'} · Test {index + 1}</strong><div>Expected: <code>{test.expected_output}</code> · Actual: <code>{test.actual_output}</code></div></div>)}</div>}
          </>
        )}
      </section>
      <footer style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 16 }}>
        <button className="btn btn-secondary" disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => index - 1)}>Previous</button>
        <span aria-live="polite">{saving ? 'Saving answer…' : 'Answers are saved to your attempt.'}</span>
        {currentIndex < questions.length - 1
          ? <button className="btn btn-secondary" onClick={() => setCurrentIndex((index) => index + 1)}>Next</button>
          : <button className="btn btn-primary" disabled={submitting || saving} onClick={() => void submit()}><Send size={15} />{submitting ? 'Submitting…' : 'Submit Assessment'}</button>}
      </footer>
    </main>
  );
};

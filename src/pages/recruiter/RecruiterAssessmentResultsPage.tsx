import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { Assessment, AssessmentAttempt, Submission } from '../../types';
import { ArrowLeft } from 'lucide-react';

interface ResultAttempt extends Omit<AssessmentAttempt, 'candidate'> {
  candidate?: { full_name: string; email: string };
  submissions?: Submission[];
}

export const RecruiterAssessmentResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [attempts, setAttempts] = useState<ResultAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!id || !user) return;
      const { data: assessmentRow, error: assessmentError } = await supabase
        .from('assessments')
        .select('*, job:jobs(*)')
        .eq('id', id)
        .eq('creator_id', user.id)
        .single();
      if (assessmentError) throw assessmentError;
      const { data: attemptRows, error: attemptsError } = await supabase
        .from('assessment_attempts')
        .select('*, candidate:profiles(full_name, email), submissions(*)')
        .eq('assessment_id', id)
        .order('started_at', { ascending: false });
      if (attemptsError) throw attemptsError;
      if (active) {
        setAssessment(assessmentRow as Assessment);
        setAttempts((attemptRows || []) as unknown as ResultAttempt[]);
      }
    };
    setLoading(true);
    load().catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load assessment results.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, user?.id]);

  if (loading) return <main className="main-content">Loading candidate results…</main>;
  if (error) return <main className="main-content"><div role="alert" className="card">{error}</div></main>;
  if (!assessment) return <main className="main-content"><div className="card">Assessment not found or access denied.</div></main>;

  return (
    <main className="main-content">
      <Link to="/recruiter/assessments" className="nav-link" style={{ marginBottom: 18 }}><ArrowLeft size={16} /> Assessments</Link>
      <span className="badge badge-accent">{assessment.job?.title || 'Job assessment'}</span>
      <h1 style={{ fontSize: '2rem', marginTop: 8 }}>{assessment.title} · Candidate Results</h1>
      <p>{assessment.duration_minutes} minutes · {assessment.total_points} marks · {attempts.length} attempts</p>
      {attempts.length === 0 ? <div className="card" style={{ marginTop: 18 }}>No candidate attempts yet.</div> : attempts.map((attempt) => (
        <article key={attempt.id} className="card" style={{ marginTop: 14 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div><h2 style={{ fontSize: '1.2rem' }}>{attempt.candidate?.full_name || 'Candidate'}</h2><p>{attempt.candidate?.email}</p></div>
            <div style={{ textAlign: 'right' }}><span className="badge badge-neutral">{attempt.status}</span>{attempt.status === 'EVALUATED' && <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: 6 }}>{attempt.technical_score ?? 0}%</div>}</div>
          </header>
          <p style={{ marginTop: 8 }}>Started {new Date(attempt.started_at).toLocaleString()}{attempt.submitted_at ? ` · Submitted ${new Date(attempt.submitted_at).toLocaleString()}` : ''}</p>
          {attempt.status === 'EVALUATED' && (
            <>
              <h3 style={{ fontSize: '1rem', marginTop: 16 }}>Skill-wise performance</h3>
              {(attempt.score_breakdown?.skill_breakdown || []).length === 0 ? <p>Skill breakdown unavailable.</p> : attempt.score_breakdown?.skill_breakdown?.map((skill) => <div key={skill.skill_id} style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', padding: '8px 0' }}><span>{skill.skill_name}</span><strong>{skill.earned} / {skill.maximum} · {skill.percentage}%</strong></div>)}
              <h3 style={{ fontSize: '1rem', marginTop: 16 }}>Coding submissions</h3>
              {(attempt.submissions || []).filter((submission) => submission.language !== 'mcq').length === 0 ? <p>No coding submissions.</p> : (attempt.submissions || []).filter((submission) => submission.language !== 'mcq').map((submission) => <div key={submission.id} style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 0' }}><strong>{submission.tests_passed}/{submission.total_tests} visible tests passed · {submission.score} marks</strong><pre style={{ overflowX: 'auto', maxHeight: 220, marginTop: 8 }}><code>{submission.code}</code></pre></div>)}
            </>
          )}
        </article>
      ))}
    </main>
  );
};

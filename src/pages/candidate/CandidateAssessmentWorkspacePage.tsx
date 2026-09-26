import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Assessment, AssessmentAttempt } from '../../types';
import { getEligibleAssessments } from '../../services/assessmentService';
import { supabase } from '../../services/supabase';
import { PersistedAssessmentRunner } from '../../components/assessment/PersistedAssessmentRunner';
import { Award, Clock, Play } from 'lucide-react';

export const CandidateAssessmentWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
  const [completed, setCompleted] = useState<AssessmentAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    if (!user) return;
    const [eligible, attemptResult] = await Promise.all([
      getEligibleAssessments(user.id),
      supabase.from('assessment_attempts')
        .select('*, submissions(*), assessment:assessments(title, job:jobs(title))')
        .eq('candidate_id', user.id)
        .order('started_at', { ascending: false }),
    ]);
    if (attemptResult.error) throw attemptResult.error;
    setAssessments(eligible);
    setAttempts((attemptResult.data || []) as unknown as AssessmentAttempt[]);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    refresh()
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load your assessments.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  if (!user) return null;
  if (loading) return <main className="main-content">Loading assessments…</main>;

  const assessment = id ? assessments.find((item) => item.id === id) : undefined;
  const attempt = assessment ? attempts.find((item) => item.assessment_id === assessment.id) : undefined;
  const result = completed || (attempt?.status === 'EVALUATED' ? attempt : null);

  if (id && assessment && !result) {
    return <PersistedAssessmentRunner
      assessment={assessment}
      candidateId={user.id}
      onComplete={(finished) => {
        setCompleted(finished);
        void refresh().catch((refreshError) => setError(refreshError instanceof Error ? refreshError.message : 'Result saved, but the page could not refresh.'));
      }}
    />;
  }

  if (id && result) {
    const breakdown = result.score_breakdown?.skill_breakdown || [];
    return (
      <main className="main-content" style={{ maxWidth: 860 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-verified">Assessment Submitted</span>
          <span className="badge badge-accent">Assessment Integrity: MONITORED</span>
        </div>
        <h1 style={{ fontSize: '2rem', marginTop: 10, fontWeight: 800 }}>{assessment?.title || result.assessment?.title}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Your answers were verified and recorded. The assessment session was monitored and submitted for recruiter review.
        </p>
        <section className="card" style={{ marginTop: 18 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Overall Score</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--status-verified)' }}>{result.technical_score ?? 0}%</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
            Submitted {result.submitted_at ? new Date(result.submitted_at).toLocaleString() : 'just now'}
          </div>
        </section>
        <h2 style={{ fontSize: '1.2rem', margin: '1.5rem 0 10px' }}>Skills Tested & Performance</h2>
        {breakdown.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Skills verified under this assessment.</p>
        ) : (
          breakdown.map((skill) => (
            <article
              key={skill.skill_id}
              className="card"
              style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}
            >
              <strong>{skill.skill_name}</strong>
              <span>
                {skill.earned} / {skill.maximum} marks · <strong>{skill.percentage}%</strong>
              </span>
            </article>
          ))
        )}
        <div style={{ marginTop: 20 }}>
          <Link to="/candidate/assessments" className="btn btn-secondary">
            Back to Assessments
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <header style={{ marginBottom: 22 }}>
        <span className="badge badge-accent">Candidate Workspace</span>
        <h1 style={{ fontSize: '2rem', marginTop: 8 }}>Your Assessments</h1>
        <p>Assessments appear here only when a recruiter invites you for a job you applied to.</p>
      </header>
      {error && <div role="alert" className="card" style={{ borderColor: 'var(--status-danger)', marginBottom: 12 }}>{error}</div>}
      {assessments.length === 0 ? <div className="card"><h2>No assessments yet</h2><p>When a recruiter invites you to an assessment for one of your applications, it will appear here.</p></div> : assessments.map((item) => {
        const priorAttempt = attempts.find((candidateAttempt) => candidateAttempt.assessment_id === item.id);
        const isInProgress = priorAttempt?.status === 'IN_PROGRESS';
        const isEvaluated = priorAttempt?.status === 'EVALUATED';
        return (
          <article className="card" key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: '1.2rem' }}>{item.title}</h2>
              <p>{item.job?.title || 'Job assessment'}</p>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                <span><Clock size={14} /> {item.duration_minutes} minutes</span>
                <span>{item.questions?.length || 0} questions</span>
                <span>{item.total_points} marks</span>
              </div>
              <p style={{ marginTop: 6 }}>Skills: {[...new Set(item.questions?.map((question) => question.skill?.name).filter(Boolean))].join(', ') || 'Assessment skills'}</p>
            </div>
            {isEvaluated ? <Link to={`/candidate/assessments/${item.id}`} className="btn btn-secondary"><Award size={16} /> View result · {priorAttempt.technical_score ?? 0}%</Link> : <Link to={`/candidate/assessments/${item.id}`} className="btn btn-primary"><Play size={16} /> {isInProgress ? 'Resume assessment' : 'Start assessment'}</Link>}
          </article>
        );
      })}
    </main>
  );
};

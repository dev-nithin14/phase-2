import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { appStore } from '../../services/store';
import { AssessmentAttempt } from '../../types';
import { AssessmentRunner } from '../../components/assessment/AssessmentRunner';
import { VerificationBadge, IntegrityBadge } from '../../components/common/Badge';
import { 
  FileCode2, Play, Award, CheckCircle2, 
  Clock, ShieldCheck, ArrowRight, RotateCcw 
} from 'lucide-react';

export const CandidateAssessmentsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  if (!user) return null;

  const assessments = appStore.getAssessments();
  const attempts = appStore.getState().attempts.filter((a) => a.candidate_id === user.id);
  const [completedAttempt, setCompletedAttempt] = useState<AssessmentAttempt | null>(null);

  // If specific assessment is requested by ID, render AssessmentRunner
  if (id) {
    const targetAssessment = appStore.getAssessment(id);
    if (!targetAssessment) {
      return (
        <div className="main-content" style={{ textAlign: 'center', padding: '4rem' }}>
          <h2>Assessment Not Found</h2>
          <Link to="/candidate/assessments" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
            Back to Assessments
          </Link>
        </div>
      );
    }

    // If attempt was just completed, show evaluation receipt
    if (completedAttempt) {
      return (
        <div className="main-content" style={{ maxWidth: '800px' }}>
          <div className="card" style={{ border: '1px solid var(--border-accent)', padding: '3rem 2rem', textAlign: 'center' }}>
            <div className="brand-icon" style={{ width: '60px', height: '60px', margin: '0 auto 1.5rem', background: 'var(--status-verified)' }}>
              <ShieldCheck size={32} color="#fff" />
            </div>

            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Assessment Successfully Evaluated!
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Your code submissions have been processed against test suites in the sandboxed runtime.
            </p>

            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                marginBottom: '2rem',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Deterministic Technical Score
              </div>
              <div style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--status-verified)', marginTop: '0.2rem' }}>
                {completedAttempt.technical_score}
                <span style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>/100</span>
              </div>

              {completedAttempt.score_breakdown && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Correctness (50%)</div>
                    <strong style={{ fontSize: '1.1rem' }}>{completedAttempt.score_breakdown.correctness}</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Efficiency (20%)</div>
                    <strong style={{ fontSize: '1.1rem' }}>{completedAttempt.score_breakdown.efficiency}</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Quality (15%)</div>
                    <strong style={{ fontSize: '1.1rem' }}>{completedAttempt.score_breakdown.code_quality}</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Coverage (10%)</div>
                    <strong style={{ fontSize: '1.1rem' }}>{completedAttempt.score_breakdown.test_coverage}</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Time (5%)</div>
                    <strong style={{ fontSize: '1.1rem' }}>{completedAttempt.score_breakdown.time_performance}</strong>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <Link to="/candidate/passport" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={18} /> View on Verified Skill Passport
              </Link>
              <button onClick={() => setCompletedAttempt(null)} className="btn btn-secondary btn-lg">
                Return to Assessments
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <AssessmentRunner
        assessment={targetAssessment}
        candidateId={user.id}
        onComplete={(res) => setCompletedAttempt(res)}
      />
    );
  }

  return (
    <div className="main-content">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Technical Coding Assessments
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Take sandboxed challenges to generate verifiable assessment scores for your Skill Passport.
        </p>
      </div>

      {/* Available Assessments */}
      <div style={{ marginBottom: '3rem' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Play size={18} color="var(--accent-primary)" /> Available Technical Challenges
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {assessments.map((asmt) => {
            const priorAttempt = attempts.find((a) => a.assessment_id === asmt.id && a.status === 'EVALUATED');

            return (
              <div key={asmt.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', padding: '1.5rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.35rem' }}>{asmt.title}</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    {asmt.description}
                  </p>

                  <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={14} /> {asmt.duration_minutes} Minutes
                    </span>
                    <span>•</span>
                    <span>{asmt.questions?.length || 2} Problems</span>
                    <span>•</span>
                    <span style={{ color: 'var(--status-verified)' }}>Languages: JavaScript / Python</span>
                  </div>
                </div>

                <div>
                  {priorAttempt ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Evaluated Score
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--status-verified)' }}>
                        {priorAttempt.technical_score}/100
                      </div>
                      <Link to={`/candidate/assessments/${asmt.id}`} className="btn btn-secondary btn-sm" style={{ marginTop: '0.4rem' }}>
                        Retake Challenge
                      </Link>
                    </div>
                  ) : (
                    <Link to={`/candidate/assessments/${asmt.id}`} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Play size={16} /> Start Challenge
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Prior Evaluation History */}
      {attempts.length > 0 && (
        <div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={18} color="var(--accent-cyan)" /> My Evaluation Receipts
          </h3>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Submitted At</th>
                  <th>Technical Score</th>
                  <th>Integrity Telemetry</th>
                  <th>Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((att) => (
                  <tr key={att.id}>
                    <td><strong>{att.assessment?.title || 'Challenge'}</strong></td>
                    <td>{new Date(att.submitted_at || att.started_at).toLocaleString()}</td>
                    <td>
                      <strong style={{ color: 'var(--status-verified)', fontSize: '1.1rem' }}>
                        {att.technical_score}/100
                      </strong>
                    </td>
                    <td>
                      <IntegrityBadge status={att.integrity_status} />
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      C: {att.score_breakdown?.correctness || 0} • E: {att.score_breakdown?.efficiency || 0} • Q: {att.score_breakdown?.code_quality || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

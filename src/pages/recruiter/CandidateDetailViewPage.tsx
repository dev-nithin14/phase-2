import React, { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { appStore } from '../../services/store';
import { calculateJobMatch } from '../../services/matching';
import { runEvaluationAgent, runIntegrityAnalysisAgent } from '../../services/aiAgents';
import { VerificationBadge, IntegrityBadge } from '../../components/common/Badge';
import { SkillPassportCard } from '../../components/passport/SkillPassportCard';
import { 
  ArrowLeft, Award, ShieldCheck, CheckCircle2, UserCheck, 
  Send, Sparkles, AlertCircle, FileCode, Check 
} from 'lucide-react';

export const CandidateDetailViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId') || 'job_frontend_cloudscale';

  const candidate = id ? appStore.getState().profiles.find((p) => p.id === id) : undefined;
  const job = appStore.getJob(jobId) || appStore.getJobs()[0];
  const assessments = appStore.getAssessments();

  const [activeTab, setActiveTab] = useState<'evidence' | 'passport'>('evidence');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  if (!candidate) {
    return (
      <div className="main-content" style={{ textAlign: 'center', padding: '4rem' }}>
        <h2>Candidate Profile Not Found</h2>
        <Link to="/recruiter/dashboard" className="btn btn-secondary">
          Back to Recruiter Hub
        </Link>
      </div>
    );
  }

  const candidateSkills = appStore.getCandidateSkills(candidate.id);
  const candidateProjects = appStore.getCandidateProjects(candidate.id);
  const attempts = appStore.getState().attempts.filter((a) => a.candidate_id === candidate.id);
  const latestAttempt = attempts[0];

  const match = job ? calculateJobMatch(job, candidate, candidateSkills, candidateProjects) : null;

  // AI Agent 3: Technical Evaluation Analysis
  const evaluationInsights = latestAttempt ? runEvaluationAgent(latestAttempt) : null;

  // AI Agent 4: Integrity Telemetry Analysis
  const integrityAnalysis = latestAttempt?.integrity_events
    ? runIntegrityAnalysisAgent(latestAttempt.integrity_events)
    : null;

  const handleUpdateStatus = (newStatus: any) => {
    if (!job) return;
    const app = appStore.getState().applications.find((a) => a.job_id === job.id && a.candidate_id === candidate.id)
      || appStore.applyToJob(job.id, candidate.id);
    appStore.updateApplicationStatus(app.id, newStatus);
    setActionNotice(`Candidate moved to ${newStatus.replace(/_/g, ' ')}!`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  return (
    <div className="main-content">
      <Link to="/recruiter/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
        <ArrowLeft size={16} /> Back to Candidates
      </Link>

      {/* Candidate Header Profile Card */}
      <div className="card" style={{ marginBottom: '2rem', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <img
              src={candidate.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'}
              alt={candidate.full_name}
              style={{ width: '84px', height: '84px', borderRadius: 'var(--radius-lg)', objectFit: 'cover', border: '2px solid var(--accent-primary)' }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>{candidate.full_name}</h1>
                <span className="badge badge-verified">Verified Developer</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                {candidate.location} • {candidate.experience_years} Years Exp • {candidate.education}
              </p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                {candidate.github_url && <a href={candidate.github_url} target="_blank" rel="noreferrer">GitHub</a>}
                {candidate.linkedin_url && <a href={candidate.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>}
                {candidate.portfolio_url && <a href={candidate.portfolio_url} target="_blank" rel="noreferrer">Portfolio</a>}
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => handleUpdateStatus('SHORTLISTED')} className="btn btn-primary btn-sm">
                Shortlist Candidate
              </button>
              <button onClick={() => handleUpdateStatus('INTERVIEW')} className="btn btn-success btn-sm">
                Move to Interview
              </button>
            </div>
            <button onClick={() => setActiveTab(activeTab === 'evidence' ? 'passport' : 'evidence')} className="btn btn-secondary btn-sm">
              {activeTab === 'evidence' ? 'View Full Skill Passport →' : 'View Audit Breakdown →'}
            </button>
          </div>
        </div>

        {actionNotice && (
          <div style={{ marginTop: '1.25rem', padding: '0.65rem 1rem', background: 'var(--status-verified-bg)', border: '1px solid var(--status-verified-border)', color: 'var(--status-verified)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 600 }}>
            {actionNotice}
          </div>
        )}
      </div>

      {activeTab === 'passport' ? (
        <SkillPassportCard
          candidate={candidate}
          skills={candidateSkills}
          projects={candidateProjects}
          attempts={attempts}
        />
      ) : (
        <>
          {/* Top Verification Stats Matrix (Section 21) */}
          <div className="grid-4" style={{ marginBottom: '2rem' }}>
            <div className="card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Job Match Score
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-primary)', marginTop: '0.3rem' }}>
                {match ? `${match.overallScore}%` : 'N/A'}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Against {job.title}</p>
            </div>

            <div className="card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Technical Assessment
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--status-verified)', marginTop: '0.3rem' }}>
                {latestAttempt ? `${latestAttempt.technical_score}/100` : 'Pending'}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Deterministic score</p>
            </div>

            <div className="card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Verified Projects
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-cyan)', marginTop: '0.3rem' }}>
                {candidateProjects.length}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Repository-backed</p>
            </div>

            <div className="card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Assessment Integrity
              </div>
              <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <IntegrityBadge status={latestAttempt?.integrity_status || 'NORMAL'} />
                {latestAttempt?.integrity_risk_score !== undefined && (
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    ({latestAttempt.integrity_risk_score}/100 Risk)
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                {latestAttempt?.integrity_summary?.tab_switches || 0} tab switches · {latestAttempt?.integrity_summary?.face_absence_events || 0} face absences
              </p>
            </div>
          </div>

          {/* Section 21 Skill Match Breakdown */}
          {match && (
            <div className="card" style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={18} color="var(--accent-primary)" />
                Deterministic Skill Match Breakdown ({job.title})
              </h3>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Required Skill</th>
                      <th>Evaluation Weight</th>
                      <th>Candidate Score</th>
                      <th>Evidence Origin</th>
                      <th>Verification Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(match.skillBreakdown).map((sb) => (
                      <tr key={sb.skillName}>
                        <td><strong>{sb.skillName}</strong></td>
                        <td>{sb.weight}%</td>
                        <td>
                          <strong style={{ color: sb.candidateScore >= 75 ? 'var(--status-verified)' : '#fff', fontSize: '1rem' }}>
                            {sb.candidateScore}/100
                          </strong>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{sb.evidenceNote}</td>
                        <td>
                          <VerificationBadge status={sb.verificationStatus} score={sb.candidateScore} showScore={false} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI Agent 3 & Agent 4 Insights */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
            {/* Agent 3: Objective Evaluation Analysis */}
            <div className="card" style={{ border: '1px solid var(--border-accent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', marginBottom: '0.85rem' }}>
                <Sparkles size={18} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Agent 3: Technical Evaluation Analysis</h4>
              </div>

              {evaluationInsights ? (
                <div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <strong style={{ fontSize: '0.825rem', color: 'var(--status-verified)' }}>Observed Strengths:</strong>
                    <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {evaluationInsights.strengths.map((st, i) => (
                        <li key={i}>{st}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <strong style={{ fontSize: '0.825rem', color: 'var(--accent-cyan)' }}>Technical Observations:</strong>
                    <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {evaluationInsights.technicalObservations.map((to, i) => (
                        <li key={i}>{to}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Awaiting candidate assessment completion to run evaluation insights.
                </p>
              )}
            </div>

            {/* Agent 4: Integrity Telemetry Report */}
            <div className="card" style={{ border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-verified)', marginBottom: '0.85rem' }}>
                <ShieldCheck size={18} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Agent 4: Integrity Telemetry Audit</h4>
              </div>

              {integrityAnalysis ? (
                <div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    {integrityAnalysis.summary}
                  </p>

                  <div style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                    <strong style={{ color: '#fff' }}>Human Review Recommendation:</strong>
                    <div style={{ marginTop: '0.2rem' }}>{integrityAnalysis.humanReviewNote}</div>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Integrity telemetry streams live during coding challenge execution.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

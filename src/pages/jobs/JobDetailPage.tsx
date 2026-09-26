import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { appStore } from '../../services/store';
import { calculateJobMatch } from '../../services/matching';
import { runSkillMatchingAgent } from '../../services/aiAgents';
import { 
  Building2, MapPin, Briefcase, DollarSign, Award, 
  CheckCircle2, ArrowLeft, Send, Sparkles, AlertCircle 
} from 'lucide-react';

import { Job } from '../../types';

export const JobDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applied, setApplied] = useState(false);

  const [job, setJob] = useState<Job | undefined>(() => id ? appStore.getJob(id) : undefined);
  const [loadingJob, setLoadingJob] = useState(!job);

  React.useEffect(() => {
    if (id) {
      const existing = appStore.getJob(id);
      if (existing) {
        setJob(existing);
        setLoadingJob(false);
      } else {
        appStore.fetchJobById(id).then((fetched) => {
          setJob(fetched);
          setLoadingJob(false);
        });
      }
    }
  }, [id]);

  const candidateSkills = user ? appStore.getCandidateSkills(user.id) : [];
  const candidateProjects = user ? appStore.getCandidateProjects(user.id) : [];

  if (loadingJob) {
    return (
      <div className="main-content" style={{ textAlign: 'center', padding: '4rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading opportunity details from database...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="main-content" style={{ textAlign: 'center', padding: '4rem' }}>
        <h2>Opportunity Not Found</h2>
        <Link to="/jobs" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Back to Jobs
        </Link>
      </div>
    );
  }

  // Calculate deterministic match if user is candidate
  const match = user && user.role === 'JOB_SEEKER'
    ? calculateJobMatch(job, user, candidateSkills, candidateProjects)
    : null;

  // Run AI Agent 1 for qualitative explanation
  const aiExplanation = match && user
    ? runSkillMatchingAgent({
        job,
        candidate: user,
        matchScore: match.overallScore,
        skills: candidateSkills,
        projects: candidateProjects,
      })
    : null;

  const existingApp = user
    ? appStore.getState().applications.find((a) => a.job_id === job.id && a.candidate_id === user.id)
    : null;

  const handleApply = () => {
    if (!user) {
      alert('Please log in as a candidate to apply.');
      return;
    }
    appStore.applyToJob(job.id, user.id);
    setApplied(true);
  };

  return (
    <div className="main-content">
      <Link to="/jobs" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
        <ArrowLeft size={16} /> Back to all jobs
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* Left Column: Job Description & Required Skills */}
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <img
                src={job.company?.logo_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=150'}
                alt={job.company?.name}
                style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-md)', objectFit: 'cover' }}
              />
              <div>
                <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.35rem' }}>{job.title}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <span>{job.company?.name}</span>
                  <span>•</span>
                  <span>{job.location}</span>
                  <span>•</span>
                  <span className="badge badge-accent">{job.work_mode}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Experience</div>
                <div style={{ fontWeight: 700, marginTop: '0.2rem' }}>{job.min_experience}+ Years</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Compensation</div>
                <div style={{ fontWeight: 700, marginTop: '0.2rem' }}>
                  ₹{(job.min_salary! / 100000).toFixed(1)}L - ₹{(job.max_salary! / 100000).toFixed(1)}L
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assessment</div>
                <div style={{ fontWeight: 700, color: 'var(--status-verified)', marginTop: '0.2rem' }}>
                  Required (Monaco)
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>Role Description</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '2rem', whiteSpace: 'pre-line' }}>
              {job.description}
            </p>

            {/* Required Skills & Weights Table */}
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>Required Technical Skills & Weight Distribution</h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Skill</th>
                    <th>Evaluation Weight</th>
                    <th>Requirement Type</th>
                    <th>Min Verified Benchmark</th>
                  </tr>
                </thead>
                <tbody>
                  {job.skills?.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.skill?.name}</strong></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '100px', height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${s.weight}%`, height: '100%', background: 'var(--accent-primary)' }} />
                          </div>
                          <span>{s.weight}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${s.is_required ? 'badge-accent' : 'badge-neutral'}`}>
                          {s.is_required ? 'Mandatory' : 'Preferred'}
                        </span>
                      </td>
                      <td>{s.min_acceptable_score}/100</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Candidate Match & Apply Action */}
        <div>
          <div className="card" style={{ border: '1px solid var(--border-accent)', position: 'sticky', top: '90px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={20} color="var(--accent-primary)" />
              Candidate Match Analysis
            </h3>

            {match ? (
              <>
                <div style={{ textAlign: 'center', background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Deterministic Match Score
                  </div>
                  <div style={{ fontSize: '3rem', fontWeight: 900, color: match.overallScore >= 80 ? 'var(--status-verified)' : '#A5B4FC' }}>
                    {match.overallScore}%
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                    {match.evidenceSummary}
                  </p>
                </div>

                {/* Score Breakdown */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.6rem', color: '#fff' }}>
                    Transparent Skill Breakdown
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.825rem' }}>
                    {Object.values(match.skillBreakdown).map((sb) => (
                      <div key={sb.skillName} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div>
                          <span>{sb.skillName} ({sb.weight}%)</span>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sb.evidenceNote}</div>
                        </div>
                        <strong style={{ color: sb.candidateScore >= 75 ? 'var(--status-verified)' : '#fff' }}>
                          {sb.candidateScore}/100
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Agent 1 Explanation */}
                {aiExplanation && (
                  <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid var(--border-accent)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-primary)', fontSize: '0.825rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                      <Sparkles size={14} /> Agent 1 Match Rationale
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {aiExplanation.matchSummary}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Log in as a Job Seeker to see your personalized verified match breakdown.
              </p>
            )}

            {/* Application Button */}
            {existingApp || applied ? (
              <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--status-verified-bg)', border: '1px solid var(--status-verified-border)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ color: 'var(--status-verified)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={16} /> Application Submitted
                </span>
                <Link to="/candidate/applications" style={{ fontSize: '0.8rem', display: 'block', marginTop: '0.35rem' }}>
                  View Application Status →
                </Link>
              </div>
            ) : (
              <button onClick={handleApply} className="btn btn-primary btn-lg" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Send size={18} /> Apply with Skill Passport
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

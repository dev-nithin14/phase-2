import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { appStore } from '../../services/store';
import { rankCandidatesForJob } from '../../services/matching';
import { VerificationBadge, IntegrityBadge } from '../../components/common/Badge';
import { 
  ArrowLeft, Search, Filter, Award, ShieldCheck, 
  Send, CheckCircle, ExternalLink, UserCheck, Play 
} from 'lucide-react';

import { Job } from '../../types';

export const RecruiterJobCandidatesPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
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

  const allProfiles = appStore.getState().profiles.filter((p) => p.role === 'JOB_SEEKER');
  const assessments = appStore.getAssessments();

  // Filters state
  const [minScore, setMinScore] = useState(0);
  const [skillFilter, setSkillFilter] = useState('');
  const [minExp, setMinExp] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  if (loadingJob) {
    return (
      <div className="main-content" style={{ textAlign: 'center', padding: '4rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading job details from database...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="main-content" style={{ textAlign: 'center', padding: '4rem' }}>
        <h2>Job Not Found</h2>
        <Link to="/recruiter/dashboard" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // Build candidate pool
  const candidatePool = allProfiles.map((c) => ({
    candidate: c,
    skills: appStore.getCandidateSkills(c.id),
    projects: appStore.getCandidateProjects(c.id),
  }));

  // Deterministic job-specific ranking
  const rankedList = rankCandidatesForJob(job, candidatePool, {
    minScore,
    skillName: skillFilter || undefined,
    minExperience: minExp,
    verifiedOnly,
  });

  const handleShortlist = (candId: string) => {
    // Find or create application
    const app = appStore.getState().applications.find((a) => a.job_id === job.id && a.candidate_id === candId)
      || appStore.applyToJob(job.id, candId);
    appStore.updateApplicationStatus(app.id, 'SHORTLISTED');
    setActionNotice(`Candidate shortlisted for ${job.title}!`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleInviteAssessment = (candId: string) => {
    const relatedAsmt = assessments.find((a) => a.job_id === job.id) || assessments[0];
    const app = appStore.getState().applications.find((a) => a.job_id === job.id && a.candidate_id === candId)
      || appStore.applyToJob(job.id, candId);
    if (relatedAsmt) {
      appStore.inviteCandidateToAssessment(relatedAsmt.id, app.id);
      setActionNotice(`Technical assessment invitation sent to candidate!`);
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  return (
    <div className="main-content">
      <Link to="/recruiter/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
        <ArrowLeft size={16} /> Back to Recruiter Dashboard
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
            <Award size={16} /> Job-Specific Deterministic Ranking
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800 }}>{job.title}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Candidates ranked strictly by required skill weights, verified scores, and relevant code repositories.
          </p>
        </div>
      </div>

      {actionNotice && (
        <div style={{ padding: '0.75rem 1rem', background: 'var(--status-verified-bg)', border: '1px solid var(--status-verified-border)', color: 'var(--status-verified)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={16} /> {actionNotice}
        </div>
      )}

      {/* Filter Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          background: 'var(--bg-card)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '2rem',
          alignItems: 'center',
        }}
      >
        <div>
          <label className="form-label">Min Match Score</label>
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="form-select"
          >
            <option value={0}>Any Match Score</option>
            <option value={70}>70%+ Compatibility</option>
            <option value={80}>80%+ Strong Fit</option>
            <option value={90}>90%+ Top Match</option>
          </select>
        </div>

        <div>
          <label className="form-label">Filter by Required Skill</label>
          <input
            type="text"
            placeholder="e.g. React, Python..."
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            className="form-input"
          />
        </div>

        <div>
          <label className="form-label">Min Experience</label>
          <select
            value={minExp}
            onChange={(e) => setMinExp(Number(e.target.value))}
            className="form-select"
          >
            <option value={0}>Any Experience</option>
            <option value={2}>2+ Years</option>
            <option value={3}>3+ Years</option>
            <option value={5}>5+ Years</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
          <input
            type="checkbox"
            id="verifiedOnlyCheck"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor="verifiedOnlyCheck" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
            Verified Assessment Only
          </label>
        </div>
      </div>

      {/* Ranked Candidates List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {rankedList.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3.5rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>No candidates match the specified filter criteria.</p>
          </div>
        ) : (
          rankedList.map(({ candidate, match, skills, projects, rank }) => {
            const existingApp = appStore.getState().applications.find(
              (a) => a.job_id === job.id && a.candidate_id === candidate.id
            );

            return (
              <div
                key={candidate.id}
                className="card card-interactive"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1.5rem',
                  padding: '1.5rem',
                  borderLeft: rank === 1 ? '4px solid var(--accent-primary)' : undefined,
                }}
              >
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                  {/* Rank Badge */}
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: 'var(--radius-md)',
                      background: rank === 1 ? 'var(--accent-gradient)' : 'var(--bg-elevated)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: '1.1rem',
                      boxShadow: rank === 1 ? 'var(--accent-glow)' : 'none',
                    }}
                  >
                    #{rank}
                  </div>

                  <img
                    src={candidate.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'}
                    alt={candidate.full_name}
                    style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-md)', objectFit: 'cover' }}
                  />

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{candidate.full_name}</h3>
                      <span className="badge badge-neutral">{candidate.experience_years} Yrs Exp</span>
                      {existingApp && (
                        <span className="badge badge-accent">{existingApp.status.replace(/_/g, ' ')}</span>
                      )}
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      {candidate.location} • {candidate.education}
                    </p>

                    {/* Skill Breakdown Chips */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {Object.values(match.skillBreakdown).map((sb) => (
                        <span
                          key={sb.skillName}
                          className={`badge ${sb.isAssessed ? 'badge-verified' : 'badge-neutral'}`}
                          style={{ fontSize: '0.72rem' }}
                        >
                          {sb.skillName}: {sb.candidateScore}/100 {sb.isAssessed ? '✓' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Score & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Match Score
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: match.overallScore >= 80 ? 'var(--status-verified)' : '#A5B4FC' }}>
                      {match.overallScore}%
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <Link to={`/recruiter/candidates/${candidate.id}?jobId=${job.id}`} className="btn btn-secondary btn-sm">
                      Inspect Evidence
                    </Link>

                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => handleShortlist(candidate.id)} className="btn btn-primary btn-sm">
                        Shortlist
                      </button>
                      <button onClick={() => handleInviteAssessment(candidate.id)} className="btn btn-secondary btn-sm" title="Invite to coding challenge">
                        <Play size={12} /> Invite
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

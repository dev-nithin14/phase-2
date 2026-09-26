import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { appStore } from '../../services/store';
import { calculateJobMatch } from '../../services/matching';
import { 
  Award, Briefcase, FileCode2, CheckCircle2, ArrowRight, 
  Clock, ShieldCheck, Plus, Sparkles 
} from 'lucide-react';
import { SkillPassportCard } from '../../components/passport/SkillPassportCard';

export const CandidateDashboard: React.FC = () => {
  const { user } = useAuth();
  const [storeState, setStoreState] = useState(() => appStore.getState());

  useEffect(() => {
    const unsubscribe = appStore.subscribe(() => setStoreState({ ...appStore.getState() }));
    void appStore.syncFromSupabase();
    return unsubscribe;
  }, []);

  if (!user) return null;

  const candidateSkills = storeState.profileSkills[user.id] || [];
  const candidateProjects = storeState.projects[user.id] || [];
  const attempts = storeState.attempts.filter((a) => a.candidate_id === user.id);
  const applications = storeState.applications.filter((a) => a.candidate_id === user.id);
  const allJobs = storeState.jobs.filter((job) => job.status === 'PUBLISHED');

  // Top recommended jobs calculated deterministically
  const recommendedJobs = allJobs
    .map((j) => ({
      job: j,
      match: calculateJobMatch(j, user, candidateSkills, candidateProjects),
    }))
    .sort((a, b) => b.match.overallScore - a.match.overallScore)
    .slice(0, 3);

  // Profile completion calculation
  const completedProfileSteps = [
    Boolean(user.full_name),
    Boolean(user.bio),
    Boolean(user.github_url || user.portfolio_url),
    candidateSkills.length > 0,
    candidateProjects.length > 0,
  ].filter(Boolean).length;
  const completionPct = Math.round((completedProfileSteps / 5) * 100);

  return (
    <div className="main-content">
      {/* Header Greeting */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
            <span className="badge badge-accent">Candidate Workspace</span>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: '0.35rem' }}>Your Career Workspace</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Welcome back, <strong>{user.full_name}</strong>. Continue building proof for your next opportunity.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/candidate/passport" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Award size={16} color="var(--status-verified)" /> Full Skill Passport
          </Link>
          <Link to="/candidate/projects" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={16} /> Add Project Proof
          </Link>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid-4" style={{ marginBottom: '2.5rem' }}>
        <div className="card">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Profile Strength
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--accent-primary)', marginTop: '0.3rem' }}>
            {completionPct}%
          </div>
          <div style={{ width: '100%', height: '5px', background: 'var(--bg-elevated)', borderRadius: '3px', marginTop: '0.6rem', overflow: 'hidden' }}>
            <div style={{ width: `${completionPct}%`, height: '100%', background: 'var(--accent-primary)' }} />
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Verified Skills
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--status-verified)', marginTop: '0.3rem' }}>
            {candidateSkills.filter((s) => s.verification_status !== 'SELF_DECLARED').length}
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}> / {candidateSkills.length} Total</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Assessment & project backed</p>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Applications
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fff', marginTop: '0.3rem' }}>
            {applications.length}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            {applications.filter((a) => a.status === 'SHORTLISTED' || a.status === 'INTERVIEW').length} Shortlisted
          </p>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Assessment Attempts
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--accent-cyan)', marginTop: '0.3rem' }}>
            {attempts.length}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Recorded in your account</p>
        </div>
      </div>

      {/* Split: High-Match Opportunities & Verified Skill Passport preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
        {/* Recommended Jobs */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Briefcase size={18} color="var(--accent-primary)" /> Top Match Opportunities
            </h3>
            <Link to="/jobs" style={{ fontSize: '0.825rem' }}>View all jobs →</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recommendedJobs.length === 0 ? (
              <div className="card" style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>
                No opportunities are available yet. Check back as employers publish roles.
              </div>
            ) : recommendedJobs.map(({ job, match }) => (
              <div key={job.id} className="card card-interactive" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{job.title}</h4>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {job.company?.name} • {job.location} ({job.work_mode})
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
                    {job.skills?.slice(0, 3).map((s) => (
                      <span key={s.id} className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                        {s.skill?.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: match.overallScore >= 80 ? 'var(--status-verified)' : '#A5B4FC' }}>
                    {match.overallScore}%
                  </div>
                  <Link to={`/jobs/${job.id}`} className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>
                    Apply
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Applications Status */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} color="var(--accent-cyan)" /> Application Tracker
            </h3>
            <Link to="/candidate/applications" style={{ fontSize: '0.825rem' }}>See status →</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {applications.length === 0 ? (
              <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No applications yet. Explore available jobs when you are ready.
              </div>
            ) : (
              applications.map((app) => (
                <div key={app.id} className="card" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h5 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{app.job?.title}</h5>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{app.job?.company?.name}</div>
                  </div>

                  <div>
                    <span className={`badge ${
                      app.status === 'ASSESSMENT_COMPLETED' || app.status === 'SHORTLISTED' 
                        ? 'badge-verified' 
                        : 'badge-accent'
                    }`}>
                      {app.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Verified Skill Passport Embed */}
      <div style={{ marginTop: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Your Official Verified Skill Passport</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Cryptographically backed credential summarizing verified assessments and code repository proof.
            </p>
          </div>
        </div>

        <SkillPassportCard
          candidate={user}
          skills={candidateSkills}
          projects={candidateProjects}
          attempts={attempts}
        />
      </div>
    </div>
  );
};

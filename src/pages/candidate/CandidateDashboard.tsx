import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { appStore } from '../../services/store';
import { NormalizedJob, ReferralStats } from '../../types';
import {
  getOrCreateCandidateReferralCode,
  getReferralUrl,
  getCandidateReferralStats,
  recordReferralInvite,
} from '../../services/referralService';
import { searchAggregatedJobs, saveJob, unsaveJob, getSavedJobs } from '../../services/jobDiscovery/jobDiscoveryService';
import {
  Award,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  Clock,
  Plus,
  Sparkles,
  Users,
  Copy,
  Check,
  Share2,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Target,
  TrendingUp,
} from 'lucide-react';
import { SkillPassportCard } from '../../components/passport/SkillPassportCard';
import { calculateProfileCompletion } from '../../services/scoring/scoringEngine';

export const CandidateDashboard: React.FC = () => {
  const { user } = useAuth();
  const [storeState, setStoreState] = useState(() => appStore.getState());

  // Referral System State
  const [referralCode, setReferralCode] = useState('');
  const [referralStats, setReferralStats] = useState<ReferralStats>({
    invited: 0,
    joined: 0,
    completed_profile: 0,
    completed_assessment: 0,
    successful_applications: 0,
  });
  const [copiedLink, setCopiedLink] = useState(false);

  // Recommended Job Feed State
  const [recommendedJobs, setRecommendedJobs] = useState<NormalizedJob[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = appStore.subscribe(() => setStoreState({ ...appStore.getState() }));
    void appStore.syncFromSupabase();
    return unsubscribe;
  }, []);

  // Fetch Referral Code & Stats
  useEffect(() => {
    if (!user) return;
    void getOrCreateCandidateReferralCode(user.id, user.full_name).then((code) => {
      setReferralCode(code);
    });
    void getCandidateReferralStats(user.id).then(setReferralStats);
  }, [user]);

  // Fetch Recommended Jobs & Saved Jobs
  useEffect(() => {
    if (!user) return;
    void searchAggregatedJobs({}, user).then((jobs) => {
      const topMatches = jobs
        .filter((j) => (j.match_percentage || 0) >= 60)
        .slice(0, 4);
      setRecommendedJobs(topMatches.length > 0 ? topMatches : jobs.slice(0, 3));
    });

    void getSavedJobs(user.id).then((saved) => {
      setSavedJobIds(new Set(saved.map((s) => s.job_id)));
    });
  }, [user]);

  if (!user) return null;

  const candidateSkills = storeState.profileSkills[user.id] || [];
  const candidateProjects = storeState.projects[user.id] || [];
  const attempts = storeState.attempts.filter((a) => a.candidate_id === user.id);
  const applications = storeState.applications.filter((a) => a.candidate_id === user.id);

  // Profile completion calculation via deterministic scoring engine
  const profileCompletion = calculateProfileCompletion(
    user,
    candidateSkills.length,
    candidateProjects.length,
    attempts.length
  );
  const completionPct = profileCompletion.percentage;

  const referralUrl = referralCode ? getReferralUrl(referralCode) : '';

  const handleCopyLink = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopiedLink(true);
      if (user) {
        void recordReferralInvite(user.id, referralCode);
        setReferralStats((prev) => ({ ...prev, invited: prev.invited + 1 }));
      }
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      /* ignore copy error */
    }
  };

  const handleShare = async () => {
    if (!referralUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Build Beyond The Resume',
          text: 'Prove what you can build and discover engineering jobs with verified skill proof:',
          url: referralUrl,
        });
        if (user) {
          void recordReferralInvite(user.id, referralCode);
          setReferralStats((prev) => ({ ...prev, invited: prev.invited + 1 }));
        }
      } catch {
        /* share dismissed */
      }
    } else {
      void handleCopyLink();
    }
  };

  const handleToggleSaveJob = async (job: NormalizedJob) => {
    if (!user) return;
    if (savedJobIds.has(job.id)) {
      await unsaveJob(user.id, job.id);
      setSavedJobIds((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    } else {
      await saveJob(user.id, job);
      setSavedJobIds((prev) => new Set(prev).add(job.id));
    }
  };

  return (
    <div className="main-content" style={{ maxWidth: 1140 }}>
      {/* HackMysuru 1.0 Presentation Banner */}
      <div className="hackmysuru-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.4rem' }}>🏛️</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="hackmysuru-badge">HackMysuru 1.0 · Sept 2026</span>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Presented by RankBook</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#F8FAFC', fontWeight: 600, marginTop: '0.2rem' }}>
              Mysuru, Karnataka · Verified Candidate Hiring Portal
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
          <Sparkles size={14} /> Deterministic Skill Verification Active
        </div>
      </div>

      {/* Header Greeting */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <span className="badge badge-accent">Candidate Workspace</span>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: '0.35rem' }}>Your Career Workspace</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Welcome back, <strong>{user.full_name}</strong>. Continue building verified proof for your next opportunity.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/jobs" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Briefcase size={16} /> Discover Jobs
          </Link>
          <Link to="/candidate/passport" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Award size={16} color="var(--status-verified)" /> Full Skill Passport
          </Link>
          <Link to="/candidate/projects" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={16} /> Add Project Proof
          </Link>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid-4" style={{ marginBottom: '2rem' }}>
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

      {/* FEATURE 1: REFER & GROW SECTION */}
      <section
        className="card"
        style={{
          padding: '1.75rem',
          marginBottom: '2.5rem',
          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.05) 0%, rgba(99, 102, 241, 0.04) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="badge badge-accent">
                <Users size={12} /> Refer & Grow
              </span>
              <span className="badge badge-neutral" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                Code: {referralCode || 'GENERATING…'}
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '4px 0' }}>
              Invite Friends & Help Them Discover Opportunities
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: 620, margin: 0 }}>
              Share your unique referral link. Track real platform progress as your peers join, build their Skill Passports, and complete verified assessments.
            </p>
          </div>

          {/* Referral Link & Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              readOnly
              value={referralUrl}
              className="form-input"
              style={{ width: '280px', fontSize: '0.8rem', fontFamily: 'monospace' }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleCopyLink}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {copiedLink ? <Check size={14} /> : <Copy size={14} />}
              {copiedLink ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleShare}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Share2 size={14} /> Share
            </button>
          </div>
        </div>

        {/* Referral Statistics Counters */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 12,
            padding: '14px 16px',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invited</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>{referralStats.invited}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Joined</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--status-verified)' }}>{referralStats.joined}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completed Profile</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{referralStats.completed_profile}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completed Assessment</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>{referralStats.completed_assessment}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Successful Applications</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>{referralStats.successful_applications}</div>
          </div>
        </div>

        {/* Lightweight Referral Progress Badges / Milestones */}
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Referral Milestone Progression
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: '0.8rem' }}>
            <span style={{ color: referralStats.invited > 0 ? 'var(--status-verified)' : 'var(--text-muted)', fontWeight: 600 }}>
              {referralStats.invited > 0 ? '●' : '○'} Invite
            </span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <span style={{ color: referralStats.joined > 0 ? 'var(--status-verified)' : 'var(--text-muted)', fontWeight: 600 }}>
              {referralStats.joined > 0 ? '●' : '○'} Signup
            </span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <span style={{ color: referralStats.completed_profile > 0 ? 'var(--status-verified)' : 'var(--text-muted)', fontWeight: 600 }}>
              {referralStats.completed_profile > 0 ? '●' : '○'} Profile
            </span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <span style={{ color: referralStats.completed_assessment > 0 ? 'var(--status-verified)' : 'var(--text-muted)', fontWeight: 600 }}>
              {referralStats.completed_assessment > 0 ? '●' : '○'} Assessment
            </span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <span style={{ color: referralStats.successful_applications > 0 ? 'var(--status-verified)' : 'var(--text-muted)', fontWeight: 600 }}>
              {referralStats.successful_applications > 0 ? '●' : '○'} Application
            </span>
          </div>
        </div>
      </section>

      {/* FEATURE 3: RECOMMENDED FOR YOU (JOB DISCOVERY AGGREGATION FEED) */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} color="var(--accent-primary)" />
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Recommended For You</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 2 }}>
              Personalized opportunities matching your verified skills, experience, and assessment proof.
            </p>
          </div>
          <Link to="/jobs" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            Explore All Jobs <ArrowRight size={14} />
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {recommendedJobs.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
              No personalized matches found yet. Add more skills or verify projects to unlock recommendations.
            </div>
          ) : (
            recommendedJobs.map((job) => {
              const isSaved = savedJobIds.has(job.id);
              const isDirect = job.source.toLowerCase().includes('employer');

              return (
                <div
                  key={job.id}
                  className="card card-interactive"
                  style={{
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                      <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
                        Source: {job.source}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleToggleSaveJob(job)}
                        style={{ background: 'none', border: 'none', color: isSaved ? '#38bdf8' : 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                        title={isSaved ? 'Saved' : 'Save job'}
                      >
                        {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                      </button>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '4px 0' }}>{job.title}</h3>
                    <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                      {job.company_name} · {job.location} ({job.work_mode})
                    </div>

                    {/* Match Score Badge */}
                    {job.match_percentage !== undefined && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Platform Match:</span>
                        {job.match_percentage !== null ? (
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '0.85rem',
                              color: job.match_percentage >= 80 ? 'var(--status-verified)' : job.match_percentage >= 50 ? '#f59e0b' : 'var(--text-muted)',
                            }}
                          >
                            {job.match_percentage}%
                          </span>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                            Not enough data
                          </span>
                        )}
                      </div>
                    )}

                    {/* Required Skills */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {job.required_skills?.slice(0, 3).map((s, idx) => (
                        <span key={idx} className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 10, marginTop: 4 }}>
                    <Link to="/jobs" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                      View Details →
                    </Link>

                    {isDirect ? (
                      <Link to={`/jobs/${job.source_job_id}`} className="btn btn-primary btn-sm">
                        Apply
                      </Link>
                    ) : (
                      <a
                        href={job.apply_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <ExternalLink size={12} /> Apply
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Split: Applications Status & Why Return / Career Progress */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
        {/* Active Applications Status */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={16} color="var(--accent-cyan)" /> Application Tracker
            </h3>
            <Link to="/candidate/applications" style={{ fontSize: '0.825rem' }}>See status →</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {applications.length === 0 ? (
              <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No applications submitted yet. Discover matching roles to apply with your Skill Passport.
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

        {/* Why Come Back? Continuous Career Progress */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={16} color="var(--status-verified)" /> Career Growth Trajectory
            </h3>
          </div>

          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Target size={16} color="var(--accent-primary)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '0.875rem' }}>Skill Gap Recommendations</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Complete assessment checkpoints for in-demand skills (React, TypeScript, Node.js) to increase job match scores above 85%.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Briefcase size={16} color="var(--status-verified)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '0.875rem' }}>New Employer Opportunities</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Engineering jobs are continuously refreshed across verified sources and platform partners.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Users size={16} color="#38bdf8" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '0.875rem' }}>Referral Milestone Rewards</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Track peers completing assessments with your invite code to unlock community badges.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Skill Passport Embed */}
      <div style={{ marginTop: '2.5rem' }}>
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

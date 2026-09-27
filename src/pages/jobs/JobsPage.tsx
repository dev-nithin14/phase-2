import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NormalizedJob, SavedJob } from '../../types';
import { searchAggregatedJobs, getSavedJobs, saveJob, unsaveJob } from '../../services/jobDiscovery/jobDiscoveryService';
import {
  Briefcase,
  MapPin,
  Building2,
  Search,
  ArrowRight,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Filter,
  DollarSign,
  Globe,
  Share2,
} from 'lucide-react';

export const JobsPage: React.FC = () => {
  const { user } = useAuth();

  // Search & Filter State
  const [roleQuery, setRoleQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [workModeFilter, setWorkModeFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'ALL' | 'RECOMMENDED' | 'SAVED'>('ALL');
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<NormalizedJob[]>([]);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<NormalizedJob | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<Record<string, boolean>>({});

  // Load saved jobs for candidate
  useEffect(() => {
    if (!user) return;
    void getSavedJobs(user.id).then(setSavedJobs);
  }, [user]);

  // Load and search jobs
  useEffect(() => {
    let active = true;
    const fetchJobs = async () => {
      setLoading(true);
      try {
        const results = await searchAggregatedJobs(
          {
            role: roleQuery,
            location: locationQuery,
            work_mode: workModeFilter !== 'ALL' ? workModeFilter : undefined,
          },
          user
        );
        if (active) {
          setJobs(results);
        }
      } catch (err) {
        console.error('Job search error:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    const timer = setTimeout(fetchJobs, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [roleQuery, locationQuery, workModeFilter, user]);

  const savedJobIds = useMemo(() => new Set(savedJobs.map((s) => s.job_id)), [savedJobs]);

  const handleToggleSave = async (job: NormalizedJob) => {
    if (!user) return;
    if (savedJobIds.has(job.id)) {
      await unsaveJob(user.id, job.id);
      setSavedJobs((prev) => prev.filter((s) => s.job_id !== job.id));
    } else {
      await saveJob(user.id, job);
      setSavedJobs((prev) => [
        ...prev,
        {
          id: 'temp-' + Date.now(),
          candidate_id: user.id,
          job_id: job.id,
          source: job.source,
          job_data: job,
          saved_at: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleApplyClick = (job: NormalizedJob) => {
    setAppliedJobs((prev) => ({ ...prev, [job.id]: true }));
    if (job.apply_url.startsWith('http')) {
      window.open(job.apply_url, '_blank', 'noopener,noreferrer');
    }
  };

  const displayedJobs = useMemo(() => {
    if (activeTab === 'SAVED') {
      return savedJobs.map((s) => s.job_data);
    }
    if (activeTab === 'RECOMMENDED') {
      return jobs.filter((j) => (j.match_percentage || 0) >= 65);
    }
    return jobs;
  }, [activeTab, jobs, savedJobs]);

  return (
    <div className="main-content" style={{ maxWidth: 1140 }}>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span className="badge badge-accent">
            <Globe size={12} /> Unified Career Engine
          </span>
          <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
            Multi-Source Aggregation
          </span>
        </div>
        <h1 style={{ fontSize: '2.1rem', fontWeight: 800, marginBottom: '0.4rem' }}>
          Real Job Discovery & Transparent Matching
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 720 }}>
          Discover verified engineering roles from official providers (Adzuna) and direct platform employers. Every opportunity calculates an auditable Skill Passport match based on your verified abilities.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div
        className="card"
        style={{
          padding: '1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{ position: 'absolute', top: '50%', left: 12, transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Role or keywords (e.g. Frontend, React)..."
              value={roleQuery}
              onChange={(e) => setRoleQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.4rem', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <MapPin
              size={16}
              style={{ position: 'absolute', top: '50%', left: 12, transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Location (e.g. Bengaluru, Remote)..."
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.4rem', fontSize: '0.85rem' }}
            />
          </div>

          <select
            value={workModeFilter}
            onChange={(e) => setWorkModeFilter(e.target.value)}
            className="form-select"
            style={{ fontSize: '0.85rem' }}
          >
            <option value="ALL">All Work Modes</option>
            <option value="REMOTE">Remote</option>
            <option value="HYBRID">Hybrid</option>
            <option value="ON-SITE">On-site</option>
          </select>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('ALL')}
        >
          <Briefcase size={14} /> All Opportunities ({jobs.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'RECOMMENDED' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('RECOMMENDED')}
        >
          <Sparkles size={14} /> Recommended For You ({jobs.filter((j) => (j.match_percentage || 0) >= 65).length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'SAVED' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('SAVED')}
        >
          <Bookmark size={14} /> Saved Jobs ({savedJobs.length})
        </button>
      </div>

      {/* Job Cards List */}
      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Briefcase size={36} style={{ opacity: 0.4, marginBottom: 12 }} />
          <div>Discovering verified engineering roles across authorized sources…</div>
        </div>
      ) : displayedJobs.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <AlertCircle size={36} style={{ opacity: 0.4, marginBottom: 12 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            {activeTab === 'SAVED' ? 'No Saved Jobs' : 'No matching jobs found.'}
          </h3>
          <p style={{ fontSize: '0.85rem', maxWidth: 450, margin: '0 auto' }}>
            {activeTab === 'SAVED'
              ? 'Click the bookmark icon on any job card to save opportunities for quick access.'
              : 'Try adjusting your search terms, role title, or location filter to discover more positions.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {displayedJobs.map((job) => {
            const isSaved = savedJobIds.has(job.id);
            const isDirect = job.source.toLowerCase().includes('employer');

            return (
              <article
                key={job.id}
                className="card card-interactive"
                style={{
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  border: isSaved ? '1px solid rgba(56, 189, 248, 0.4)' : undefined,
                }}
              >
                {/* Top Row: Title, Company, Source Badge, Save Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>{job.title}</h2>
                      <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                        {job.work_mode || 'Hybrid'}
                      </span>
                      <span
                        className="badge badge-accent"
                        style={{
                          fontSize: '0.72rem',
                          background: isDirect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                          color: isDirect ? '#34d399' : '#38bdf8',
                        }}
                      >
                        Source: {job.source}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.85rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <Building2 size={14} /> {job.company_name}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={14} /> {job.location}
                      </span>
                      {job.salary_min && (
                        <span style={{ color: '#34d399', fontWeight: 600 }}>
                          ₹{(job.salary_min / 100000).toFixed(1)}L
                          {job.salary_max ? ` - ₹${(job.salary_max / 100000).toFixed(1)}L` : '+'}
                        </span>
                      )}
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Posted {new Date(job.posted_at || Date.now()).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Bookmark Button */}
                  <button
                    type="button"
                    onClick={() => void handleToggleSave(job)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isSaved ? '#38bdf8' : 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                    title={isSaved ? 'Remove from saved' : 'Save job'}
                  >
                    {isSaved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
                  </button>
                </div>

                {/* Description Preview */}
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '4px 0', lineHeight: 1.5 }}>
                  {job.description.length > 200 ? `${job.description.slice(0, 200)}…` : job.description}
                </p>

                {/* Required Skills */}
                {job.required_skills && job.required_skills.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 4 }}>Required:</span>
                    {job.required_skills.map((s, idx) => (
                      <span key={idx} className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Skill Passport Match Breakdown */}
                {job.match_percentage !== undefined && (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Platform Match:
                        </span>
                        {job.match_percentage !== null ? (
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '0.95rem',
                              color: job.match_percentage >= 80 ? 'var(--status-verified)' : job.match_percentage >= 50 ? '#f59e0b' : 'var(--text-muted)',
                            }}
                          >
                            {job.match_percentage}%
                          </span>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                            Not enough data
                          </span>
                        )}
                      </div>

                      {/* Matching and Gap Signals */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: '0.75rem' }}>
                        {job.match_reasons?.slice(0, 3).map((r, idx) => (
                          <span key={idx} style={{ color: '#34d399' }}>
                            {r}
                          </span>
                        ))}
                        {job.missing_skills?.slice(0, 2).map((m, idx) => (
                          <span key={idx} style={{ color: 'var(--text-muted)' }}>
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedJob(job)}
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                    >
                      Why this match?
                    </button>
                  </div>
                )}

                {/* Actions Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedJob(job)}
                  >
                    View Details
                  </button>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {isDirect ? (
                      <Link to={`/jobs/${job.source_job_id}`} className="btn btn-primary btn-sm">
                        Apply on Platform <ArrowRight size={14} />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleApplyClick(job)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <ExternalLink size={14} />
                        {appliedJobs[job.id] ? 'Application Opened' : 'View Original Job'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* JOB DETAILS MODAL */}
      {selectedJob && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 680,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <span className="badge badge-accent" style={{ marginBottom: 6 }}>
                  Source: {selectedJob.source}
                </span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{selectedJob.title}</h3>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {selectedJob.company_name} · {selectedJob.location}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Platform Match Box */}
            {selectedJob.match_percentage !== undefined && (
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#38bdf8' }}>
                    Skill Passport: {selectedJob.match_percentage}% Platform Match
                  </div>
                </div>

                <div style={{ fontSize: '0.82rem', marginBottom: 8, color: 'var(--text-secondary)' }}>
                  Platform match evaluates your verified profile abilities, verified projects, and assessment telemetry against job requirements.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399' }}>Matching Factors:</div>
                  {(selectedJob.match_reasons || []).map((r, idx) => (
                    <div key={idx} style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginLeft: 8 }}>
                      {r}
                    </div>
                  ))}
                  {selectedJob.missing_skills && selectedJob.missing_skills.length > 0 && (
                    <>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: 4 }}>
                        Skill Gaps (Assess to verify):
                      </div>
                      {selectedJob.missing_skills.map((m, idx) => (
                        <div key={idx} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                          {m}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            <div style={{ marginBottom: 18 }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 6 }}>Role Description</h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {selectedJob.description}
              </p>
            </div>

            {/* Required Skills */}
            {selectedJob.required_skills && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 6 }}>Required Skills</h4>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selectedJob.required_skills.map((s, idx) => (
                    <span key={idx} className="badge badge-accent">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void handleToggleSave(selectedJob)}
              >
                {savedJobIds.has(selectedJob.id) ? 'Saved' : 'Save Job'}
              </button>

              <div style={{ display: 'flex', gap: 10 }}>
                {selectedJob.source.toLowerCase().includes('employer') ? (
                  <Link to={`/jobs/${selectedJob.source_job_id}`} className="btn btn-primary btn-sm">
                    Apply on Platform
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleApplyClick(selectedJob)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <ExternalLink size={14} />
                    {appliedJobs[selectedJob.id] ? 'Application Opened' : 'View Original Job'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

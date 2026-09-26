import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { appStore } from '../../services/store';
import { calculateJobMatch } from '../../services/matching';
import { 
  Briefcase, MapPin, Building2, Search, ArrowRight, 
  Sparkles, CheckCircle, Percent, DollarSign 
} from 'lucide-react';

export const JobsPage: React.FC = () => {
  const { user } = useAuth();
  const jobs = appStore.getJobs();
  const [searchTerm, setSearchTerm] = useState('');
  const [workModeFilter, setWorkModeFilter] = useState('ALL');

  const candidateSkills = user ? appStore.getCandidateSkills(user.id) : [];
  const candidateProjects = user ? appStore.getCandidateProjects(user.id) : [];

  const filteredJobs = jobs.filter((j) => {
    const matchesSearch = 
      j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.company?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.skills?.some((s) => s.skill?.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesWorkMode = workModeFilter === 'ALL' || j.work_mode === workModeFilter;

    return matchesSearch && matchesWorkMode;
  });

  return (
    <div className="main-content">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Explore Verified Engineering Opportunities
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Every job lists transparent skill weights and computes your verified match score in real time.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          background: 'var(--bg-card)',
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '2rem',
        }}
      >
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by job title, company, or required skill (e.g. React, Python)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>

        <select
          value={workModeFilter}
          onChange={(e) => setWorkModeFilter(e.target.value)}
          className="form-select"
          style={{ width: 'auto', minWidth: '160px' }}
        >
          <option value="ALL">All Work Modes</option>
          <option value="REMOTE">Remote</option>
          <option value="HYBRID">Hybrid</option>
          <option value="ONSITE">Onsite</option>
        </select>
      </div>

      {/* Jobs Listing */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {filteredJobs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>No opportunities matching your criteria found.</p>
          </div>
        ) : (
          filteredJobs.map((job) => {
            // Live deterministic match calculation for current user
            const match = user && user.role === 'JOB_SEEKER'
              ? calculateJobMatch(job, user, candidateSkills, candidateProjects)
              : null;

            return (
              <div
                key={job.id}
                className="card card-interactive"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                  <img
                    src={job.company?.logo_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=150'}
                    alt={job.company?.name}
                    style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-md)', objectFit: 'cover' }}
                  />

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{job.title}</h2>
                      <span className="badge badge-neutral">{job.work_mode}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Building2 size={14} /> {job.company?.name}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <MapPin size={14} /> {job.location}
                      </span>
                      <span>
                        ₹{(job.min_salary! / 100000).toFixed(1)}L - ₹{(job.max_salary! / 100000).toFixed(1)}L
                      </span>
                      <span>{job.min_experience}+ Yrs Exp</span>
                    </div>

                    {/* Skill Tags with Weights */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {job.skills?.map((s) => (
                        <span key={s.id} className="badge badge-accent" style={{ fontSize: '0.75rem' }}>
                          {s.skill?.name} ({s.weight}%)
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Match Score Badge & Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  {match && (
                    <div
                      style={{
                        background: match.overallScore >= 80 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                        border: match.overallScore >= 80 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.6rem 1rem',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: match.overallScore >= 80 ? 'var(--status-verified)' : '#A5B4FC', fontWeight: 700 }}>
                        Your Match
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fff' }}>
                        {match.overallScore}%
                      </div>
                    </div>
                  )}

                  <Link to={`/jobs/${job.id}`} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    View & Apply <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

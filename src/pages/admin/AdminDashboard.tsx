import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { appStore } from '../../services/store';
import { ShieldCheck, Users, Briefcase, FileCode2, Award } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const state = appStore.getState();

  const totalCandidates = state.profiles.filter((p) => p.role === 'JOB_SEEKER').length;
  const totalRecruiters = state.profiles.filter((p) => p.role === 'RECRUITER').length;
  const totalJobs = state.jobs.length;
  const totalAssessments = state.assessments.length;

  return (
    <div className="main-content" style={{ maxWidth: '1000px', marginTop: '2rem', marginBottom: '3rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div className="brand-icon" style={{ width: '38px', height: '38px' }}>
            <ShieldCheck size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Platform Administration</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Welcome, {user?.full_name || 'Administrator'} ({user?.email})
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border-medium)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Users size={20} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Candidates</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{totalCandidates}</div>
        </div>

        <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border-medium)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Users size={20} color="var(--accent-secondary)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Recruiters</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{totalRecruiters}</div>
        </div>

        <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border-medium)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Briefcase size={20} color="#10B981" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Jobs</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{totalJobs}</div>
        </div>

        <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border-medium)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <FileCode2 size={20} color="#F59E0B" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Assessments</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{totalAssessments}</div>
        </div>
      </div>

      <div className="card" style={{ padding: '1.75rem', border: '1px solid var(--border-accent)', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.75rem' }}>Platform Navigation & Tools</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          Explore workspaces across candidate and recruiter experiences.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <Link to="/candidate/dashboard" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={16} /> Candidate Experience
          </Link>
          <Link to="/recruiter/dashboard" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Briefcase size={16} /> Recruiter Workspace
          </Link>
          <Link to="/jobs" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Explore Jobs
          </Link>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { appStore } from '../../services/store';
import { 
  Building2, Briefcase, Users, FileCode2, Plus, 
  ArrowRight, Award, ShieldCheck, CheckCircle2 
} from 'lucide-react';
import { IntegrityBadge } from '../../components/common/Badge';

export const RecruiterDashboard: React.FC = () => {
  const { user } = useAuth();
  const [storeState, setStoreState] = useState(() => appStore.getState());

  useEffect(() => {
    const unsubscribe = appStore.subscribe(() => setStoreState({ ...appStore.getState() }));
    void appStore.syncFromSupabase();
    return unsubscribe;
  }, []);

  if (!user) return null;

  const ownedJobs = storeState.jobs.filter((job) => job.recruiter_id === user.id);
  const jobs = ownedJobs.filter((job) => job.status === 'PUBLISHED');
  const ownedJobIds = new Set(ownedJobs.map((job) => job.id));
  const applications = storeState.applications.filter((application) => ownedJobIds.has(application.job_id));
  const assessments = storeState.assessments.filter((assessment) => assessment.creator_id === user.id);
  const ownedAssessmentIds = new Set(assessments.map((assessment) => assessment.id));
  const attempts = storeState.attempts.filter((attempt) => ownedAssessmentIds.has(attempt.assessment_id));

  const totalEvaluated = attempts.filter((a) => a.status === 'EVALUATED').length;
  const totalShortlisted = applications.filter((a) => a.status === 'SHORTLISTED' || a.status === 'INTERVIEW').length;

  return (
    <div className="main-content">
      {/* Recruiter Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
            <span className="badge badge-verified">Recruiter Workspace</span>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: '0.35rem' }}>Your Hiring Workspace</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Find verified talent, review evidence, and manage your hiring pipeline.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/recruiter/jobs/new" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={16} /> Publish New Job
          </Link>
          <Link to="/recruiter/assessments/new" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileCode2 size={16} /> Create Assessment
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid-4" style={{ marginBottom: '2.5rem' }}>
        <div className="card">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Active Jobs
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fff', marginTop: '0.3rem' }}>
            {jobs.length}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Across engineering domains</p>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Applications
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--accent-primary)', marginTop: '0.3rem' }}>
            {applications.length}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Ranked deterministically</p>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Completed Assessments
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--status-verified)', marginTop: '0.3rem' }}>
            {totalEvaluated}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>With sandbox telemetry</p>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Hiring Pipeline
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--accent-cyan)', marginTop: '0.3rem' }}>
            {totalShortlisted} Shortlisted
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Passed evidence review</p>
        </div>
      </div>

      {/* Active Jobs & Candidates Rankings Table */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Briefcase size={18} color="var(--accent-primary)" /> Active Jobs & Candidate Rankings
          </h3>
          <Link to="/recruiter/jobs/new" style={{ fontSize: '0.85rem' }}>+ Create another role</Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {jobs.length === 0 ? (
              <div className="card" style={{ padding: '2rem', color: 'var(--text-muted)' }}>
                No active jobs yet. Create your first job to begin receiving applications.
              </div>
            ) : jobs.map((job) => {
            const jobApps = applications.filter((a) => a.job_id === job.id);
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
                  padding: '1.5rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{job.title}</h4>
                    <span className="badge badge-neutral">{job.work_mode}</span>
                    <span className="badge badge-verified">Active</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                    <span>{job.company?.name}</span>
                    <span>•</span>
                    <span>{job.location}</span>
                    <span>•</span>
                    <span>{job.min_experience}+ Yrs Exp</span>
                    <span>•</span>
                    <strong>{jobApps.length} Candidates Applied</strong>
                  </div>

                  {/* Skills with weights */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {job.skills?.map((s) => (
                      <span key={s.id} className="badge badge-accent" style={{ fontSize: '0.72rem' }}>
                        {s.skill?.name}: {s.weight}%
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <Link
                    to={`/recruiter/jobs/${job.id}/candidates`}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Users size={16} /> View Ranked Candidates ({jobApps.length})
                  </Link>
                  <Link
                    to="/recruiter/assessments/new"
                    state={{ jobId: job.id }}
                    className="btn btn-secondary"
                  >
                    <FileCode2 size={16} /> Create Assessment
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Assessment Attempts & Integrity Stream */}
      <div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={18} color="var(--status-verified)" /> Assessment Evaluation & Integrity Audit Stream
        </h3>

        {attempts.length === 0 ? (
          <div className="card" style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>
            No candidate assessment activity yet.
          </div>
        ) : <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Assessment Challenge</th>
                <th>Deterministic Score</th>
                <th>Integrity Signals</th>
                <th>Audit Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((att) => (
                <tr key={att.id}>
                  <td>
                    <strong>{att.candidate?.full_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{att.candidate?.email}</div>
                  </td>
                  <td>{att.assessment?.title}</td>
                  <td>
                    <strong style={{ color: 'var(--status-verified)', fontSize: '1.1rem' }}>
                      {att.technical_score}/100
                    </strong>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Focus Shifts: {att.integrity_summary?.tab_switches || 0} • Fullscreen: {att.integrity_summary?.fullscreen_exits || 0}
                    </div>
                  </td>
                  <td>
                    <IntegrityBadge status={att.integrity_status} />
                  </td>
                  <td>
                    <Link to={`/recruiter/candidates/${att.candidate_id}`} className="btn btn-secondary btn-sm">
                      Inspect Evidence →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      </div>
    </div>
  );
};

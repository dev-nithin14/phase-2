import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { appStore } from '../../services/store';
import { 
  Briefcase, Building2, MapPin, Play, CheckCircle2, 
  Clock, ArrowRight, ShieldCheck 
} from 'lucide-react';

export const CandidateApplicationsPage: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;

  const applications = appStore.getState().applications.filter((a) => a.candidate_id === user.id);
  const assessments = appStore.getAssessments();

  return (
    <div className="main-content">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          My Applications
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Track real-time evaluation status and assessment invitations from hiring teams.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {applications.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3.5rem' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              You haven't submitted any job applications yet.
            </p>
            <Link to="/jobs" className="btn btn-primary">
              Browse Open Opportunities
            </Link>
          </div>
        ) : (
          applications.map((app) => {
            // Find relevant assessment for this job if invited
            const relatedAsmt = assessments.find((a) => a.job_id === app.job_id && a.status === 'PUBLISHED');

            return (
              <div
                key={app.id}
                className="card"
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
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{app.job?.title}</h3>
                    <span className="badge badge-accent">Match {app.match_score}%</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span>{app.job?.company?.name}</span>
                    <span>•</span>
                    <span>Applied on {new Date(app.applied_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Current Status
                    </div>
                    <div style={{ marginTop: '0.2rem' }}>
                      <span className={`badge ${
                        app.status === 'ASSESSMENT_COMPLETED' || app.status === 'SHORTLISTED' || app.status === 'INTERVIEW'
                          ? 'badge-verified'
                          : app.status === 'ASSESSMENT_INVITED'
                          ? 'badge-warning'
                          : 'badge-neutral'
                      }`}>
                        {app.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* If invited to assessment, show direct Take Assessment action */}
                  {app.status === 'ASSESSMENT_INVITED' && relatedAsmt && (
                    <Link
                      to={`/candidate/assessments/${relatedAsmt.id}`}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Play size={16} /> Take Coding Assessment
                    </Link>
                  )}

                  {app.status === 'ASSESSMENT_COMPLETED' && (
                    <Link
                      to="/candidate/passport"
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <ShieldCheck size={14} color="var(--status-verified)" /> View on Passport
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { Profile, ProfileSkill, Project, AssessmentAttempt } from '../../types';
import { buildSkillPassport } from '../../services/skillPassport';
import { VerificationBadge, IntegrityBadge } from '../common/Badge';
import { 
  ShieldCheck, Award, FileCode2, CheckCircle2, 
  ExternalLink, Calendar, GitBranch, Cpu, Sparkles, Printer 
} from 'lucide-react';

interface SkillPassportCardProps {
  candidate: Profile;
  skills: ProfileSkill[];
  projects: Project[];
  attempts: AssessmentAttempt[];
  readOnly?: boolean;
}

export const SkillPassportCard: React.FC<SkillPassportCardProps> = ({
  candidate,
  skills,
  projects,
  attempts,
}) => {
  const passport = buildSkillPassport(candidate, skills, projects, attempts);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="passport-card">
      <div className="passport-watermark">PASSPORT</div>

      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
          <img
            src={candidate.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'}
            alt={candidate.full_name}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--accent-primary)',
              objectFit: 'cover',
              boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="badge badge-verified" style={{ padding: '0.25rem 0.6rem' }}>
                <ShieldCheck size={14} /> Official Verified Credential
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {candidate.id.toUpperCase()}</span>
            </div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '0.35rem', letterSpacing: '-0.02em' }}>
              {candidate.full_name}
            </h1>
            <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)' }}>
              {candidate.bio || 'Software Engineer'} • {candidate.location}
            </p>
          </div>
        </div>

        {/* Global Evidence Rating Pill & Print Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.85rem 1.4rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#A5B4FC', fontWeight: 700, letterSpacing: '0.05em' }}>
              Verified Index
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
              {passport.overall_rating}
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>/100</span>
            </div>
          </div>

          <button
            onClick={handlePrint}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            title="Export or print Skill Passport"
          >
            <Printer size={15} /> Print
          </button>
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          marginBottom: '2.5rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Verified Skills
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--status-verified)', marginTop: '0.2rem' }}>
            {passport.verified_skills_count}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Completed Assessments
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>
            {passport.total_assessments_taken}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Verified Projects
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '0.2rem' }}>
            {passport.total_projects_verified}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Experience
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>
            {candidate.experience_years} Years
          </div>
        </div>
      </div>

      {/* Section: Verified Skills Matrix */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={18} color="var(--accent-primary)" />
            Skills & Evidence Matrix
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Objective scores from platform sandboxed coding evaluations
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {passport.skills.map((s) => (
            <div
              key={s.name}
              style={{
                background: 'rgba(18, 25, 43, 0.7)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{s.name}</h4>
                  {s.assessed_score !== undefined ? (
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--status-verified)' }}>
                      {s.assessed_score}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/100</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.self_level}</span>
                  )}
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <VerificationBadge status={s.verification_status} score={s.assessed_score} showScore={false} />
                </div>

                {/* Evidence Proof Checkmarks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.825rem' }}>
                  {s.assessed_score !== undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--status-verified)' }}>
                      <CheckCircle2 size={14} />
                      <span>Assessment Evidence ({s.assessed_score}/100)</span>
                    </div>
                  )}

                  {s.project_count > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-cyan)' }}>
                      <CheckCircle2 size={14} />
                      <span>{s.project_count} Verified Project Repository Proof(s)</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                      <span style={{ width: '14px', textAlign: 'center' }}>—</span>
                      <span>No project repository attached yet</span>
                    </div>
                  )}
                </div>
              </div>

              {s.evidence_sources.length > 0 && (
                <div
                  style={{
                    marginTop: '0.85rem',
                    paddingTop: '0.65rem',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Latest proof: {s.evidence_sources[0].title}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Section: Assessment Evaluation History */}
      {passport.assessment_history.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Cpu size={18} color="var(--accent-cyan)" />
            Completed Assessment History
          </h3>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Assessment Title</th>
                  <th>Related Role</th>
                  <th>Technical Score</th>
                  <th>Integrity Telemetry</th>
                  <th>Evaluation Date</th>
                </tr>
              </thead>
              <tbody>
                {passport.assessment_history.map((ah, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{ah.title}</strong>
                    </td>
                    <td>{ah.job_title || 'General Engineering Evaluation'}</td>
                    <td>
                      <strong style={{ color: 'var(--status-verified)', fontSize: '1.05rem' }}>
                        {ah.score}/100
                      </strong>
                    </td>
                    <td>
                      <IntegrityBadge status={ah.integrity_status} />
                    </td>
                    <td>{new Date(ah.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer Verification Stamp */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={16} color="var(--accent-primary)" />
          <span>Cryptographically validated evidence record on Beyond the Resume.</span>
        </div>
        <div>
          Last updated: {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
};

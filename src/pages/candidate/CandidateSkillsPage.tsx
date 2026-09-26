import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { appStore } from '../../services/store';
import { VerificationBadge } from '../../components/common/Badge';
import { Award, Plus, CheckCircle2, ShieldAlert, Cpu } from 'lucide-react';

export const CandidateSkillsPage: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;

  const candidateSkills = appStore.getCandidateSkills(user.id);
  const allSkills = appStore.getState().skills;

  const [selectedSkillId, setSelectedSkillId] = useState(allSkills[0]?.id || '');
  const [level, setLevel] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT'>('ADVANCED');
  const [added, setAdded] = useState(false);

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSkillId) return;
    appStore.addCandidateSkill(user.id, selectedSkillId, level);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <div className="main-content">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Skills & Technical Evidence Matrix
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Every skill distinguishes between self-declared proficiency and platform assessment / code repository proof.
        </p>
      </div>

      {/* Disclaimers Box from Section 6 */}
      <div
        style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid var(--border-accent)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          marginBottom: '2rem',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <ShieldAlert size={20} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
        <span>
          <strong>Evidence Standard:</strong> Platform assessment scores represent performance on specific sandboxed technical benchmarks, not absolute determinations of total human engineering potential.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        {/* Add Skill Form */}
        <div className="card" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} color="var(--accent-primary)" />
            Add Skill to Profile
          </h3>

          <form onSubmit={handleAddSkill}>
            <div className="form-group">
              <label className="form-label">Select Technology / Competency</label>
              <select
                value={selectedSkillId}
                onChange={(e) => setSelectedSkillId(e.target.value)}
                className="form-select"
              >
                {allSkills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Self-Declared Level</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
                className="form-select"
              >
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
                <option value="EXPERT">Expert</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Add Skill Claim
            </button>

            {added && (
              <p style={{ color: 'var(--status-verified)', fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'center' }}>
                Skill claim added to profile! Take an assessment to verify.
              </p>
            )}
          </form>
        </div>

        {/* Existing Skills Breakdown Cards */}
        <div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1.25rem' }}>Your Current Skill Evidence Breakdown</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {candidateSkills.map((ps) => (
              <div
                key={ps.id}
                className="card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  padding: '1.25rem 1.5rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{ps.skill?.name}</h4>
                    <span className="badge badge-neutral">{ps.skill?.category}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <div>
                      Self-Declared: <strong>{ps.self_declared_level}</strong>
                    </div>
                    <div>
                      Project Evidence: <strong>{ps.project_count} project(s)</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Platform Assessment
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: ps.assessed_score ? 'var(--status-verified)' : 'var(--text-muted)' }}>
                      {ps.assessed_score !== undefined ? `${ps.assessed_score}/100` : 'Not Assessed'}
                    </div>
                  </div>

                  <VerificationBadge status={ps.verification_status} score={ps.assessed_score} showScore={false} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

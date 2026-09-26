import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { appStore } from '../../services/store';
import { SkillPassportCard } from '../../components/passport/SkillPassportCard';
import { ShieldCheck, Share2, Award, Download } from 'lucide-react';

export const CandidatePassportPage: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;

  const candidateSkills = appStore.getCandidateSkills(user.id);
  const candidateProjects = appStore.getCandidateProjects(user.id);
  const attempts = appStore.getState().attempts.filter((a) => a.candidate_id === user.id);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Public Skill Passport verification URL copied to clipboard!');
  };

  return (
    <div className="main-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-verified)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
            <ShieldCheck size={16} /> Official Credential Registry
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800 }}>Verified Skill Passport</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Digital proof of technical competence. Powered by sandboxed code evaluations and code repository links.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={handleShare} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Share2 size={16} /> Share Credential Link
          </button>
        </div>
      </div>

      <SkillPassportCard
        candidate={user}
        skills={candidateSkills}
        projects={candidateProjects}
        attempts={attempts}
      />
    </div>
  );
};

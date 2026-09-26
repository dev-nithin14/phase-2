import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Save, CheckCircle, GitBranch, Globe, Phone, MapPin } from 'lucide-react';
import { updateReferralMilestone } from '../../services/referralService';

export const CandidateProfilePage: React.FC = () => {
  const { user, updateCurrentUser } = useAuth();
  if (!user) return null;

  const [formData, setFormData] = useState({
    full_name: user.full_name || '',
    avatar_url: user.avatar_url || '',
    bio: user.bio || '',
    location: user.location || '',
    phone: user.phone || '',
    education: user.education || '',
    experience_years: user.experience_years || 0,
    availability: user.availability || 'IMMEDIATELY',
    preferred_job_type: user.preferred_job_type || 'FULL_TIME',
    preferred_location: user.preferred_location || 'HYBRID',
    github_url: user.github_url || '',
    linkedin_url: user.linkedin_url || '',
    portfolio_url: user.portfolio_url || '',
  });

  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCurrentUser({
      ...formData,
      experience_years: Number(formData.experience_years),
    });
    void updateReferralMilestone(user.id, 'PROFILE_COMPLETED');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="main-content" style={{ maxWidth: '860px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Developer Profile
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Keep your professional details up to date. Recruiters evaluate your verified evidence alongside these baseline parameters.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        {saved && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--status-verified-bg)',
              border: '1px solid var(--status-verified-border)',
              color: 'var(--status-verified)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.5rem',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            <CheckCircle size={16} /> Profile changes saved successfully!
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Avatar Image URL</label>
            <input
              type="url"
              value={formData.avatar_url}
              onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
              className="form-input"
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Professional Bio & Focus</label>
          <textarea
            rows={3}
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            className="form-textarea"
            placeholder="Briefly describe your core engineering focus..."
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">Location (City, Country)</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="form-input"
              placeholder="e.g. Mysuru, Karnataka"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Contact</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="form-input"
              placeholder="+91 ..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Years of Experience</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={formData.experience_years}
              onChange={(e) => setFormData({ ...formData, experience_years: Number(e.target.value) })}
              className="form-input"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Education & Degree</label>
          <input
            type="text"
            value={formData.education}
            onChange={(e) => setFormData({ ...formData, education: e.target.value })}
            className="form-input"
            placeholder="e.g. B.E. Computer Science, NIE Mysuru"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">Availability</label>
            <select
              value={formData.availability}
              onChange={(e) => setFormData({ ...formData, availability: e.target.value as any })}
              className="form-select"
            >
              <option value="IMMEDIATELY">Immediately</option>
              <option value="15_DAYS">15 Days</option>
              <option value="1_MONTH">1 Month</option>
              <option value="OPEN">Exploring</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Preferred Job Type</label>
            <select
              value={formData.preferred_job_type}
              onChange={(e) => setFormData({ ...formData, preferred_job_type: e.target.value as any })}
              className="form-select"
            >
              <option value="FULL_TIME">Full Time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERNSHIP">Internship</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Work Mode Preference</label>
            <select
              value={formData.preferred_location}
              onChange={(e) => setFormData({ ...formData, preferred_location: e.target.value as any })}
              className="form-select"
            >
              <option value="HYBRID">Hybrid</option>
              <option value="REMOTE">Remote</option>
              <option value="ONSITE">Onsite</option>
            </select>
          </div>
        </div>

        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#fff' }}>Code Repositories & Profiles</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <GitBranch size={14} /> GitHub Profile URL
            </label>
            <input
              type="url"
              value={formData.github_url}
              onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
              className="form-input"
              placeholder="https://github.com/..."
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Globe size={14} /> LinkedIn URL
            </label>
            <input
              type="url"
              value={formData.linkedin_url}
              onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
              className="form-input"
              placeholder="https://linkedin.com/in/..."
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Globe size={14} /> Portfolio Site
            </label>
            <input
              type="url"
              value={formData.portfolio_url}
              onChange={(e) => setFormData({ ...formData, portfolio_url: e.target.value })}
              className="form-input"
              placeholder="https://..."
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Save size={18} /> Save Developer Profile
        </button>
      </form>
    </div>
  );
};

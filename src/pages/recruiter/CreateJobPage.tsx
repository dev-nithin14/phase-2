import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { appStore } from '../../services/store';
import { JobSkill } from '../../types';
import { Briefcase, ArrowLeft, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';

export const CreateJobPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const allSkills = appStore.getState().skills;
  const companies = appStore.getState().companies;

  const [formData, setFormData] = useState({
    title: 'Senior Frontend Developer',
    description: 'We are seeking an experienced Frontend Developer to lead client architecture, component optimizations, and state management.',
    company_id: companies[0]?.id || '',
    employment_type: 'FULL_TIME' as const,
    location: 'Mysuru, Karnataka',
    work_mode: 'HYBRID' as const,
    min_experience: 3,
    max_experience: 6,
    min_salary: 1800000,
    max_salary: 2800000,
    salary_currency: 'INR',
    deadline: '2026-11-30T23:59:59Z',
    status: 'PUBLISHED' as const,
    assessment_required: true,
  });

  const [skillsConfig, setSkillsConfig] = useState<Array<{ skill_id: string; weight: number; is_required: boolean; min_acceptable_score: number }>>(() => {
    if (allSkills && allSkills.length >= 4) {
      return [
        { skill_id: allSkills[0].id, weight: 40, is_required: true, min_acceptable_score: 75 },
        { skill_id: allSkills[1].id, weight: 25, is_required: true, min_acceptable_score: 70 },
        { skill_id: allSkills[2].id, weight: 20, is_required: true, min_acceptable_score: 70 },
        { skill_id: allSkills[3].id, weight: 15, is_required: true, min_acceptable_score: 65 },
      ];
    }
    return [
      { skill_id: 'f2ee449f-093d-4ec9-b61e-0455ab2e9fe2', weight: 40, is_required: true, min_acceptable_score: 75 },
      { skill_id: '6cea9325-b180-4551-ae7c-a4d0a20f1f2c', weight: 25, is_required: true, min_acceptable_score: 70 },
      { skill_id: '55a5d36c-1b07-4097-a5ec-58bf787a0d18', weight: 20, is_required: true, min_acceptable_score: 70 },
      { skill_id: '7381485a-10a5-4847-a1fd-ac6ceab78196', weight: 15, is_required: true, min_acceptable_score: 65 },
    ];
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalWeight = skillsConfig.reduce((acc, s) => acc + Number(s.weight), 0);

  const handleAddSkillRow = () => {
    const unselected = allSkills.find((s) => !skillsConfig.some((sc) => sc.skill_id === s.id));
    if (unselected) {
      setSkillsConfig([
        ...skillsConfig,
        { skill_id: unselected.id, weight: 10, is_required: true, min_acceptable_score: 60 },
      ]);
    }
  };

  const handleRemoveSkillRow = (index: number) => {
    setSkillsConfig(skillsConfig.filter((_, idx) => idx !== index));
  };

  const handleWeightChange = (index: number, weight: number) => {
    const updated = [...skillsConfig];
    updated[index].weight = weight;
    setSkillsConfig(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (totalWeight !== 100) {
      setErrorMsg(`Skill weights must sum to precisely 100%. Currently: ${totalWeight}%`);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const compiledSkills: JobSkill[] = skillsConfig.map((sc, idx) => ({
        id: `js_${Date.now()}_${idx}`,
        job_id: '',
        skill_id: sc.skill_id,
        skill: allSkills.find((s) => s.id === sc.skill_id),
        weight: sc.weight,
        is_required: sc.is_required,
        min_acceptable_score: sc.min_acceptable_score,
      }));

      const targetCompany = companies.find((c) => c.id === formData.company_id) || companies[0];

      const created = await appStore.createJob({
        ...formData,
        company_id: targetCompany?.id || 'e1000000-0000-0000-0000-000000000001',
        company: targetCompany,
        recruiter_id: user.id,
        skills: compiledSkills,
      });

      navigate(`/recruiter/jobs/${created.id}/candidates`);
    } catch (err: any) {
      console.error('[CreateJobPage] Error persisting job:', err);
      setErrorMsg(err.message || 'Failed to persist job into Supabase database.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-content" style={{ maxWidth: '860px' }}>
      <Link to="/recruiter/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Create New Job Opportunity
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Specify required skill weights. Our matching engine uses these weights to deterministically rank applicants.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        {errorMsg && (
          <div style={{ padding: '0.75rem 1rem', background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger-border)', color: 'var(--status-danger)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} /> {errorMsg}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Job Title</label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="form-input"
            placeholder="e.g. Senior Frontend Developer"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Company</label>
          <select
            value={formData.company_id}
            onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
            className="form-select"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.industry})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Job Description & Responsibilities</label>
          <textarea
            rows={4}
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="form-textarea"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">Work Mode</label>
            <select
              value={formData.work_mode}
              onChange={(e) => setFormData({ ...formData, work_mode: e.target.value as any })}
              className="form-select"
            >
              <option value="HYBRID">Hybrid</option>
              <option value="REMOTE">Remote</option>
              <option value="ONSITE">Onsite</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Location</label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Employment Type</label>
            <select
              value={formData.employment_type}
              onChange={(e) => setFormData({ ...formData, employment_type: e.target.value as any })}
              className="form-select"
            >
              <option value="FULL_TIME">Full Time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERNSHIP">Internship</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.75rem' }}>
          <div className="form-group">
            <label className="form-label">Min Experience (Years)</label>
            <input
              type="number"
              min="0"
              value={formData.min_experience}
              onChange={(e) => setFormData({ ...formData, min_experience: Number(e.target.value) })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Max Annual CTC (INR)</label>
            <input
              type="number"
              value={formData.max_salary}
              onChange={(e) => setFormData({ ...formData, max_salary: Number(e.target.value) })}
              className="form-input"
            />
          </div>
        </div>

        {/* Section 9: Required Skills & Skill Weights */}
        <div style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Required Skills & Weights</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Weights must total exactly 100%. Defines the deterministic matching algorithm.
              </p>
            </div>

            <div
              style={{
                fontSize: '1rem',
                fontWeight: 800,
                color: totalWeight === 100 ? 'var(--status-verified)' : 'var(--status-warning)',
              }}
            >
              Total Weight: {totalWeight}% / 100%
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {skillsConfig.map((sc, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <select
                  value={sc.skill_id}
                  onChange={(e) => {
                    const updated = [...skillsConfig];
                    updated[idx].skill_id = e.target.value;
                    setSkillsConfig(updated);
                  }}
                  className="form-select"
                  style={{ flex: 2 }}
                >
                  {allSkills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </select>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1 }}>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={sc.weight}
                    onChange={(e) => handleWeightChange(idx, Number(e.target.value))}
                    className="form-input"
                    style={{ width: '80px' }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>%</span>
                </div>

                <div style={{ flex: 1 }}>
                  <input
                    type="number"
                    min="40"
                    max="100"
                    placeholder="Min Score"
                    value={sc.min_acceptable_score}
                    onChange={(e) => {
                      const updated = [...skillsConfig];
                      updated[idx].min_acceptable_score = Number(e.target.value);
                      setSkillsConfig(updated);
                    }}
                    className="form-input"
                    title="Minimum acceptable platform assessment score"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveSkillRow(idx)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.5rem', color: 'var(--status-danger)' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddSkillRow}
            className="btn btn-secondary btn-sm"
            style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={14} /> Add Another Required Skill
          </button>
        </div>

        <button
          type="submit"
          disabled={totalWeight !== 100 || loading}
          className="btn btn-primary btn-lg"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          {loading ? 'Persisting to Supabase Database...' : 'Publish Job & Calculate Candidate Matches'}
        </button>
      </form>
    </div>
  );
};

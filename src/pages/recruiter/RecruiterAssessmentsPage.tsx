import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { appStore } from '../../services/store';
import { runAssessmentGeneratorAgent } from '../../services/aiAgents';
import { Assessment, AssessmentQuestion } from '../../types';
import { 
  FileCode2, Sparkles, Plus, Clock, Award, 
  CheckCircle2, ArrowRight, Play, Eye 
} from 'lucide-react';

export const RecruiterAssessmentsPage: React.FC = () => {
  const { user } = useAuth();
  const assessments = appStore.getAssessments();
  const jobs = appStore.getJobs();

  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [roleInput, setRoleInput] = useState('Frontend Developer');
  const [skillsInput, setSkillsInput] = useState('React, JavaScript, TypeScript');
  const [difficultyInput, setDifficultyInput] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [generatedDraftQuestions, setGeneratedDraftQuestions] = useState<AssessmentQuestion[] | null>(null);
  const [createdNotice, setCreatedNotice] = useState(false);

  // Agent 2 Question Generation
  const handleGenerateQuestions = (e: React.FormEvent) => {
    e.preventDefault();
    const skillsList = skillsInput.split(',').map((s) => s.trim()).filter(Boolean);
    const draft = runAssessmentGeneratorAgent({
      role: roleInput,
      skills: skillsList,
      difficulty: difficultyInput,
    });
    setGeneratedDraftQuestions(draft);
  };

  // Recruiter reviews and publishes draft
  const handlePublishAssessment = () => {
    if (!user || !generatedDraftQuestions) return;

    appStore.createAssessment({
      creator_id: user.id,
      title: `${roleInput} Challenge (${difficultyInput})`,
      description: `Targeted technical evaluation assessing ${skillsInput} in a sandboxed runtime.`,
      duration_minutes: 45,
      total_points: 100,
      status: 'PUBLISHED',
      questions: generatedDraftQuestions,
    });

    setIsGeneratorOpen(false);
    setGeneratedDraftQuestions(null);
    setCreatedNotice(true);
    setTimeout(() => setCreatedNotice(false), 3000);
  };

  return (
    <div className="main-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            Technical Assessment Center
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Manage coding challenges, inspect test suites, or generate tailored problems with AI Agent 2.
          </p>
        </div>

        <button onClick={() => setIsGeneratorOpen(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Sparkles size={16} /> Generate with Agent 2
        </button>
      </div>

      {createdNotice && (
        <div style={{ padding: '0.75rem 1rem', background: 'var(--status-verified-bg)', border: '1px solid var(--status-verified-border)', color: 'var(--status-verified)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} /> New assessment challenge successfully published!
        </div>
      )}

      {/* Assessments List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {assessments.map((asmt) => (
          <div key={asmt.id} className="card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{asmt.title}</h3>
                <span className="badge badge-verified">{asmt.status}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                {asmt.description}
              </p>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Duration: {asmt.duration_minutes} Mins</span>
                <span>•</span>
                <span>{asmt.questions?.length || 2} Coding Problems</span>
                <span>•</span>
                <span>Sandboxed: Node.js & Python</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link to={`/candidate/assessments/${asmt.id}`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Eye size={14} /> Preview Candidate Experience
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* AI Agent 2 Question Generator Modal */}
      {isGeneratorOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
        >
          <div className="card" style={{ maxWidth: '780px', width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>
              <Sparkles size={20} />
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Agent 2: Assessment Question Generator</h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Provide target engineering role and required competencies. The agent drafts coding challenges with starter code and test cases. Recruiter review is required before publishing.
            </p>

            <form onSubmit={handleGenerateQuestions} style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Target Role</label>
                  <input
                    type="text"
                    required
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Competencies (Comma separated)</label>
                  <input
                    type="text"
                    required
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Difficulty</label>
                  <select
                    value={difficultyInput}
                    onChange={(e) => setDifficultyInput(e.target.value as any)}
                    className="form-select"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={16} /> Generate Draft Problems
              </button>
            </form>

            {/* Generated Draft Review Section */}
            {generatedDraftQuestions && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--status-verified)' }}>
                  Draft Review (Recruiter Approval Required):
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  {generatedDraftQuestions.map((q, idx) => (
                    <div key={q.id} style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <strong>Problem {idx + 1}: {q.title}</strong>
                        <span className="badge badge-accent">{q.difficulty} • {q.points} Pts</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        {q.statement}
                      </p>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Includes {q.test_cases.length} deterministic test cases & starter templates.
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" onClick={() => setGeneratedDraftQuestions(null)} className="btn btn-secondary">
                    Regenerate
                  </button>
                  <button type="button" onClick={handlePublishAssessment} className="btn btn-success">
                    Approve & Publish Assessment
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" onClick={() => setIsGeneratorOpen(false)} className="btn btn-secondary btn-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

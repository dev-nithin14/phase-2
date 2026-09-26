import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import {
  Assessment, AssessmentQuestion, AssessmentSecurityPolicy, DEFAULT_ASSESSMENT_SECURITY_POLICY, Job, Skill, TestCase,
} from '../../types';
import {
  AssessmentQuestionDraft, createAssessmentDraft, deleteDraftQuestion, getDraftAssessmentQuestions,
  getDraftQuestionKey, getRecruiterAssessments, getRecruiterJobs, publishAssessment, saveAssessmentQuestion, updateDraftSecurityPolicy,
} from '../../services/assessmentService';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';

const blankQuestion = (orderIndex: number): AssessmentQuestionDraft => ({
  title: '',
  statement: '',
  question_type: 'MCQ',
  options: [
    { id: 'A', text: '' },
    { id: 'B', text: '' },
    { id: 'C', text: '' },
    { id: 'D', text: '' },
  ],
  correct_option: 'A',
  skill_id: '',
  constraints: '',
  examples: [],
  starter_code: { javascript: 'function solution() {\n  // Write your solution here\n}\n', python: '' },
  test_cases: [],
  hidden_test_cases: [],
  difficulty: 'MEDIUM',
  points: 5,
  time_limit_sec: 3,
  memory_limit_mb: 256,
  order_index: orderIndex,
});

interface SupabaseErrorDetails {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

const errorText = (error: unknown, operation: string) => {
  const details = error && typeof error === 'object' ? error as SupabaseErrorDetails : {};
  const message = details.message || (error instanceof Error ? error.message : String(error));
  const context = [details.code && `code ${details.code}`, details.details, details.hint && `hint: ${details.hint}`]
    .filter(Boolean)
    .join(' · ');
  const migrationHint = ['42703', '42P01', 'PGRST202'].includes(details.code || '')
    ? ' The required assessment-engine migration may not be applied to this Supabase project.'
    : '';
  const description = `Unable to load ${operation}. Supabase returned: ${message}${context ? ` (${context})` : ''}.${migrationHint}`;
  if (import.meta.env.DEV) console.error(`[AssessmentBuilder] ${description}`, error);
  return description;
};

const SecurityPolicyEditor: React.FC<{
  policy: AssessmentSecurityPolicy;
  onChange: (update: Partial<AssessmentSecurityPolicy>) => void;
}> = ({ policy, onChange }) => (
  <fieldset className="card" style={{ margin: '1rem 0', padding: '1rem' }}>
    <legend className="form-label">Assessment security policy</legend>
    <p>Enabled controls are enforced by this assessment. Unavailable capabilities cannot be enabled.</p>
    <label style={{ display: 'flex', gap: 8, margin: '0.6rem 0' }}><input type="checkbox" checked={policy.laptop_camera} onChange={(event) => onChange({ laptop_camera: event.target.checked })} />Laptop camera permission required at assessment start</label>
    <label style={{ display: 'flex', gap: 8, margin: '0.6rem 0' }}><input type="checkbox" checked={policy.microphone} onChange={(event) => onChange({ microphone: event.target.checked })} />Microphone permission required at assessment start</label>
    <div className="form-group"><label className="form-label" htmlFor="assessment-fullscreen">Fullscreen</label><select id="assessment-fullscreen" className="form-select" value={policy.fullscreen} onChange={(event) => onChange({ fullscreen: event.target.value as AssessmentSecurityPolicy['fullscreen'] })}><option value="OPTIONAL">Optional</option><option value="REQUIRED">Required</option></select></div>
    <label style={{ display: 'flex', gap: 8, margin: '0.6rem 0' }}><input type="checkbox" checked={policy.browser_integrity_monitoring} onChange={(event) => onChange({ browser_integrity_monitoring: event.target.checked })} />Browser focus and clipboard event monitoring</label>
    <label style={{ display: 'flex', gap: 8, margin: '0.6rem 0' }}><input type="checkbox" checked={policy.network_monitoring} onChange={(event) => onChange({ network_monitoring: event.target.checked })} />Browser online/offline event monitoring</label>
    <label style={{ display: 'flex', gap: 8, margin: '0.6rem 0' }}><input type="checkbox" checked={policy.explain_back} onChange={(event) => onChange({ explain_back: event.target.checked })} />Require a written explain-back response before submission</label>
    <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 12, paddingTop: 10 }}>
      <p><strong>Unavailable in this build</strong></p>
      <label style={{ display: 'flex', gap: 8, margin: '0.6rem 0', opacity: 0.65 }}><input type="checkbox" checked={false} disabled />Secondary phone camera (phone pairing unavailable)</label>
      <div className="form-group"><label className="form-label" htmlFor="screen-evidence-policy">Screen evidence</label><select id="screen-evidence-policy" className="form-select" value="DISABLED" disabled><option value="DISABLED">Disabled (capture/storage unavailable)</option></select></div>
      <label style={{ display: 'flex', gap: 8, margin: '0.6rem 0', opacity: 0.65 }}><input type="checkbox" checked={false} disabled />Code similarity (analysis service unavailable)</label>
    </div>
  </fieldset>
);

export const RecruiterAssessmentBuilderPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeJobApplied = useRef<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobError, setJobError] = useState('');
  const [assessmentError, setAssessmentError] = useState('');
  const [skillsError, setSkillsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [selectedJobId, setSelectedJobId] = useState(() => searchParams.get('job') || '');
  const [selectedAgent, setSelectedAgent] = useState('technical');
  const [draft, setDraft] = useState<Assessment | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(45);
  const [securityPolicy, setSecurityPolicy] = useState<AssessmentSecurityPolicy>(DEFAULT_ASSESSMENT_SECURITY_POLICY);
  const [questionDraft, setQuestionDraft] = useState<AssessmentQuestionDraft | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [review, setReview] = useState(false);

  const refresh = async () => {
    if (!user) return;
    setJobError('');
    setAssessmentError('');
    setSkillsError('');
    const [jobsResult, assessmentsResult, skillResult] = await Promise.allSettled([
      getRecruiterJobs(user.id),
      getRecruiterAssessments(user.id),
      supabase.from('skills').select('*').order('name').then(({ data, error: queryError }) => {
        if (queryError) throw queryError;
        return data || [];
      }),
    ]);
    if (jobsResult.status === 'fulfilled') setJobs(jobsResult.value);
    else setJobError(errorText(jobsResult.reason, 'recruiter-owned jobs'));
    if (assessmentsResult.status === 'fulfilled') setAssessments(assessmentsResult.value);
    else setAssessmentError(errorText(assessmentsResult.reason, 'recruiter assessments'));
    if (skillResult.status === 'fulfilled') setSkills(skillResult.value as Skill[]);
    else setSkillsError(errorText(skillResult.reason, 'the skill catalog'));
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    refresh()
      .catch((loadError) => { if (active) setActionError(errorText(loadError, 'assessment data')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    const routeJobId = searchParams.get('job');
    const stateJobId = (location.state as { jobId?: string } | null)?.jobId;
    const jobId = routeJobId || stateJobId;
    if (!jobId) return;
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;
    const routeKey = `${location.pathname}:${jobId}`;
    if (routeJobApplied.current === routeKey) return;
    routeJobApplied.current = routeKey;
    setSelectedJobId(jobId);
    setTitle((currentTitle) => currentTitle || `${job.title} Technical Assessment`);
    if (location.pathname.endsWith('/create')) setTitle(`${job.title} Technical Assessment`);
  }, [location.pathname, location.state, jobs, searchParams]);

  const selectedJobRoute = (flow: 'create' | 'ai') => `/recruiter/assessments/${flow}?job=${encodeURIComponent(selectedJobId)}`;
  const isManualRoute = location.pathname.endsWith('/create');
  const isAgentRoute = location.pathname.endsWith('/ai');

  const selectedJob = jobs.find((job) => job.id === selectedJobId);
  const selectedJobSkills = selectedJob?.skills?.map((jobSkill) => jobSkill.skill).filter((skill): skill is Skill => Boolean(skill)) || skills;
  const questions = draft?.questions || [];
  const totalMarks = questions.reduce((total, question) => total + Number(question.points), 0);

  useEffect(() => {
    const requestedJobId = searchParams.get('job');
    if (!requestedJobId || loading || jobError || selectedJob) return;
    setActionError('The selected job was not returned by the authenticated recruiter jobs query. Confirm that the job belongs to this recruiter account.');
  }, [searchParams, loading, jobError, selectedJob]);

  const beginDraft = async () => {
    if (!user || !selectedJob || !title.trim()) {
      setActionError('Select an owned job and enter an assessment title.');
      return;
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 480) {
      setActionError('Duration must be between 1 and 480 minutes.');
      return;
    }
    setSaving(true);
    setActionError('');
    try {
      const created = await createAssessmentDraft({
        jobId: selectedJob.id,
        recruiterId: user.id,
        title,
        description,
        durationMinutes: duration,
        securityPolicy,
      });
      setDraft({ ...created, job: selectedJob, questions: [] });
      setQuestionDraft(blankQuestion(0));
      await refresh();
    } catch (createError) {
      setActionError(errorText(createError, 'the assessment draft'));
    } finally {
      setSaving(false);
    }
  };

  const editQuestion = async (question: AssessmentQuestion) => {
    setActionError('');
    setEditingQuestionId(question.id);
    try {
      const key = await getDraftQuestionKey(question.id);
      setQuestionDraft({ ...question, correct_option: key.correct_option || '', hidden_test_cases: key.hidden_test_cases || [] });
    } catch (keyError) {
      setActionError(errorText(keyError, 'the question answer key'));
      setEditingQuestionId(null);
    }
  };

  const resumeDraft = async (assessment: Assessment) => {
    if (!user) return;
    setActionError('');
    try {
      const savedQuestions = await getDraftAssessmentQuestions(assessment.id, user.id);
      setDraft({ ...assessment, questions: savedQuestions });
    } catch (loadError) {
      setActionError(errorText(loadError, 'draft questions'));
      return;
    }
    if (assessment.job_id) navigate(`/recruiter/assessments/create?job=${encodeURIComponent(assessment.job_id)}`);
    setSelectedJobId(assessment.job_id || '');
    setTitle(assessment.title);
    setDescription(assessment.description || '');
    setDuration(assessment.duration_minutes);
    setSecurityPolicy({ ...DEFAULT_ASSESSMENT_SECURITY_POLICY, ...assessment.security_policy });
    setQuestionDraft(blankQuestion(assessment.questions?.length || 0));
    setReview(false);
  };

  const saveQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || !user || !questionDraft) return;
    if (!questionDraft.skill_id) {
      setActionError('Choose a skill from the existing skill catalog.');
      return;
    }
    if (questionDraft.question_type === 'MCQ') {
      if (questionDraft.options.some((option) => !option.text.trim())) {
        setActionError('Complete all four answer options.');
        return;
      }
      if (!questionDraft.correct_option) {
        setActionError('Choose the correct option.');
        return;
      }
    } else if (questionDraft.test_cases.length === 0 || questionDraft.test_cases.some((test) => !test.input.trim() || !test.expected_output.trim())) {
      setActionError('Add at least one valid coding test case with input and expected output.');
      return;
    }
    if (!questionDraft.title.trim() || !questionDraft.statement.trim() || !Number.isInteger(questionDraft.points) || questionDraft.points < 1) {
      setActionError('Question title, prompt, and positive marks are required.');
      return;
    }

    setSaving(true);
    setActionError('');
    try {
      const saved = await saveAssessmentQuestion(draft, user.id, {
        ...questionDraft,
        id: editingQuestionId || undefined,
        order_index: editingQuestionId
          ? questions.find((question) => question.id === editingQuestionId)?.order_index ?? questions.length
          : questions.length,
      });
      const nextQuestions = editingQuestionId
        ? questions.map((question) => question.id === editingQuestionId ? saved : question)
        : [...questions, saved];
      setDraft({ ...draft, questions: nextQuestions });
      setQuestionDraft(blankQuestion(nextQuestions.length));
      setEditingQuestionId(null);
      await refresh();
    } catch (saveError) {
      setActionError(errorText(saveError, 'saving the assessment question'));
    } finally {
      setSaving(false);
    }
  };

  const removeQuestion = async (questionId: string) => {
    if (!draft || !user) return;
    setSaving(true);
    setActionError('');
    try {
      await deleteDraftQuestion(draft.id, user.id, questionId);
      const nextQuestions = questions.filter((question) => question.id !== questionId)
        .map((question, index) => ({ ...question, order_index: index }));
      setDraft({ ...draft, questions: nextQuestions });
      setQuestionDraft(blankQuestion(nextQuestions.length));
      setEditingQuestionId(null);
      await refresh();
    } catch (deleteError) {
      setActionError(errorText(deleteError, 'deleting the draft question'));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!draft || !user) return;
    setPublishing(true);
    setActionError('');
    try {
      await publishAssessment(draft.id);
      setDraft(null);
      setReview(false);
      setQuestionDraft(null);
      setTitle('');
      setDescription('');
      setSecurityPolicy(DEFAULT_ASSESSMENT_SECURITY_POLICY);
      navigate('/recruiter/assessments');
      await refresh();
    } catch (publishError) {
      setActionError(errorText(publishError, 'publishing the assessment'));
    } finally {
      setPublishing(false);
    }
  };

  const replaceQuestionDraft = (update: Partial<AssessmentQuestionDraft>) => {
    setQuestionDraft((current) => current ? { ...current, ...update } : current);
  };

  const updateSecurityPolicy = (update: Partial<AssessmentSecurityPolicy>) => {
    const nextPolicy = { ...securityPolicy, ...update };
    setSecurityPolicy(nextPolicy);
    if (draft && user) {
      setSaving(true);
      setActionError('');
      void updateDraftSecurityPolicy(draft.id, user.id, nextPolicy)
        .then(() => setDraft((currentDraft) => currentDraft ? { ...currentDraft, security_policy: nextPolicy } : currentDraft))
        .catch((policyError) => setActionError(errorText(policyError, 'saving the assessment security policy')))
        .finally(() => setSaving(false));
    }
  };

  if (loading) return <main className="main-content">Loading your jobs and assessments…</main>;

  return (
    <main className="main-content" style={{ maxWidth: 1080 }}>
      <Link to="/recruiter/dashboard" className="nav-link" style={{ marginBottom: 20 }}>
        <ArrowLeft size={16} /> Recruiter workspace
      </Link>
      <header style={{ margin: '0 0 1.5rem' }}>
        <span className="badge badge-accent">Recruiter Assessment Builder</span>
        <h1 style={{ fontSize: '2rem', marginTop: 8 }}>Prepare an assessment</h1>
        <p>AI prepares. Recruiter decides. Candidate proves.</p>
      </header>

      {(isManualRoute || isAgentRoute) && <Link to="/recruiter/assessments" className="nav-link" style={{ marginBottom: 16 }}>Back to job selection</Link>}

      {[jobError, assessmentError, skillsError, actionError].filter(Boolean).map((message) => <div key={message} role="alert" className="card" style={{ borderColor: 'var(--status-danger)', marginBottom: 16 }}>{message}</div>)}

      {!draft && (
        <>
          <section className="card" style={{ marginBottom: 20 }}>
            <label className="form-label" htmlFor="assessment-job">Select a job you own</label>
            <select id="assessment-job" className="form-select" value={selectedJobId} disabled={isManualRoute || isAgentRoute} onChange={(event) => {
              const job = jobs.find((item) => item.id === event.target.value);
              setSelectedJobId(event.target.value);
              if (job && !title) setTitle(`${job.title} Technical Assessment`);
            }}>
              <option value="">Choose a job</option>
              {jobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.company?.name || 'Company'} · {job.status}</option>)}
            </select>
            {!selectedJob && !jobError && <p style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Select a job to continue.</p>}
            {!jobError && jobs.length === 0 && <p style={{ marginTop: 8 }}>No recruiter-owned jobs found. Create a job before creating its assessment.</p>}
            {selectedJob && <div style={{ marginTop: 10 }}><p><strong>{selectedJob.title}</strong> · {selectedJob.company?.name || 'Company'} · Job ID: {selectedJob.id}</p><p>{selectedJob.description}</p><p>Required skills: {selectedJob.skills?.map((item) => item.skill?.name).filter(Boolean).join(', ') || 'No job skills attached'}</p></div>}
          </section>

          {!isManualRoute && !isAgentRoute && (
            <section>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 12 }}>How would you like to prepare this assessment?</h2>
              <div className="grid-2">
                <article className="card">
                  <h3>Build manually</h3>
                  <p>Create and review every question yourself.</p>
                  <button className="btn btn-primary" disabled={!selectedJob} onClick={() => navigate(selectedJobRoute('create'))}>Build Manually</button>
                </article>
                <article className="card">
                  <h3>AI assessment agent</h3>
                  <p>Choose an agent to prepare a draft using this job’s context.</p>
                  <button className="btn btn-secondary" disabled={!selectedJob} onClick={() => navigate(selectedJobRoute('ai'))}>Choose AI Agent</button>
                </article>
              </div>
            </section>
          )}

          {isAgentRoute && (
            <section className="card">
              <span className="badge badge-neutral">AI generation unavailable</span>
              <h2 style={{ fontSize: '1.2rem', marginTop: 8 }}>Choose Assessment Agent</h2>
              <p>Agent labels are shown for the planned flow. No real AI provider is configured, so generation is disabled and no generated questions are fabricated.</p>
              <div style={{ display: 'grid', gap: 8, margin: '1rem 0' }}>
                {[
                  ['technical', 'Technical Assessment Agent', 'Technical questions based on this job’s required skills.'],
                  ['coding', 'Coding Assessment Agent', 'Programming and problem-solving questions.'],
                  ['conceptual', 'Conceptual Assessment Agent', 'Fundamentals and technical understanding.'],
                  ['mixed', 'Mixed Assessment Agent', 'A balanced MCQ and coding assessment.'],
                ].map(([id, name, summary]) => <label key={id} className="card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><input type="radio" name="assessment-agent" checked={selectedAgent === id} onChange={() => setSelectedAgent(id)} /><span><strong>{name}</strong><br /><small>{summary}</small></span><span className="badge badge-neutral" style={{ marginLeft: 'auto' }}>Unavailable</span></label>)}
              </div>
              <button className="btn btn-secondary" disabled title="No AI provider is configured">AI assessment generation is not configured yet</button>
                <button className="btn btn-primary" style={{ marginLeft: 8 }} onClick={() => navigate(selectedJobRoute('create'))}>Build Manually</button>
            </section>
          )}

          {isManualRoute && (
            <section className="card">
              <h2 style={{ fontSize: '1.2rem', marginBottom: 12 }}>Assessment details</h2>
              <div className="form-group"><label className="form-label" htmlFor="assessment-title">Title</label><input id="assessment-title" className="form-input" value={title} onChange={(event) => setTitle(event.target.value)} /></div>
              <div className="form-group"><label className="form-label" htmlFor="assessment-description">Description</label><textarea id="assessment-description" className="form-textarea" value={description} onChange={(event) => setDescription(event.target.value)} /></div>
              <div className="form-group"><label className="form-label" htmlFor="assessment-duration">Duration (minutes)</label><input id="assessment-duration" className="form-input" type="number" min={1} max={480} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></div>
              <SecurityPolicyEditor policy={securityPolicy} onChange={updateSecurityPolicy} />
              <button className="btn btn-primary" disabled={saving || !title.trim()} onClick={beginDraft}>{saving ? 'Saving draft…' : 'Create Draft'}</button>
            </section>
          )}
        </>
      )}

      {draft && (
        <>
          <section className="card" style={{ marginBottom: 20 }}>
            <span className="badge badge-neutral">DRAFT · Manual</span>
            <h2 style={{ fontSize: '1.4rem', marginTop: 8 }}>{draft.title}</h2>
            <p>Job: {selectedJob?.title || draft.job?.title} · Duration: {draft.duration_minutes} min · Questions: {questions.length} · Marks: {totalMarks}</p>
            <p>Skills: {[...new Set(questions.map((question) => skills.find((skill) => skill.id === question.skill_id)?.name).filter(Boolean))].join(', ') || 'Assign a skill to each question'}</p>
          </section>

          {!review ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 1fr)', gap: 20, alignItems: 'start' }}>
              <section>
                <h2 style={{ fontSize: '1.2rem', marginBottom: 12 }}>Draft questions</h2>
                {questions.length === 0 && <div className="card">No questions yet. Add the first question to this draft.</div>}
                {questions.map((question, index) => (
                  <article className="card" key={question.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div><span className="badge badge-neutral">QUESTION {index + 1} · {question.question_type}</span><h3 style={{ marginTop: 8 }}>{question.title}</h3></div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <button className="btn btn-secondary btn-sm" aria-label={`Edit ${question.title}`} onClick={() => editQuestion(question)}>Edit</button>
                        <button className="btn btn-secondary btn-sm" aria-label={`Delete ${question.title}`} onClick={() => void removeQuestion(question.id)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <p>{question.statement}</p>
                    <small>{skills.find((skill) => skill.id === question.skill_id)?.name || 'Skill'} · {question.difficulty} · {question.points} marks</small>
                  </article>
                ))}
                <button className="btn btn-secondary" onClick={() => { setEditingQuestionId(null); setQuestionDraft(blankQuestion(questions.length)); }}><Plus size={16} /> Add Question</button>
              </section>

              {questionDraft && (
                <form className="card" onSubmit={saveQuestion}>
                  <h2 style={{ fontSize: '1.15rem', marginBottom: 12 }}>{editingQuestionId ? 'Edit question' : 'Add question'}</h2>
                  <div className="form-group"><label className="form-label" htmlFor="question-type">Question type</label><select id="question-type" className="form-select" value={questionDraft.question_type} onChange={(event) => replaceQuestionDraft({ question_type: event.target.value as 'MCQ' | 'CODING' })}><option value="MCQ">Multiple choice</option><option value="CODING">Coding</option></select></div>
                  <div className="form-group"><label className="form-label" htmlFor="question-title">Title</label><input id="question-title" className="form-input" required value={questionDraft.title} onChange={(event) => replaceQuestionDraft({ title: event.target.value })} /></div>
                  <div className="form-group"><label className="form-label" htmlFor="question-statement">Question / problem statement</label><textarea id="question-statement" className="form-textarea" required value={questionDraft.statement} onChange={(event) => replaceQuestionDraft({ statement: event.target.value })} /></div>
                  <div className="form-group"><label className="form-label" htmlFor="question-skill">Skill</label><select id="question-skill" className="form-select" required value={questionDraft.skill_id} onChange={(event) => replaceQuestionDraft({ skill_id: event.target.value })}><option value="">Choose a catalog skill</option>{selectedJobSkills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group"><label className="form-label" htmlFor="question-marks">Marks</label><input id="question-marks" className="form-input" type="number" min={1} value={questionDraft.points} onChange={(event) => replaceQuestionDraft({ points: Number(event.target.value) })} /></div>
                    <div className="form-group"><label className="form-label" htmlFor="question-difficulty">Difficulty</label><select id="question-difficulty" className="form-select" value={questionDraft.difficulty} onChange={(event) => replaceQuestionDraft({ difficulty: event.target.value as AssessmentQuestion['difficulty'] })}><option value="EASY">Easy</option><option value="MEDIUM">Intermediate</option><option value="HARD">Hard</option></select></div>
                  </div>
                  {questionDraft.question_type === 'MCQ' ? (
                    <fieldset style={{ border: 0, padding: 0, margin: '0 0 1rem' }}><legend className="form-label">Answer options · choose the correct answer</legend>{questionDraft.options.map((option, index) => <div key={option.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}><input type="radio" name="correct-option" checked={questionDraft.correct_option === option.id} onChange={() => replaceQuestionDraft({ correct_option: option.id })} aria-label={`Mark option ${option.id} correct`} /><input className="form-input" aria-label={`Option ${option.id}`} value={option.text} onChange={(event) => replaceQuestionDraft({ options: questionDraft.options.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item) })} placeholder={`Option ${option.id}`} /></div>)}</fieldset>
                  ) : (
                    <>
                      <div className="form-group"><label className="form-label" htmlFor="coding-starter">JavaScript starter code</label><textarea id="coding-starter" className="form-textarea" rows={7} value={questionDraft.starter_code.javascript} onChange={(event) => replaceQuestionDraft({ starter_code: { ...questionDraft.starter_code, javascript: event.target.value } })} /></div>
                      <div className="form-group"><label className="form-label" htmlFor="coding-tests">Visible test cases (one JSON object per line: input, expected_output)</label><textarea id="coding-tests" className="form-textarea" rows={4} value={questionDraft.test_cases.map((test) => JSON.stringify({ input: test.input, expected_output: test.expected_output })).join('\n')} onChange={(event) => {
                        const cases: TestCase[] = event.target.value.split('\n').filter((line) => line.trim()).map((line, index) => {
                          try { const parsed = JSON.parse(line); return { id: `visible-${index + 1}`, input: String(parsed.input ?? ''), expected_output: String(parsed.expected_output ?? ''), is_hidden: false }; }
                          catch { return { id: `invalid-${index + 1}`, input: line, expected_output: '', is_hidden: false }; }
                        });
                        replaceQuestionDraft({ test_cases: cases });
                      }} placeholder={'{"input":"[2,3]","expected_output":"5"}'} /></div>
                    </>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-primary" type="submit" disabled={saving}><Save size={15} /> {saving ? 'Saving…' : 'Save Question'}</button><button className="btn btn-secondary" type="button" onClick={() => { setQuestionDraft(null); setEditingQuestionId(null); }}>Close</button></div>
                </form>
              )}
            </div>
          ) : (
            <section className="card">
              <h2 style={{ fontSize: '1.25rem' }}>Assessment review</h2>
              <p>{draft.title} · {selectedJob?.title} · Manual · {draft.duration_minutes} minutes · {questions.length} questions · {totalMarks} marks</p>
              <p>Policy: camera {securityPolicy.laptop_camera ? 'on' : 'off'}, mic {securityPolicy.microphone ? 'on' : 'off'}, fullscreen {securityPolicy.fullscreen.toLowerCase()}, browser monitoring {securityPolicy.browser_integrity_monitoring ? 'on' : 'off'}, network events {securityPolicy.network_monitoring ? 'on' : 'off'}, explain-back {securityPolicy.explain_back ? 'on' : 'off'}.</p>
              <SecurityPolicyEditor policy={securityPolicy} onChange={updateSecurityPolicy} />
              {questions.map((question, index) => <article key={question.id} style={{ padding: '1rem 0', borderTop: '1px solid var(--border-subtle)' }}><span className="badge badge-neutral">QUESTION {index + 1} · {question.question_type} · {question.difficulty} · {question.points} marks</span><h3 style={{ marginTop: 8 }}>{question.title}</h3><p>{question.statement}</p>{question.question_type === 'MCQ' && <ul>{question.options.map((option) => <li key={option.id}>{option.id}. {option.text}</li>)}</ul>}</article>)}
              <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-secondary" onClick={() => setReview(false)}>Back to Edit</button><button className="btn btn-primary" disabled={!questions.length || publishing || saving} onClick={() => void handlePublish()}>{publishing ? 'Publishing…' : 'Publish Assessment'}</button></div>
            </section>
          )}
          {!review && <button className="btn btn-primary" style={{ marginTop: 18 }} disabled={!questions.length} onClick={() => setReview(true)}>Review Before Publishing</button>}
        </>
      )}

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: 12 }}>Your assessments</h2>
        {assessmentError ? null : assessments.length === 0 ? <p>No assessments yet.</p> : assessments.map((assessment) => <article className="card" key={assessment.id} style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}><div><span className={`badge ${assessment.status === 'PUBLISHED' ? 'badge-verified' : 'badge-neutral'}`}>{assessment.status}</span><h3 style={{ marginTop: 6 }}>{assessment.title}</h3><p>{assessment.job?.title || 'No linked job'} · {assessment.duration_minutes} min · {assessment.question_count || 0} questions</p></div>{assessment.status === 'DRAFT' ? <button className="btn btn-secondary btn-sm" onClick={() => void resumeDraft(assessment)}>Continue Draft</button> : <Link className="btn btn-secondary btn-sm" to={`/recruiter/assessments/${assessment.id}/results`}>Candidate Results</Link>}</article>)}
      </section>
    </main>
  );
};

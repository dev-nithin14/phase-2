import { supabase } from './supabase';
import { Assessment, AssessmentAttempt, AssessmentQuestion, AssessmentSecurityPolicy, IntegrityEvent, Job, Submission } from '../types';

export interface AssessmentQuestionDraft extends Omit<AssessmentQuestion, 'id' | 'assessment_id' | 'skill'> {
  id?: string;
  correct_option?: string;
  hidden_test_cases?: AssessmentQuestion['test_cases'];
}

const questionColumns = 'id, assessment_id, skill_id, title, statement, question_type, options, constraints, examples, starter_code, test_cases, difficulty, points, time_limit_sec, memory_limit_mb, order_index, skill:skills(*)';

export async function getRecruiterJobs(recruiterId: string): Promise<Job[]> {
  const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authenticatedUser) throw new Error('No active Supabase Auth user was found. Sign in again before loading recruiter jobs.');
  if (authenticatedUser.id !== recruiterId) {
    throw new Error('The active Supabase Auth user does not match the recruiter profile loaded by the app. Refresh the session and retry.');
  }

  const { data, error } = await supabase
    .from('jobs')
    .select('*, company:companies(*), job_skills(*, skill:skills(*))')
    .eq('recruiter_id', recruiterId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((job: any) => ({
    ...job,
    skills: (job.job_skills || []).map((jobSkill: any) => ({ ...jobSkill, skill: jobSkill.skill })),
  }));
}

export async function getRecruiterAssessments(recruiterId: string): Promise<Assessment[]> {
  const { data, error } = await supabase
    .from('assessments')
    .select('*, job:jobs(*)')
    .eq('creator_id', recruiterId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const assessments = data || [];
  if (assessments.length === 0) return [];

  const { data: questionRows, error: questionsError } = await supabase
    .from('assessment_questions')
    .select('assessment_id')
    .in('assessment_id', assessments.map((assessment) => assessment.id));
  if (questionsError) throw questionsError;
  const questionCounts = new Map<string, number>();
  for (const question of questionRows || []) {
    questionCounts.set(question.assessment_id, (questionCounts.get(question.assessment_id) || 0) + 1);
  }
  return assessments.map((assessment) => ({
    ...assessment,
    question_count: questionCounts.get(assessment.id) || 0,
  })) as Assessment[];
}

export async function getDraftAssessmentQuestions(assessmentId: string, recruiterId: string): Promise<AssessmentQuestion[]> {
  const { data: owner, error: ownerError } = await supabase
    .from('assessments')
    .select('id')
    .eq('id', assessmentId)
    .eq('creator_id', recruiterId)
    .eq('status', 'DRAFT')
    .single();
  if (ownerError || !owner) throw ownerError || new Error('Only the owner can reopen this assessment draft.');

  const { data, error } = await supabase
    .from('assessment_questions')
    .select(questionColumns)
    .eq('assessment_id', assessmentId)
    .order('order_index');
  if (error) throw error;
  return (data || []) as unknown as AssessmentQuestion[];
}

export async function getDraftQuestionKey(questionId: string): Promise<{
  correct_option: string | null;
  hidden_test_cases: AssessmentQuestion['test_cases'];
}> {
  const { data, error } = await supabase
    .from('assessment_question_keys')
    .select('correct_option, hidden_test_cases')
    .eq('question_id', questionId)
    .single();
  if (error) throw error;
  return data as { correct_option: string | null; hidden_test_cases: AssessmentQuestion['test_cases'] };
}

export async function createAssessmentDraft(params: {
  jobId: string;
  recruiterId: string;
  title: string;
  description: string;
  durationMinutes: number;
  securityPolicy: AssessmentSecurityPolicy;
}): Promise<Assessment> {
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, recruiter_id')
    .eq('id', params.jobId)
    .eq('recruiter_id', params.recruiterId)
    .single();
  if (jobError || !job) throw jobError || new Error('Select a job owned by your recruiter account.');

  const { data, error } = await supabase
    .from('assessments')
    .insert({
      job_id: job.id,
      creator_id: params.recruiterId,
      title: params.title.trim(),
      description: params.description.trim(),
      duration_minutes: params.durationMinutes,
      total_points: 0,
      status: 'DRAFT',
      security_policy: params.securityPolicy,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Assessment;
}

export async function updateDraftSecurityPolicy(
  assessmentId: string,
  recruiterId: string,
  securityPolicy: AssessmentSecurityPolicy
): Promise<void> {
  const { data, error } = await supabase
    .from('assessments')
    .update({ security_policy: securityPolicy, updated_at: new Date().toISOString() })
    .eq('id', assessmentId)
    .eq('creator_id', recruiterId)
    .eq('status', 'DRAFT')
    .select('id')
    .single();
  if (error) throw error;
  if (!data) throw new Error('Assessment draft was not found or is no longer editable.');
}

export async function saveAssessmentQuestion(
  assessment: Assessment,
  recruiterId: string,
  draft: AssessmentQuestionDraft
): Promise<AssessmentQuestion> {
  const { data: owner, error: ownerError } = await supabase
    .from('assessments')
    .select('id')
    .eq('id', assessment.id)
    .eq('creator_id', recruiterId)
    .eq('status', 'DRAFT')
    .single();
  if (ownerError || !owner) throw ownerError || new Error('Only the assessment owner can edit a draft.');

  const { correct_option: correctOption, hidden_test_cases: hiddenTestCases, ...question } = draft;
  const payload = {
    assessment_id: assessment.id,
    skill_id: question.skill_id || null,
    title: question.title.trim(),
    statement: question.statement.trim(),
    question_type: question.question_type,
    options: question.question_type === 'MCQ' ? question.options : [],
    constraints: question.constraints || null,
    examples: question.examples || [],
    starter_code: question.starter_code || { javascript: '', python: '' },
    test_cases: question.question_type === 'CODING' ? question.test_cases : [],
    difficulty: question.difficulty,
    points: question.points,
    time_limit_sec: question.time_limit_sec,
    memory_limit_mb: question.memory_limit_mb,
    order_index: question.order_index,
  };

  const query = question.id
    ? supabase.from('assessment_questions').update(payload).eq('id', question.id).eq('assessment_id', assessment.id).select(questionColumns).single()
    : supabase.from('assessment_questions').insert(payload).select(questionColumns).single();
  const { data, error } = await query;
  if (error) throw error;

  const keyQuery = await supabase.from('assessment_question_keys')
    .select('correct_option, hidden_test_cases')
    .eq('question_id', data.id)
    .maybeSingle();
  if (keyQuery.error) throw keyQuery.error;
  const { error: keyError } = await supabase.from('assessment_question_keys').upsert({
    question_id: data.id,
    correct_option: question.question_type === 'MCQ' ? correctOption || keyQuery.data?.correct_option || null : null,
    hidden_test_cases: question.question_type === 'CODING' ? hiddenTestCases?.length ? hiddenTestCases : keyQuery.data?.hidden_test_cases || [] : [],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'question_id' });
  if (keyError) throw keyError;
  return data as unknown as AssessmentQuestion;
}

export async function deleteDraftQuestion(assessmentId: string, recruiterId: string, questionId: string): Promise<void> {
  const { data: assessment, error: assessmentError } = await supabase
    .from('assessments')
    .select('id')
    .eq('id', assessmentId)
    .eq('creator_id', recruiterId)
    .eq('status', 'DRAFT')
    .single();
  if (assessmentError || !assessment) throw assessmentError || new Error('Only draft questions can be removed.');
  const { error } = await supabase.from('assessment_questions').delete().eq('id', questionId).eq('assessment_id', assessmentId);
  if (error) throw error;
}

export async function publishAssessment(assessmentId: string): Promise<void> {
  const { error } = await supabase.rpc('publish_job_assessment', { p_assessment_id: assessmentId });
  if (error) throw error;
}

export async function inviteApplicantToAssessment(params: {
  assessmentId: string;
  recruiterId: string;
  applicationId: string;
}): Promise<void> {
  const { data: assessment, error: assessmentError } = await supabase
    .from('assessments')
    .select('id, job_id, status')
    .eq('id', params.assessmentId)
    .eq('creator_id', params.recruiterId)
    .eq('status', 'PUBLISHED')
    .single();
  if (assessmentError || !assessment) throw assessmentError || new Error('Choose a published assessment you own.');

  const { data: application, error: applicationError } = await supabase
    .from('applications')
    .select('id, job_id, candidate_id')
    .eq('id', params.applicationId)
    .eq('job_id', assessment.job_id)
    .single();
  if (applicationError || !application) throw applicationError || new Error('Candidate application does not belong to this assessment job.');

  const { data: existing, error: invitationQueryError } = await supabase
    .from('assessment_invitations')
    .select('id')
    .eq('assessment_id', assessment.id)
    .eq('candidate_id', application.candidate_id)
    .limit(1)
    .maybeSingle();
  if (invitationQueryError) throw invitationQueryError;
  if (!existing) {
    const { error: invitationError } = await supabase.from('assessment_invitations').insert({
      assessment_id: assessment.id,
      application_id: application.id,
      candidate_id: application.candidate_id,
      invited_by: params.recruiterId,
      status: 'PENDING',
    });
    if (invitationError) throw invitationError;
  }
  const { error: applicationUpdateError } = await supabase
    .from('applications')
    .update({ status: 'ASSESSMENT_INVITED', updated_at: new Date().toISOString() })
    .eq('id', application.id);
  if (applicationUpdateError) throw applicationUpdateError;
}

export async function getEligibleAssessments(candidateId: string): Promise<Assessment[]> {
  const { data, error } = await supabase
    .from('assessment_invitations')
    .select(`id, application_id, assessment:assessments!inner(*, job:jobs(*), questions:assessment_questions(${questionColumns}))`)
    .eq('candidate_id', candidateId)
    .in('status', ['PENDING', 'ACCEPTED', 'COMPLETED']);
  if (error) throw error;
  return (data || [])
    .map((invitation: any) => invitation.assessment)
    .filter((assessment: Assessment | null) => assessment?.status === 'PUBLISHED') as Assessment[];
}

export async function getOrStartAttempt(assessmentId: string, candidateId: string, policy: AssessmentSecurityPolicy): Promise<{ attempt: AssessmentAttempt; isNew: boolean }> {
  const { data: invitation, error: invitationError } = await supabase
    .from('assessment_invitations')
    .select('id, assessment:assessments!inner(id, status)')
    .eq('assessment_id', assessmentId)
    .eq('candidate_id', candidateId)
    .in('status', ['PENDING', 'ACCEPTED'])
    .limit(1)
    .single();
  if (invitationError || !invitation || (invitation.assessment as any)?.status !== 'PUBLISHED') {
    throw invitationError || new Error('You are not eligible for this assessment.');
  }

  const { data: existing, error: existingError } = await supabase
    .from('assessment_attempts')
    .select('*, submissions(*)')
    .eq('assessment_id', assessmentId)
    .eq('candidate_id', candidateId)
    .eq('status', 'IN_PROGRESS')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { attempt: existing as AssessmentAttempt, isNew: false };

  const { data, error } = await supabase
    .from('assessment_attempts')
    .insert({
      assessment_id: assessmentId,
      invitation_id: invitation.id,
      candidate_id: candidateId,
      status: 'IN_PROGRESS',
      started_at: new Date().toISOString(),
      camera_enabled: false,
      mic_enabled: false,
      fullscreen_confirmed: policy.fullscreen === 'OPTIONAL',
      integrity_status: 'NORMAL',
      integrity_summary: { tab_switches: 0, fullscreen_exits: 0, copy_attempts: 0, paste_attempts: 0, camera_dropouts: 0, total_flags: 0, status: 'NORMAL' },
    })
    .select('*, submissions(*)')
    .single();
  if (error) throw error;
  return { attempt: data as AssessmentAttempt, isNew: true };
}

export async function updateAttemptSecurityState(params: {
  attemptId: string;
  candidateId: string;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  fullscreenConfirmed: boolean;
  resetStartTime?: boolean;
}): Promise<void> {
  const update = {
    camera_enabled: params.cameraEnabled,
    mic_enabled: params.microphoneEnabled,
    fullscreen_confirmed: params.fullscreenConfirmed,
    ...(params.resetStartTime ? { started_at: new Date().toISOString() } : {}),
  };
  const { data, error } = await supabase.from('assessment_attempts').update(update)
    .eq('id', params.attemptId).eq('candidate_id', params.candidateId).eq('status', 'IN_PROGRESS')
    .select('id').single();
  if (error) throw error;
  if (!data) throw new Error('The active candidate attempt could not be updated.');
}

export async function saveExplainBackResponse(attemptId: string, candidateId: string, response: string): Promise<void> {
  const { data, error } = await supabase.from('assessment_attempts').update({ explain_back_response: response })
    .eq('id', attemptId).eq('candidate_id', candidateId).eq('status', 'IN_PROGRESS')
    .select('id').single();
  if (error) throw error;
  if (!data) throw new Error('The active candidate attempt could not save the explain-back response.');
}

export async function recordAssessmentIntegrityEvent(event: Omit<IntegrityEvent, 'id'>): Promise<void> {
  const { error } = await supabase.from('integrity_events').insert({
    attempt_id: event.attempt_id,
    event_type: event.event_type,
    severity: event.severity,
    metadata: event.metadata || {},
    timestamp: event.timestamp,
  });
  if (error) throw error;
}

export async function saveAttemptSubmission(submission: Omit<Submission, 'id'>): Promise<Submission> {
  const { data: existing, error: queryError } = await supabase
    .from('submissions')
    .select('id')
    .eq('attempt_id', submission.attempt_id)
    .eq('question_id', submission.question_id)
    .maybeSingle();
  if (queryError) throw queryError;
  const query = existing
    ? supabase.from('submissions').update(submission).eq('id', existing.id).select('*').single()
    : supabase.from('submissions').insert(submission).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return data as Submission;
}

export async function completeAttempt(params: {
  attemptId: string;
  candidateId: string;
  answers: Record<string, string>;
  submissions: Submission[];
}): Promise<AssessmentAttempt> {
  for (const submission of params.submissions.filter((item) => item.language !== 'mcq')) {
    await saveAttemptSubmission(submission);
  }
  const { error: scoreError } = await supabase.rpc('submit_assessment_attempt', {
    p_attempt_id: params.attemptId,
    p_answers: params.answers,
  });
  if (scoreError) throw scoreError;

  const { data, error } = await supabase
    .from('assessment_attempts')
    .select('*, submissions(*), assessment:assessments(*, job:jobs(*), questions:assessment_questions(*, skill:skills(*)))')
    .eq('id', params.attemptId)
    .eq('candidate_id', params.candidateId)
    .single();
  if (error) throw error;
  return data as unknown as AssessmentAttempt;
}

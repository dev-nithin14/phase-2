import { 
  Profile, Skill, ProfileSkill, Project, Company, Job, 
  Application, Assessment, AssessmentAttempt, NotificationItem, 
  JobMatch, Submission, IntegrityEvent 
} from '../types';
import { 
  DEMO_SKILLS, DEMO_CANDIDATES, DEMO_RECRUITERS, DEMO_COMPANIES, 
  DEMO_JOBS, DEMO_PROFILE_SKILLS, DEMO_PROJECTS, DEMO_ASSESSMENTS, 
  DEMO_ATTEMPTS, DEMO_APPLICATIONS, DEMO_NOTIFICATIONS,
  resolveSkillId, RECRUITER_DEFAULT_ID, COMPANY_DEFAULT_ID
} from './demoData';
import { calculateJobMatch } from './matching';
import { calculateAssessmentScore } from './scoring';
import { evaluateIntegrityStatus } from './integrity';
import { supabase } from './supabase';

const STORAGE_KEY = 'beyond_the_resume_state_v1';

export interface AppState {
  currentProfile: Profile;
  profiles: Profile[];
  skills: Skill[];
  profileSkills: Record<string, ProfileSkill[]>;
  projects: Record<string, Project[]>;
  companies: Company[];
  jobs: Job[];
  applications: Application[];
  assessments: Assessment[];
  attempts: AssessmentAttempt[];
  notifications: NotificationItem[];
}

function getInitialState(): AppState {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse cached app state:', e);
      }
    }
  }

  return {
    currentProfile: DEMO_CANDIDATES[0], // Samarth M N by default
    profiles: [...DEMO_CANDIDATES, ...DEMO_RECRUITERS],
    skills: DEMO_SKILLS,
    profileSkills: DEMO_PROFILE_SKILLS,
    projects: DEMO_PROJECTS,
    companies: DEMO_COMPANIES,
    jobs: DEMO_JOBS,
    applications: DEMO_APPLICATIONS,
    assessments: DEMO_ASSESSMENTS,
    attempts: DEMO_ATTEMPTS,
    notifications: DEMO_NOTIFICATIONS,
  };
}

class Store {
  private state: AppState = getInitialState();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.save();
    // Attempt background sync with Supabase
    this.syncFromSupabase();
  }

  private save() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        console.warn('Storage save warning:', e);
      }
    }
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getState(): AppState {
    return this.state;
  }

  public resetToDemoData() {
    this.state = {
      currentProfile: DEMO_CANDIDATES[0],
      profiles: [...DEMO_CANDIDATES, ...DEMO_RECRUITERS],
      skills: DEMO_SKILLS,
      profileSkills: DEMO_PROFILE_SKILLS,
      projects: DEMO_PROJECTS,
      companies: DEMO_COMPANIES,
      jobs: DEMO_JOBS,
      applications: DEMO_APPLICATIONS,
      assessments: DEMO_ASSESSMENTS,
      attempts: DEMO_ATTEMPTS,
      notifications: DEMO_NOTIFICATIONS,
    };
    this.save();
  }

  public switchProfile(profileId: string) {
    const found = this.state.profiles.find((p) => p.id === profileId);
    if (found) {
      this.state.currentProfile = found;
      this.save();
    }
  }

  public updateProfile(updated: Partial<Profile>) {
    const cur = this.state.currentProfile;
    const merged = { ...cur, ...updated, updated_at: new Date().toISOString() };
    this.state.currentProfile = merged;
    this.state.profiles = this.state.profiles.map((p) => (p.id === cur.id ? merged : p));
    this.save();
    if (cur?.id) {
      Promise.resolve(
        supabase
          .from('profiles')
          .update(updated)
          .eq('id', cur.id)
      )
        .then(({ error }: any) => {
          if (error) console.warn('[Store] Supabase profile update error:', error.message);
        })
        .catch((e: any) => console.warn('[Store] Supabase profile update catch:', e));
    }
  }

  // Profile Skills
  public getCandidateSkills(profileId: string): ProfileSkill[] {
    return this.state.profileSkills[profileId] || [];
  }

  public addCandidateSkill(profileId: string, skillId: string, level: ProfileSkill['self_declared_level']) {
    const skill = this.state.skills.find((s) => s.id === skillId);
    const existing = this.state.profileSkills[profileId] || [];
    if (existing.some((s) => s.skill_id === skillId)) return;

    const newSkill: ProfileSkill = {
      id: `ps_${Date.now()}`,
      profile_id: profileId,
      skill_id: skillId,
      skill,
      self_declared_level: level,
      project_count: 0,
      verification_status: 'SELF_DECLARED',
      created_at: new Date().toISOString(),
    };

    this.state.profileSkills = {
      ...this.state.profileSkills,
      [profileId]: [...existing, newSkill],
    };
    this.save();

    // Persist to Supabase if valid UUID
    if (profileId && profileId.length > 20 && skillId && skillId.length > 20) {
      Promise.resolve(
        supabase
          .from('profile_skills')
          .upsert({
            profile_id: profileId,
            skill_id: skillId,
            self_declared_level: level,
            verification_status: 'SELF_DECLARED',
            project_count: 0,
          }, { onConflict: 'profile_id,skill_id' })
      )
        .then(({ error }: any) => {
          if (error) console.warn('[Store] Supabase profile_skills upsert error:', error.message);
        })
        .catch((e: any) => console.warn('[Store] Supabase profile_skills catch:', e));
    }
  }

  // Candidate Projects
  public getCandidateProjects(profileId: string): Project[] {
    return this.state.projects[profileId] || [];
  }

  public addCandidateProject(profileId: string, project: Omit<Project, 'id' | 'profile_id' | 'created_at'>) {
    const newProj: Project = {
      ...project,
      id: `proj_${Date.now()}`,
      profile_id: profileId,
      created_at: new Date().toISOString(),
    };

    const existing = this.state.projects[profileId] || [];
    this.state.projects = {
      ...this.state.projects,
      [profileId]: [newProj, ...existing],
    };

    // Update project count on profile skills
    const cSkills = this.state.profileSkills[profileId] || [];
    const updatedSkills = cSkills.map((ps) => {
      const match = newProj.skills?.some((s) => s.id === ps.skill_id || s.name === ps.skill?.name);
      if (match) {
        return {
          ...ps,
          project_count: ps.project_count + 1,
          verification_status: ps.assessed_score ? 'FULLY_VERIFIED' as const : 'EVIDENCE_BACKED' as const,
        };
      }
      return ps;
    });

    this.state.profileSkills[profileId] = updatedSkills;
    this.save();

    // Persist to Supabase if valid UUID
    if (profileId && profileId.length > 20) {
      Promise.resolve(
        supabase
          .from('projects')
          .insert({
            profile_id: profileId,
            title: newProj.title,
            description: newProj.description,
            github_url: newProj.github_url || null,
            live_url: newProj.live_url || null,
            candidate_role: newProj.candidate_role || 'Developer',
            team_size: newProj.team_size || 1,
            verification_status: 'EVIDENCE_SUBMITTED',
          })
      )
        .then(({ error }: any) => {
          if (error) console.warn('[Store] Supabase projects insert error:', error.message);
        })
        .catch((e: any) => console.warn('[Store] Supabase projects catch:', e));
    }
  }

  // Jobs
  public getJobs(): Job[] {
    return this.state.jobs;
  }

  public getJob(id: string): Job | undefined {
    return this.state.jobs.find((j) => j.id === id);
  }

  public async createJob(jobData: Omit<Job, 'id' | 'created_at'>): Promise<Job> {
    // 1. Resolve recruiter and company IDs to valid UUIDs
    const recruiterId = (jobData.recruiter_id && jobData.recruiter_id.length > 20)
      ? jobData.recruiter_id
      : RECRUITER_DEFAULT_ID;

    const companyId = (jobData.company_id && jobData.company_id.length > 20)
      ? jobData.company_id
      : (jobData.company?.id && jobData.company.id.length > 20)
        ? jobData.company.id
        : COMPANY_DEFAULT_ID;

    // 2. Ensure active Supabase Auth session for recruiter
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session || sessionData.session.user.id !== recruiterId) {
      const recruiterProfile = this.state.profiles.find((p) => p.id === recruiterId) || this.state.profiles.find((p) => p.role === 'RECRUITER');
      const email = recruiterProfile?.email || 'karthik@cloudscale.io';
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: 'RecruiterPassword123!',
      });
      if (authError) {
        console.error('[Store] Supabase authentication failed before job insert:', authError);
        throw new Error(`Authentication error with Supabase: ${authError.message}`);
      }
    }

    // 3. Supabase INSERT into public.jobs
    const insertPayload = {
      company_id: companyId,
      recruiter_id: recruiterId,
      title: jobData.title,
      description: jobData.description,
      employment_type: jobData.employment_type || 'FULL_TIME',
      location: jobData.location,
      work_mode: jobData.work_mode || 'HYBRID',
      min_experience: jobData.min_experience !== undefined ? Number(jobData.min_experience) : 0,
      max_experience: jobData.max_experience !== undefined ? Number(jobData.max_experience) : null,
      min_salary: jobData.min_salary !== undefined ? Number(jobData.min_salary) : null,
      max_salary: jobData.max_salary !== undefined ? Number(jobData.max_salary) : null,
      salary_currency: jobData.salary_currency || 'INR',
      deadline: jobData.deadline || null,
      status: jobData.status || 'PUBLISHED',
      assessment_required: jobData.assessment_required ?? true,
    };

    console.log('[Store] Executing Supabase INSERT into public.jobs:', insertPayload);

    const { data: jobRow, error: jobError } = await supabase
      .from('jobs')
      .insert([insertPayload])
      .select('*')
      .single();

    if (jobError || !jobRow) {
      console.error('[Store] Supabase jobs insert error:', jobError);
      throw new Error(`Supabase job insert failed: ${jobError?.message || 'Unknown database error'}`);
    }

    console.log('[Store] Successfully persisted job to public.jobs:', jobRow.id);

    // 4. Insert job_skills into public.job_skills
    if (jobData.skills && jobData.skills.length > 0) {
      const skillsToInsert = jobData.skills.map((s) => ({
        job_id: jobRow.id,
        skill_id: resolveSkillId(s.skill_id),
        weight: Number(s.weight),
        is_required: Boolean(s.is_required),
        min_acceptable_score: s.min_acceptable_score !== undefined ? Number(s.min_acceptable_score) : 60,
      }));

      console.log('[Store] Executing Supabase INSERT into public.job_skills:', skillsToInsert);

      const { error: skillsError } = await supabase
        .from('job_skills')
        .insert(skillsToInsert);

      if (skillsError) {
        console.error('[Store] Supabase job_skills insert error:', skillsError);
        throw new Error(`Failed to insert job skills into Supabase: ${skillsError.message}`);
      }
    }

    // 5. Refresh/query job from Supabase
    const { data: persistedJobData, error: fetchError } = await supabase
      .from('jobs')
      .select(`
        *,
        company:companies(*),
        job_skills(
          id,
          job_id,
          skill_id,
          weight,
          is_required,
          min_acceptable_score,
          skill:skills(*)
        )
      `)
      .eq('id', jobRow.id)
      .single();

    if (fetchError || !persistedJobData) {
      console.error('[Store] Failed to query newly persisted job from Supabase:', fetchError);
      throw new Error(`Failed to query newly persisted job from Supabase: ${fetchError?.message}`);
    }

    const completeJob: Job = {
      ...persistedJobData,
      skills: (persistedJobData.job_skills || []).map((js: any) => ({
        ...js,
        skill: js.skill || this.state.skills.find((s) => s.id === js.skill_id),
      })),
      company: persistedJobData.company || this.state.companies.find((c) => c.id === persistedJobData.company_id),
    };

    // 6. Update local store state with the returned persisted job
    this.state.jobs = [completeJob, ...this.state.jobs.filter((j) => j.id !== completeJob.id)];
    this.computeMatchesForNewJob(completeJob);
    this.save();

    console.log('[Store] Persisted job loaded into application state:', completeJob.id);
    return completeJob;
  }

  private computeMatchesForNewJob(job: Job) {
    const candidates = this.state.profiles.filter((p) => p.role === 'JOB_SEEKER');
    for (const c of candidates) {
      const cSkills = this.getCandidateSkills(c.id);
      const cProjects = this.getCandidateProjects(c.id);
      const match = calculateJobMatch(job, c, cSkills, cProjects);

      if (match.overallScore >= 80) {
        this.addNotification({
          user_id: c.id,
          title: `New High-Match Job Opportunity (${match.overallScore}%)`,
          message: `${job.title} at ${job.company?.name || 'Top Company'} matches ${match.overallScore}% of your skill evidence.`,
          type: 'MATCH',
          related_job_id: job.id,
        });
      }
    }
  }

  // Applications
  public applyToJob(jobId: string, candidateId: string): Application {
    const existing = this.state.applications.find(
      (a) => a.job_id === jobId && a.candidate_id === candidateId
    );
    if (existing) return existing;

    const job = this.getJob(jobId);
    const candidate = this.state.profiles.find((p) => p.id === candidateId);
    const cSkills = this.getCandidateSkills(candidateId);
    const cProjects = this.getCandidateProjects(candidateId);
    const match = job && candidate ? calculateJobMatch(job, candidate, cSkills, cProjects) : { overallScore: 75 };

    const newApp: Application = {
      id: `app_${Date.now()}`,
      job_id: jobId,
      candidate_id: candidateId,
      job,
      candidate,
      status: 'APPLIED',
      match_score: match.overallScore,
      applied_at: new Date().toISOString(),
    };

    this.state.applications = [newApp, ...this.state.applications];

    // Notify recruiter
    if (job?.recruiter_id) {
      this.addNotification({
        user_id: job.recruiter_id,
        title: `New Application for ${job.title}`,
        message: `${candidate?.full_name || 'A developer'} applied with a verified match score of ${match.overallScore}%.`,
        type: 'APPLICATION_UPDATE',
        related_application_id: newApp.id,
        related_job_id: jobId,
      });
    }

    this.save();

    // Persist to Supabase if valid UUIDs
    if (jobId && jobId.length > 20 && candidateId && candidateId.length > 20) {
      Promise.resolve(
        supabase
          .from('applications')
          .upsert({
            job_id: jobId,
            candidate_id: candidateId,
            status: 'APPLIED',
            match_score: match.overallScore,
          }, { onConflict: 'job_id,candidate_id' })
      )
        .then(({ error }: any) => {
          if (error) console.warn('[Store] Supabase applications upsert error:', error.message);
        })
        .catch((e: any) => console.warn('[Store] Supabase applications catch:', e));
    }

    return newApp;
  }

  public updateApplicationStatus(appId: string, status: Application['status']): Application | undefined {
    const app = this.state.applications.find((a) => a.id === appId);
    if (!app) return undefined;

    app.status = status;
    app.updated_at = new Date().toISOString();

    // Notify candidate
    this.addNotification({
      user_id: app.candidate_id,
      title: `Application Status Updated: ${status.replace(/_/g, ' ')}`,
      message: `Your application for ${app.job?.title || 'the role'} has moved to status ${status.replace(/_/g, ' ')}.`,
      type: 'APPLICATION_UPDATE',
      related_application_id: appId,
      related_job_id: app.job_id,
    });

    this.save();

    // Persist to Supabase if valid UUID
    if (appId && appId.length > 20) {
      Promise.resolve(
        supabase
          .from('applications')
          .update({
            status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', appId)
      )
        .then(({ error }: any) => {
          if (error) console.warn('[Store] Supabase application status update error:', error.message);
        })
        .catch((e: any) => console.warn('[Store] Supabase application status catch:', e));
    }

    return app;
  }

  // Assessments
  public getAssessments(): Assessment[] {
    return this.state.assessments;
  }

  public getAssessment(id: string): Assessment | undefined {
    return this.state.assessments.find((a) => a.id === id);
  }

  public createAssessment(assessment: Omit<Assessment, 'id' | 'created_at'>): Assessment {
    const newAsmt: Assessment = {
      ...assessment,
      id: `asmt_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    this.state.assessments = [newAsmt, ...this.state.assessments];
    this.save();
    return newAsmt;
  }

  public inviteCandidateToAssessment(assessmentId: string, applicationId: string) {
    const asmt = this.getAssessment(assessmentId);
    const app = this.state.applications.find((a) => a.id === applicationId);
    if (!asmt || !app) return;

    this.updateApplicationStatus(applicationId, 'ASSESSMENT_INVITED');

    this.addNotification({
      user_id: app.candidate_id,
      title: `Technical Assessment Invitation: ${asmt.title}`,
      message: `You have been invited to complete the ${asmt.duration_minutes}-minute technical assessment for ${app.job?.title || 'your application'}.`,
      type: 'ASSESSMENT_INVITE',
      related_application_id: applicationId,
      related_job_id: app.job_id,
    });

    this.save();
  }

  // Assessment Attempts & Evaluation
  public getAttempt(id: string): AssessmentAttempt | undefined {
    return this.state.attempts.find((a) => a.id === id);
  }

  public getAttemptForAssessmentAndCandidate(asmtId: string, candId: string): AssessmentAttempt | undefined {
    return this.state.attempts.find((a) => a.assessment_id === asmtId && a.candidate_id === candId);
  }

  public startAttempt(assessmentId: string, candidateId: string): AssessmentAttempt {
    const existing = this.getAttemptForAssessmentAndCandidate(assessmentId, candidateId);
    if (existing && existing.status === 'IN_PROGRESS') return existing;

    const asmt = this.getAssessment(assessmentId);
    const candidate = this.state.profiles.find((p) => p.id === candidateId);

    const newAttempt: AssessmentAttempt = {
      id: `att_${Date.now()}`,
      assessment_id: assessmentId,
      assessment: asmt,
      candidate_id: candidateId,
      candidate,
      status: 'IN_PROGRESS',
      started_at: new Date().toISOString(),
      camera_enabled: true,
      mic_enabled: true,
      fullscreen_confirmed: true,
      integrity_status: 'NORMAL',
      integrity_summary: {
        tab_switches: 0,
        fullscreen_exits: 0,
        copy_attempts: 0,
        paste_attempts: 0,
        camera_dropouts: 0,
        total_flags: 0,
        status: 'NORMAL',
      },
      submissions: [],
      integrity_events: [],
    };

    this.state.attempts = [newAttempt, ...this.state.attempts];
    this.save();
    return newAttempt;
  }

  public recordIntegrityEvent(attemptId: string, event: IntegrityEvent) {
    const attempt = this.getAttempt(attemptId);
    if (!attempt) return;

    attempt.integrity_events = attempt.integrity_events || [];
    attempt.integrity_events.push(event);

    if (event.event_type === 'TAB_SWITCH') attempt.integrity_summary.tab_switches++;
    if (event.event_type === 'FULLSCREEN_EXIT') attempt.integrity_summary.fullscreen_exits++;
    if (event.event_type === 'COPY_ATTEMPT') attempt.integrity_summary.copy_attempts++;
    if (event.event_type === 'PASTE_ATTEMPT') attempt.integrity_summary.paste_attempts++;
    if (event.event_type === 'CAMERA_DISABLED') attempt.integrity_summary.camera_dropouts++;

    const evalResult = evaluateIntegrityStatus({
      tabSwitches: attempt.integrity_summary.tab_switches,
      fullscreenExits: attempt.integrity_summary.fullscreen_exits,
      copyAttempts: attempt.integrity_summary.copy_attempts,
      pasteAttempts: attempt.integrity_summary.paste_attempts,
      cameraDropouts: attempt.integrity_summary.camera_dropouts,
    });
    attempt.integrity_status = evalResult.status;
    attempt.integrity_summary.status = evalResult.status;
    attempt.integrity_summary.total_flags = evalResult.totalFlags;

    this.save();
  }

  public submitAssessmentAttempt(
    attemptId: string,
    submissions: Submission[],
    timeTakenMinutes: number
  ): AssessmentAttempt | undefined {
    const attempt = this.getAttempt(attemptId);
    if (!attempt) return undefined;

    const asmt = attempt.assessment || this.getAssessment(attempt.assessment_id);
    const durationAllowed = asmt?.duration_minutes || 45;

    // Deterministic scoring calculation
    const scoreResult = calculateAssessmentScore(submissions, durationAllowed, timeTakenMinutes);

    attempt.status = 'EVALUATED';
    attempt.submitted_at = new Date().toISOString();
    attempt.submissions = submissions;
    attempt.technical_score = scoreResult.totalScore;
    attempt.score_breakdown = scoreResult.breakdown;

    // Update related application if exists
    const app = this.state.applications.find(
      (a) => a.candidate_id === attempt.candidate_id && a.job_id === asmt?.job_id
    );
    if (app) {
      app.status = 'ASSESSMENT_COMPLETED';
      app.updated_at = new Date().toISOString();
    }

    // Automatically update candidate's Skill Passport evidence
    this.updateCandidatePassportFromAttempt(attempt.candidate_id, attempt, submissions);

    // Notifications
    this.addNotification({
      user_id: attempt.candidate_id,
      title: `Assessment Completed: ${scoreResult.totalScore}/100`,
      message: `Your submission for "${asmt?.title || 'Technical Assessment'}" has been evaluated. Verified Skill Passport updated.`,
      type: 'ASSESSMENT_RESULT',
      related_application_id: app?.id,
    });

    if (asmt?.creator_id) {
      this.addNotification({
        user_id: asmt.creator_id,
        title: `Assessment Submitted by ${attempt.candidate?.full_name || 'Candidate'}`,
        message: `Scored ${scoreResult.totalScore}/100 on ${asmt.title}. Integrity: ${attempt.integrity_status}.`,
        type: 'APPLICATION_UPDATE',
        related_application_id: app?.id,
      });
    }

    this.save();
    return attempt;
  }

  private updateCandidatePassportFromAttempt(
    candidateId: string,
    attempt: AssessmentAttempt,
    submissions: Submission[]
  ) {
    const cSkills = this.state.profileSkills[candidateId] || [];
    const questions = attempt.assessment?.questions || [];

    for (const q of questions) {
      if (!q.skill_id && !q.skill?.id) continue;
      const targetSkillId = q.skill_id || q.skill?.id;
      const sub = submissions.find((s) => s.question_id === q.id);
      const subScore = sub ? (sub.score || (sub.tests_passed / Math.max(1, sub.total_tests)) * 100) : 80;

      const idx = cSkills.findIndex((ps) => ps.skill_id === targetSkillId);
      if (idx >= 0) {
        cSkills[idx].assessed_score = Math.round(subScore);
        cSkills[idx].verification_status = cSkills[idx].project_count > 0 ? 'FULLY_VERIFIED' : 'ASSESSMENT_BACKED';
        cSkills[idx].verified_at = new Date().toISOString();
      } else {
        const fullSkill = this.state.skills.find((s) => s.id === targetSkillId) || q.skill;
        if (fullSkill) {
          cSkills.push({
            id: `ps_${Date.now()}_${targetSkillId}`,
            profile_id: candidateId,
            skill_id: targetSkillId!,
            skill: fullSkill,
            self_declared_level: 'ADVANCED',
            assessed_score: Math.round(subScore),
            project_count: 0,
            verification_status: 'ASSESSMENT_BACKED',
            verified_at: new Date().toISOString(),
          });
        }
      }
    }

    this.state.profileSkills[candidateId] = [...cSkills];
  }

  // Notifications
  public getNotifications(userId: string): NotificationItem[] {
    return this.state.notifications.filter((n) => n.user_id === userId);
  }

  public markNotificationAsRead(id: string) {
    this.state.notifications = this.state.notifications.map((n) =>
      n.id === id ? { ...n, is_read: true } : n
    );
    this.save();
  }

  public addNotification(notification: Omit<NotificationItem, 'id' | 'is_read' | 'created_at'>) {
    const newNotif: NotificationItem = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    this.state.notifications = [newNotif, ...this.state.notifications];
    this.save();
  }

  // Sync with remote Supabase
  public async syncFromSupabase() {
    try {
      // 1. Fetch skills from Supabase
      const { data: skills } = await supabase.from('skills').select('*').limit(50);
      if (skills && skills.length > 0) {
        this.state.skills = skills;
      }

      // 2. Fetch companies from Supabase
      const { data: companies } = await supabase.from('companies').select('*');
      if (companies && companies.length > 0) {
        this.state.companies = companies;
      }

      // 3. Fetch jobs with company and job_skills from Supabase
      const { data: dbJobs, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          *,
          company:companies(*),
          job_skills(
            id,
            job_id,
            skill_id,
            weight,
            is_required,
            min_acceptable_score,
            skill:skills(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (dbJobs && dbJobs.length > 0) {
        const formattedDbJobs: Job[] = dbJobs.map((j: any) => ({
          ...j,
          skills: (j.job_skills || []).map((js: any) => ({
            ...js,
            skill: js.skill || this.state.skills.find((s) => s.id === js.skill_id),
          })),
        }));

        const dbJobIds = new Set(formattedDbJobs.map((j) => j.id));
        this.state.jobs = [
          ...formattedDbJobs,
          ...this.state.jobs.filter((j) => !dbJobIds.has(j.id)),
        ];
      }

      // 4. Fetch profiles from Supabase
      const { data: dbProfiles } = await supabase.from('profiles').select('*');
      if (dbProfiles && dbProfiles.length > 0) {
        const dbEmails = new Set(dbProfiles.map((p) => p.email.toLowerCase()));
        this.state.profiles = [
          ...dbProfiles,
          ...this.state.profiles.filter((p) => !dbEmails.has(p.email.toLowerCase())),
        ];
        const matchingCurrent = dbProfiles.find((p) => p.email.toLowerCase() === this.state.currentProfile?.email?.toLowerCase());
        if (matchingCurrent) {
          this.state.currentProfile = { ...this.state.currentProfile, ...matchingCurrent };
        }
      }

      // 5. Fetch profile_skills from Supabase
      const { data: dbPS } = await supabase.from('profile_skills').select('*, skill:skills(*)');
      if (dbPS && dbPS.length > 0) {
        const grouped: Record<string, ProfileSkill[]> = { ...this.state.profileSkills };
        for (const ps of dbPS) {
          if (!grouped[ps.profile_id]) grouped[ps.profile_id] = [];
          const idx = grouped[ps.profile_id].findIndex((existing) => existing.skill_id === ps.skill_id);
          if (idx >= 0) {
            grouped[ps.profile_id][idx] = { ...grouped[ps.profile_id][idx], ...ps };
          } else {
            grouped[ps.profile_id].push(ps);
          }
        }
        this.state.profileSkills = grouped;
      }

      // 6. Fetch projects from Supabase
      const { data: dbProj } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (dbProj && dbProj.length > 0) {
        const groupedProj: Record<string, Project[]> = { ...this.state.projects };
        for (const pr of dbProj) {
          if (!groupedProj[pr.profile_id]) groupedProj[pr.profile_id] = [];
          const idx = groupedProj[pr.profile_id].findIndex((existing) => existing.id === pr.id);
          if (idx >= 0) {
            groupedProj[pr.profile_id][idx] = { ...groupedProj[pr.profile_id][idx], ...pr };
          } else {
            groupedProj[pr.profile_id].unshift(pr);
          }
        }
        this.state.projects = groupedProj;
      }

      // 7. Fetch applications from Supabase
      const { data: dbApps } = await supabase
        .from('applications')
        .select(`
          *,
          job:jobs(*, company:companies(*)),
          candidate:profiles(*)
        `)
        .order('applied_at', { ascending: false });
      if (dbApps && dbApps.length > 0) {
        const dbAppIds = new Set(dbApps.map((a: any) => a.id));
        this.state.applications = [
          ...dbApps,
          ...this.state.applications.filter((a) => !dbAppIds.has(a.id)),
        ];
      }

      this.save();
    } catch (e) {
      console.warn('[Store] Supabase sync warning (offline fallback active):', e);
    }
  }

  public async fetchJobById(id: string): Promise<Job | undefined> {
    try {
      const { data: j, error } = await supabase
        .from('jobs')
        .select(`
          *,
          company:companies(*),
          job_skills(
            id,
            job_id,
            skill_id,
            weight,
            is_required,
            min_acceptable_score,
            skill:skills(*)
          )
        `)
        .eq('id', id)
        .single();

      if (j && !error) {
        const completeJob: Job = {
          ...j,
          skills: (j.job_skills || []).map((js: any) => ({
            ...js,
            skill: js.skill || this.state.skills.find((s) => s.id === js.skill_id),
          })),
        };
        this.state.jobs = [completeJob, ...this.state.jobs.filter((existing) => existing.id !== completeJob.id)];
        this.save();
        return completeJob;
      }
    } catch (e) {
      console.warn('[Store] Failed to fetch job by ID from Supabase:', e);
    }
    return this.getJob(id);
  }
}

export const appStore = new Store();

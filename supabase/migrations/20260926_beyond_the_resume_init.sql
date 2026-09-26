-- Beyond the Resume - Core Database Schema Migration
-- Enables pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES Table Evolution
-- Safely handle existing table from Phase 1 or create fresh
DO $$
BEGIN
    -- Drop old role check constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
    END IF;
END $$;

-- Ensure columns exist in profiles
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS full_name TEXT,
    ADD COLUMN IF NOT EXISTS bio TEXT,
    ADD COLUMN IF NOT EXISTS education TEXT,
    ADD COLUMN IF NOT EXISTS experience_years NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'IMMEDIATELY',
    ADD COLUMN IF NOT EXISTS preferred_job_type TEXT DEFAULT 'FULL_TIME',
    ADD COLUMN IF NOT EXISTS preferred_location TEXT DEFAULT 'HYBRID',
    ADD COLUMN IF NOT EXISTS github_url TEXT,
    ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
    ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
    ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]'::jsonb;

-- Populate full_name from name if name exists and full_name is null
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'name') THEN
        UPDATE public.profiles SET full_name = name WHERE full_name IS NULL;
    END IF;
END $$;

-- Update role check constraint for Phase 2
ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_role_check 
    CHECK (role = ANY (ARRAY['JOB_SEEKER'::text, 'RECRUITER'::text, 'ADMIN'::text, 'CITIZEN'::text, 'BUILDER'::text, 'COLLECTION_TEAM'::text, 'PROCESSING_TEAM'::text]));

-- 2. SKILLS Table
CREATE TABLE IF NOT EXISTS public.skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'ENGINEERING', -- FRONTEND, BACKEND, DATABASE, DEVOPS, CORE_CS, AI_ML
    description TEXT,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. PROFILE_SKILLS Table
CREATE TABLE IF NOT EXISTS public.profile_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    self_declared_level TEXT NOT NULL DEFAULT 'INTERMEDIATE', -- BEGINNER, INTERMEDIATE, ADVANCED, EXPERT
    assessed_score NUMERIC, -- 0-100 deterministic verified score
    project_count INTEGER DEFAULT 0,
    verification_status TEXT NOT NULL DEFAULT 'SELF_DECLARED', -- SELF_DECLARED, EVIDENCE_BACKED, ASSESSMENT_BACKED, FULLY_VERIFIED
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT profile_skills_unique UNIQUE(profile_id, skill_id)
);

-- 4. PROJECTS Table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    github_url TEXT,
    live_url TEXT,
    screenshots JSONB DEFAULT '[]'::jsonb,
    candidate_role TEXT,
    team_size INTEGER DEFAULT 1,
    completion_date DATE,
    verification_status TEXT NOT NULL DEFAULT 'ADDED', -- ADDED, LINK_VERIFIED, REPOSITORY_CONNECTED, EVIDENCE_REVIEWED
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. PROJECT_SKILLS Table
CREATE TABLE IF NOT EXISTS public.project_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    CONSTRAINT project_skills_unique UNIQUE(project_id, skill_id)
);

-- 6. COMPANIES Table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recruiter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    logo_url TEXT,
    description TEXT,
    industry TEXT,
    location TEXT,
    website TEXT,
    company_size TEXT DEFAULT '11-50',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. JOBS Table
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    recruiter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    employment_type TEXT NOT NULL DEFAULT 'FULL_TIME',
    location TEXT NOT NULL,
    work_mode TEXT NOT NULL DEFAULT 'HYBRID', -- REMOTE, HYBRID, ONSITE
    min_experience NUMERIC DEFAULT 0,
    max_experience NUMERIC,
    min_salary NUMERIC,
    max_salary NUMERIC,
    salary_currency TEXT DEFAULT 'INR',
    deadline TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'PUBLISHED', -- DRAFT, PUBLISHED, CLOSED, ARCHIVED
    assessment_required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. JOB_SKILLS Table
CREATE TABLE IF NOT EXISTS public.job_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    weight NUMERIC NOT NULL DEFAULT 25 CHECK (weight >= 0 AND weight <= 100),
    is_required BOOLEAN NOT NULL DEFAULT true,
    min_acceptable_score NUMERIC DEFAULT 60,
    CONSTRAINT job_skills_unique UNIQUE(job_id, skill_id)
);

-- 9. APPLICATIONS Table
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'APPLIED', -- APPLIED, REVIEWING, SHORTLISTED, ASSESSMENT_INVITED, ASSESSMENT_COMPLETED, INTERVIEW, SELECTED, REJECTED, WITHDRAWN
    match_score NUMERIC DEFAULT 0,
    applied_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT applications_unique UNIQUE(job_id, candidate_id)
);

-- 10. JOB_MATCHES Table
CREATE TABLE IF NOT EXISTS public.job_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    match_score NUMERIC NOT NULL,
    skill_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence_summary TEXT,
    calculated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT job_matches_unique UNIQUE(job_id, candidate_id)
);

-- 11. Adapt NOTIFICATIONS Table for Phase 2
ALTER TABLE public.notifications 
    ADD COLUMN IF NOT EXISTS related_job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS related_application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Sync is_read with read if read column exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read') THEN
        UPDATE public.notifications SET is_read = read WHERE is_read IS NULL;
    END IF;
END $$;

-- 12. ASSESSMENTS Table
CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 45,
    total_points INTEGER NOT NULL DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'PUBLISHED', -- DRAFT, PUBLISHED, ARCHIVED
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 13. ASSESSMENT_QUESTIONS Table
CREATE TABLE IF NOT EXISTS public.assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES public.skills(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    statement TEXT NOT NULL,
    constraints TEXT,
    examples JSONB DEFAULT '[]'::jsonb,
    starter_code JSONB DEFAULT '{"javascript": "// Write your solution here\nfunction solution() {\n  \n}\n", "python": "# Write your solution here\ndef solution():\n    pass\n"}'::jsonb,
    test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
    difficulty TEXT NOT NULL DEFAULT 'MEDIUM', -- EASY, MEDIUM, HARD
    points INTEGER NOT NULL DEFAULT 50,
    time_limit_sec INTEGER DEFAULT 5,
    memory_limit_mb INTEGER DEFAULT 256,
    order_index INTEGER DEFAULT 0
);

-- 14. ASSESSMENT_INVITATIONS Table
CREATE TABLE IF NOT EXISTS public.assessment_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, ACCEPTED, EXPIRED, COMPLETED
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. ASSESSMENT_ATTEMPTS Table
CREATE TABLE IF NOT EXISTS public.assessment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    invitation_id UUID REFERENCES public.assessment_invitations(id) ON DELETE SET NULL,
    candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, SUBMITTED, EVALUATED, FLAGGED
    started_at TIMESTAMPTZ DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    camera_enabled BOOLEAN DEFAULT true,
    mic_enabled BOOLEAN DEFAULT true,
    fullscreen_confirmed BOOLEAN DEFAULT true,
    integrity_status TEXT NOT NULL DEFAULT 'NORMAL', -- NORMAL, MINOR_FLAGS, REVIEW_REQUIRED
    integrity_summary JSONB DEFAULT '{}'::jsonb,
    technical_score NUMERIC,
    score_breakdown JSONB DEFAULT '{}'::jsonb
);

-- 16. SUBMISSIONS Table
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    code TEXT NOT NULL,
    tests_passed INTEGER DEFAULT 0,
    total_tests INTEGER DEFAULT 0,
    execution_time_ms NUMERIC DEFAULT 0,
    memory_used_mb NUMERIC DEFAULT 0,
    score NUMERIC DEFAULT 0,
    test_results JSONB DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMPTZ DEFAULT now()
);

-- 17. INTEGRITY_EVENTS Table
CREATE TABLE IF NOT EXISTS public.integrity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- FULLSCREEN_EXIT, TAB_SWITCH, COPY_ATTEMPT, PASTE_ATTEMPT, VISIBILITY_HIDDEN, CAMERA_DISABLED, MIC_DISABLED, MULTIPLE_FACES, NO_FACE
    severity TEXT NOT NULL DEFAULT 'LOW', -- LOW, MEDIUM, HIGH
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- 18. ASSESSMENT_SCORES Table
CREATE TABLE IF NOT EXISTS public.assessment_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
    overall_score NUMERIC NOT NULL,
    correctness_score NUMERIC NOT NULL,
    efficiency_score NUMERIC NOT NULL,
    quality_score NUMERIC NOT NULL,
    test_coverage_score NUMERIC NOT NULL,
    time_performance_score NUMERIC NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 19. SKILL_EVIDENCE Table
CREATE TABLE IF NOT EXISTS public.skill_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    evidence_type TEXT NOT NULL, -- ASSESSMENT, PROJECT, WORK_EXPERIENCE
    source_id UUID,
    score NUMERIC,
    evidence_details JSONB DEFAULT '{}'::jsonb,
    verified_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_evidence ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policies (Safe IF NOT EXISTS pattern)
DO $$
BEGIN
    -- Skills: Readable by everyone, insertable by authenticated users
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'skills_select_all') THEN
        CREATE POLICY skills_select_all ON public.skills FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'skills_insert_auth') THEN
        CREATE POLICY skills_insert_auth ON public.skills FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;

    -- Profiles: Everyone can read basic profiles, users can update their own
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_select_all') THEN
        CREATE POLICY profiles_select_all ON public.profiles FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_update_own') THEN
        CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_insert_own') THEN
        CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;

    -- Profile Skills: Everyone can read (for recruiter searches & skill passports), candidates can edit own
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profile_skills_select_all') THEN
        CREATE POLICY profile_skills_select_all ON public.profile_skills FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profile_skills_modify_own') THEN
        CREATE POLICY profile_skills_modify_own ON public.profile_skills FOR ALL USING (auth.uid() = profile_id);
    END IF;

    -- Projects: Publicly viewable for evidence, candidates manage own
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'projects_select_all') THEN
        CREATE POLICY projects_select_all ON public.projects FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'projects_modify_own') THEN
        CREATE POLICY projects_modify_own ON public.projects FOR ALL USING (auth.uid() = profile_id);
    END IF;

    -- Project Skills
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'project_skills_select_all') THEN
        CREATE POLICY project_skills_select_all ON public.project_skills FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'project_skills_modify') THEN
        CREATE POLICY project_skills_modify ON public.project_skills FOR ALL USING (
            EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_skills.project_id AND projects.profile_id = auth.uid())
        );
    END IF;

    -- Companies: Publicly viewable, recruiter manages own
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'companies_select_all') THEN
        CREATE POLICY companies_select_all ON public.companies FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'companies_modify_own') THEN
        CREATE POLICY companies_modify_own ON public.companies FOR ALL USING (auth.uid() = recruiter_id);
    END IF;

    -- Jobs: Publicly viewable if published, recruiter manages own
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'jobs_select_all') THEN
        CREATE POLICY jobs_select_all ON public.jobs FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'jobs_insert_recruiter') THEN
        CREATE POLICY jobs_insert_recruiter ON public.jobs 
        FOR INSERT 
        WITH CHECK (
            auth.uid() IS NOT NULL
            AND auth.uid() = recruiter_id
            AND EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE profiles.id = auth.uid() 
                AND profiles.role = 'RECRUITER'
            )
            AND EXISTS (
                SELECT 1 FROM public.companies 
                WHERE companies.id = jobs.company_id 
                AND companies.recruiter_id = auth.uid()
            )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'jobs_update_recruiter') THEN
        CREATE POLICY jobs_update_recruiter ON public.jobs 
        FOR UPDATE 
        USING (
            auth.uid() = recruiter_id 
            AND EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE profiles.id = auth.uid() 
                AND profiles.role = 'RECRUITER'
            )
        )
        WITH CHECK (
            auth.uid() = recruiter_id 
            AND EXISTS (
                SELECT 1 FROM public.companies 
                WHERE companies.id = jobs.company_id 
                AND companies.recruiter_id = auth.uid()
            )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'jobs_delete_recruiter') THEN
        CREATE POLICY jobs_delete_recruiter ON public.jobs 
        FOR DELETE 
        USING (
            auth.uid() = recruiter_id 
            AND EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE profiles.id = auth.uid() 
                AND profiles.role = 'RECRUITER'
            )
        );
    END IF;

    -- Job Skills: Viewable by all, recruiter manages
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'job_skills_select_all') THEN
        CREATE POLICY job_skills_select_all ON public.job_skills FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'job_skills_insert_recruiter') THEN
        CREATE POLICY job_skills_insert_recruiter ON public.job_skills 
        FOR INSERT 
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.jobs 
                WHERE jobs.id = job_skills.job_id 
                AND jobs.recruiter_id = auth.uid()
            )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'job_skills_update_recruiter') THEN
        CREATE POLICY job_skills_update_recruiter ON public.job_skills 
        FOR UPDATE 
        USING (
            EXISTS (
                SELECT 1 FROM public.jobs 
                WHERE jobs.id = job_skills.job_id 
                AND jobs.recruiter_id = auth.uid()
            )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'job_skills_delete_recruiter') THEN
        CREATE POLICY job_skills_delete_recruiter ON public.job_skills 
        FOR DELETE 
        USING (
            EXISTS (
                SELECT 1 FROM public.jobs 
                WHERE jobs.id = job_skills.job_id 
                AND jobs.recruiter_id = auth.uid()
            )
        );
    END IF;

    -- Applications: Candidate sees own, Recruiter sees applications to their jobs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'applications_access') THEN
        CREATE POLICY applications_access ON public.applications FOR ALL USING (
            candidate_id = auth.uid() OR 
            EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = applications.job_id AND jobs.recruiter_id = auth.uid())
        );
    END IF;

    -- Job Matches
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'job_matches_access') THEN
        CREATE POLICY job_matches_access ON public.job_matches FOR ALL USING (
            candidate_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_matches.job_id AND jobs.recruiter_id = auth.uid())
        );
    END IF;

    -- Notifications: Candidate/Recruiter views and updates their own
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notifications_own') THEN
        CREATE POLICY notifications_own ON public.notifications FOR ALL USING (user_id = auth.uid());
    END IF;

    -- Assessments: Recruiter manages, Candidate views if invited
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'assessments_access') THEN
        CREATE POLICY assessments_access ON public.assessments FOR ALL USING (
            creator_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.assessment_invitations WHERE assessment_invitations.assessment_id = assessments.id AND assessment_invitations.candidate_id = auth.uid())
        );
    END IF;

    -- Assessment Questions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'questions_access') THEN
        CREATE POLICY questions_access ON public.assessment_questions FOR ALL USING (
            EXISTS (SELECT 1 FROM public.assessments WHERE assessments.id = assessment_questions.assessment_id AND (
                assessments.creator_id = auth.uid() OR
                EXISTS (SELECT 1 FROM public.assessment_invitations WHERE assessment_invitations.assessment_id = assessments.id AND assessment_invitations.candidate_id = auth.uid())
            ))
        );
    END IF;

    -- Assessment Invitations
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'invitations_access') THEN
        CREATE POLICY invitations_access ON public.assessment_invitations FOR ALL USING (
            candidate_id = auth.uid() OR invited_by = auth.uid()
        );
    END IF;

    -- Assessment Attempts
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'attempts_access') THEN
        CREATE POLICY attempts_access ON public.assessment_attempts FOR ALL USING (
            candidate_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.assessments WHERE assessments.id = assessment_attempts.assessment_id AND assessments.creator_id = auth.uid())
        );
    END IF;

    -- Submissions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'submissions_access') THEN
        CREATE POLICY submissions_access ON public.submissions FOR ALL USING (
            EXISTS (SELECT 1 FROM public.assessment_attempts WHERE assessment_attempts.id = submissions.attempt_id AND (
                assessment_attempts.candidate_id = auth.uid() OR
                EXISTS (SELECT 1 FROM public.assessments WHERE assessments.id = assessment_attempts.assessment_id AND assessments.creator_id = auth.uid())
            ))
        );
    END IF;

    -- Integrity Events
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'integrity_events_access') THEN
        CREATE POLICY integrity_events_access ON public.integrity_events FOR ALL USING (
            EXISTS (SELECT 1 FROM public.assessment_attempts WHERE assessment_attempts.id = integrity_events.attempt_id AND (
                assessment_attempts.candidate_id = auth.uid() OR
                EXISTS (SELECT 1 FROM public.assessments WHERE assessments.id = assessment_attempts.assessment_id AND assessments.creator_id = auth.uid())
            ))
        );
    END IF;

    -- Assessment Scores
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'scores_access') THEN
        CREATE POLICY scores_access ON public.assessment_scores FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.assessment_attempts WHERE assessment_attempts.id = assessment_scores.attempt_id AND (
                assessment_attempts.candidate_id = auth.uid() OR
                EXISTS (SELECT 1 FROM public.assessments WHERE assessments.id = assessment_attempts.assessment_id AND assessments.creator_id = auth.uid())
            ))
        );
    END IF;

    -- Skill Evidence: Publicly readable for skill passports
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'skill_evidence_select_all') THEN
        CREATE POLICY skill_evidence_select_all ON public.skill_evidence FOR SELECT USING (true);
    END IF;
END $$;

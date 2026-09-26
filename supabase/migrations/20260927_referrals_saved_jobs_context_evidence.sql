-- Referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  referred_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  referred_email TEXT,
  status TEXT NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED', 'SIGNED_UP', 'PROFILE_COMPLETED', 'ASSESSMENT_COMPLETED', 'APPLIED', 'HIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signup_timestamp TIMESTAMPTZ,
  profile_completed_at TIMESTAMPTZ,
  assessment_completed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  hired_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_user_id);

-- Referral events
CREATE TABLE IF NOT EXISTS public.referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_events_ref ON public.referral_events(referral_id);

-- Saved jobs
CREATE TABLE IF NOT EXISTS public.saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'internal',
  job_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_candidate_saved_job UNIQUE (candidate_id, job_id, source)
);

CREATE INDEX IF NOT EXISTS idx_saved_jobs_cand ON public.saved_jobs(candidate_id);

-- Assessment context events
CREATE TABLE IF NOT EXISTS public.assessment_context_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  elapsed_seconds INT NOT NULL DEFAULT 0,
  trigger TEXT NOT NULL,
  evidence_reference TEXT,
  event_type TEXT NOT NULL DEFAULT 'SCREEN_EVIDENCE_ON_CONTEXT_EXIT',
  image_data TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ctx_events_attempt ON public.assessment_context_events(attempt_id);

-- Job search cache
CREATE TABLE IF NOT EXISTS public.job_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  query_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'adzuna',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour')
);

CREATE INDEX IF NOT EXISTS idx_job_search_cache_key ON public.job_search_cache(cache_key);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_context_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_search_cache ENABLE ROW LEVEL SECURITY;

-- Referrals policies
DROP POLICY IF EXISTS "Users can read own referrals" ON public.referrals;
CREATE POLICY "Users can read own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

DROP POLICY IF EXISTS "Users can insert referrals" ON public.referrals;
CREATE POLICY "Users can insert referrals" ON public.referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update referrals" ON public.referrals;
CREATE POLICY "Users can update referrals" ON public.referrals
  FOR UPDATE USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- Referral events policies
DROP POLICY IF EXISTS "Users can read own referral events" ON public.referral_events;
CREATE POLICY "Users can read own referral events" ON public.referral_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.referrals WHERE id = referral_id AND (referrer_user_id = auth.uid() OR referred_user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can insert referral events" ON public.referral_events;
CREATE POLICY "Users can insert referral events" ON public.referral_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Saved jobs policies
DROP POLICY IF EXISTS "Candidates can manage saved jobs" ON public.saved_jobs;
CREATE POLICY "Candidates can manage saved jobs" ON public.saved_jobs
  FOR ALL USING (auth.uid() = candidate_id) WITH CHECK (auth.uid() = candidate_id);

-- Assessment context events policies
DROP POLICY IF EXISTS "Candidates can manage context events" ON public.assessment_context_events;
CREATE POLICY "Candidates can manage context events" ON public.assessment_context_events
  FOR ALL USING (auth.uid() = candidate_id) WITH CHECK (auth.uid() = candidate_id);

DROP POLICY IF EXISTS "Recruiters can view context events" ON public.assessment_context_events;
CREATE POLICY "Recruiters can view context events" ON public.assessment_context_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND a.creator_id = auth.uid())
  );

-- Job search cache policies (public read/insert for authenticated users)
DROP POLICY IF EXISTS "Authenticated users can use job cache" ON public.job_search_cache;
CREATE POLICY "Authenticated users can use job cache" ON public.job_search_cache
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

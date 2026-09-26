import { supabase } from '../supabase';
import { JobSearchParams, NormalizedJob, Profile, SavedJob } from '../../types';
import { AdzunaJobSource } from './adzunaAdapter';

const adzunaAdapter = new AdzunaJobSource();

/**
 * Searches across authorized job providers and internal platform employer jobs
 */
export async function searchAggregatedJobs(
  params: JobSearchParams,
  candidateProfile?: Profile | null
): Promise<NormalizedJob[]> {
  try {
    // 1. Fetch internal employer jobs from database
    let internalQuery = supabase
      .from('jobs')
      .select('*, company:companies(*), job_skills(*, skill:skills(*))')
      .eq('status', 'OPEN');

    if (params.role) {
      internalQuery = internalQuery.ilike('title', `%${params.role}%`);
    }

    const { data: internalJobs } = await internalQuery;

    const normalizedInternal: NormalizedJob[] = (internalJobs || []).map((j: any) => ({
      id: `internal-${j.id}`,
      source: 'Employer (Direct)',
      source_job_id: j.id,
      title: j.title,
      company_name: j.company?.name || 'Verified Employer',
      location: j.location || 'Remote',
      description: j.description || '',
      salary_min: j.salary_min,
      salary_max: j.salary_max,
      contract_type: j.job_type === 'FULL_TIME' ? 'Full-time' : j.job_type || 'Full-time',
      work_mode: j.work_mode === 'REMOTE' ? 'Remote' : j.work_mode === 'HYBRID' ? 'Hybrid' : 'On-site',
      posted_at: j.created_at,
      apply_url: `/jobs/${j.id}`,
      source_logo: j.company?.logo_url,
      required_skills: (j.job_skills || []).map((js: any) => js.skill?.name).filter(Boolean),
    }));

    // 2. Fetch external partner/Adzuna jobs
    const externalJobs = await adzunaAdapter.searchJobs(params);

    // Combine and calculate Skill Passport platform match
    const combined = [...normalizedInternal, ...externalJobs];

    if (candidateProfile) {
      return combined.map((job) => enrichJobWithPlatformMatch(job, candidateProfile));
    }

    return combined;
  } catch (err) {
    console.warn('Error in searchAggregatedJobs:', err);
    return [];
  }
}

/**
 * Calculates transparent "Platform Match" with Candidate's Skill Passport
 */
export function enrichJobWithPlatformMatch(job: NormalizedJob, profile: Profile): NormalizedJob {
  const profileAny = profile as any;
  const rawSkills: any[] = profileAny.skills || profileAny.profile_skills || [];
  const candidateSkills: string[] = rawSkills.map((s: any) =>
    (typeof s === 'string' ? s : s.name || s.skill?.name || '').toLowerCase()
  ).filter(Boolean);
  const requiredSkills = job.required_skills || [];

  if (requiredSkills.length === 0) {
    return {
      ...job,
      match_percentage: 70,
      match_reasons: ['Base profile match on experience level'],
      missing_skills: [],
    };
  }

  const matching: string[] = [];
  const missing: string[] = [];

  for (const req of requiredSkills) {
    const isMatched = candidateSkills.some(
      (cSkill) => cSkill.includes(req.toLowerCase()) || req.toLowerCase().includes(cSkill)
    );
    if (isMatched) {
      matching.push(req);
    } else {
      missing.push(req);
    }
  }

  const skillMatchRatio = matching.length / requiredSkills.length;
  // Weight skill match 80%, experience alignment 20%
  const experienceBonus = (profile.experience_years || 0) >= 2 ? 15 : 10;
  const rawScore = Math.round(skillMatchRatio * 80 + experienceBonus);
  const matchPercentage = Math.min(98, Math.max(35, rawScore));

  const reasons = matching.map((s) => `✓ ${s}`);
  if (profile.experience_years && profile.experience_years > 0) {
    reasons.push(`✓ ${profile.experience_years} years verified experience`);
  }

  return {
    ...job,
    match_percentage: matchPercentage,
    match_reasons: reasons,
    missing_skills: missing.map((s) => `○ ${s}`),
  };
}

/**
 * Saved Jobs Management
 */
export async function getSavedJobs(candidateId: string): Promise<SavedJob[]> {
  try {
    const { data, error } = await supabase
      .from('saved_jobs')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('saved_at', { ascending: false });

    if (error || !data) return [];
    return data as SavedJob[];
  } catch (err) {
    console.warn('Error fetching saved jobs:', err);
    return [];
  }
}

export async function saveJob(candidateId: string, job: NormalizedJob): Promise<boolean> {
  try {
    const { error } = await supabase.from('saved_jobs').insert({
      candidate_id: candidateId,
      job_id: job.id,
      source: job.source,
      job_data: job,
      saved_at: new Date().toISOString(),
    });

    return !error;
  } catch (err) {
    console.warn('Error saving job:', err);
    return false;
  }
}

export async function unsaveJob(candidateId: string, jobId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('saved_jobs')
      .delete()
      .eq('candidate_id', candidateId)
      .eq('job_id', jobId);

    return !error;
  } catch (err) {
    console.warn('Error unsaving job:', err);
    return false;
  }
}

import { Job, NormalizedJob, Profile, ProfileSkill, Project, AssessmentAttempt } from '../../types';

export interface TransparentMatchResult {
  value: number | null; // 0 - 100 or null if insufficient data
  status: 'CALCULATED' | 'INSUFFICIENT_DATA';
  label: string; // e.g. "42%" or "Not enough data"
  matchedSkills: string[];
  missingSkills: string[];
  evidence: string[];
  breakdown: {
    skillMatchScore: number;
    experienceScore: number;
    projectScore: number;
    assessmentScore: number;
  };
}

/**
 * Deterministic, transparent platform job match calculator.
 * NEVER invents scores or assigns arbitrary defaults (e.g. 65%, 70%, 75%).
 * 
 * Rules:
 * - Candidate with no profile data -> INSUFFICIENT_DATA (label: "Not enough data", value: null)
 * - Candidate with zero matching skills -> Strictly 0%
 * - Category with no evidence -> Awards 0 points for that category
 * - Formula (when at least 1 skill matches):
 *   60% Required Skills Match + 20% Experience Alignment + 10% Project Evidence + 10% Assessment Proof
 */
export function calculatePlatformJobMatch(
  job: {
    title: string;
    required_skills?: string[];
    skills?: Array<{ skill?: { name: string }; weight?: number }>;
    min_experience?: number;
  },
  candidate: Profile | null | undefined,
  candidateSkills: Array<string | ProfileSkill> = [],
  candidateProjects: Project[] = [],
  completedAttempts: AssessmentAttempt[] = []
): TransparentMatchResult {
  // 1. Check for insufficient candidate data
  if (!candidate || (!candidate.full_name && candidateSkills.length === 0 && candidateProjects.length === 0)) {
    return {
      value: null,
      status: 'INSUFFICIENT_DATA',
      label: 'Not enough data',
      matchedSkills: [],
      missingSkills: [],
      evidence: ['Awaiting candidate profile information'],
      breakdown: { skillMatchScore: 0, experienceScore: 0, projectScore: 0, assessmentScore: 0 },
    };
  }

  // 2. Normalize required job skills
  let requiredSkillNames: string[] = [];
  if (job.required_skills && job.required_skills.length > 0) {
    requiredSkillNames = job.required_skills;
  } else if (job.skills && job.skills.length > 0) {
    requiredSkillNames = job.skills.map((s) => s.skill?.name || '').filter(Boolean);
  }

  // If the job itself has no required skills specified
  if (requiredSkillNames.length === 0) {
    return {
      value: null,
      status: 'INSUFFICIENT_DATA',
      label: 'Not enough data',
      matchedSkills: [],
      missingSkills: [],
      evidence: ['Opportunity has no specific skill requirements listed'],
      breakdown: { skillMatchScore: 0, experienceScore: 0, projectScore: 0, assessmentScore: 0 },
    };
  }

  // 3. Extract candidate skills cleanly
  const candidateSkillNames: string[] = candidateSkills.map((s) => {
    if (typeof s === 'string') return s.trim().toLowerCase();
    return (s.skill?.name || '').trim().toLowerCase();
  }).filter(Boolean);

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  const evidence: string[] = [];

  for (const req of requiredSkillNames) {
    const reqLower = req.toLowerCase();
    const isMatched = candidateSkillNames.some(
      (cSkill) => cSkill.includes(reqLower) || reqLower.includes(cSkill)
    );

    if (isMatched) {
      matchedSkills.push(req);
    } else {
      missingSkills.push(req);
    }
  }

  // If candidate has ZERO matching skills, match is strictly 0%
  if (matchedSkills.length === 0) {
    return {
      value: 0,
      status: 'CALCULATED',
      label: '0%',
      matchedSkills: [],
      missingSkills: requiredSkillNames,
      evidence: ['No required skills found in candidate profile or projects'],
      breakdown: { skillMatchScore: 0, experienceScore: 0, projectScore: 0, assessmentScore: 0 },
    };
  }

  // 4. Calculate Sub-Scores Based ONLY on Real Evidence
  // A. Skill Match Score (60% weight)
  const skillRatio = matchedSkills.length / requiredSkillNames.length;
  const skillMatchScore = Math.round(skillRatio * 100);
  evidence.push(`Matched ${matchedSkills.length} of ${requiredSkillNames.length} required skills (${skillMatchScore}%)`);

  // B. Experience Score (20% weight)
  const reqMinExp = job.min_experience || 0;
  const candidateExp = candidate.experience_years || 0;
  let experienceScore = 0;

  if (candidateExp > 0) {
    if (reqMinExp === 0) {
      experienceScore = 100;
      evidence.push(`${candidateExp} years verified experience`);
    } else if (candidateExp >= reqMinExp) {
      experienceScore = 100;
      evidence.push(`Meets experience requirement (${candidateExp} / ${reqMinExp} yrs)`);
    } else {
      experienceScore = Math.round((candidateExp / reqMinExp) * 100);
      evidence.push(`Partial experience alignment (${candidateExp} / ${reqMinExp} yrs)`);
    }
  } else {
    experienceScore = 0;
    evidence.push('No professional experience on record');
  }

  // C. Project Evidence Score (10% weight)
  let projectScore = 0;
  const relevantProjects = candidateProjects.filter((p) =>
    p.skills?.some((ps) => matchedSkills.some((ms) => ms.toLowerCase() === ps.name.toLowerCase()))
  );
  if (relevantProjects.length > 0) {
    projectScore = Math.min(100, relevantProjects.length * 50);
    evidence.push(`${relevantProjects.length} linked project repository with demonstrated skills`);
  } else {
    projectScore = 0;
    evidence.push('No project repository proof linked for required skills');
  }

  // D. Assessment Evidence Score (10% weight)
  let assessmentScore = 0;
  const passedAttempts = completedAttempts.filter((att) => (att.technical_score || 0) >= 60);
  if (passedAttempts.length > 0) {
    const avgScore = Math.round(
      passedAttempts.reduce((acc, att) => acc + (att.technical_score || 0), 0) / passedAttempts.length
    );
    assessmentScore = avgScore;
    evidence.push(`${passedAttempts.length} verified assessment(s) passed (avg: ${avgScore}%)`);
  } else {
    assessmentScore = 0;
    evidence.push('No technical assessment verification completed yet');
  }

  // 5. Final Normalized Weighted Calculation
  const finalValue = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        skillMatchScore * 0.60 +
        experienceScore * 0.20 +
        projectScore * 0.10 +
        assessmentScore * 0.10
      )
    )
  );

  return {
    value: finalValue,
    status: 'CALCULATED',
    label: `${finalValue}%`,
    matchedSkills,
    missingSkills,
    evidence,
    breakdown: {
      skillMatchScore,
      experienceScore,
      projectScore,
      assessmentScore,
    },
  };
}

/**
 * Calculates candidate profile completion strictly from 8 actual profile sections.
 * Never uses arbitrary defaults.
 */
export function calculateProfileCompletion(
  candidate: Profile | null,
  skillsCount = 0,
  projectsCount = 0,
  assessmentsCount = 0
): { percentage: number; completedCount: number; totalCount: number; missingFields: string[] } {
  if (!candidate) {
    return { percentage: 0, completedCount: 0, totalCount: 8, missingFields: ['Profile not found'] };
  }

  const checks: Array<{ name: string; completed: boolean }> = [
    { name: 'Full Name', completed: Boolean(candidate.full_name?.trim()) },
    { name: 'Professional Bio', completed: Boolean(candidate.bio?.trim()) },
    { name: 'Location / Work Preferences', completed: Boolean(candidate.location || candidate.preferred_location) },
    { name: 'Declared Skills', completed: skillsCount > 0 },
    { name: 'Project Proof', completed: projectsCount > 0 },
    { name: 'Experience / Education', completed: (candidate.experience_years || 0) > 0 || Boolean(candidate.education?.trim()) },
    { name: 'Online Portfolio / GitHub', completed: Boolean(candidate.github_url || candidate.portfolio_url || candidate.linkedin_url) },
    { name: 'Assessment Verification', completed: assessmentsCount > 0 },
  ];

  const completedCount = checks.filter((c) => c.completed).length;
  const missingFields = checks.filter((c) => !c.completed).map((c) => c.name);
  const percentage = Math.round((completedCount / checks.length) * 100);

  return {
    percentage,
    completedCount,
    totalCount: checks.length,
    missingFields,
  };
}

/**
 * Calculates Skill Passport rating strictly from real assessed attempts.
 * Returns null / 0 if no assessments were taken — NEVER invents a score like 78.
 */
export function calculatePassportRating(assessedScores: number[]): {
  overallRating: number | null;
  label: string;
} {
  const validScores = assessedScores.filter((s) => typeof s === 'number' && !isNaN(s) && s >= 0);
  if (validScores.length === 0) {
    return {
      overallRating: null,
      label: 'Awaiting Assessment Proof',
    };
  }

  const sum = validScores.reduce((acc, val) => acc + val, 0);
  const avg = Math.round(sum / validScores.length);
  return {
    overallRating: avg,
    label: `${avg}/100`,
  };
}

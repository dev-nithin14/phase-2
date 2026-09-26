import { Job, Profile, ProfileSkill, Project, JobMatch, VerificationStatus } from '../types';

export interface SkillMatchDetail {
  skillName: string;
  weight: number;
  candidateScore: number;
  weightedContribution: number;
  isAssessed: boolean;
  verificationStatus: VerificationStatus;
  evidenceNote: string;
}

export interface MatchCalculationResult {
  overallScore: number; // 0-100
  skillScore: number;   // 0-100
  experienceScore: number; // 0-100
  locationScore: number;   // 0-100
  skillBreakdown: Record<string, SkillMatchDetail>;
  evidenceSummary: string;
  isStrongMatch: boolean;
}

/**
 * Deterministic Matching Engine
 * Strictly computes transparent, weighted, and evidence-backed match scores.
 */
export function calculateJobMatch(
  job: Job,
  candidate: Profile,
  candidateSkills: ProfileSkill[],
  candidateProjects: Project[]
): MatchCalculationResult {
  const jobSkills = job.skills || [];
  const skillBreakdown: Record<string, SkillMatchDetail> = {};

  let totalWeightedSkillScore = 0;
  let totalSkillWeight = 0;

  // 1. Skill Evaluation (70% total weight of match)
  if (jobSkills.length > 0) {
    for (const reqSkill of jobSkills) {
      const skillName = reqSkill.skill?.name || 'Unknown Skill';
      const weight = reqSkill.weight || (100 / jobSkills.length);
      totalSkillWeight += weight;

      // Find candidate's matching profile skill
      const candidateSkill = candidateSkills.find(
        (ps) => ps.skill?.name.toLowerCase() === skillName.toLowerCase() || ps.skill_id === reqSkill.skill_id
      );

      // Check projects that touch this skill
      const relevantProjects = candidateProjects.filter((p) =>
        p.skills?.some((s) => s.name.toLowerCase() === skillName.toLowerCase())
      );

      let skillRating = 0;
      let verificationStatus: VerificationStatus = 'SELF_DECLARED';
      let isAssessed = false;
      let note = '';

      if (candidateSkill) {
        verificationStatus = candidateSkill.verification_status;

        // If candidate took a technical assessment on this skill
        if (candidateSkill.assessed_score !== undefined && candidateSkill.assessed_score !== null) {
          isAssessed = true;
          // Assessed score provides primary deterministic proof (80% assessed + 20% project/declared)
          const baseAssessed = Number(candidateSkill.assessed_score);
          const projectBoost = Math.min(20, relevantProjects.length * 7);
          skillRating = Math.min(100, Math.round(baseAssessed * 0.85 + projectBoost * 0.15));
          note = `Assessment Score: ${candidateSkill.assessed_score}/100 with ${relevantProjects.length} linked project(s)`;
        } else {
          // Self-declared base score
          const selfMap: Record<string, number> = {
            BEGINNER: 45,
            INTERMEDIATE: 65,
            ADVANCED: 80,
            EXPERT: 90,
          };
          const base = selfMap[candidateSkill.self_declared_level] || 60;
          const projectBoost = Math.min(20, relevantProjects.length * 10);
          skillRating = Math.min(92, base + projectBoost);
          note = `Self-declared ${candidateSkill.self_declared_level} with ${relevantProjects.length} project evidence`;
          if (relevantProjects.length > 0) {
            verificationStatus = 'EVIDENCE_BACKED';
          }
        }
      } else if (relevantProjects.length > 0) {
        // Did not declare skill in profile, but demonstrated in projects
        skillRating = Math.min(75, 45 + relevantProjects.length * 12);
        verificationStatus = 'EVIDENCE_BACKED';
        note = `Demonstrated across ${relevantProjects.length} project repository(s)`;
      } else {
        skillRating = 0;
        note = 'Skill not found in candidate profile or projects';
      }

      const weightedContribution = Math.round((skillRating * weight) / 100);
      totalWeightedSkillScore += (skillRating * weight);

      skillBreakdown[skillName] = {
        skillName,
        weight,
        candidateScore: skillRating,
        weightedContribution,
        isAssessed,
        verificationStatus,
        evidenceNote: note,
      };
    }
  }

  const normalizedSkillScore = totalSkillWeight > 0 
    ? Math.round(totalWeightedSkillScore / totalSkillWeight) 
    : 70;

  // 2. Experience Match (15% total weight of match)
  const reqMinExp = job.min_experience || 0;
  const candidateExp = candidate.experience_years || 0;
  let experienceScore = 100;
  if (candidateExp < reqMinExp) {
    const deficit = reqMinExp - candidateExp;
    experienceScore = Math.max(30, Math.round(100 - deficit * 20));
  } else if (job.max_experience && candidateExp > job.max_experience + 3) {
    // Slight overqualification factor
    experienceScore = 90;
  }

  // 3. Location & Work Mode Match (15% total weight of match)
  let locationScore = 80;
  if (job.work_mode === 'REMOTE' || candidate.preferred_location === 'REMOTE') {
    locationScore = 100;
  } else if (job.work_mode === candidate.preferred_location) {
    locationScore = 100;
  } else if (candidate.location && job.location && candidate.location.toLowerCase().includes(job.location.toLowerCase())) {
    locationScore = 95;
  } else {
    locationScore = 70;
  }

  // Final Overall Weighted Score: 70% Skills + 15% Experience + 15% Location/Work Mode
  const finalScore = Math.round(
    normalizedSkillScore * 0.70 + 
    experienceScore * 0.15 + 
    locationScore * 0.15
  );

  // Evidence summary generation
  const assessedSkills = Object.values(skillBreakdown).filter((s) => s.isAssessed);
  const evidenceBackedSkills = Object.values(skillBreakdown).filter((s) => s.verificationStatus !== 'SELF_DECLARED');
  
  const summaryParts: string[] = [];
  if (assessedSkills.length > 0) {
    summaryParts.push(`${assessedSkills.length} required skill(s) validated by verified assessment`);
  }
  if (evidenceBackedSkills.length > 0) {
    summaryParts.push(`${evidenceBackedSkills.length} skill(s) backed by project repositories`);
  }
  summaryParts.push(`${candidateExp} yr(s) exp against ${reqMinExp}+ yr(s) required`);

  return {
    overallScore: Math.min(100, Math.max(0, finalScore)),
    skillScore: normalizedSkillScore,
    experienceScore,
    locationScore,
    skillBreakdown,
    evidenceSummary: summaryParts.join(' • '),
    isStrongMatch: finalScore >= 80,
  };
}

/**
 * Job-specific candidate ranking with filtering options
 */
export interface CandidateRankingItem {
  candidate: Profile;
  match: MatchCalculationResult;
  skills: ProfileSkill[];
  projects: Project[];
  rank: number;
}

export interface CandidateFilterOptions {
  minScore?: number;
  skillName?: string;
  minExperience?: number;
  location?: string;
  verifiedOnly?: boolean;
  availability?: string;
}

export function rankCandidatesForJob(
  job: Job,
  candidates: Array<{ candidate: Profile; skills: ProfileSkill[]; projects: Project[] }>,
  filters?: CandidateFilterOptions
): CandidateRankingItem[] {
  const ranked = candidates.map(({ candidate, skills, projects }) => {
    const match = calculateJobMatch(job, candidate, skills, projects);
    return {
      candidate,
      match,
      skills,
      projects,
      rank: 0,
    };
  });

  // Sort descending by overall match score
  ranked.sort((a, b) => b.match.overallScore - a.match.overallScore);

  // Apply filters
  let filtered = ranked;
  if (filters) {
    if (filters.minScore !== undefined) {
      filtered = filtered.filter((item) => item.match.overallScore >= (filters.minScore || 0));
    }
    if (filters.minExperience !== undefined) {
      filtered = filtered.filter((item) => item.candidate.experience_years >= (filters.minExperience || 0));
    }
    if (filters.skillName) {
      const q = filters.skillName.toLowerCase();
      filtered = filtered.filter((item) =>
        item.skills.some((s) => s.skill?.name.toLowerCase().includes(q))
      );
    }
    if (filters.location) {
      const q = filters.location.toLowerCase();
      filtered = filtered.filter((item) =>
        item.candidate.location?.toLowerCase().includes(q)
      );
    }
    if (filters.verifiedOnly) {
      filtered = filtered.filter((item) =>
        Object.values(item.match.skillBreakdown).some((s) => s.verificationStatus === 'ASSESSMENT_BACKED' || s.verificationStatus === 'FULLY_VERIFIED')
      );
    }
    if (filters.availability && filters.availability !== 'ALL') {
      filtered = filtered.filter((item) => item.candidate.availability === filters.availability);
    }
  }

  // Assign 1-based ranks
  return filtered.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

import { Job, Profile, ProfileSkill, Project, AssessmentAttempt, IntegrityEvent } from '../types';

/**
 * Agent 1: Skill Matching Agent
 * Generates transparent evidence-backed explanations for recruiter and candidate.
 * The numerical score remains strictly deterministic.
 */
export function runSkillMatchingAgent(params: {
  job: Job;
  candidate: Profile;
  matchScore: number;
  skills: ProfileSkill[];
  projects: Project[];
}): {
  matchSummary: string;
  keyStrengths: string[];
  evidenceHighlights: string[];
  recommendation: 'STRONG_FIT' | 'CONSIDER' | 'POTENTIAL_TRAINEE';
} {
  const { job, candidate, matchScore, skills, projects } = params;
  const verifiedSkills = skills.filter((s) => s.verification_status === 'ASSESSMENT_BACKED' || s.verification_status === 'FULLY_VERIFIED');
  
  const strengths: string[] = [];
  const highlights: string[] = [];

  for (const s of skills) {
    if (s.assessed_score && s.assessed_score >= 80) {
      strengths.push(`High proficiency in ${s.skill?.name || 'Core Skill'} (${s.assessed_score}/100 assessed score)`);
    }
  }

  if (candidate.experience_years >= (job.min_experience || 0)) {
    strengths.push(`${candidate.experience_years} years hands-on experience satisfies the role threshold`);
  }

  for (const p of projects.slice(0, 3)) {
    highlights.push(`Project "${p.title}" proves capability in ${p.skills?.map(s => s.name).join(', ') || 'full-stack dev'}`);
  }

  let recommendation: 'STRONG_FIT' | 'CONSIDER' | 'POTENTIAL_TRAINEE' = 'CONSIDER';
  if (matchScore >= 85 && verifiedSkills.length >= 2) {
    recommendation = 'STRONG_FIT';
  } else if (matchScore < 70) {
    recommendation = 'POTENTIAL_TRAINEE';
  }

  return {
    matchSummary: `Candidate matches ${matchScore}% of requirements for ${job.title} based on ${verifiedSkills.length} verified skill assessments and ${projects.length} project repository proofs.`,
    keyStrengths: strengths.length > 0 ? strengths : ['Solid foundational technical skills', 'Demonstrated problem-solving potential'],
    evidenceHighlights: highlights.length > 0 ? highlights : ['Technical profile demonstrates relevant experience'],
    recommendation,
  };
}

/**
 * Agent 3: Evaluation Agent
 * Synthesizes objective test metrics into actionable technical insights.
 * Does not arbitrarily dictate numerical score.
 */
export function runEvaluationAgent(attempt: AssessmentAttempt): {
  strengths: string[];
  weaknesses: string[];
  technicalObservations: string[];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const observations: string[] = [];

  const score = attempt.technical_score || 0;
  const submissions = attempt.submissions || [];
  
  let totalTests = 0;
  let passedTests = 0;
  for (const s of submissions) {
    totalTests += s.total_tests;
    passedTests += s.tests_passed;
    if (s.tests_passed === s.total_tests) {
      strengths.push(`Successfully passed 100% test cases on ${s.language} solution`);
    } else {
      weaknesses.push(`Failed ${s.total_tests - s.tests_passed} edge cases in ${s.language} submission`);
    }
  }

  if (score >= 85) {
    strengths.push('Clean algorithmic structure with minimal computational overhead');
    strengths.push('Efficient memory management in submission runtimes');
  } else if (score < 65) {
    weaknesses.push('Submissions showed difficulties with edge case boundaries and time performance');
  }

  observations.push(`Submitted ${submissions.length} problem solutions across ${totalTests} test criteria`);
  observations.push(`Scored ${score}/100 based on deterministic criteria: Correctness, Efficiency, and Quality`);

  return {
    strengths: strengths.length > 0 ? strengths : ['Completed all assessment requirements'],
    weaknesses: weaknesses.length > 0 ? weaknesses : ['None flagged. Solid execution.'],
    technicalObservations: observations,
  };
}

/**
 * Agent 4: Integrity Analysis Agent
 * Synthesizes timestamped integrity telemetry into a balanced recommendation.
 * Strictly adheres to non-accusatory, human-centered review standard.
 */
export function runIntegrityAnalysisAgent(events: IntegrityEvent[]): {
  summary: string;
  flaggedEvents: string[];
  reviewRecommendation: 'PROCEED' | 'MANUAL_VERIFICATION_RECOMMENDED' | 'FLAGGED_FOR_FOLLOWUP';
  humanReviewNote: string;
} {
  const flaggedEvents: string[] = [];
  let tabSwitches = 0;
  let fullscreenExits = 0;
  let copyPastes = 0;

  for (const e of events) {
    if (e.event_type === 'TAB_SWITCH') tabSwitches++;
    if (e.event_type === 'FULLSCREEN_EXIT') fullscreenExits++;
    if (e.event_type === 'PASTE_ATTEMPT' || e.event_type === 'COPY_ATTEMPT') copyPastes++;
  }

  if (tabSwitches > 0) flaggedEvents.push(`${tabSwitches} window / tab focus switch event(s) recorded`);
  if (fullscreenExits > 0) flaggedEvents.push(`${fullscreenExits} fullscreen exit event(s) recorded`);
  if (copyPastes > 0) flaggedEvents.push(`${copyPastes} clipboard interaction(s) logged`);

  let reviewRecommendation: 'PROCEED' | 'MANUAL_VERIFICATION_RECOMMENDED' | 'FLAGGED_FOR_FOLLOWUP' = 'PROCEED';
  let humanReviewNote = 'Integrity signals show standard candidate behavior. Proceed without reservation.';

  if (tabSwitches >= 4 || fullscreenExits >= 3) {
    reviewRecommendation = 'FLAGGED_FOR_FOLLOWUP';
    humanReviewNote = 'Elevated count of focus changes. Recommend quick recruiter clarification during technical interview rather than automatic disqualification.';
  } else if (tabSwitches >= 1 || fullscreenExits >= 1 || copyPastes >= 2) {
    reviewRecommendation = 'MANUAL_VERIFICATION_RECOMMENDED';
    humanReviewNote = 'Minor ambient telemetry events. Likely dual-monitor behavior or harmless reference lookup.';
  }

  return {
    summary: `Assessment integrity audit processed ${events.length} timestamped telemetry points. Overall posture: ${reviewRecommendation.replace(/_/g, ' ')}.`,
    flaggedEvents,
    reviewRecommendation,
    humanReviewNote,
  };
}

import { Job, Profile, ProfileSkill, Project, AssessmentAttempt, AssessmentQuestion, IntegrityEvent } from '../types';

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
 * Agent 2: Assessment Question Generator
 * Generates tailored coding problems. Requires recruiter review before publishing.
 */
export function runAssessmentGeneratorAgent(params: {
  role: string;
  skills: string[];
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}): AssessmentQuestion[] {
  const { role, skills, difficulty } = params;
  const primarySkill = skills[0] || 'JavaScript';

  return [
    {
      id: `gen_q_${Date.now()}_1`,
      assessment_id: '',
      title: `${primarySkill}: Dynamic Throttle & Cache Function`,
      statement: `In modern ${role} applications, API rate limits are critical. Implement a cache-backed wrapper function \`solution(fn, ttlMs)\` that remembers results for identical arguments within a \`ttlMs\` sliding window and avoids redundant executions.`,
      constraints: `• fn will always be a valid function returning a value\n• ttlMs >= 100 and <= 10000\n• Must handle primitive and array arguments`,
      examples: [
        {
          input: '["computeTotal", 500]',
          output: '"Cached result"',
          explanation: 'Subsequent calls with identical inputs within 500ms return cached output without executing fn again.'
        }
      ],
      starter_code: {
        javascript: `// Implement cache-backed function wrapper\nfunction solution(fn, ttlMs) {\n  const cache = new Map();\n  return function(...args) {\n    const key = JSON.stringify(args);\n    const now = Date.now();\n    if (cache.has(key) && (now - cache.get(key).timestamp < ttlMs)) {\n      return cache.get(key).value;\n    }\n    const result = fn(...args);\n    cache.set(key, { value: result, timestamp: now });\n    return result;\n  };\n}`,
        python: `# Implement cache-backed function wrapper\nimport time\ndef solution(fn, ttl_ms):\n    cache = {}\n    def wrapper(*args):\n        key = str(args)\n        now = time.time() * 1000\n        if key in cache and (now - cache[key]['time'] < ttl_ms):\n            return cache[key]['val']\n        res = fn(*args)\n        cache[key] = {'val': res, 'time': now}\n        return res\n    return wrapper`
      },
      test_cases: [
        {
          id: 'tc_1',
          input: '[4, 6]',
          expected_output: '10',
          is_hidden: false,
          explanation: 'Basic computation and return verification'
        },
        {
          id: 'tc_2',
          input: '[10, 20]',
          expected_output: '30',
          is_hidden: true,
          explanation: 'Boundary arguments verification'
        }
      ],
      difficulty,
      points: 50,
      time_limit_sec: 3,
      memory_limit_mb: 256,
      order_index: 1,
    },
    {
      id: `gen_q_${Date.now()}_2`,
      assessment_id: '',
      title: `${skills[1] || 'Algorithm'}: Safe Nested Property Resolver`,
      statement: `Build a safe object property extraction utility \`solution(obj, path, defaultValue)\` that traverses nested objects using dot-notation string paths without throwing TypeErrors on undefined segments.`,
      constraints: `• path is a dot-separated string like 'user.profile.address.city'\n• If any node is undefined or null, return defaultValue\n• Must execute in O(N) where N is path depth`,
      examples: [
        {
          input: '{"user": {"name": "Alex"}}, "user.name", "Default"',
          output: '"Alex"',
          explanation: 'Path correctly traverses and finds "Alex"'
        }
      ],
      starter_code: {
        javascript: `function solution(obj, path, defaultValue) {\n  if (!path || typeof path !== 'string') return defaultValue;\n  const keys = path.split('.');\n  let current = obj;\n  for (const key of keys) {\n    if (current == null) return defaultValue;\n    current = current[key];\n  }\n  return current !== undefined ? current : defaultValue;\n}`,
        python: `def solution(obj, path, default_value):\n    if not path:\n        return default_value\n    keys = path.split('.')\n    current = obj\n    for key in keys:\n        if current is None or not isinstance(current, dict):\n            return default_value\n        current = current.get(key)\n    return current if current is not None else default_value`
      },
      test_cases: [
        {
          id: 'tc_3',
          input: '{"a": {"b": 42}}, "a.b", 0',
          expected_output: '42',
          is_hidden: false,
          explanation: 'Standard nested traversal'
        },
        {
          id: 'tc_4',
          input: '{"a": null}, "a.b.c", "fallback"',
          expected_output: '"fallback"',
          is_hidden: true,
          explanation: 'Safe handling of null intermediate property'
        }
      ],
      difficulty,
      points: 50,
      time_limit_sec: 3,
      memory_limit_mb: 256,
      order_index: 2,
    }
  ];
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

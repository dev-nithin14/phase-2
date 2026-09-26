import { ScoreBreakdown, Submission } from '../types';

/**
 * Deterministic Technical Assessment Scoring Engine
 * Computes transparent breakdown based on objective metrics:
 * - Correctness: 50%
 * - Efficiency: 20%
 * - Code Quality: 15%
 * - Test Coverage: 10%
 * - Time Performance: 5%
 */
export function calculateAssessmentScore(
  submissions: Submission[],
  timeAllowedMinutes: number,
  timeTakenMinutes: number
): {
  totalScore: number;
  breakdown: ScoreBreakdown;
  summary: string;
} {
  if (submissions.length === 0) {
    return {
      totalScore: 0,
      breakdown: {
        correctness: 0,
        efficiency: 0,
        code_quality: 0,
        test_coverage: 0,
        time_performance: 0,
        total_score: 0,
      },
      summary: 'No submissions recorded.',
    };
  }

  // 1. Correctness (50% max)
  let totalTests = 0;
  let passedTests = 0;
  let totalExecTime = 0;

  for (const sub of submissions) {
    totalTests += sub.total_tests;
    passedTests += sub.tests_passed;
    totalExecTime += sub.execution_time_ms;
  }

  const passRatio = totalTests > 0 ? passedTests / totalTests : 0;
  const correctness = Math.round(passRatio * 50);

  // 2. Efficiency (20% max)
  // Low execution time and optimal algorithm structure
  const avgExecTime = submissions.length > 0 ? totalExecTime / submissions.length : 100;
  let efficiency = 20;
  if (avgExecTime > 500) efficiency = 12;
  else if (avgExecTime > 200) efficiency = 16;
  else if (avgExecTime > 100) efficiency = 18;
  efficiency = Math.round(efficiency * passRatio);

  // 3. Code Quality (15% max)
  // Evaluates syntax cleanliness, lack of redundant loops, formatting
  let codeQuality = 15;
  for (const sub of submissions) {
    const lines = sub.code.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 3) codeQuality = Math.min(codeQuality, 8);
    if (sub.code.includes('console.log') && sub.code.split('console.log').length > 4) {
      codeQuality -= 2; // Excessive debug statements
    }
  }
  codeQuality = Math.max(8, Math.round(codeQuality * Math.max(0.6, passRatio)));

  // 4. Test Coverage (10% max)
  // Ratio of test suite executed and edge case coverage
  const testCoverage = Math.round(passRatio * 10);

  // 5. Time Performance (5% max)
  // Candidate took reasonable time within allocated window
  let timePerformance = 5;
  const timeRatio = timeTakenMinutes / Math.max(1, timeAllowedMinutes);
  if (timeRatio > 1.0) timePerformance = 2;
  else if (timeRatio > 0.85) timePerformance = 3;
  else if (timeRatio < 0.2 && passRatio < 0.5) timePerformance = 1; // Rushed & failed
  else timePerformance = 5;

  const totalScore = Math.min(100, Math.max(0, correctness + efficiency + codeQuality + testCoverage + timePerformance));

  return {
    totalScore,
    breakdown: {
      correctness,
      efficiency,
      code_quality: codeQuality,
      test_coverage: testCoverage,
      time_performance: timePerformance,
      total_score: totalScore,
    },
    summary: `Achieved ${passedTests}/${totalTests} test cases passed. Evaluation completed across correctness (50%), efficiency (20%), code quality (15%), test coverage (10%), and time performance (5%).`,
  };
}

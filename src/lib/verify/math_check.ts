import { AIProblemItem } from '@/lib/ai/types';
import { VerificationResult, FailureCode } from './failure_codes';

export function checkMath(problem: AIProblemItem): VerificationResult {
  // 1. Basic content checks
  if (problem.stem_latex.length < 5) { // Arbitrary min length
      return { success: false, code: FailureCode.MATH_FAILED, reason: 'Stem too short' };
  }
  if (problem.answer_latex.length < 1) {
      return { success: false, code: FailureCode.MATH_FAILED, reason: 'Answer empty' };
  }

  // 2. Placeholder for more advanced math checks (e.g. using a parser if available)
  // For MVP, checks are minimal as requested.

  return { success: true };
}

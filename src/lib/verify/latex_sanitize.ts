import { FailureCode, VerificationResult } from './failure_codes';

// Forbidden commands that could be dangerous or break layout
const FORBIDDEN_PATTERNS = [
  /\\write\d*/,
  /\\input/,
  /\\include/,
  /\\directlua/,
  /\\usepackage/,
  /\\newcommand/, // Avoid redefining macros for now
  /\\def/,
  /\\catcode/,
  /\\openout/,
  /\\newwrite/,
  /\\immediate/,
  /\\ShellEscape/,
  /\\write18/
];

export function sanitizeLatex(latex: string): VerificationResult {
  if (!latex) {
    return { success: false, code: FailureCode.SCHEMA_FAILED, reason: 'Empty latex' };
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(latex)) {
      return { 
        success: false, 
        code: FailureCode.SANITIZE_FAILED, 
        reason: `Forbidden pattern detected: ${pattern.toString()}` 
      };
    }
  }

  // Also check for unbalanced braces (simple check)
  const open = (latex.match(/\{/g) || []).length;
  const close = (latex.match(/\}/g) || []).length;
  if (open !== close) {
      return {
          success: false,
          code: FailureCode.SANITIZE_FAILED,
          reason: `Unbalanced braces: {=${open}, }=${close}`
      };
  }

  return { success: true };
}

export enum FailureCode {
  SANITIZE_FAILED = 'SANITIZE_FAILED',
  COMPILE_FAILED = 'COMPILE_FAILED',
  MATH_FAILED = 'MATH_FAILED',
  SCHEMA_FAILED = 'SCHEMA_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface VerificationResult {
  success: boolean;
  code?: FailureCode;
  reason?: string;
}

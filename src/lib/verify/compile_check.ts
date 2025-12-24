import { PDFBuilder } from '@/lib/latex';
import { VerificationResult, FailureCode } from './failure_codes';

const builder = new PDFBuilder();

export async function checkCompilation(latexSnippet: string): Promise<VerificationResult> {
  // Wrap snippet in a minimal document to test compilation
  const fullBody = builder.getLayoutTemplate(latexSnippet);
  
  try {
    // We don't need the buffer, just want to see if it throws
    await builder.buildPDF(fullBody);
    return { success: true };
  } catch (error: any) {
    return { 
      success: false, 
      code: FailureCode.COMPILE_FAILED, 
      reason: error.message 
    };
  }
}

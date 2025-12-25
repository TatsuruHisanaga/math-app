import { PDFBuilder } from '@/lib/latex';
import { VerificationResult, FailureCode } from './failure_codes';

const builder = new PDFBuilder();

export async function checkCompilation(latexSnippet: string, type: 'stem' | 'answer' = 'stem'): Promise<VerificationResult> {
  // Wrap snippet to match actual usage context
  let content = latexSnippet;
  if (type === 'stem') {
      // Wrapped in qbox (minipage)
      content = `\\begin{qbox}\n${latexSnippet}\n\\end{qbox}`;
  } else {
      // Wrapped in itemize
      content = `\\begin{itemize}\n\\item ${latexSnippet}\n\\end{itemize}`;
  }

  const fullBody = builder.getLayoutTemplate(content);
  
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

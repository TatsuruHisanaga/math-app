import { PDFBuilder } from '@/lib/latex';
import { VerificationResult, FailureCode } from './failure_codes';

const builder = new PDFBuilder();

export async function checkCompilation(latexSnippet: string, type: 'stem' | 'answer' = 'stem'): Promise<VerificationResult> {
  // Wrap snippet to match actual usage context
  let content = latexSnippet;
  if (type === 'stem') {
      // Wrapped in qbox
      content = `\\begin{qbox}\n${latexSnippet}\n\\answerbox{3cm}{}\n\\end{qbox}`;
  } else {
      // Wrapped in qbox + answeredbox (Answer Sheet context)
      content = `\\begin{qbox}\nProblem Stem\n\\answeredbox{${latexSnippet}}\n\\end{qbox}`;
  }

  const fullBody = builder.getVerificationTemplate(content);
  
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

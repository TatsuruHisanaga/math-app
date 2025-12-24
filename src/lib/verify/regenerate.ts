import { AIClient } from '@/lib/ai/client';
import { AIProblemSet, AIProblemItem } from '@/lib/ai/types';
import { sanitizeLatex } from './latex_sanitize';
import { checkCompilation } from './compile_check';
import { checkMath } from './math_check';
import { FailureCode, VerificationResult } from './failure_codes';

export interface ValidatedProblem extends AIProblemItem {
    verification_log?: VerificationResult[];
}

export class GenerationPipeline {
    private client: AIClient;
    private maxRetries = 2; // Keep low for speed

    constructor(client: AIClient) {
        this.client = client;
    }

    async generateVerified(
        topic: string, 
        count: number, 
        difficulty: string
    ): Promise<ValidatedProblem[]> {
        let validProblems: ValidatedProblem[] = [];
        let attempts = 0;
        let needed = count;

        while (attempts <= this.maxRetries && validProblems.length < count) {
            attempts++;
            // Request slightly more to buffer for failures on first try, less on subsequent
            const bufferCount = Math.ceil(needed * (attempts === 1 ? 1.5 : 1.2));
            
            try {
                // If needed < 1, stop (loop condition handles it but bufferCount calc fails)
                if (needed <= 0) break;

                const problemSet = await this.client.generateProblems(topic, bufferCount, difficulty);
                
                if (!problemSet || !problemSet.problems) {
                    continue;
                }

                // Process sequentially to be safe with latex builds (concurrent builds can be done but might be heavy)
                for (const p of problemSet.problems) {
                    if (validProblems.length >= count) break;

                    const validation = await this.verifyProblem(p);
                    if (validation.success) {
                        validProblems.push(p);
                        needed--;
                    } else {
                        console.warn(`Problem rejected: ${validation.code} - ${validation.reason} \nContent: ${p.stem_latex}`);
                        // Logic to feedback error to AI could go here in a refined version
                    }
                }
            } catch (e) {
                console.error("AI Generation failed", e);
                // Continue to retry
            }
        }
        
        return validProblems;
    }

    async verifyProblem(p: AIProblemItem): Promise<VerificationResult> {
        // 1. Sanitize
        let res = sanitizeLatex(p.stem_latex);
        if (!res.success) return res;
        res = sanitizeLatex(p.answer_latex);
        if (!res.success) return res;

        // 2. Math Check
        res = checkMath(p);
        if (!res.success) return res;

        // 3. Compile Check (Most expensive, do last)
        // Check stem
        res = await checkCompilation(p.stem_latex);
        if (!res.success) return res;
        
        // Check answer
        res = await checkCompilation(p.answer_latex);
        if (!res.success) return res;

        return { success: true };
    }
}

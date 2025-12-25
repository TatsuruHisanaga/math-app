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
        difficulty: string,
        modelOverride?: string,
        onProgress?: (current: number, total: number) => void
    ): Promise<ValidatedProblem[]> {
        let validProblems: ValidatedProblem[] = [];
        let attempts = 0;
        let needed = count;
        let lastError = "";

        // Initial progress
        if (onProgress) onProgress(0, count);

        while (attempts <= this.maxRetries && validProblems.length < count) {
            attempts++;
            // Request slightly more to buffer for failures
            const bufferCount = Math.ceil(needed * (attempts === 1 ? 1.5 : 1.2));
            
            try {
                if (needed <= 0) break;

                const problemSet = await this.client.generateProblems(topic, bufferCount, difficulty, modelOverride);
                
                if (!problemSet || !problemSet.problems) {
                    lastError = "AI returned empty problem set.";
                    continue;
                }

                for (const p of problemSet.problems) {
                    if (validProblems.length >= count) break;

                    const validation = await this.verifyProblem(p);
                    if (validation.success) {
                        validProblems.push(p);
                        needed--;
                        if (onProgress) onProgress(validProblems.length, count);
                    } else {
                        lastError = `Rejected: ${validation.code} - ${validation.reason}`;
                        console.warn(`Problem rejected: ${validation.code} - ${validation.reason} \nContent: ${p.stem_latex}`);
                    }
                }
            } catch (e: any) {
                lastError = e.message;
                console.error("AI Generation failed", e);
            }
        }
        
        if (validProblems.length === 0 && attempts > this.maxRetries) {
            throw new Error(`Failed to generate any valid problems after ${attempts} attempts. Last reason: ${lastError}`);
        }
        
        return validProblems;
    }

    async verifyProblem(p: AIProblemItem): Promise<VerificationResult> {
        p.stem_latex = this.tryRepairMath(p.stem_latex);
        p.answer_latex = this.tryRepairMath(p.answer_latex);
        if (p.explanation_latex) p.explanation_latex = this.tryRepairMath(p.explanation_latex);

        // 1. Sanitize
        let res = sanitizeLatex(p.stem_latex);
        if (!res.success) return res;
        res = sanitizeLatex(p.answer_latex);
        if (!res.success) return res;
        
        if (p.explanation_latex) {
            res = sanitizeLatex(p.explanation_latex);
            if (!res.success) return res;
        }

        // 2. Math Check
        res = checkMath(p);
        if (!res.success) return res;

        // 3. Compile Check
        res = await checkCompilation(p.stem_latex, 'stem');
        if (!res.success) return res;
        
        res = await checkCompilation(p.answer_latex, 'answer');
        if (!res.success) return res;

        if (p.explanation_latex) {
            res = await checkCompilation(p.explanation_latex, 'answer');
            if (!res.success) return res;
        }

        return { success: true };
    }

    private tryRepairMath(latex: string): string {
        if (!latex) return latex;
        // Permissive repair for missing math delimiters
        const mathTokens = ['^', '_', '\\frac', '\\sqrt', '\\times', '\\div', '=', '\\pi'];
        const hasMathToken = mathTokens.some(t => latex.includes(t));
        const hasDollar = latex.includes('$');
        
        if (hasMathToken && !hasDollar) {
            const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(latex);
            if (!hasJapanese) {
                return `$${latex}$`;
            } else {
                // Improved wrapping: handle spaces better or wrap whole segments that are clearly math
                // For now, simpler but safer regex
                return latex.replace(/([a-zA-Z0-9\+\-\=\(\)\^\/\\]+)/g, (match) => {
                     if (match.includes('^') || match.includes('_') || match.includes('\\')) {
                         return `$${match}$`;
                     }
                     return match;
                });
            }
        }
        return latex;
    }
}

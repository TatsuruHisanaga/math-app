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
        onProgress?: (current: number, total: number) => void
    ): Promise<ValidatedProblem[]> {
        let validProblems: ValidatedProblem[] = [];
        let attempts = 0;
        let needed = count;

        // Initial progress
        if (onProgress) onProgress(0, count);

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
                        if (onProgress) onProgress(validProblems.length, count);
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
        // 0. Auto-Repair (Heuristic)
        // If the stem contains common math characters but NO dollar signs, wrap the math part or whole stem?
        // It's dangerous to wrap whole stem if it contains Japanese.
        // But often the AI returns "Solve x^2" where x^2 is just text.
        // Let's try a stronger prompt-based repair? No, too slow.
        // Let's try simple heuristic:
        // If we detect "x^...", "a_..." or "\frac" and there are NO '$', invalid. 
        // We can ALSO try to "repair" by wrapping common patterns if they are isolated.
        // But for now, let's just do a very aggressive check: 
        // If compilation failed with "Missing $ inserted", we can try to wrap the CONTENT of the failed item in $. 
        // But we don't know which field failed easily here. 
        
        // Let's pre-process: find pattern [a-zA-Z0-9]+\^[a-zA-Z0-9]+ and if not inside $, wrap it?
        // Too complex for regex without destroying text.
        
        // BETTER STRATEGY: 
        // The problem is likely that the AI returns `x^2 + 4x + 4` as `stem_latex`. 
        // If `stem_latex` has NO Japanese/Multibyte characters, it's likely pure math.
        // If it has Japanese, it's mixed.
        
        p.stem_latex = this.tryRepairMath(p.stem_latex);
        p.answer_latex = this.tryRepairMath(p.answer_latex);
        if (p.explanation_latex) p.explanation_latex = this.tryRepairMath(p.explanation_latex);
        if (p.hint_latex) p.hint_latex = this.tryRepairMath(p.hint_latex);
        if (p.common_mistake_latex) p.common_mistake_latex = this.tryRepairMath(p.common_mistake_latex);

        // 1. Sanitize
        let res = sanitizeLatex(p.stem_latex);
        if (!res.success) return res;
        res = sanitizeLatex(p.answer_latex);
        if (!res.success) return res;
        
        // Sanitize feedback fields if present
        if (p.explanation_latex) {
            res = sanitizeLatex(p.explanation_latex);
            if (!res.success) return res;
        }
        if (p.hint_latex) {
            res = sanitizeLatex(p.hint_latex);
            if (!res.success) return res;
        }
        if (p.common_mistake_latex) {
            res = sanitizeLatex(p.common_mistake_latex);
            if (!res.success) return res;
        }

        // 2. Math Check
        res = checkMath(p);
        if (!res.success) return res;

        // 3. Compile Check (Most expensive, do last)
        // Check stem
        res = await checkCompilation(p.stem_latex, 'stem');
        if (!res.success) return res;
        
        // Check answer
        res = await checkCompilation(p.answer_latex, 'answer');
        if (!res.success) return res;

        // Check feedback (as answer context/itemize)
        if (p.explanation_latex) {
            res = await checkCompilation(p.explanation_latex, 'answer');
            if (!res.success) return res;
        }
        if (p.hint_latex) {
             res = await checkCompilation(p.hint_latex, 'answer');
            if (!res.success) return res;
        }

        return { success: true };
    }

    private tryRepairMath(latex: string): string {
        if (!latex) return latex;
        // 1. If the string contains NO '$' but contains '^' or '\', it is highly suspicious.
        // However, we might have '\textbf' which is valid text mode.
        // We look for SPECIFIC math-only tokens: '^', '_', '\frac', '\sqrt', '\times', '\div'.
        const mathTokens = ['^', '_', '\\frac', '\\sqrt', '\\times', '\\div', '=', '\\pi'];
        const hasMathToken = mathTokens.some(t => latex.includes(t));
        const hasDollar = latex.includes('$');
        
        if (hasMathToken && !hasDollar) {
            // High probability of missing math delimiters.
            // Check if it contains Japanese characters (Hiragana/Katakana/Kanji)
            // Range: 3000-303f, 3040-309f, 30a0-30ff, 4e00-9faf
            const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(latex);
            
            if (!hasJapanese) {
                // If no Japanese, assume it's a pure math expression and wrap it wholly.
                return `$${latex}$`;
            } else {
                // Mixed content with missing delimiters. Hard to fix automatically without NLP.
                // We could try to replace `x^2` with `$x^2$` using regex but it's risky.
                // For now, let's leave mixed content alone and rely on the AI learning (or failing).
                // Or... we can try to wrap "words" that contain math chars?
                // Example: "次の式 x^2+1 を解け" -> "次の式 $x^2+1$ を解け"
                // Regex: ([a-zA-Z0-9\+\-\=\(\)\^]+) might capture math parts?
                return latex.replace(/([a-zA-Z0-9\+\-\=\(\)\^\/\\]+)/g, (match) => {
                     // Filter out common text commands if any? 
                     // Simple heuristic: if it has ^ or _, needs $.
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

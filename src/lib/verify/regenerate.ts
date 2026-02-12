import { AIClient } from '@/lib/ai/client';
import { AIProblemSet, AIProblemItem } from '@/lib/ai/types';
import { sanitizeLatex } from './latex_sanitize';
import { checkCompilation } from './compile_check';
import { checkMath } from './math_check';
import { FailureCode, VerificationResult } from './failure_codes';
import fs from 'fs';
import path from 'path';

function logToDebugFile(message: string) {
    const logPath = path.resolve(process.cwd(), 'debug_generation.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
}

export interface ValidatedProblem extends AIProblemItem {
    verification_log?: VerificationResult[];
}

export class GenerationPipeline {
    private client: AIClient;
    private maxRetries = 4; // Increased retries to ensure count met

    constructor(client: AIClient) {
        this.client = client;
    }

    async generateVerified(
        topic: string, 
        count: number, 
        difficulty: string,
        modelOverride?: string,
        onProgress?: (current: number, total: number) => void,
        otherRequests?: string
    ): Promise<{ problems: ValidatedProblem[], intent: string, point_review_latex: string }> {
        const systemPrompt = `You are a skilled mathematics teacher creating exercise problems for Japanese students.
Generate ${count} math problems based on the unit topic and difficulty provided.
IMPORTANT: You MUST generate EXACTLY ${count} problems. Do not generate fewer than requested.
IMPORTANT: You MUST STRICTLY adhere to the provided unit topic(s).
IMPORTANT: If "Focus topics" are provided, you MUST distribute the problems evenly among ALL selected topics. Do not skip any selected topic.
Output MUST be a valid JSON object strictly matching the schema.
- 'stem_latex': The problem text in LaTeX. Use Japanese for text. IMPORTANT: All math expressions (e.g. equations, variables like x) MUST be wrapped in $...$ (inline math) or $$...$$ (display math). DO NOT include the answer in this field.
- 'answer_latex': The descriptive answer in LaTeX. Include intermediate steps/derivations. Example: "$(x+1)(x+2) = 0 \\rightarrow x = -1, -2$". Wrappers $...$ required. Do NOT include "Answer:" prefix.
- 'explanation_latex': Detailed explanation. Wrap all math in $...$.
- 'point_review_latex': A summary of key formulas, theorems, and concepts used in this problem set, formatted in LaTeX. Japanese text with math in $...$.
- 'difficulty': One of L1, L2, L3.
- 'intent': A brief description of the generation intent in Japanese.
`;

        let userPrompt = `Unit: ${topic}
Count: ${count}
Difficulty: ${difficulty}
`;

        if (otherRequests) {
            userPrompt += `Other Requests: ${otherRequests}\n`;
        }

        return this.generateVerifiedFlexible(systemPrompt, userPrompt, count, modelOverride, onProgress);
    }

    async generateVerifiedFlexible(
        systemPrompt: string,
        userPrompt: string | any[],
        targetCount: number,
        modelOverride?: string,
        onProgress?: (current: number, total: number) => void,
        stopAfterFirstAttempt: boolean = false
    ): Promise<{ problems: ValidatedProblem[], intent: string, point_review_latex: string }> {
        let validProblems: ValidatedProblem[] = [];
        let attempts = 0;
        let needed = targetCount;
        let lastError = "";
        let intent = "";
        let point_review_latex = "";

        // Initial progress
        if (onProgress) onProgress(0, targetCount);

        while (attempts <= this.maxRetries && validProblems.length < targetCount) {
            attempts++;
            // Request slightly more to buffer for failures
            const bufferCount = Math.ceil(needed * (attempts === 1 ? 1.5 : 1.2));
            
            try {
                if (needed <= 0) break;

                // Adjust the prompts slightly if it's a retry to ask for the remaining count
                let currentSystemPrompt = systemPrompt;
                if (attempts > 1) {
                    currentSystemPrompt += `\nNOTE: Please generate exactly ${bufferCount} problems to complete the set.`;
                }

                const problemSet = await this.client.generateProblemsFromPrompt(currentSystemPrompt, userPrompt, modelOverride);
                
                if (!problemSet || !problemSet.problems) {
                    lastError = "AI returned empty problem set.";
                    continue;
                }

                if (!intent && problemSet.intent) {
                    intent = problemSet.intent;
                }
                if (!point_review_latex && problemSet.point_review_latex) {
                    point_review_latex = problemSet.point_review_latex;
                }

                for (const p of problemSet.problems) {
                    if (validProblems.length >= targetCount) break;

                    const validation = await this.verifyProblem(p);
                    if (validation.success) {
                        validProblems.push(p);
                        needed--;
                        if (onProgress) onProgress(validProblems.length, targetCount);
                    } else {
                        lastError = `Rejected: ${validation.code} - ${validation.reason}`;
                        console.warn(`Problem rejected: ${validation.code} - ${validation.reason} \nContent: ${p.stem_latex}`);
                        logToDebugFile(`Problem rejected: ${validation.code} - ${validation.reason}\nContent: ${p.stem_latex}\nAnswer: ${p.answer_latex}`);
                    }
                }
                
                // If auto mode, we only want the first batch (plus retries only if EVERYTHING failed, maybe?)
                // Actually, let's just break if we got ANY valid problems and stopAfterFirstAttempt is true.
                if (stopAfterFirstAttempt && validProblems.length > 0) break;

            } catch (e: any) {
                lastError = e.message;
                console.error("AI Generation failed", e);
                logToDebugFile(`AI Generation Attempt Failed: ${e.message}\nStack: ${e.stack}`);
            }
        }
        
        if (validProblems.length === 0 && attempts > this.maxRetries) {
            throw new Error(`Failed to generate any valid problems after ${attempts} attempts. Last reason: ${lastError}`);
        }
        
        return { problems: validProblems, intent, point_review_latex };
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

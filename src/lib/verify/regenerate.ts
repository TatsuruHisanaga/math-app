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
        otherRequests?: string,
        images?: any[] // New parameter for images
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
- 'point_review_latex': A summary of key formulas, theorems, and concepts used in this problem set, formatted as a LaTeX itemize environment (\\begin{itemize} ... \\end{itemize}). Each item should start with a bold topic name, e.g., \\item \\textbf{Topic}: Content. Japanese text with math in $...$.
- 'difficulty': One of L1, L2, L3, L4, L5.
- 'intent': A brief description of the generation intent in Japanese. IMPORTANT: Wrap ALL math symbols (e.g. $n$, $P$, $C$, equations) in $...$ to ensure they render correctly. Do not use plain text for math. When mentioning difficulty, use Japanese terms: "基礎1" (L1), "基礎2" (L2), "基礎3" (L3), "標準" (L4), "発展" (L5).

Difficulty Definitions:
- L1 (基礎1): Introductory level. Definitions, formulas, simple calculation drills.
- L2 (基礎2): Textbook standard level. Basic word problems, routine standard questions.
- L3 (基礎3): Textbook application level. End-of-chapter problems, complex basic questions.
- L4 (標準): Standard entrance exam level. Typical university exam problems.
- L5 (発展): Advanced/Difficult entrance exam level. Complex application.
`;

        let textPrompt = `Unit: ${topic}
Count: ${count}
Difficulty: ${difficulty}
`;

        if (otherRequests) {
            textPrompt += `Other Requests: ${otherRequests}\n`;
        }

        let finalUserPrompt: string | any[] = textPrompt;

        if (images && images.length > 0) {
            finalUserPrompt = [
                { type: 'text', text: textPrompt },
                ...images
            ];
        }

        return this.generateVerifiedFlexible(systemPrompt, finalUserPrompt, count, modelOverride, onProgress);
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

        // 3. Compile Check - TEMPORARILY DISABLED for debugging crash
        // res = await checkCompilation(p.stem_latex, 'stem');
        // if (!res.success) return res;
        
        // res = await checkCompilation(p.answer_latex, 'answer');
        // if (!res.success) return res;

        // if (p.explanation_latex) {
        //     res = await checkCompilation(p.explanation_latex, 'answer');
        //     if (!res.success) return res;
        // }

        return { success: true };
    }

    async regenerateSingleProblem(
        currentProblem: AIProblemItem | null,
        instruction: string,
        topic: string,
        difficulty: string,
        modelOverride?: string
    ): Promise<ValidatedProblem> {
        const systemPrompt = `You are a skilled mathematics teacher.
Refine or create a SINGLE math problem based on the user's specific instruction.
IMPORTANT: You must generate EXACTLY ONE problem.
Output MUST be a valid JSON object strictly matching the problem schema.
- 'stem_latex': Problem text in LaTeX (Japanese). Wrap math in $...$.
- 'answer_latex': Answer in LaTeX. Wrap math in $...$.
- 'explanation_latex': Detailed explanation. Wrap math in $...$.
- 'difficulty': ${difficulty}
- 'difficulty': ${difficulty}
- 'difficulty': ${difficulty}
- 'intent': Brief description of changes. IMPORTANT: Wrap ALL math symbols (e.g. $n$, $x^2$, $nCr$) in $...$. Use Japanese terms for difficulty: "基礎1" (L1), "基礎2" (L2), "基礎3" (L3), "標準" (L4), "発展" (L5).

CRITICAL: When writing LaTeX inside JSON, you MUST double-escape backslashes. 
Example: Use "\\\\frac{1}{2}" instead of "\\frac{1}{2}".
Example: Use "\\\\sqrt{2}" instead of "\\sqrt{2}".
`;

        let userPrompt = `Topic: ${topic}\nDifficulty: ${difficulty}\nInstruction: ${instruction}\n`;
        
        if (currentProblem) {
            userPrompt += `
Original Problem:
${currentProblem.stem_latex}
Original Answer:
${currentProblem.answer_latex}
`;
        }

        // Reuse generateVerifiedFlexible with count 1
        const result = await this.generateVerifiedFlexible(
            systemPrompt,
            userPrompt,
            1,
            modelOverride,
            undefined, // no progress callback
            true // stop after first attempt if successful
        );

        if (result.problems.length === 0) {
            throw new Error("Failed to regenerate problem.");
        }

        return result.problems[0];
    }

    private tryRepairMath(latex: string): string {
        if (!latex) return latex;

        // Replace literal \n with newline
        latex = latex.replace(/\\n/g, '\n');

        // Permissive repair for missing math delimiters
        const mathTokens = ['^', '_', '\\frac', '\\sqrt', '\\times', '\\div', '=', '\\pi'];
        const hasMathToken = mathTokens.some(t => latex.includes(t));
        const hasDollar = latex.includes('$') || latex.includes('\\(') || latex.includes('\\[') || latex.includes('\\begin{');
        
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

import { AIClient } from '../../src/lib/ai/client';

export interface EvaluationResult {
  score: number; // 1-5
  reason: string;
  pass: boolean;
}

export class Judge {
  private client: AIClient;

  constructor(client: AIClient) {
    this.client = client;
  }

  async evaluate(
    prompt: string,
    output: any,
    criteria: string[]
  ): Promise<EvaluationResult> {
    const systemPrompt = `You are a strict Evaluator for a Mathematics Problem Generator.
Your job is to grade the AI-generated output based on the user's prompt and specific criteria.

Score on a scale of 1 to 5:
5: Perfect. Follows all instructions and criteria perfectly. High quality.
4: Good. Minor issues but follows main criteria.
3: Acceptable. Misses some minor criteria or has slight quality issues.
2: Poor. Misses major criteria or has quality issues.
1: Failure. Completely fails to follow instructions or is invalid.

Output JSON format:
{
  "score": number,
  "reason": "Short explanation of the score in Japanese",
  "pass": boolean (true if score >= 4)
}`;

    const userPrompt = `
User Prompt: ${prompt}
Specific Criteria:
${criteria.map(c => `- ${c}`).join('\n')}

Generated Output (JSON):
${JSON.stringify(output, null, 2)}
`;


    try {
      // Use the structured evaluation method
      const result = await this.client.generateEvaluation(systemPrompt, userPrompt);
      return result;

    } catch (error: any) {
      return { score: 0, reason: `Evaluation error: ${error.message}`, pass: false };
    }
  }
}


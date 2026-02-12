import { AIProblemSet, AIFeedbackSet, AIProblemItem } from './types';
import problemSchema from './schemas/problem_set.strict.json';
import feedbackSchema from './schemas/feedback_set.strict.json';

const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export class AIClient {
  private apiKey: string;
  private modelProblem: string;
  private modelFeedback: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    // Default to a model that strongly supports Structured Outputs
    this.modelProblem = process.env.AI_MODEL_PROBLEM || 'gpt-4o-2024-08-06';
    this.modelFeedback = process.env.AI_MODEL_FEEDBACK || 'gpt-4o-2024-08-06';
  }



  async generateProblems(topic: string, count: number, difficulty: string, modelOverride?: string): Promise<AIProblemSet> {
    const systemPrompt = `You are a skilled mathematics teacher creating exercise problems for Japanese students.
Generate ${count} math problems based on the unit topic and difficulty provided.
IMPORTANT: You MUST STRICTLY adhere to the provided unit topic(s). DO NOT generate problems outside the specified scope.
Output MUST be a valid JSON object strictly matching the schema.
- 'stem_latex': The problem text in LaTeX. Use Japanese for text. IMPORTANT: All math expressions (e.g. equations, variables like x) MUST be wrapped in $...$ (inline math) or $$...$$ (display math). DO NOT include the answer in this field.
- 'answer_latex': The descriptive answer in LaTeX. Include intermediate steps/derivations. Example: "$(x+1)(x+2) = 0 \\rightarrow x = -1, -2$". Wrappers $...$ required. Do NOT include "Answer:" prefix.
- 'explanation_latex': Detailed explanation. Wrap all math in $...$.
- 'difficulty': One of L1, L2, L3.
- 'graph': (Optional) Populate this only if the problem involves a function, geometry, or requires visualization.
  - 'type': 'function' (for y=f(x)), 'point' (for specific coordinates), 'segment', or 'polygon'.
  - 'expression': For 'function', provide the math expression in JS syntax (e.g. "x^2", "Math.sin(x)").
  - 'points': Array of {x, y, label, color} for points of interest.
  - 'xMin', 'xMax', 'yMin', 'yMax': Suggested view range.
`;

    const userPrompt = `Unit: ${topic}
Count: ${count}
Difficulty: ${difficulty}
`;

    return this.generateProblemsFromPrompt(systemPrompt, userPrompt, modelOverride);
  }

  /**
   * Generates problems from a flexibe prompt, supporting images/multi-modal content.
   */
  async generateProblemsFromPrompt(
    systemPrompt: string, 
    userPrompt: string | any[], 
    modelOverride?: string
  ): Promise<AIProblemSet> {
    let model = modelOverride || this.modelProblem;

    // Use a unified internal method that handles the actual call
    return this.callOpenAIWithMessages<AIProblemSet>(
        model,
        [
            { role: 'system', content: systemPrompt },
            typeof userPrompt === 'string' 
                ? { role: 'user', content: userPrompt }
                : { role: 'user', content: userPrompt }
        ],
        "problem_set",
        problemSchema
    );
  }

  private async callOpenAIWithMessages<T>(
    model: string,
    messages: any[],
    schemaName: string,
    schema: any
  ): Promise<T> {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: schemaName,
            strict: true,
            schema: schema
          }
        },
        temperature: 1.0
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    return JSON.parse(content) as T;
  }

  private async callOpenAI<T>(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    schemaName: string,
    schema: any
  ): Promise<T> {
    return this.callOpenAIWithMessages<T>(
        model,
        [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        schemaName,
        schema
    );
  }

  async generateFeedback(problem: AIProblemItem): Promise<AIFeedbackSet> {
    const systemPrompt = `You are a helpful tutor providing feedback on a math problem.
Generate explanation, hint, and common mistake for the given problem.
Output MUST be a valid JSON object strictly matching the schema.
`;
    
    const userPrompt = `Problem: ${problem.stem_latex}
Answer: ${problem.answer_latex}
Difficulty: ${problem.difficulty}
`;

    return this.callOpenAI<AIFeedbackSet>(
        this.modelFeedback,
        systemPrompt,
        userPrompt,
        "feedback_set",
        feedbackSchema
    );
  }


  async generateEvaluation(systemPrompt: string, userPrompt: string): Promise<{ score: number; reason: string; pass: boolean }> {
    const evalSchema = require('./schemas/evaluation_result.strict.json');
    return this.callOpenAIWithMessages<{ score: number; reason: string; pass: boolean }>(
        this.modelFeedback, // reuse feedback model (gpt-4o) which is good for logical tasks
        [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        "evaluation_result",
        evalSchema
    );
  }
}

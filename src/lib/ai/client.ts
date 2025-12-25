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

  private async callOpenAI<T>(
    model: string,
    systemPrompt: string,
    userPrompt: string,
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
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: schemaName,
            strict: true,
            schema: schema
          }
        },
        temperature: 0.7
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // With strict schema, this should be valid JSON matching the type
    return JSON.parse(content) as T;
  }

  async generateProblems(topic: string, count: number, difficulty: string): Promise<AIProblemSet> {
    const systemPrompt = `You are a skilled mathematics teacher creating exercise problems for Japanese students.
Generate ${count} math problems based on the unit topic and difficulty provided.
Output MUST be a valid JSON object strictly matching the schema.
- 'stem_latex': The problem text in LaTeX. Use Japanese for text. IMPORTANT: All math expressions (e.g. equations, variables like x) MUST be wrapped in $...$ (inline math) or $$...$$ (display math). Example: "次の方程式を解け: $x^2 + 3x + 2 = 0$"
- 'answer_latex': The answer text in LaTeX. Math must be wrapped in $...$ if mixed with text, or just the math expression.
- 'explanation_latex': Detailed explanation. Wrap all math in $...$.
- 'hint_latex': Hint. Wrap all math in $...$.
- 'common_mistake_latex': Common pitfall. Wrap all math in $...$.
- 'difficulty': One of L1, L2, L3.
`;
    // TODO: Add more detailed instruction on LaTeX format if needed (e.g. "Use \\dfrac not \\frac")

    const userPrompt = `Unit: ${topic}
Count: ${count}
Difficulty: ${difficulty}
`;

    return this.callOpenAI<AIProblemSet>(
        this.modelProblem,
        systemPrompt,
        userPrompt,
        "problem_set",
        problemSchema
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
}

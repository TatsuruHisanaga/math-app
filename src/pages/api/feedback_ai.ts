import type { NextApiRequest, NextApiResponse } from 'next';
import { AIClient } from '@/lib/ai/client';
import { sanitizeLatex } from '@/lib/verify/latex_sanitize';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
      return res.status(500).json({ message: 'Server configuration error: Missing API Key' });
  }

  try {
    const { problem } = req.body; // AIProblemItem

    if (!problem) {
        return res.status(400).json({ message: 'Missing problem data' });
    }

    const client = new AIClient(apiKey);
    const feedbackSet = await client.generateFeedback(problem);

    // Sanitize feedback content
    if (feedbackSet && feedbackSet.items) {
        for (const item of feedbackSet.items) {
            let res = sanitizeLatex(item.explanation_latex);
            if (!res.success) throw new Error('Generated explanation contains forbidden LaTeX');
            
            res = sanitizeLatex(item.hint_latex);
            if (!res.success) throw new Error('Generated hint contains forbidden LaTeX');
            
            res = sanitizeLatex(item.common_mistake_latex);
            if (!res.success) throw new Error('Generated common_mistake contains forbidden LaTeX');
        }
    }

    res.status(200).json(feedbackSet);

  } catch (error: any) {
    console.error('AI Feedback Error:', error);
    res.status(500).json({ message: 'Feedback generation failed', error: error.message });
  }
}

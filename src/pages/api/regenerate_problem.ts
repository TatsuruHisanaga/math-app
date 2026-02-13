import type { NextApiRequest, NextApiResponse } from 'next';
import { AIClient } from '@/lib/ai/client';
import { GenerationPipeline } from '@/lib/verify/regenerate';

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
    const { 
        problem, // existing problem object (optional)
        instruction, // user instruction
        unit_title, 
        difficulty 
    } = req.body;

    if (!instruction || !unit_title) {
        return res.status(400).json({ message: 'Missing instruction or unit_title' });
    }

    const client = new AIClient(apiKey);
    const pipeline = new GenerationPipeline(client);

    const newProblem = await pipeline.regenerateSingleProblem(
        problem,
        instruction,
        unit_title,
        difficulty || 'L1'
    );

    res.status(200).json({ problem: newProblem });

  } catch (error: any) {
    console.error('Regeneration Error:', error);
    res.status(500).json({ message: 'Regeneration failed', error: error.message });
  }
}

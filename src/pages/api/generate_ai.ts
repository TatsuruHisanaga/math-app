import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { QuestionGenerator } from '@/lib/generator';
import { AIClient } from '@/lib/ai/client';
import { GenerationPipeline } from '@/lib/verify/regenerate';

// Singleton generator access (copied from generate.ts pattern)
let generator: QuestionGenerator | null = null;
const getGenerator = () => {
    if (!generator) {
        const dataDir = path.resolve(process.cwd(), 'data');
        generator = new QuestionGenerator(
            path.join(dataDir, 'unit_map.json'),
            path.join(dataDir, 'templates.json')
        );
    }
    return generator;
}

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
        units, // string[] unit IDs
        difficulty, // string
        count // number
    } = req.body;

    if (!units || !count || !difficulty) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const gen = getGenerator();
    // Resolve unit IDs to titles
    const unitTitles = (units as string[]).map(id => gen.getUnitTitle(id)).join(', ');

    const client = new AIClient(apiKey);
    const pipeline = new GenerationPipeline(client);

    const problems = await pipeline.generateVerified(unitTitles, typeof count === 'string' ? parseInt(count) : count, difficulty);

    res.status(200).json({ problems });

  } catch (error: any) {
    console.error('AI Generation Error:', error);
    res.status(500).json({ message: 'AI generation failed', error: error.message });
  }
}

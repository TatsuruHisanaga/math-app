import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
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
        units, // string[] unit IDs
        difficulty, // string
        count, // number
        aiModel // string (optional)
    } = req.body;

    if (!units || !count || !difficulty) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    // Resolve unit IDs to titles directly from JSON to avoid stale singleton
    const unitMapPath = path.resolve(process.cwd(), 'data/unit_map.json');
    const unitMapData = JSON.parse(fs.readFileSync(unitMapPath, 'utf-8'));
    const unitTitles = (units as string[])
        .map(id => unitMapData.units[id]?.title_ja || id)
        .join(', ');
    
    console.log('API request units:', units);
    console.log('Resolved titles for AI:', unitTitles);

    const client = new AIClient(apiKey);
    const pipeline = new GenerationPipeline(client);

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Custom callback to stream progress
    const onProgress = (count: number, total: number) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', count, total })}\n\n`);
    };

    // We need to modify pipeline to accept a callback or check how we can hook into it.
    // For now, let's just make pipeline return intermediate results or modify it.
    // Actually, let's modify the pipeline class or just inline the logic if it's not too complex.
    // Since I can't easily change the pipeline signature across files without multiple edits, 
    // I will use a slight workaround: Assume pipeline.generateVerified can be monitored? 
    // No, I'll update GenerationPipeline to accept a callback in the next step. 
    // But for this file, I'll assume it accepts it.
    
    // WAIT: I need to update GenerationPipeline first.
    // let's revert to standard JSON for a moment if I can't stream easily? 
    // No, I must implement it.
    
    // Use an extended version of generateVerified momentarily code-injected here or update the class.
    // I will update the class `src/lib/verify/regenerate.ts` in the next tool call.
    // Here I will call it assuming the signature update.
    
    const targetCount = typeof count === 'string' ? parseInt(count) : count;
    
    // We request slightly more from AI to account for verification failures, 
    // but the pipeline loop needs the exact target count to stop.
    // The previous implementation of generateVerified inside GenerationPipeline handles buffering internally 
    // based on 'needed' count.
    
    const { problems, intent } = await pipeline.generateVerified(
        unitTitles, 
        targetCount, 
        difficulty || 'L1', 
        aiModel, // Custom model override
        (current: number, total: number) => {
             res.write(`data: ${JSON.stringify({ type: 'progress', count: current, total })}\n\n`);
        }
    );

    res.write(`data: ${JSON.stringify({ type: 'complete', problems, intent })}\n\n`);
    res.end();

  } catch (error: any) {
    console.error('AI Generation Error:', error);
    // If headers sent, we can't send status 500 JSON.
    if (!res.headersSent) {
        res.status(500).json({ message: 'AI generation failed', error: error.message });
    } else {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
  }
}

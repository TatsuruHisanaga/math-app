import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { AIClient } from '@/lib/ai/client';
import { GenerationPipeline } from '@/lib/verify/regenerate';

import formidable from 'formidable';
const pdf = require('pdf-parse');

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
      const logPath = path.resolve(process.cwd(), 'debug_generation.log');
      const timestamp = new Date().toISOString();
      try {
        require('fs').appendFileSync(logPath, `[${timestamp}] Config Error: Missing API Key\n`);
      } catch (e) { /* ignore */ }
      return res.status(500).json({ message: 'Server configuration error: Missing API Key' });
  }

  const form = formidable({});

  try {
    const [fields, files] = await form.parse(req);

    // fields values are arrays, we need to extract them
    // Note: units and unitDetails might be stringified JSON if sent as FormData text
    
    let units: string[] = [];
    try {
        units = JSON.parse(fields.units?.[0] || '[]');
    } catch (e) {
        // Handle case where it might be just comma separated or single
        if (fields.units?.[0]) units = [fields.units[0]];
    }

    let unitDetails: Record<string, string[]> = {};
    try {
        unitDetails = JSON.parse(fields.unitDetails?.[0] || '{}');
    } catch (e) {}

    const difficulty = fields.difficulty?.[0] || 'L1';
    const count = parseInt(fields.count?.[0] || '5');
    // Handle aiModel: formidable v3 parses fields as arrays of strings or just strings depending on config 
    // but typically fields.param is string[] | undefined
    const rawAiModel = fields.aiModel;
    let aiModel = 'gpt-5.2'; // Default
    if (Array.isArray(rawAiModel) && rawAiModel.length > 0) {
        aiModel = rawAiModel[0];
    } else if (typeof rawAiModel === 'string') {
        aiModel = rawAiModel;
    }
    const additionalRequest = fields.additionalRequest?.[0] || '';

    if (!units || units.length === 0 || !count) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    // DEBUG LOGGING
    console.log('--- API Request Debug ---');
    console.log('Units:', units);
    console.log('Count:', count);
    console.log('Difficulty:', difficulty);
    console.log('Raw aiModel:', rawAiModel, 'Type:', typeof rawAiModel, 'IsArray:', Array.isArray(rawAiModel));
    console.log('Resolved aiModel:', aiModel);
    console.log('-------------------------');

    // Process Files
    const images: any[] = [];
    if (files.files) {
      const uploadedFiles = Array.isArray(files.files) ? files.files : [files.files];
      
      for (const file of uploadedFiles) {
        if (!file.mimetype) continue;
        
        if (file.mimetype.startsWith('image/')) {
          const base64 = fs.readFileSync(file.filepath).toString('base64');
          images.push({
            type: 'image_url',
            image_url: { url: `data:${file.mimetype};base64,${base64}` }
          });
        }
      }
    }

    // Resolve unit IDs to titles directly from JSON to avoid stale singleton
    const unitMapPath = path.resolve(process.cwd(), 'data/unit_map.json');
    const unitMapData = JSON.parse(fs.readFileSync(unitMapPath, 'utf-8'));
    
    // Construct refined unit titles with sub-topics
    const unitTitles = units.map(id => {
        const baseTitle = unitMapData.units[id]?.title_ja || id;
        const details = unitDetails?.[id];
        if (details && Array.isArray(details) && details.length > 0) {
            return `${details.join(', ')}`;
        }
        return baseTitle;
    }).join(', ');
    
    console.log('API request units:', units);
    console.log('Resolved titles for AI:', unitTitles);
    if (images.length > 0) {
        console.log(`Processing ${images.length} images`);
    }

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

    const targetCount = count;
    
    // Pass images to regenerateVerified
    const { problems, intent, point_review_latex } = await pipeline.generateVerified(
        unitTitles, 
        targetCount, 
        difficulty, 
        aiModel, 
        (current: number, total: number) => {
             res.write(`data: ${JSON.stringify({ type: 'progress', count: current, total })}\n\n`);
        },
        additionalRequest,
        images // Pass images
    );

    console.log('AI Generation Complete. Point Review Length:', point_review_latex?.length); // Debug Log

    res.write(`data: ${JSON.stringify({ type: 'complete', problems, intent, point_review_latex })}\n\n`);
    res.end();

  } catch (error: any) {
    console.error('AI Generation Error:', error);
    const logPath = path.resolve(process.cwd(), 'debug_generation.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] API Error (generate_ai): ${error.message}\nStack: ${error.stack}\n`);
    // If headers sent, we can't send status 500 JSON.
    if (!res.headersSent) {
        res.status(500).json({ message: 'AI generation failed', error: error.message });
    } else {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
  }
}

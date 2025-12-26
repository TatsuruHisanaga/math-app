import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
// @ts-ignore
import pdf from 'pdf-parse';
import { AIClient } from '@/lib/ai/client';
import { GenerationPipeline } from '@/lib/verify/regenerate';

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
    return res.status(500).json({ message: 'Server configuration error: Missing API Key' });
  }

  const form = formidable({});
  
  try {
    const [fields, files] = await form.parse(req);
    
    const userMessage = fields.prompt?.[0] || '';
    const count = parseInt(fields.count?.[0] || '5');
    const aiModel = fields.aiModel?.[0] || 'gpt-4o';
    
    let userPromptParts: any[] = [{ type: 'text', text: userMessage }];
    
    // Process Files
    if (files.files) {
      const uploadedFiles = Array.isArray(files.files) ? files.files : [files.files];
      
      for (const file of uploadedFiles) {
        if (!file.mimetype) continue;
        
        if (file.mimetype.startsWith('image/')) {
          const base64 = fs.readFileSync(file.filepath).toString('base64');
          userPromptParts.push({
            type: 'image_url',
            image_url: { url: `data:${file.mimetype};base64,${base64}` }
          });
        } else if (file.mimetype === 'application/pdf') {
          const dataBuffer = fs.readFileSync(file.filepath);
          const pdfData = await pdf(dataBuffer);
          userPromptParts.push({
            type: 'text',
            text: `[PDF Content (${file.originalFilename})]:\n${pdfData.text}`
          });
        }
      }
    }

    const client = new AIClient(apiKey);
    const pipeline = new GenerationPipeline(client);

    // Set headers for streaming SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const systemPrompt = `You are a professional mathematics teacher and editor. 
Your goal is to generate high-quality math problems based on the user's instructions and provided reference material (images or PDF text).

INSTRUCTIONS:
- Generate exactly ${count} problems.
- Use the reference material as a guide for topic, difficulty, and style.
- Output MUST be a valid JSON object strictly matching the schema.
- All math expressions MUST be wrapped in $...$ (inline) or $$...$$ (display).
- Use Japanese for all text elements.
- Difficulty should be L1 (Basic), L2 (Standard), or L3 (Advanced).

JSON format details:
- 'stem_latex': The problem text.
- 'answer_latex': The descriptive answer with intermediate steps.
- 'explanation_latex': Detailed explanation for the student.
- 'difficulty': One of L1, L2, L3.
`;

    const problems = await pipeline.generateVerifiedFromPrompt(
      systemPrompt,
      userPromptParts,
      count,
      aiModel,
      (current: number, total: number) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', count: current, total })}\n\n`);
      }
    );

    res.write(`data: ${JSON.stringify({ type: 'complete', problems })}\n\n`);
    res.end();

  } catch (error: any) {
    console.error('AI Prompt Generation Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'AI generation failed', error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
}

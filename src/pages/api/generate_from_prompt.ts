import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
const pdf = require('pdf-parse');
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
    const logPath = path.resolve(process.cwd(), 'debug_generation.log');
    const timestamp = new Date().toISOString();
    try {
      require('fs').appendFileSync(logPath, `[${timestamp}] Config Error: Missing API Key (generate_from_prompt)\n`);
    } catch (e) { /* ignore */ }
    return res.status(500).json({ message: 'Server configuration error: Missing API Key' });
  }

  const form = formidable({});
  
  try {
    const [fields, files] = await form.parse(req);
    
    const userMessage = fields.prompt?.[0] || '';
    const countParam = parseInt(fields.count?.[0] || '5');
    const autoCount = fields.autoCount?.[0] === 'true';
    const rawAiModel = fields.aiModel;
    let aiModel = 'gpt-5.2'; // Default
    if (Array.isArray(rawAiModel) && rawAiModel.length > 0) {
        aiModel = rawAiModel[0];
    } else if (typeof rawAiModel === 'string') {
        aiModel = rawAiModel;
    }
    // DEBUG LOGGING
    console.log('--- API Request Debug (Prompt) ---');
    console.log('Prompt:', userMessage);
    console.log('Count:', countParam);
    console.log('Raw aiModel:', rawAiModel, 'Type:', typeof rawAiModel, 'IsArray:', Array.isArray(rawAiModel));
    console.log('Resolved aiModel:', aiModel);
    console.log('--------------------------------');

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
    
    const countInstruction = autoCount 
      ? "Determine an appropriate number of problems based on the context and reference material (generate between 3 to 10 problems)."
      : `Generate exactly ${countParam} problems.`;

    const systemPrompt = `You are a professional mathematics teacher and editor. 
Your goal is to generate high-quality math problems based on the user's instructions and provided reference material (images or PDF text).

INSTRUCTIONS:
- ${countInstruction}
- Use the reference material as a guide for topic, difficulty, and style.
- Output MUST be a valid JSON object strictly matching the schema.
- All math expressions MUST be wrapped in $...$ (inline) or $$...$$ (display).
- Use Japanese for all text elements.
- Use Japanese for all text elements.
- IMPORTANT: You MUST escape all backslashes in JSON strings. Use "\\text" instead of "\text", "\\frac" instead of "\frac". Single backslashes will be read as control characters (like tab for \t) and corrupt the output.
- Difficulty should be L1 (Basic), L2 (Standard), or L3 (Advanced).
- Generate 3-4 progressive hints for each problem in the 'hints' array. Hint 1 should be a conceptual nudge, while the last hint should be close to the solution step.
- **CRITICAL**: When the user requests multiple sub-topics (e.g. "addition, subtraction, and base change formula"), you MUST ensure the problems are distributed EVENLY across all these topics. Do not focus on just one.
- **CRITICAL**: Strictly adhere to any "negative constraints" (e.g. "do not mention X in the problem text").
- Ensure problems are non-trivial and maintain the requested difficulty level even when covering multiple topics.

JSON format details:
- 'stem_latex': The problem text.
- 'answer_latex': The descriptive answer with intermediate steps.
- 'explanation_latex': Detailed explanation for the student.
- 'explanation_latex': Detailed explanation for the student.
- 'hints': Array of strings (3-4 hints).
- 'difficulty': One of L1, L2, L3.
- 'intent': (At the root level) A brief description of the generation intent or educational goal in Japanese.
`;

    // If autoCount is true, we don't want the pipeline to keep retrying to reach a fixed "targetCount".
    // We can pass a targetCount that is effectively "whatever you get first time".
    // However, if some are invalid, we might want some retries.
    // Let's set a targetCount that signals "Auto" to the pipeline, or just use countParam as a limit.
    // Actually, if autoCount is true, let's just use 10 as the "needed" limit but tell AI to decide.
    // The pipeline will stop once it has AT LEAST 1 problem if we modify it, but let's keep it simple:
    // If autoCount, we'll take what we get in the first valid batch.
    
    let targetCount = autoCount ? 1 : countParam; 
    // Wait, if targetCount is 1, the pipeline stops at 1.
    // If autoCount is true, we want the AI to return e.g. 5, and we verify all 5.
    
    // I should probably add a flag to the pipeline or just use a helper.
    // Let's use countParam as the "limit" if manual, or 10 if auto.
    const pipelineTarget = autoCount ? 10 : countParam;

    const { problems, intent, point_review_latex } = await pipeline.generateVerifiedFlexible(
      systemPrompt,
      userPromptParts,
      pipelineTarget,
      aiModel,
      (current: number, total: number) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', count: current, total })}\n\n`);
      },
      autoCount // stopAfterFirstAttempt
    );

    res.write(`data: ${JSON.stringify({ type: 'complete', problems, intent, point_review_latex })}\n\n`);
    res.end();

  } catch (error: any) {
    console.error('AI Prompt Generation Error:', error);
    const logPath = path.resolve(process.cwd(), 'debug_generation.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] API Error (generate_from_prompt): ${error.message}\nStack: ${error.stack}\n`);
    if (!res.headersSent) {
      res.status(500).json({ message: 'AI generation failed', error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
}

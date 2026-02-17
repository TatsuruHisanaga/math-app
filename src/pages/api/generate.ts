import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import fs from 'fs';
import { QuestionGenerator, Difficulty } from '@/lib/generator';
import { PDFBuilder } from '@/lib/latex';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

// Initialize singleton-ish instances
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

const builder = new PDFBuilder();

const escapeLatex = (str: string) => {
    return str.replace(/[&%$#_{}~^\\]/g, '\\$&');
};


// Simple in-memory semaphore for local development / single instance
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 3;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Concurrency Check
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
      return res.status(503).json({ 
          message: 'Server is busy. Please try again later.',
          retryAfter: 10 
      });
  }

  try {
    activeRequests++;
    const { 
        units, // string[]
        difficulties, // Difficulty[]
        count, // number
        options // { stumblingBlock: boolean, ... }
    } = req.body;

    if (!units || !difficulties || !count) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const gen = getGenerator();
    
    // Resolve Difficulty Labels for Header
    const diffLabels: Record<string, string> = { 'L1': '基礎', 'L2': '標準', 'L3': '発展', 'L4': '難関', 'L5': '最難関' };
    console.log('Received difficulties:', difficulties);
    const displayDiffs = (Array.isArray(difficulties) ? difficulties : [difficulties]).map((d: string) => diffLabels[d] || d).join('・');
    const displayUnits = (Array.isArray(units) ? units : [units]).map((id: string) => gen.getUnitTitle(id)).join('・');

    // 1. Generate Questions (or use provided)
    let questions: any[];
    if (req.body.providedQuestions && Array.isArray(req.body.providedQuestions) && req.body.providedQuestions.length > 0) {
        questions = req.body.providedQuestions;
    } else {
        questions = gen.generateBatch({
            unitIds: units,
            difficulty: difficulties,
            count: parseInt(count),
            usePrereqs: options.stumblingBlock || false
        });
    }

    // Sanitize LaTeX strings to prevent double math mode (e.g. $[ ... ]$)
    const sanitizeLatex = (str: string) => {
        if (!str) return str;
        let cleaned = str.trim();
        
        // Replace literal "\n" sequence with actual newline character
        cleaned = cleaned.replace(/\\n/g, '\n');

        // If wrapped in $...$ and contains \[ ... \], strip the outer $
        if (cleaned.startsWith('$') && cleaned.endsWith('$')) {
            const inner = cleaned.slice(1, -1).trim();
            if (inner.includes('\\[') && inner.includes('\\]')) {
                return inner;
            }
        }
        return cleaned;
    };

    questions = questions.map(q => ({
        ...q,
        stem_latex: sanitizeLatex(q.stem_latex),
        answer_latex: sanitizeLatex(q.answer_latex),
        explanation_latex: sanitizeLatex(q.explanation_latex || ''),
        common_mistake_latex: sanitizeLatex(q.common_mistake_latex || ''),
        hint_latex: sanitizeLatex(q.hint_latex || ''),
        hints: q.hints ? q.hints.map((h: string) => sanitizeLatex(h)) : undefined
    }));

    // 2. Build LaTeX Content
    // Header for Problem Page - MUST ESCAPE UNDERSCORES IN IDs
    // 2. Build LaTeX Content
    // Header for Problem Page
    const header = `
\\twocolumn[{
  \\vspace{0.5em}
  % Header Container
  \\noindent
  \\begin{minipage}[b]{0.6\\linewidth}
    {\\LARGE \\textbf{数学演習プリント}} \\\\[0.4em]
    {\\small \\color{darkgray} \\textbf{単元:} ${escapeLatex(displayUnits)} \\quad \\textbf{難易度:} ${escapeLatex(displayDiffs)}}
  \\end{minipage}
  \\hfill
  \\begin{minipage}[b]{0.38\\linewidth}
    \\begin{flushright}
      \\small
      \\textbf{日付}: \\underline{\\hspace{2.5cm}} \\quad \\textbf{氏名}: \\underline{\\hspace{2.5cm}}
    \\end{flushright}
  \\end{minipage}
  \\par\\vspace{1em}
  \\hrule height 0.5pt
  \\vspace{2em}
}]
`;

    // Generate Problem Part (Empty Answer Box)
    let problemBody = header;
    questions.forEach((q, idx) => {
        const qNum = `（${idx + 1}）`; 
        const workHeight = options.moreWorkSpace ? '6cm' : '3cm';

        problemBody += `
\\begin{needspace}{4cm}
\\begin{qbox}
\\textbf{${qNum}} ${q.stem_latex}
\\answerbox{${workHeight}}{}
\\end{qbox}
\\end{needspace}
        `;
    });

    // Generate Answer Part (Filled Answer Box) with Page Break
    let answerBody = '\\newpage\\section*{解答}\\vspace{1em}';
    questions.forEach((q, idx) => {
        const qNum = `（${idx + 1}）`;
        
        let explanationBlock = '';
        if (q.explanation_latex) {
             explanationBlock += `\\par\\vspace{0.5em}\\noindent\\small{\\textbf{解説}:\\par ${q.explanation_latex}}`;
        }
        if (q.common_mistake_latex) {
             explanationBlock += `\\mistakebox{${q.common_mistake_latex}}`;
        }
        if (q.hint_latex) {
             explanationBlock += `\\hintbox{${q.hint_latex}}`;
        }

        answerBody += `
\\begin{needspace}{4cm}
\\begin{qbox}
\\textbf{${qNum}} ${q.stem_latex}
\\answeredbox{${q.answer_latex}}
${explanationBlock}
\\end{qbox}
\\end{needspace}
        `;
    });

    // Append Point Review if available
    if (req.body.pointReview) {
        console.log('PDF API: Received Point Review:', req.body.pointReview.length);
        answerBody += builder.getPointReview(req.body.pointReview);
    } else {
        console.log('PDF API: No Point Review received');
    }

    // Generate Teaching Assistant Page if requested
    let instructorBody = '';
    if (options.teachingAssistant) {
        instructorBody = '\\newpage\\section*{講師用ガイド（ヒント・指導案）}\\vspace{1em}';
        questions.forEach((q, idx) => {
             const qNum = `（${idx + 1}）`;
             
             let hintsBlock = '';
             if (q.hints && Array.isArray(q.hints) && q.hints.length > 0) {
                 hintsBlock = '\\par\\vspace{0.5em}\\textbf{学習ヒント}:\\begin{itemize}';
                 q.hints.forEach((h: string, hIdx: number) => {
                     hintsBlock += `\\item \\textbf{ヒント ${hIdx + 1}}: ${h}`;
                 });
                 hintsBlock += '\\end{itemize}';
             }

             instructorBody += `
\\begin{needspace}{5cm}
\\begin{qbox}
\\textbf{${qNum}} ${q.stem_latex}
\\par\\vspace{0.5em}
${hintsBlock}
\\par\\vspace{0.5em}
\\textbf{解説}:\\par ${q.explanation_latex || 'なし'}
\\end{qbox}
\\end{needspace}
             `;
        });
    }

    // 3. Combine into single LaTeX document
    // Problems first, then a page break, then Answers.
    // Adding a header or title for the Answer section might be nice.
    const fullBody = `
${problemBody}
${answerBody}
${instructorBody}
    `;

    const latexSource = builder.getLayoutTemplate(fullBody);

    // 4. Compile PDF
    const pdfBuffer = await builder.buildPDF(latexSource);

    // 5. Return PDF directly
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="math_test.pdf"');
    res.end(pdfBuffer);

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Generation failed', error: error.message });
  } finally {
      activeRequests--;
  }
}

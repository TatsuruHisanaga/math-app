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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
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

    // 2. Build LaTeX Content
    // Problem PDF
    // Use minipage inside tcolorbox directly or wrap content?
    // We want 2 columns.
    // Each question:
    // \begin{needspace}{5em}
    // \begin{qbox}
    // (1) ...
    // \answerbox{3cm} 
    // \end{qbox}
    // \end{needspace}

    // Generate Problem Part (Empty Answer Box)
    let problemBody = '\\section*{問題}\\vspace{1em}';
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
    // Re-using the same layout but filling the answer box.
    let answerBody = '\\newpage\\section*{解答}\\vspace{1em}';
    questions.forEach((q, idx) => {
        const qNum = `（${idx + 1}）`;
        const workHeight = options.moreWorkSpace ? '6cm' : '3cm';
        // Content inside answer box
        const answerContent = `\\textbf{答}: $${q.answer_latex}$`;
        
        // Include explanation if available?
        // User said "image is problem and answer box page, and answer box filled page".
        // If we add explanation, it might overflow the box if fixed height.
        // For now, let's keep it simple as requested: just the answer.
        // If explanation exists, maybe append it below the box?
        // "Answer in the answer box" implies just the answer.
        
        let explanationBlock = '';
        if (q.explanation_latex) {
             explanationBlock = `\\par\\vspace{0.5em}\\noindent\\small{\\textbf{解説}: ${q.explanation_latex}}`;
        }

        answerBody += `
\\begin{needspace}{4cm}
\\begin{qbox}
\\textbf{${qNum}} ${q.stem_latex}
\\answerbox{${workHeight}}{$${q.answer_latex}$}
${explanationBlock}
\\end{qbox}
\\end{needspace}
        `;
    });

    // 3. Combine into single LaTeX document
    // Problems first, then a page break, then Answers.
    // Adding a header or title for the Answer section might be nice.
    const fullBody = `
${problemBody}
${answerBody}
    `;

    const latexSource = builder.getLayoutTemplate(fullBody);

    // 4. Compile PDF
    const pdfBuffer = await builder.buildPDF(latexSource);

    // 5. Return PDF directly
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=math_test.pdf');
    res.send(pdfBuffer);

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Generation failed', error: error.message });
  }
}

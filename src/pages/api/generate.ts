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

    let problemBody = '';
    questions.forEach((q, idx) => {
        // Full-width Japanese parenthesis for number
        const qNum = `（${idx + 1}）`; 
        // Heuristic for answer box height based on 'work_required' or simple logic
        // "options.moreWorkSpace" could increase this.
        const workHeight = options.moreWorkSpace ? '6cm' : '3cm';

        problemBody += `
\\begin{needspace}{4cm}
\\begin{qbox}
\\textbf{${qNum}} ${q.stem_latex}
\\answerbox{${workHeight}}
\\end{qbox}
\\end{needspace}
        `;
    });

    // Answer PDF
    // Simple list with Unit Tags
    let answerBody = '\\begin{itemize}';
    questions.forEach((q, idx) => {
        const qNum = `（${idx + 1}）`;
        // Tag format: [UnitName]
        const tag = `\\textbf{[${q.unit_title}]}`;
        answerBody += `
\\item[${qNum}] ${tag} \\quad $${q.answer_latex}$
        `;
        
        if (q.explanation_latex || q.hint_latex || q.common_mistake_latex) {
            answerBody += '\\begin{itemize}';
            if (q.explanation_latex) answerBody += `\\item[\\textbf{解説}] ${q.explanation_latex}`;
            if (q.hint_latex) answerBody += `\\item[\\textbf{ヒント}] ${q.hint_latex}`;
            if (q.common_mistake_latex) answerBody += `\\item[\\textbf{注意}] ${q.common_mistake_latex}`;
            answerBody += '\\end{itemize}\\vspace{0.5em}';
        }
    });
    answerBody += '\\end{itemize}';

    // 3. Combine into single LaTeX document
    // Problems first, then a page break, then Answers.
    // Adding a header or title for the Answer section might be nice.
    const fullBody = `
${problemBody}
\\newpage
\\section*{解答}
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

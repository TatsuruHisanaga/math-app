import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

export class PDFBuilder {
  private tempDir: string;
  private fontsDir: string;

  constructor() {
    // Determine temp dir (in a real app, might want a specific cache dir)
    this.tempDir = path.resolve(process.cwd(), 'temp_builds');
    this.fontsDir = path.resolve(process.cwd(), 'public/fonts');
    
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // Generate PDF from LaTeX string
  public async buildPDF(latexContent: string): Promise<Buffer> {
    const jobId = uuidv4();
    const jobDir = path.join(this.tempDir, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const texFile = path.join(jobDir, 'main.tex');
    const pdfFile = path.join(jobDir, 'main.pdf');

    fs.writeFileSync(texFile, latexContent);

    // We use latexmk for reliable building
    // Note: Assuming 'lualatex' and 'latexmk' are in PATH.
    // If not, we might need to configure absolute paths or user environment.
    return new Promise((resolve, reject) => {
      // Use basictex paths if standard path fails? 
      // For now, assume user will fix PATH or we use standard command.
      // latexmk is missing in BasicTeX by default sometimes. 
      // Switch to direct lualatex execution.
      // We run it twice to ensure references/page numbers are correct (though for this MVP once might suffice, safety first).
      const cmd = '/Library/TeX/texbin/lualatex'; 
      const args = [
        '--interaction=nonstopmode',
        `--output-directory=${jobDir}`,
        texFile
      ];

      // Note: We might need to add /Library/TeX/texbin to PATH for the spawn process
      // if it's not already there.
      const env = { ...process.env };
      // Append standard TeX paths just in case
      const texPath = '/Library/TeX/texbin:/usr/local/bin:/opt/homebrew/bin';
      env.PATH = `${texPath}:${env.PATH || ''}`;

      // Timeout after 120 seconds to prevent infinite hangs (first run cache can be slow)
      const processNode = spawn(cmd, args, { env });
      
      const timeout = setTimeout(() => {
          processNode.kill();
          reject(new Error('LaTeX compilation timed out (120s).'));
      }, 120000);

      let stdout = '';
      let stderr = '';

      processNode.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      processNode.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      processNode.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          console.error('LaTeX build failed:', stdout); // Log header
          // Clean up somewhat
          // fs.rmSync(jobDir, { recursive: true, force: true });
          reject(new Error(`LaTeX compilation failed with code ${code}.\nStderr: ${stderr}\nStdout: ${stdout}`));
          return;
        }

        if (fs.existsSync(pdfFile)) {
          const pdfBuffer = fs.readFileSync(pdfFile);
          // Cleanup
          fs.rmSync(jobDir, { recursive: true, force: true });
          resolve(pdfBuffer);
        } else {
          reject(new Error('PDF file was not created despite exit code 0'));
        }
      });
    });
  }

  public getLayoutTemplate(content: string, isAnswer: boolean = false): string {
     // Basic wrapper
     return `
\\documentclass[a4paper,10pt,twocolumn]{article}
\\usepackage{luatexja}
\\usepackage[top=10mm,bottom=10mm,left=10mm,right=10mm]{geometry}
\\usepackage{amsmath,amssymb}
\\usepackage{multicol}
\\usepackage{needspace}
\\usepackage{xcolor}
\\pagestyle{empty}

% Internal padding for fbox
\\setlength{\\fboxsep}{8pt}

% Clean box layout matching the reference image style
% Single frame, question number and text inside, empty space below.
\\newsavebox{\\myqbox}
\\newenvironment{qbox}{%
  \\begin{lrbox}{\\myqbox}%
  % Subtract framesep and rule to fit exactly in column. fboxsep is now 8pt.
  \\begin{minipage}{\\dimexpr\\linewidth-2\\fboxsep-2\\fboxrule\\relax}
  \\setlength{\\parskip}{5pt}
}{%
  \\end{minipage}%
  \\end{lrbox}%
  \\par\\noindent
  \\fbox{\\usebox{\\myqbox}}%
  \\par\\vspace{1em} % Space between questions
}

% Answer Box (Empty) - For Problem Sheet
% Width is adjusted to prevent overflow past labels
\\newcommand{\\answerbox}[2]{
  \\par\\vspace{0.2em}
  \\noindent\\textbf{答:}
  \\begin{minipage}[t][#1][t]{\\dimexpr\\linewidth-3em\\relax}
    \\mbox{}
  \\end{minipage}
}

% Answer Box (Filled) - For Answer Sheet
% Dynamic height and calculated width to ensure wrapping within the box
\\newcommand{\\answeredbox}[1]{
  \\par\\vspace{0.2em}
  \\noindent\\textbf{答:}\\ 
  \\begin{minipage}[t]{\\dimexpr\\linewidth-3em\\relax}
    \\raggedright
    \\color{red}
    \\normalsize #1
  \\end{minipage}
  \\par
}

\\begin{document}

${content}

\\end{document}
     `;
  }
}

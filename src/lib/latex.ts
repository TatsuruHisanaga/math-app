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
      const cmd = 'lualatex'; 
      const args = [
        '--interaction=nonstopmode',
        `--output-directory=${jobDir}`,
        texFile
      ];

      // Note: We might need to add /Library/TeX/texbin to PATH for the spawn process
      // if it's not already there.
      // Use environment PATH or a sensible default for Linux/Docker
      const env = { ...process.env };
      // On many Linux setups, lualatex is in /usr/bin or /usr/local/bin which are usually in PATH.
      // We only append specific paths if we are on macOS for local dev convenience.
      if (process.platform === 'darwin') {
        const texPath = '/Library/TeX/texbin:/usr/local/bin:/opt/homebrew/bin';
        env.PATH = `${texPath}:${env.PATH || ''}`;
      }

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
        
        // Check if PDF exists regardless of exit code
        if (fs.existsSync(pdfFile)) {
          const pdfBuffer = fs.readFileSync(pdfFile);
          // Cleanup
          fs.rmSync(jobDir, { recursive: true, force: true });
          
          if (code !== 0) {
              console.warn('LaTeX build finished with non-zero exit code, but PDF was generated.', stdout);
          }
          resolve(pdfBuffer);
          return;
        }

        if (code !== 0) {
          console.error('LaTeX build failed:', stdout); // Log header
          // Clean up somewhat
          // fs.rmSync(jobDir, { recursive: true, force: true });
          reject(new Error(`LaTeX compilation failed with code ${code}.\nStderr: ${stderr}\nStdout: ${stdout}`));
          return;
        }

        reject(new Error('PDF file was not created despite exit code 0'));
      });
    });
  }

  public getLayoutTemplate(content: string, isAnswer: boolean = false): string {
     // Basic wrapper
     return `
\\documentclass[a4paper,10pt,twocolumn]{article}
\\usepackage[haranoaji]{luatexja-preset}
\\usepackage[top=10mm,bottom=10mm,left=10mm,right=10mm]{geometry}
\\usepackage{amsmath,amssymb}
\\usepackage{multicol}
\\usepackage{needspace}
\\usepackage{xcolor}
\\usepackage{tikz} % Added for rounded corners
\\pagestyle{empty}

% Internal padding for fbox
\\setlength{\\fboxsep}{8pt}

% Point Review Box Style - Redesigned with TikZ for rounded corners and print-friendly look
\\newsavebox{\\pointboxcontent}
\\newenvironment{pointbox}{%
  \\par\\vspace{1.5em}
  \\noindent
  \\begin{lrbox}{\\pointboxcontent}%
    \\begin{minipage}{0.92\\linewidth}
      \\linespread{1.3}\\selectfont
      \\setlength{\\parskip}{0.5em}
      % Customize itemize inside this box manually for compatibility
      \\let\\olditemize\\itemize
      \\renewcommand\\itemize{\\olditemize\\setlength\\itemsep{0.5em}\\setlength\\parskip{0pt}\\setlength\\parsep{0pt}}
}{%
    \\end{minipage}
  \\end{lrbox}
  \\begin{center}
  \\begin{tikzpicture}
    % Main box: Rounded corners, thick dark border, white background
    \\node [
      draw=black!80,
      line width=1.5pt,
      rectangle,
      rounded corners=8pt,
      inner sep=12pt,
      inner ysep=15pt,
      fill=white
    ] (box) {\\usebox{\\pointboxcontent}};
    
    % Floating Header: Badge style on top border
    \\node [
      fill=black!80,
      text=white,
      rounded corners=4pt,
      anchor=west,
      xshift=15pt
    ] at (box.north west) {
       \\bfseries \\hspace{0.5em} ★ Point Review - 今回の重要ポイント ★ \\hspace{0.5em}
    };
  \\end{tikzpicture}
  \\end{center}
  \\par\\vspace{1em}
}

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
% Removed label as per user request
\\newcommand{\\answerbox}[2]{
  \\par\\vspace{0.2em}
  \\begin{minipage}[t][#1][t]{\\dimexpr\\linewidth-1em\\relax}
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

  public getPointReview(content: string): string {
      if (!content) return '';
      return `
\\par\\vspace{2em}
\\begin{pointbox}
${content}
\\end{pointbox}
      `;
  }
}

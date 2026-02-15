import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

export class PDFBuilder {
  private tempDir: string;
  private fontsDir: string;
  private engine: 'lualatex' | 'uplatex';

  constructor() {
    // Determine temp dir (in a real app, might want a specific cache dir)
    this.tempDir = path.resolve(process.cwd(), 'temp_builds');
    this.fontsDir = path.resolve(process.cwd(), 'public/fonts');
    
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Determine engine based on platform or env var
    // 1. PDF_ENGINE env var (override)
    // 2. macOS (Dev) -> lualatex (default)
    // 3. Linux (Docker/Prod) -> uplatex (default)
    if (process.env.PDF_ENGINE === 'uplatex') {
      this.engine = 'uplatex';
    } else if (process.env.PDF_ENGINE === 'lualatex') {
      this.engine = 'lualatex';
    } else {
      this.engine = process.platform === 'darwin' ? 'lualatex' : 'uplatex';
    }
    console.log(`[PDFBuilder] Initialized with engine: ${this.engine}`);
  }

  // Generate PDF from LaTeX string
  public async buildPDF(latexContent: string): Promise<Buffer> {
    const jobId = uuidv4();
    const jobDir = path.join(this.tempDir, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const texFile = path.join(jobDir, 'main.tex');
    const pdfFile = path.join(jobDir, 'main.pdf');

    fs.writeFileSync(texFile, latexContent);

    // We use latexmk for reliable building or direct commands
    // Note: Assuming 'uplatex' and 'dvipdfmx' are in PATH.
    // If not, we might need to configure absolute paths or user environment.
      // Use uplatex + dvipdfmx for lower memory usage
      // 1. Run uplatex to generate .dvi
      // 2. Run dvipdfmx to generate .pdf

      // Note: We use /usr/bin/time if available for memory logging, or just run directly.
      
      const env = { ...process.env };
      if (process.platform === 'darwin') {
        const texPath = '/Library/TeX/texbin:/usr/local/bin:/opt/homebrew/bin';
        env.PATH = `${texPath}:${env.PATH || ''}`;
      }

      const runCommand = (cmd: string, args: string[], stepName: string): Promise<void> => {
          return new Promise((resolve, reject) => {
              // Wrap with time on Mac for memory monitoring (if not already wrapped)
              let finalCmd = cmd;
              let finalArgs = args;
              
              if (process.platform === 'darwin' && cmd !== '/usr/bin/time') {
                  finalArgs = ['-l', cmd, ...args];
                  finalCmd = '/usr/bin/time';
              }

              console.log(`[PDFBuilder] Starting ${stepName}: ${finalCmd} ${finalArgs.join(' ')}`);
              
              const p = spawn(finalCmd, finalArgs, { env });
              
              // 30s Timeout
              const timeoutMs = 30000;
              const timer = setTimeout(() => {
                  console.error(`[PDFBuilder] Timeout (${timeoutMs}ms) reached for ${stepName}. Killing process...`);
                  p.kill('SIGKILL'); // Force kill
                  reject(new Error(`${stepName} timed out after ${timeoutMs}ms`));
              }, timeoutMs);

              let stdout = '';
              let stderr = '';
              
              p.stdout.on('data', d => stdout += d.toString());
              p.stderr.on('data', d => stderr += d.toString());
              
              p.on('close', (code) => {
                  clearTimeout(timer); // Clear timeout on completion

                  // Try to parse memory usage from stderr (which is where /usr/bin/time outputs)
                  // Look for "maximum resident set size"
                  const match = stderr.match(/(\d+)\s+maximum resident set size/);
                  if (match) {
                      const maxRssBytes = parseInt(match[1], 10);
                      const maxRssMb = (maxRssBytes / 1024 / 1024).toFixed(2);
                      console.log(`[PDF Memory] ${stepName}: Maximum Resident Set Size: ${maxRssBytes} bytes (~${maxRssMb} MB)`);
                  }

                  if (code === 0) {
                      resolve();
                  } else {
                      // If killed by timeout, the error might have already been rejected, but usually 'close' fires after kill.
                      // If logic handled reject in setTimeout, we should be careful not to reject twice or handle the null code.
                      // signal might be 'SIGKILL'
                      if (p.killed) {
                          // Already rejected in timeout
                          return;
                      }
                      console.error(`[PDFBuilder] ${stepName} failed:`, stdout);
                      reject(new Error(`${stepName} failed with code ${code}\nStderr: ${stderr}\nStdout: ${stdout}`));
                  }
              });
              
              p.on('error', (err) => {
                  clearTimeout(timer);
                  reject(err);
              });
          });
      };

      try {
         if (this.engine === 'uplatex') {
            // Step 1: uplatex
            // Run output to jobDir. uplatex creates .dvi
            await runCommand('uplatex', ['-interaction=nonstopmode', `-output-directory=${jobDir}`, texFile], 'uplatex');
            
            // Step 2: dvipdfmx
            // Input is .dvi file in jobDir/main.dvi
            const dviFile = path.join(jobDir, 'main.dvi');
            if (!fs.existsSync(dviFile)) {
                throw new Error('DVI file was not created by uplatex');
            }
            await runCommand('dvipdfmx', ['-o', pdfFile, dviFile], 'dvipdfmx');
         } else {
             // lualatex (macOS/Legacy)
             // Use /usr/bin/time if available on Mac for monitoring (optional, kept from previous impl)
              let cmd = 'lualatex';
              let args = ['-interaction=nonstopmode', `-output-directory=${jobDir}`, texFile];

              if (process.platform === 'darwin') {
                   // Measure memory on Mac
                   args = ['-l', cmd, ...args];
                   cmd = '/usr/bin/time';
              }

              await runCommand(cmd, args, 'lualatex');
         }

         if (fs.existsSync(pdfFile)) {
             const pdfBuffer = fs.readFileSync(pdfFile);
             fs.rmSync(jobDir, { recursive: true, force: true });
             return pdfBuffer;
         } else {
             throw new Error('PDF file was not created');
         }
      } catch (e) {
          // Clean up on error?
           // fs.rmSync(jobDir, { recursive: true, force: true });
          throw e;
      }
  }

  public getLayoutTemplate(content: string, isAnswer: boolean = false): string {
     if (this.engine === 'uplatex') {
         // uplatex template
         return `
\\documentclass[a4paper,10pt,twocolumn,uplatex,dvipdfmx]{ujarticle}
% \\usepackage[haranoaji]{luatexja-preset} % Removed for uplatex

\\usepackage[top=10mm,bottom=10mm,left=10mm,right=10mm]{geometry}
\\usepackage{amsmath,amssymb}
\\usepackage{multicol}
\\usepackage{needspace}
\\usepackage{xcolor}
% \\usepackage{tcolorbox} % Removed to prevent garbage output text
\\pagestyle{empty}

% Internal padding for fbox - Default is usually 3pt. 
% We reset it to a standard value to avoid affecting other boxes.
\\setlength{\\fboxsep}{3pt} 
\\setlength{\\fboxrule}{0.4pt}

% Point Review Box Style - Standard LaTeX implementation (No TikZ, No tcolorbox)
% Uses robust box measurement and overlay to place title on top of border.
\\newsavebox{\\pointboxcontent}
\\newsavebox{\\pointboxtitle}
\\newsavebox{\\pointboxframe}
\\newenvironment{pointbox}{%
  \\par\\vspace{2em}
  \\noindent
  \\begin{lrbox}{\\pointboxcontent}%
    \\begin{minipage}{0.90\\linewidth}
      \\linespread{1.3}\\selectfont
      \\setlength{\\parskip}{0.5em}
      % Customize itemize inside this box
      \\let\\olditemize\\itemize
      \\renewcommand\\itemize{\\olditemize\\setlength\\itemsep{0.5em}\\setlength\\parskip{0pt}\\setlength\\parsep{0pt}}
      \\vspace{0.5em} 
}{%
    \\end{minipage}
  \\end{lrbox}
  \\begin{center}
    % Create the frame box
    \\sbox{\\pointboxframe}{%
      \\setlength{\\fboxrule}{1.5pt}% Thick border for this box only
      \\setlength{\\fboxsep}{10pt}% Padding
      \\fbox{\\usebox{\\pointboxcontent}}%
    }%
    % Create the title box
    \\sbox{\\pointboxtitle}{%
      \\colorbox{black!80}{\\textcolor{white}{\\textbf{\\ \\ ★ 今回の重要ポイント ★\\ \\ }}}%
    }%
    % Draw Frame then Title on top
    \\leavevmode
    \\usebox{\\pointboxframe}%
    \\hspace{-\\wd\\pointboxframe}% Move back to start
    % Raise title to top edge of frame. 
    % \\ht\\pointboxframe is height above baseline. 
    % \\ht\\pointboxtitle is height of title.
    % We want center of title to match top edge.
    \\raisebox{\\dimexpr\\ht\\pointboxframe - 0.5\\ht\\pointboxtitle\\relax}{%
       \\makebox[\\wd\\pointboxframe][l]{%
         \\hspace{1em}% Indent title
         \\usebox{\\pointboxtitle}%
       }%
    }%
  \\end{center}
  \\par\\vspace{1em}
}

% Clean box layout matching the reference image style
% Single frame, question number and text inside, empty space below.
\\newsavebox{\\myqbox}
\\newenvironment{qbox}{%
  \\setlength{\\fboxsep}{8pt}% Increase padding for problem box
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
     } else {
         // lualatex template (Legacy/Mac)
         return `
\\documentclass[a4paper,10pt,twocolumn]{article}
\\usepackage[haranoaji]{luatexja-preset}
\\usepackage[top=10mm,bottom=10mm,left=10mm,right=10mm]{geometry}
\\usepackage{amsmath,amssymb}
\\usepackage{multicol}
\\usepackage{needspace}
\\usepackage{xcolor}
\\pagestyle{empty}

\\setlength{\\fboxsep}{3pt} 
\\setlength{\\fboxrule}{0.4pt}

% Definitions same as above but compatible with lualatex (standard latex is compatible)
% Point Review Box Style
\\newsavebox{\\pointboxcontent}
\\newsavebox{\\pointboxtitle}
\\newsavebox{\\pointboxframe}
\\newenvironment{pointbox}{%
  \\par\\vspace{2em}
  \\noindent
  \\begin{lrbox}{\\pointboxcontent}%
    \\begin{minipage}{0.90\\linewidth}
      \\linespread{1.3}\\selectfont
      \\setlength{\\parskip}{0.5em}
      \\let\\olditemize\\itemize
      \\renewcommand\\itemize{\\olditemize\\setlength\\itemsep{0.5em}\\setlength\\parskip{0pt}\\setlength\\parsep{0pt}}
      \\vspace{0.5em} 
}{%
    \\end{minipage}
  \\end{lrbox}
  \\begin{center}
    \\sbox{\\pointboxframe}{%
      \\setlength{\\fboxrule}{1.5pt}%
      \\setlength{\\fboxsep}{10pt}%
      \\fbox{\\usebox{\\pointboxcontent}}%
    }%
    \\sbox{\\pointboxtitle}{%
      \\colorbox{black!80}{\\textcolor{white}{\\textbf{\\ \\ ★ 今回の重要ポイント ★\\ \\ }}}%
    }%
    \\leavevmode
    \\usebox{\\pointboxframe}%
    \\hspace{-\\wd\\pointboxframe}%
    \\raisebox{\\dimexpr\\ht\\pointboxframe - 0.5\\ht\\pointboxtitle\\relax}{%
       \\makebox[\\wd\\pointboxframe][l]{%
         \\hspace{1em}%
         \\usebox{\\pointboxtitle}%
       }%
    }%
  \\end{center}
  \\par\\vspace{1em}
}

\\newsavebox{\\myqbox}
\\newenvironment{qbox}{%
  \\setlength{\\fboxsep}{8pt}%
  \\begin{lrbox}{\\myqbox}%
  \\begin{minipage}{\\dimexpr\\linewidth-2\\fboxsep-2\\fboxrule\\relax}
  \\setlength{\\parskip}{5pt}
}{%
  \\end{minipage}%
  \\end{lrbox}%
  \\par\\noindent
  \\fbox{\\usebox{\\myqbox}}%
  \\par\\vspace{1em}
}

\\newcommand{\\answerbox}[2]{
  \\par\\vspace{0.2em}
  \\begin{minipage}[t][#1][t]{\\dimexpr\\linewidth-1em\\relax}
    \\mbox{}
  \\end{minipage}
}

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

  public getVerificationTemplate(content: string): string {
      if (this.engine === 'uplatex') {
          return `
\\documentclass[uplatex,dvipdfmx]{ujarticle}
\\usepackage{amsmath,amssymb}
\\usepackage{xcolor}

% Dummy definitions to pass syntax check
\\newenvironment{qbox}{}{}
\\newcommand{\\answerbox}[2]{}
\\newcommand{\\answeredbox}[1]{}
\\newenvironment{pointbox}{}{}

\\begin{document}
${content}
\\end{document}
          `;
      } else {
          // MacOS / Lualatex verification
          return `
\\documentclass{article}
\\usepackage{amsmath,amssymb}
\\usepackage{xcolor}

% Dummy definitions to pass syntax check
\\newenvironment{qbox}{}{}
\\newcommand{\\answerbox}[2]{}
\\newcommand{\\answeredbox}[1]{}
\\newenvironment{pointbox}{}{}

\\begin{document}
${content}
\\end{document}
          `;
      }
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

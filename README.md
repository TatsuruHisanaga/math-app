# Math PDF Generator MVP

A Next.js application to generate Math Exercise PDFs using LuaLaTeX.

## Prerequisites

### 1. Node.js
Ensure Node.js (v18+) is installed.

### 2. LaTeX Environment (Crucial)
This app requires a local LaTeX installation with LuaLaTeX and Japanese support.

**macOS (using BasicTeX):**
```bash
brew install --cask basictex

# Update package manager
sudo tlmgr update --self

# Install required packages
# haranoaji is REQUIRED for Japanese fonts
sudo tlmgr install luatexja needspace geometry multicol haranoaji
```

## Setup & Run

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

## System Details

- **PDF Generation**: Occurs locally using `spawn` to call `lualatex`.
- **First Run**: The first time you generate a PDF, it may take **several minutes** to build the LuaTeX font cache. Please be patient.
- **Templates**: Located in `data/templates.json`.
- **Layout**: Defined in `src/lib/latex.ts`.

## Troubleshooting

- **"Generation Failed"**: Check the error log in the UI modal.
- **"Font not found"**: Ensure `sudo tlmgr install haranoaji` was run.
- **"lualatex not found"**: The app looks for lualatex at `/Library/TeX/texbin/lualatex`. If your path is different, update `src/lib/latex.ts`.

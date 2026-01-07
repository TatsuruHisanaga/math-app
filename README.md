<img width="1920" height="2242" alt="image" src="https://github.com/user-attachments/assets/e9ff7df8-5a24-4b4e-a00d-ad3ef9def95c" />

# Math PDF Generator MVP
A Next.js application to generate Math Exercise PDFs using LuaLaTeX.

<img width="1920" height="2242" alt="image" src="https://github.com/user-attachments/assets/e1ab8ea8-7130-4d09-981e-6025d39776c0" />


<img width="1046" height="775" alt="スクリーンショット 2025-12-28 23 26 47" src="https://github.com/user-attachments/assets/fe6bcfa4-4516-4757-af39-043d3c43dce1" />

<img width="1095" height="796" alt="スクリーンショット 2025-12-28 23 26 54" src="https://github.com/user-attachments/assets/c8c90b90-ad6b-4681-ac19-82880493267f" />

<img width="2212" height="1318" alt="image" src="https://github.com/user-attachments/assets/f1f28511-a3d0-468d-b360-0896e35b082d" />

[指数・対数関数_2025-12-28.pdf](https://github.com/user-attachments/files/24463655/_2025-12-28.pdf)

[指数・対数関数_2025-12-28 (4).pdf](https://github.com/user-attachments/files/24463687/_2025-12-28.4.pdf)

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

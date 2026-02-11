
import { PDFBuilder } from '@/lib/latex';
import path from 'path';

async function main() {
    console.log('Starting PDFBuilder debug...');
    
    try {
        const builder = new PDFBuilder();
        console.log('PDFBuilder instantiated.');

        const content = `
\\begin{qbox}
Test Problem
\\answerbox{3cm}{}
\\end{qbox}
`;
        const fullBody = builder.getLayoutTemplate(content);
        console.log('Full LaTeX body generated.');

        console.log('Attempting to build PDF with full template...');
        const buffer = await builder.buildPDF(fullBody);
        console.log('PDF built successfully! Size:', buffer.length);

    } catch (error) {
        console.error('PDF Build FAILED:', error);
        process.exit(1);
    }
}

main();

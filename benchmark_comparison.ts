
import { PDFBuilder } from './src/lib/latex';

const sampleLatex = `
\\section*{Benchmark Test}
This is a test document to measure memory usage and compilation time.
$E = mc^2$
\\[
  \\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
\\]
`;

async function run() {
    console.log('--- Starting Benchmark ---');
    const builder = new PDFBuilder();
    
    const start = Date.now();
    try {
        const layout = builder.getLayoutTemplate(sampleLatex);
        await builder.buildPDF(layout);
        const end = Date.now();
        console.log(`Total Execution Time: ${end - start}ms`);
    } catch (e) {
        console.error('Benchmark failed:', e);
    }
}

run();

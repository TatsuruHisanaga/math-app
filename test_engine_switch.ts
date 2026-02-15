
import { PDFBuilder } from './src/lib/latex';

console.log('--- Testing PDF_ENGINE=uplatex ---');
// Instantiate PDFBuilder to trigger constructor logging
try {
    const builder = new PDFBuilder();
    // Since engine is private, we rely on the console.log in constructor
    console.log('PDFBuilder instantiated successfully.');
} catch (e) {
    console.error('Failed to instantiate PDFBuilder:', e);
}

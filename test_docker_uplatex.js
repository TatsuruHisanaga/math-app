
const { exec } = require('child_process');
const fs = require('fs');

const texContent = `
\\documentclass{ujarticle}
\\usepackage{amsmath,amssymb}
\\begin{document}
Test
\\end{document}
`;

fs.writeFileSync('test_docker_uplatex.tex', texContent);

console.log('Running uplatex in Docker...');
// We use /usr/bin/time -v for GNU time in Linux (Debian)
// Use base64 to avoid shell escaping issues completely
const base64Content = Buffer.from(texContent).toString('base64');
exec(`docker exec local-math-app sh -c "mkdir -p /tmp/test && cd /tmp/test && echo '${base64Content}' | base64 -d > main.tex && /usr/bin/time -v uplatex main.tex && /usr/bin/time -v dvipdfmx main.dvi"`, (err, stdout, stderr) => {
    if (err) {
        console.error('Docker execution failed:', err);
    }
    console.log('STDOUT:', stdout);
    console.log('STDERR:', stderr);
    
    // Check if PDF exists
    exec('docker exec local-math-app ls -l /tmp/test/main.pdf', (e, out, err2) => {
        console.log('PDF Check:', out);
    });
});

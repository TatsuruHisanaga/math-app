import { GraphData } from './ai/types';

export function generateTikZ(graph: GraphData): string {
    const { 
        xMin = -5, xMax = 5, 
        yMin = -5, yMax = 5, 
        expression, 
        points, 
        type 
    } = graph;

    // Basic TikZ setup with grid and axes
    let tikz = `
\\begin{tikzpicture}[scale=0.8, >=stealth]
    \\draw[very thin, gray!30] (${xMin},${yMin}) grid (${xMax},${yMax});
    \\draw[->] (${xMin},0) -- (${xMax},0) node[right] {$x$};
    \\draw[->] (0,${yMin}) -- (0,${yMax}) node[above] {$y$};
    \\node at (0,0) [below left] {O};
`;

    // Plot function
    if (type === 'function' && expression) {
        // Convert JS expression to TikZ syntax
        // This is a naive conversion and might need validtion
        const tikzExpr = expression
            .replace(/\*\*/g, '^')
            .replace(/Math\.sin/g, 'sin')
            .replace(/Math\.cos/g, 'cos')
            .replace(/Math\.tan/g, 'tan')
            .replace(/Math\.log/g, 'ln')
            .replace(/Math\.exp/g, 'exp')
            .replace(/Math\.sqrt/g, 'sqrt')
            .replace(/Math\.PI/gi, '3.14159')
            // Handle x as \x
            .replace(/\bx\b/g, '\\x');

        // TikZ uses degrees for trig by default, need to verify if we need 'r' or 'deg'
        // usually sin(\x r) works for radians in standard TikZ plot
        // Let's assume standard math notation for now, user might strictly stick to polynomials
        
        // We trim the domain slightly to avoid hitting the exact edge if undefined (e.g. log(0))
        const plotStart = Math.max(xMin, -15); // limit plot range
        const plotEnd = Math.min(xMax, 15);

        tikz += `    \\draw[thick, domain=${plotStart}:${plotEnd}, samples=100, variable=\\x] plot (\\x, {${tikzExpr}});\n`;
    }

    // Plot Points
    if (points) {
        points.forEach(p => {
            const color = p.color === 'red' || !p.color ? 'red' : p.color; // Map colors if needed
            tikz += `    \\fill[${color}] (${p.x},${p.y}) circle (2pt);\n`;
            if (p.label) {
                // Formatting label to avoid overlap
                tikz += `    \\node[above right] at (${p.x},${p.y}) {${p.label}};\n`;
            }
        });
    }

    tikz += `\\end{tikzpicture}`;
    return tikz;
}

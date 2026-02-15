import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  content: string;
  inline?: boolean;
}

const LatexRenderer: React.FC<LatexRendererProps> = ({ content }) => {
  if (!content) return null;

  // Split content by various LaTeX delimiters: $$, $, \[, \(
  // Use a regex that captures the delimiters as well
  // Also replace literal \n with newline for correct rendering
  const normalizedContent = content.replace(/\\n/g, '\n');
  const parts = normalizedContent.split(/(\$\$.*?\$\$|\$.*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g);

  return (
    <span>
      {parts.map((part, index) => {
        if (!part) return null;

        // Display math: $$...$$ or \[...\]
        if ((part.startsWith('$$') && part.endsWith('$$')) || 
            (part.startsWith('\\[') && part.endsWith('\\]'))) {
          const isSquare = part.startsWith('\\[');
          const math = isSquare ? part.slice(2, -2) : part.slice(2, -2);
          try {
            return (
              <div
                key={index}
                className="latex-display"
                style={{ margin: '1em 0', overflowX: 'auto', overflowY: 'hidden' }}
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(math, { displayMode: true, throwOnError: false }),
                }}
              />
            );
          } catch (e) {
            return <span key={index}>{part}</span>;
          }
        } 
        // Inline math: $...$ or \(...\)
        else if ((part.startsWith('$') && part.endsWith('$')) || 
                 (part.startsWith('\\(') && part.endsWith('\\)'))) {
          const isRound = part.startsWith('\\(');
          const math = isRound ? part.slice(2, -2) : part.slice(1, -1);
          try {
            return (
              <span
                key={index}
                className="latex-inline"
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(math, { displayMode: false, throwOnError: false }),
                }}
              />
            );
          } catch (e) {
            return <span key={index}>{part}</span>;
          }
        }
        
        // Plain text: handle newlines
        return (
          <span key={index} style={{ whiteSpace: 'pre-wrap' }}>
            {part}
          </span>
        );
      })}
    </span>
  );
};

export default LatexRenderer;

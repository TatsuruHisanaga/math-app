import React from 'react';
import { Mafs, Coordinates, Plot, Point, Text, Theme } from 'mafs';
import 'mafs/core.css';
import 'mafs/font.css';
import { GraphData } from '@/lib/ai/types';

interface MathGraphProps {
  data?: GraphData;
}

const MathGraph: React.FC<MathGraphProps> = ({ data }) => {
  if (!data) return null;

  const { xMin = -5, xMax = 5, yMin = -5, yMax = 5 } = data;

  return (
    <div style={{ margin: '1rem 0', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
      <Mafs
        viewBox={{ x: [xMin, xMax], y: [yMin, yMax] }}
        height={300}
        preserveAspectRatio={false}
        pan={false}
      >
        <Coordinates.Cartesian />
        
        {data.type === 'function' && data.expression && (
          <Plot.OfX 
            y={(x) => {
                try {
                    // Simple evaluation for JS math expressions (e.g. "x*x", "Math.sin(x)")
                    const safeExpr = data.expression!
                        .replace(/\\^/g, '**') // Replace ^ with ** for power
                        .replace(/\bsin\b/g, 'Math.sin')
                        .replace(/\bcos\b/g, 'Math.cos')
                        .replace(/\btan\b/g, 'Math.tan')
                        .replace(/\blog\b/g, 'Math.log')
                        .replace(/\bexp\b/g, 'Math.exp')
                        .replace(/\bsqrt\b/g, 'Math.sqrt')
                        .replace(/\bpi\b/gi, 'Math.PI');
                        
                    return new Function('x', `return ${safeExpr}`)(x);
                } catch (e) {
                    return 0;
                }
            }} 
            color={Theme.blue}
            weight={3}
          />
        )}

        {data.points?.map((p, i) => (
          <React.Fragment key={i}>
            <Point x={p.x} y={p.y} color={p.color || Theme.red} />
            {p.label && (
                <Text x={p.x} y={p.y} attach="ne" size={20} color="black">
                    {p.label}
                </Text>
            )}
          </React.Fragment>
        ))}
      </Mafs>
    </div>
  );
};

export default MathGraph;

import React, { useState } from 'react';
import LatexRenderer from './LatexRenderer';

type Problem = {
  id: string; 
  stem_latex: string;
  answer_latex: string;
  explanation_latex?: string;
  unit_title?: string;
  unit_id?: string;
};

type Props = {
  problems: Problem[];
  onDelete: (index: number) => void;
  onUpdate: (index: number, updated: Problem) => void;
  onRequestPDFUpdate: () => void;
};

export default function ProblemEditList({ problems, onDelete, onUpdate, onRequestPDFUpdate }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setInstruction('');
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setInstruction('');
  };

  const handleRegenerate = async () => {
    if (editingIndex === null || !instruction.trim()) return;
    
    setLoading(true);
    const problem = problems[editingIndex];
    
    try {
      const res = await fetch('/api/regenerate_problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem,
          instruction,
          unit_title: problem.unit_title || 'Math Problem',
          difficulty: 'L1' // You might want to pass actual difficulty if available in problem object
        })
      });

      if (!res.ok) throw new Error('Regeneration failed');
      
      const data = await res.json();
      if (data.problem) {
        onUpdate(editingIndex, {
            ...data.problem,
            id: problem.id, // Keep original ID
            unit_title: problem.unit_title,
            unit_id: problem.unit_id
        });
        cancelEdit();
        
        // Confirmation popup removed as per request
        // if (window.confirm('AIの編集が完了しました。PDFを更新しますか？')) {
        //     onRequestPDFUpdate();
        // }
      }
    } catch (e) {
      alert('再生成に失敗しました');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!problems || problems.length === 0) return null;

  return (
    <div style={{ marginTop: '2rem', padding: '1rem', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd' }}>
      <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #ddd', paddingBottom: '0.5rem', color: '#333' }}>
        生成された問題の編集・削除
      </h3>
      <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
        問題を編集または削除した後、下の「PDFを更新する」ボタンを押してください。
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {problems.map((prob, idx) => (
          <div key={idx} style={{ 
            background: 'white', 
            padding: '1rem', 
            borderRadius: '6px', 
            border: '1px solid #eee',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            {/* Always show problem content for reference */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold', minWidth: '3rem', color: '#0070f3' }}>({idx + 1})</span>
                    {editingIndex !== idx && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                            onClick={() => startEdit(idx)}
                            style={{
                                padding: '4px 10px',
                                fontSize: '0.8rem',
                                background: '#fff',
                                color: '#2196F3',
                                border: '1px solid #2196F3',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                            >
                            AIで編集
                            </button>
                            <button 
                            onClick={() => onDelete(idx)}
                            style={{
                                padding: '4px 10px',
                                fontSize: '0.8rem',
                                background: '#fff',
                                color: '#F44336',
                                border: '1px solid #F44336',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                            >
                            削除
                            </button>
                        </div>
                    )}
                </div>
                <div style={{ paddingLeft: '3rem' }}>
                    <div style={{ marginBottom: '0.8rem', fontSize: '1rem' }}>
                        <LatexRenderer content={prob.stem_latex} />
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#555', background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px' }}>
                        <strong>答:</strong> <LatexRenderer content={prob.answer_latex} />
                    </div>
                    {prob.explanation_latex && (
                        <div style={{ fontSize: '0.9rem', color: '#555', marginTop: '0.5rem', padding: '0.5rem', borderTop: '1px dashed #eee' }}>
                            <strong>解説:</strong> <LatexRenderer content={prob.explanation_latex} />
                        </div>
                    )}
                </div>
            </div>

            {editingIndex === idx && (
               // Edit Mode with Instruction
               <div style={{ marginTop: '1rem', background: '#f0f9ff', padding: '1rem', borderRadius: '4px', border: '1px solid #bae6fd' }}>
                 <div style={{ marginBottom: '1rem' }}>
                   <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#0284c7' }}>
                     AIへの指示:
                   </label>
                   <textarea
                     value={instruction}
                     onChange={(e) => setInstruction(e.target.value)}
                     placeholder="例: 数値を簡単にして、文章題に変更して、など"
                     style={{ 
                         width: '100%', 
                         minHeight: '60px', 
                         padding: '8px', 
                         fontSize: '0.95rem', 
                         borderRadius: '4px', 
                         border: '1px solid #90caf9',
                         fontFamily: 'inherit'
                     }}
                   />
                 </div>
                 
                 <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                   <button 
                     onClick={cancelEdit}
                     disabled={loading}
                     style={{
                       padding: '6px 12px',
                       background: '#fff',
                       color: '#666',
                       border: '1px solid #ccc',
                       borderRadius: '4px',
                       cursor: 'pointer'
                     }}
                   >
                     キャンセル
                   </button>
                   <button 
                     onClick={handleRegenerate}
                     disabled={loading || !instruction.trim()}
                     style={{
                       padding: '6px 16px',
                       background: loading ? '#ccc' : '#0ea5e9',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       cursor: loading ? 'not-allowed' : 'pointer',
                       fontWeight: 'bold',
                       display: 'flex',
                       alignItems: 'center',
                       gap: '0.5rem'
                     }}
                   >
                     {loading ? '生成中...' : '💫 AIで再生成'}
                   </button>
                 </div>
               </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

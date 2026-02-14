import React, { useState, useEffect } from 'react';
import LatexRenderer from './LatexRenderer';

type Problem = {
  id: string; 
  stem_latex: string;
  answer_latex: string;
  explanation_latex?: string;
  unit_title?: string;
  unit_id?: string;
  history?: Problem; // Previous version for undo
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
  
  // Simple Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
      if (toastMessage) {
          const timer = setTimeout(() => setToastMessage(null), 3000);
          return () => clearTimeout(timer);
      }
  }, [toastMessage]);

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
    const currentProblem = problems[editingIndex];
    
    try {
      const res = await fetch('/api/regenerate_problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem: currentProblem,
          instruction,
          unit_title: currentProblem.unit_title || 'Math Problem',
          difficulty: 'L1' // You might want to pass actual difficulty if available in problem object
        })
      });

      if (!res.ok) throw new Error('Regeneration failed');
      
      const data = await res.json();
      if (data.problem) {
        onUpdate(editingIndex, {
            ...data.problem,
            id: currentProblem.id, // Keep original ID
            unit_title: currentProblem.unit_title,
            unit_id: currentProblem.unit_id,
            history: currentProblem // Save current state as history
        });
        cancelEdit();
        
        // Show Toast
        setToastMessage('AI編集が完了しました');
      }
    } catch (e) {
      alert('再生成に失敗しました');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = (index: number) => {
      const current = problems[index];
      if (current.history) {
          if (confirm('編集前の状態に戻しますか？')) {
             onUpdate(index, current.history);
          }
      }
  };

  if (!problems || problems.length === 0) return null;

  return (
    <div style={{ marginTop: '2rem', padding: '1rem', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd', position: 'relative' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
          <div style={{
              position: 'fixed',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#333',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 9999,
              animation: 'fadeInOut 3s ease-in-out',
              fontWeight: 'bold'
          }}>
              {toastMessage}
          </div>
      )}

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
                            {prob.history && (
                                <button 
                                onClick={() => handleUndo(idx)}
                                style={{
                                    padding: '4px 10px',
                                    fontSize: '0.8rem',
                                    background: '#fff',
                                    color: '#757575',
                                    border: '1px solid #757575',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                                title="編集前に戻す"
                                >
                                ↩ 元に戻す
                                </button>
                            )}
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
                
                {/* Original Content Display (if exists) */}
                {prob.history && (
                    <div style={{ 
                        marginBottom: '1rem', 
                        padding: '0.8rem', 
                        background: '#f8f9fa', 
                        borderLeft: '4px solid #adb5bd',
                        opacity: 0.85
                    }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#6c757d', marginBottom: '0.5rem' }}>
                             [編集前]
                        </div>
                        <div style={{ paddingLeft: '1rem' }}>
                             <div style={{ marginBottom: '0.5rem', fontSize: '0.95rem', color: '#495057' }}>
                                 <LatexRenderer content={prob.history.stem_latex} />
                             </div>
                             <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                                <strong>答:</strong> <LatexRenderer content={prob.history.answer_latex} />
                             </div>
                        </div>
                    </div>
                )}

                {/* Current Content */}
                <div style={{ paddingLeft: '3rem' }}>
                    {prob.history && <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0070f3', marginBottom: '0.5rem' }}>[編集後]</div>}
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
      <style jsx>{`
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -20px); }
            10% { opacity: 1; transform: translate(-50%, 0); }
            90% { opacity: 1; transform: translate(-50%, 0); }
            100% { opacity: 0; transform: translate(-50%, -20px); }
        }
      `}</style>
    </div>
  );
}

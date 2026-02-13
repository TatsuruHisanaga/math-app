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
};

export default function ProblemEditList({ problems, onDelete, onUpdate }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Problem | null>(null);

  const startEdit = (index: number, problem: Problem) => {
    setEditingIndex(index);
    setEditForm({ ...problem });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditForm(null);
  };

  const saveEdit = () => {
    if (editingIndex !== null && editForm) {
      onUpdate(editingIndex, editForm);
      setEditingIndex(null);
      setEditForm(null);
    }
  };

  const handleChange = (field: keyof Problem, value: string) => {
    if (editForm) {
      setEditForm({ ...editForm, [field]: value });
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
            {editingIndex === idx && editForm ? (
               // Edit Mode
               <div style={{ background: '#fafafa', padding: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}>
                 <div style={{ marginBottom: '1rem' }}>
                   <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.3rem', color: '#555' }}>
                     問題文 (LaTeX):
                   </label>
                   <textarea
                     value={editForm.stem_latex}
                     onChange={(e) => handleChange('stem_latex', e.target.value)}
                     style={{ width: '100%', minHeight: '80px', padding: '8px', fontSize: '0.9rem', fontFamily: 'monospace', borderRadius: '4px', border: '1px solid #ccc' }}
                   />
                 </div>
                 
                 <div style={{ marginBottom: '1rem' }}>
                   <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.3rem', color: '#555' }}>
                     解答 (LaTeX):
                   </label>
                   <textarea
                     value={editForm.answer_latex}
                     onChange={(e) => handleChange('answer_latex', e.target.value)}
                     style={{ width: '100%', minHeight: '60px', padding: '8px', fontSize: '0.9rem', fontFamily: 'monospace', borderRadius: '4px', border: '1px solid #ccc' }}
                   />
                 </div>
                 
                 <div style={{ marginBottom: '1rem' }}>
                   <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.3rem', color: '#555' }}>
                     解説 (LaTeX):
                   </label>
                   <textarea
                     value={editForm.explanation_latex || ''}
                     onChange={(e) => handleChange('explanation_latex', e.target.value)}
                     style={{ width: '100%', minHeight: '80px', padding: '8px', fontSize: '0.9rem', fontFamily: 'monospace', borderRadius: '4px', border: '1px solid #ccc' }}
                   />
                 </div>

                 <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                   <button 
                     onClick={cancelEdit}
                     style={{
                       padding: '6px 12px',
                       background: '#eee',
                       color: '#333',
                       border: '1px solid #ccc',
                       borderRadius: '4px',
                       cursor: 'pointer'
                     }}
                   >
                     キャンセル
                   </button>
                   <button 
                     onClick={saveEdit}
                     style={{
                       padding: '6px 16px',
                       background: '#4CAF50',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       cursor: 'pointer',
                       fontWeight: 'bold'
                     }}
                   >
                     保存
                   </button>
                 </div>
               </div>
            ) : (
                // View Mode
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 'bold', minWidth: '3rem', color: '#0070f3' }}>({idx + 1})</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                            onClick={() => startEdit(idx, prob)}
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
                            編集
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
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

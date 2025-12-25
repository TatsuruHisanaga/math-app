import { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '@/styles/Home.module.css';

// Type definitions matching backend
type Unit = { id: string; title_ja: string };
type UnitMap = { units: Record<string, Unit> };

export default function Home() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string[]>(['L1']);
  const [count, setCount] = useState<number>(10);
  const [options, setOptions] = useState({
    stumblingBlock: false,
    moreWorkSpace: false,
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  // Load basic unit data (mock or verify from public json?)
  // Ideally we use getStaticProps, but for MVP let's hardcode or fetch.
  // Since we have data/unit_map.json, we can import it if we move it to public or import in getStaticProps.
  // For now, let's just hardcode the list for the UI to be fast, or fetch from a simple API if we had one.
  // I'll fetch from a new lightweight API strictly for UI data, or just inline it in getStaticProps.
  
  // Let's use useEffect to fetch from a data endpoint? Or just hardcode for MVP speed.
  // Hardcoding the list for now based on the spec to avoid extra API route.
  const UNIT_LIST = [
    { id: 'u1', title: '正負・分数の計算' },
    { id: 'u2', title: '文字式の計算' },
    { id: 'u3', title: '指数法則' },
    { id: 'u4', title: '平方根' },
    { id: 'u5', title: '整式の計算（展開）' },
    { id: 'u6', title: '因数分解' },
    { id: 'u7', title: '一次方程式' },
    { id: 'u8', title: '二次方程式' },
  ];

  const [mode, setMode] = useState<'TEMPLATE' | 'AI'>('TEMPLATE');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<number[]>([]);

  const handleGenerate = async () => {
    if (selectedUnits.length === 0) {
      setError('単元を選択してください');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      let body: any = {

          units: selectedUnits,
          difficulties: difficulty,
          count,
          options
      };

      if (mode === 'AI') {
          // Map candidates back to Question format
          if (selectedCandidates.length === 0) {
              setError('候補を選択してください');
              setLoading(false);
              return;
          }
          const questions = selectedCandidates.map(idx => {
              const c = candidates[idx];
              // Find unit title
              const uTitle = UNIT_LIST.find(u => u.id === c.unit_id)?.title || c.unit_id;
              return {
                  id: `ai_${idx}`,
                  template_id: 'ai_generated',
                  unit_id: c.unit_id,
                  unit_title: uTitle,
                  stem_latex: c.stem_latex,
                  answer_latex: c.answer_latex,
                  explanation_latex: c.explanation_latex,
                  hint_latex: c.hint_latex,
                  common_mistake_latex: c.common_mistake_latex
              };
          });
          body = {
              ...body,
              providedQuestions: questions
          };
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Generation failed');
      }

      // Handle file download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Construct filename from units and difficulty
      const unitNames = selectedUnits
        .map(id => UNIT_LIST.find(u => u.id === id)?.title ?? id)
        .join('_');
      const diffStr = difficulty.join('');
      const dateStr = new Date().toISOString().slice(0,10);
      
      // Sanitize
      const safeName = `${unitNames}_${diffStr}_${dateStr}`.replace(/[\\/:*?"<>|]/g, '');
      
      a.download = `${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUnit = (id: string) => {
    setSelectedUnits(prev => 
      prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]
    );
  };

  const toggleDifficulty = (d: string) => {
     setDifficulty(prev =>
        prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
     );
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Math Exercise Generator</title>
        <meta name="description" content="Generate Math PDFs with LaTeX" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>数学演習テスト生成 (MVP)</h1>

        <div style={{display: 'flex', gap: '1rem', marginBottom: '2rem', justifyContent: 'center'}}>
            <button 
                onClick={() => setMode('TEMPLATE')}
                style={{
                    padding: '0.5rem 1rem', 
                    background: mode === 'TEMPLATE' ? '#0070f3' : '#eee',
                    color: mode === 'TEMPLATE' ? '#fff' : '#000',
                    border: 'none', borderRadius: '4px'
                }}
            >
                テンプレート生成
            </button>
            <button 
                onClick={() => setMode('AI')}
                style={{
                    padding: '0.5rem 1rem', 
                    background: mode === 'AI' ? '#0070f3' : '#eee',
                    color: mode === 'AI' ? '#fff' : '#000',
                    border: 'none', borderRadius: '4px'
                }}
            >
                 AI生成 (β)
            </button>
        </div>

        <section className={styles.section}>
          <h2>1. 単元選択</h2>
          <div className={styles.grid}>
            {UNIT_LIST.map(u => (
              <button
                key={u.id}
                className={`${styles.card} ${selectedUnits.includes(u.id) ? styles.active : ''}`}
                onClick={() => toggleUnit(u.id)}
              >
                {u.title}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2>2. 難易度 & 設定</h2>
          <div className={styles.row}>
             <div>
                <h3>難易度</h3>
                {['L1', 'L2', 'L3'].map(d => (
                    <label key={d} className={styles.checkbox}>
                        <input 
                            type="checkbox" 
                            checked={difficulty.includes(d)} 
                            onChange={() => toggleDifficulty(d)}
                        /> {d}
                    </label>
                ))}
            </div>
            <div>
                <h3>問題数 ({count})</h3>
                <input 
                    type="range" min="5" max="30" 
                    value={count} onChange={(e) => setCount(Number(e.target.value))} 
                />
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2>3. オプション</h2>
          <label className={styles.checkboxBlock}>
            <input 
                type="checkbox" 
                checked={options.stumblingBlock} 
                onChange={e => setOptions({...options, stumblingBlock: e.target.checked})}
            />
            つまずき補助 (30% 前提単元を混入)
          </label>
          <label className={styles.checkboxBlock}>
            <input 
                type="checkbox" 
                checked={options.moreWorkSpace} 
                onChange={e => setOptions({...options, moreWorkSpace: e.target.checked})}
            />
            途中式欄多め
          </label>
        </section>

        <div className={styles.actions}>
             {error && <p className={styles.error}>{error}</p>}
             
             {mode === 'TEMPLATE' && (
                <button 
                    className={styles.generateButton} 
                    onClick={handleGenerate} 
                    disabled={loading || selectedUnits.length === 0}
                >
                    PDFを作成する
                </button>
             )}

             {mode === 'AI' && (
                 <div style={{width: '100%'}}>
                     <button
                        className={styles.generateButton}
                        style={{background: '#28a745', marginBottom: '2rem'}}
                        onClick={async () => {
                             if (selectedUnits.length === 0) {
                                setError('単元を選択してください');
                                return;
                             }
                             setLoading(true);
                             setProgress('AI生成を開始します...');
                             setError('');
                             try {
                                 const res = await fetch('/api/generate_ai', {
                                     method: 'POST',
                                     headers: { 'Content-Type': 'application/json' },
                                     body: JSON.stringify({
                                         units: selectedUnits,
                                         difficulty: difficulty[0] || 'L1', // AI only supports single diff for now
                                         count
                                     })
                                 });
                                 
                                 if (!res.ok) throw new Error('AI Generation failed');
                                 
                                 // Handle streaming response
                                 const reader = res.body?.getReader();
                                 if (!reader) throw new Error('ReadableStream not supported');
                                 
                                 const decoder = new TextDecoder();
                                 let buffer = '';
                                 let collectedProblems: any[] = []; // Rename to avoid confusion

                                 while (true) {
                                     const { done, value } = await reader.read();
                                     if (done) break;
                                     
                                     buffer += decoder.decode(value, { stream: true });
                                     const lines = buffer.split('\n\n');
                                     
                                     // Handle incomplete buffer logic properly
                                     // If last item is empty string (caused by trailing \n\n), pop it.
                                     // If not empty, it's incomplete chunk, save back to buffer.
                                     // Wait, standard SSE ends with \n\n. split result will have empty string at end.
                                     
                                     // BUT: If the chunk ended exactly at \n\n, lines will have empty string at end.
                                     // If chunk ended in middle, last element is partial.
                                     // We need to be careful.
                                     // Let's assume standard behavior:
                                     
                                     buffer = lines.pop() || ''; 
                                     
                                     for (const line of lines) {
                                         if (line.trim().startsWith('data: ')) {
                                             try {
                                                 const jsonStr = line.trim().substring(6);
                                                 const data = JSON.parse(jsonStr);
                                                 
                                                 if (data.type === 'progress') {
                                                     setProgress(`生成中: ${data.count} / ${data.total} 問完了`);
                                                 } else if (data.type === 'complete') {
                                                     collectedProblems = data.problems;
                                                 } else if (data.type === 'error') {
                                                     throw new Error(data.message);
                                                 }
                                             } catch (parseError) {
                                                 console.error('JSON Parse Error:', parseError, line);
                                             }
                                         }
                                     }
                                 }
                                 
                                 // Fallback check if buffer has remaining data
                                 if (buffer.trim().startsWith('data: ')) {
                                      try {
                                         const data = JSON.parse(buffer.trim().substring(6));
                                         if (data.type === 'complete') {
                                             collectedProblems = data.problems;
                                         }
                                      } catch (e) { console.error('Final buffer parse error', e); }
                                 }

                                 if (collectedProblems.length === 0) {
                                     throw new Error('生成された問題がありませんでした。APIキーや設定を確認してください。');
                                 }

                                 setCandidates(collectedProblems);
                                 setSelectedCandidates(collectedProblems.map((_: any, i: number) => i)); 
                             } catch(e: any) {
                                 setError(e.message);
                             } finally {
                                 setLoading(false);
                                 setProgress('');
                             }
                        }}
                        disabled={loading || selectedUnits.length === 0}
                     >
                         AI候補を生成
                     </button>

                     {candidates.length > 0 && (
                         <div style={{textAlign: 'left', marginBottom: '2rem'}}>
                             <h3>生成候補 (確認して選択)</h3>
                             {candidates.map((c, i) => (
                                 <div key={i} style={{border: '1px solid #ccc', padding: '1rem', marginBottom: '0.5rem', borderRadius: '4px'}}>
                                     <label style={{display: 'flex', gap: '1rem'}}>
                                         <input 
                                            type="checkbox" 
                                            checked={selectedCandidates.includes(i)}
                                            onChange={() => {
                                                setSelectedCandidates(prev => 
                                                    prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                                                );
                                            }}
                                         />
                                         <div style={{flex: 1}}>
                                             <div><strong>問題:</strong> {c.stem_latex}</div>
                                             <div><strong>解答:</strong> {c.answer_latex}</div>
                                             {c.explanation_latex && (
                                                 <div style={{marginTop: '0.5rem', fontSize: '0.9rem', color: '#28a745'}}>
                                                     ✓ 解説あり
                                                 </div>
                                             )}
                                         </div>
                                     </label>
                                 </div>
                             ))}
                             
                             <button 
                                className={styles.generateButton}
                                onClick={handleGenerate}
                                disabled={selectedCandidates.length === 0 || loading}
                             >
                                 選択した問題でPDFを作成
                             </button>
                         </div>
                     )}
                 </div>
             )}
        </div>
      </main>

      {(loading || error) && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            {loading ? (
                <>
                    <div className={styles.spinner}></div>
                    <p>{progress || 'PDFを生成中...'}</p>
                    <p style={{fontSize: '0.9rem', color: '#666'}}>
                        {progress ? 'AIが問題を生成・検証しています。' : '数式をLaTeXで組版しています。'}<br/>
                        ※初回はフォントキャッシュ生成のため数分かかる場合があります。
                    </p>
                </>
            ) : (
                <>
                    <p style={{color: 'red', fontWeight: 'bold'}}>生成エラー</p>
                    <div style={{
                        textAlign: 'left', 
                        background: '#f8d7da', 
                        color: '#721c24', 
                        padding: '1rem', 
                        borderRadius: '4px',
                        maxHeight: '300px',
                        overflow: 'auto',
                        fontSize: '0.8rem',
                        whiteSpace: 'pre-wrap'
                    }}>
                        {error}
                    </div>
                    <button 
                        className={styles.generateButton}
                        style={{padding: '0.5rem 1rem', fontSize: '1rem', marginTop: '1rem'}}
                        onClick={() => setError('')}
                    >
                        閉じる
                    </button>
                </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

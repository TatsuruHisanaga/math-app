import { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '@/styles/Home.module.css';
import confetti from 'canvas-confetti';
import { saveAs } from 'file-saver';

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
  const [aiModel, setAiModel] = useState<'gpt-4o' | 'gpt-4o-mini'>('gpt-4o');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Expanded Unit List with categories
  const CURRICULUM = [
    {
      subject: '数学I',
      units: [
        { id: 'm1_shiki', title: '数と式' },
        { id: 'm1_shugo', title: '集合と命題' },
        { id: 'm1_2ji_func', title: '2次関数' },
        { id: 'm1_trig', title: '図形と計量' },
        { id: 'm1_data', title: 'データの分析' },
      ]
    },
    {
      subject: '数学A',
      units: [
        { id: 'ma_baai', title: '場合の数と確率' },
        { id: 'ma_seishitsu', title: '整数の性質' },
        { id: 'ma_zukei', title: '図形の性質' },
      ]
    },
    {
      subject: '数学II',
      units: [
        { id: 'm2_shiki_shomei', title: '式と証明' },
        { id: 'm2_fuku_2ji', title: '複素数と方程式' },
        { id: 'm2_zukei_hoteishiki', title: '図形と方程式' },
        { id: 'm2_sankaku', title: '三角関数' },
        { id: 'm2_shisu_taisu', title: '指数・対数関数' },
        { id: 'm2_bibun_sekibun', title: '微分法・積分法' },
      ]
    },
    {
      subject: '数学B',
      units: [
        { id: 'mb_suiretsu', title: '数列' },
        { id: 'mb_toukei', title: '統計的な推測' },
      ]
    },
    {
      subject: '数学C',
      units: [
        { id: 'mc_vector', title: 'ベクトル' },
        { id: 'mc_kyokusen', title: '平面曲線・複素数平面' },
      ]
    },
    {
      subject: '数学III',
      units: [
        { id: 'm3_kyukan', title: '極限' },
        { id: 'm3_bibun', title: '微分法' },
        { id: 'm3_sekibun', title: '積分法' },
      ]
    }
  ];

  // Flat list for lookups
  const ALL_UNITS = CURRICULUM.flatMap(cat => cat.units);

  const handleAutoGenerate = async () => {
    if (selectedUnits.length === 0) {
      setError('単元を選択してください');
      return;
    }
    setLoading(true);
    setProgress('AI生成を開始します...');
    setError('');
    setShowSuccess(false);

    try {
      // 1. AI Generation
      const res = await fetch('/api/generate_ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          units: selectedUnits,
          difficulty: difficulty[0] || 'L1',
          count,
          aiModel
        })
      });

      if (!res.ok) throw new Error('AI Generation failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported');

      const decoder = new TextDecoder();
      let buffer = '';
      let collectedProblems: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            try {
              const jsonStr = line.trim().substring(6);
              const data = JSON.parse(jsonStr);

              if (data.type === 'progress') {
                setProgress(`AI生成中: ${data.count} / ${data.total} 問完了`);
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

      if (collectedProblems.length === 0) {
        throw new Error('生成された問題がありませんでした。');
      }

      // 2. PDF Generation
      setProgress('PDFファイルを作成中...');
      const pdfRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providedQuestions: collectedProblems.map((p, idx) => ({
            ...p,
            id: `ai_${idx}`,
            unit_title: ALL_UNITS.find(u => u.id === p.unit_id)?.title || p.unit_id
          })),
          units: selectedUnits,
          difficulties: difficulty,
          count: collectedProblems.length,
          options
        })
      });

      if (!pdfRes.ok) throw new Error('PDF Creation failed');

      const blob = await pdfRes.blob();
      const unitNames = selectedUnits
        .map(id => ALL_UNITS.find(u => u.id === id)?.title ?? id)
        .join('_');
      saveAs(blob, `AI_Math_${unitNames}_${new Date().toISOString().slice(0, 10)}.pdf`);

      // 3. Success
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
      setShowSuccess(true);
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleGenerate = async () => {
    if (selectedUnits.length === 0) {
      setError('単元を選択してください');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          units: selectedUnits,
          difficulties: difficulty,
          count,
          options
        }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const blob = await res.blob();
      saveAs(blob, `Math_Exercise_${new Date().toISOString().slice(0, 10)}.pdf`);
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
        <h1 className={styles.title}>数学演習プリント生成</h1>

        <div className={styles.header}>
          <p>AIがレベルに合わせた問題を自動生成します</p>
        </div>

        <section className={styles.section}>
          <h2>1. 単元選択</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {CURRICULUM.map(cat => (
              <div key={cat.subject}>
                <h3 style={{ marginBottom: '0.5rem', color: '#666', fontSize: '0.9rem' }}>{cat.subject}</h3>
                <div className={styles.grid}>
                  {cat.units.map(u => (
                    <button
                      key={u.id}
                      className={`${styles.card} ${selectedUnits.includes(u.id) ? styles.active : ''}`}
                      onClick={() => toggleUnit(u.id)}
                    >
                      {u.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2>2. 難易度 & 設定</h2>
          <div className={styles.row}>
            <div>
              <h3>難易度</h3>
              {[
                { id: 'L1', label: '基礎' },
                { id: 'L2', label: '標準' },
                { id: 'L3', label: '発展' }
              ].map(d => (
                <label key={d.id} className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={difficulty.includes(d.id)}
                    onChange={() => toggleDifficulty(d.id)}
                  /> {d.label}
                </label>
              ))}
            </div>
            <div>
              <h3>問題数 ({count})</h3>
              <input
                type="range" min="3" max="30"
                value={count} onChange={(e) => setCount(Number(e.target.value))}
              />
            </div>
            <div>
              <h3>AIモデル</h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label className={styles.checkbox}>
                    <input
                      type="radio"
                      checked={aiModel === 'gpt-4o'}
                      onChange={() => setAiModel('gpt-4o')}
                    /> 高品質 (gpt-4o)
                  </label>
                  <label className={styles.checkbox}>
                    <input
                      type="radio"
                      checked={aiModel === 'gpt-4o-mini'}
                      onChange={() => setAiModel('gpt-4o-mini')}
                    /> 高速 (gpt-4o-mii)
                  </label>
                </div>
              </div>
          </div>
        </section>

        <div className={styles.actions}>
            <button
              className={styles.generateButton}
              onClick={handleAutoGenerate}
              disabled={loading || selectedUnits.length === 0}
            >
              {loading ? '生成中...' : 'AIでPDFを自動作成'}
            </button>
        </div>
      </main>

      {(loading || progress || error) && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            {loading ? (
              <>
                <div className={styles.spinner}></div>
                <h3>{progress || '処理中...'}</h3>
                <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '1rem' }}>
                  AIが問題を生成・検証し、PDFを作成しています。<br />
                  少々お待ちください。
                </p>
              </>
            ) : error ? (
              <>
                <p style={{ color: 'red', fontWeight: 'bold' }}>生成エラー</p>
                <div style={{
                  textAlign: 'left',
                  background: '#f8d7da',
                  color: '#721c24',
                  padding: '1rem',
                  borderRadius: '4px',
                  maxHeight: '300px',
                  overflow: 'auto',
                  fontSize: '0.8rem',
                  whiteSpace: 'pre-wrap',
                  marginTop: '1rem'
                }}>
                  {error}
                </div>
                <button
                  className={styles.generateButton}
                  style={{ marginTop: '1rem' }}
                  onClick={() => setError('')}
                >
                  閉じる
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {showSuccess && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ textAlign: 'center' }}>
            <h2 style={{ color: '#28a745', marginBottom: '1rem' }}>🎉 PDFを作成しました！</h2>
            <p>ダウンロードが開始されます。</p>
            <button
              className={styles.generateButton}
              onClick={() => setShowSuccess(false)}
              style={{ marginTop: '1.5rem' }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

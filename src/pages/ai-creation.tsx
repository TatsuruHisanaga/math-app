import { useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/AiCreation.module.css';
import commonStyles from '@/styles/Home.module.css'; // Reuse some global styles
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';

interface AIProblem {
    stem_latex: string;
    answer_latex: string;
    explanation_latex: string;
    difficulty: string;
}

export default function AiCreation() {
    const [prompt, setPrompt] = useState('');
    const [count, setCount] = useState(5);
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState('');
    const [results, setResults] = useState<AIProblem[]>([]);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);

            newFiles.forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (rev) => {
                        setPreviews(prev => [...prev, rev.target?.result as string]);
                    };
                    reader.readAsDataURL(file);
                } else {
                    // For PDFs or others, just a placeholder
                    setPreviews(prev => [...prev, '/pdf-icon.png']); // Or something similar
                }
            });
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleGenerate = async () => {
        if (!prompt && files.length === 0) {
            setError('プロンプトを入力するか、ファイルをアップロードしてください。');
            return;
        }

        setLoading(true);
        setError('');
        setResults([]);
        setProgress('AIがリクエストを解析中...');

        try {
            const formData = new FormData();
            formData.append('prompt', prompt);
            formData.append('count', count.toString());
            files.forEach(file => {
                formData.append('files', file);
            });

            const res = await fetch('/api/generate_from_prompt', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('AI生成に失敗しました。');

            const reader = res.body?.getReader();
            if (!reader) throw new Error('ReadableStream not supported');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim().startsWith('data: ')) {
                        const data = JSON.parse(line.trim().substring(6));
                        if (data.type === 'progress') {
                            setProgress(`検証中: ${data.count} / ${data.total} 問完了`);
                        } else if (data.type === 'complete') {
                            setResults(data.problems);
                            confetti({
                                particleCount: 100,
                                spread: 70,
                                origin: { y: 0.6 }
                            });
                        } else if (data.type === 'error') {
                            throw new Error(data.message);
                        }
                    }
                }
            }
        } catch (e: any) {
            setError(e.message || 'エラーが発生しました');
        } finally {
            setLoading(false);
            setProgress('');
        }
    };

    const handleExportPdf = async () => {
        if (results.length === 0) return;
        
        setLoading(true);
        setProgress('PDFを作成中...');
        
        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    providedQuestions: results.map((p, idx) => ({
                        ...p,
                        id: `ai_prompt_${idx}`,
                        unit_title: 'AI生成問題'
                    })),
                    units: ['ai_prompt'],
                    difficulties: ['L1', 'L2', 'L3'],
                    count: results.length,
                    options: { stumblingBlock: false, moreWorkSpace: false }
                })
            });

            if (!res.ok) throw new Error('PDF作成に失敗しました');

            const blob = await res.blob();
            saveAs(blob, `AI_Generated_Math_${new Date().toISOString().slice(0,10)}.pdf`);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
            setProgress('');
        }
    };

    return (
        <div className={styles.container}>
            <Head>
                <title>AI問題作成 - Math Exercise Generator</title>
            </Head>

            <main className={styles.main}>
                <div className={styles.header}>
                    <Link href="/" className={styles.backLink}>
                        ← トップへ戻る
                    </Link>
                    <h1>AI自由記述・ファイル作成</h1>
                    <div></div>
                </div>

                <div className={styles.chatContainer}>
                    <div className={styles.inputArea}>
                        <label className={styles.label}>AIへの指示 (ChatGPTのように具体的な要望を伝えてください)</label>
                        <textarea 
                            className={styles.textarea}
                            placeholder="例: 中学3年生レベルの因数分解の問題を5問作ってください。特にたすき掛けを使うものを中心に。"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        />

                        <div className={styles.fileControls}>
                            <button 
                                className={styles.fileLabel}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                📎 ファイルを添付 (画像/PDF)
                            </button>
                            <input 
                                type="file"
                                ref={fileInputRef}
                                className={styles.fileInput}
                                onChange={handleFileChange}
                                multiple
                                accept="image/*,application/pdf"
                            />
                            
                            <div className={styles.problemCount}>
                                <span>問題数:</span>
                                <input 
                                    type="number" 
                                    min="1" max="20"
                                    value={count}
                                    onChange={(e) => setCount(parseInt(e.target.value))}
                                />
                            </div>
                        </div>

                        {previews.length > 0 && (
                            <div className={styles.previewArea}>
                                {previews.map((src, i) => (
                                    <div key={i} className={styles.previewItem}>
                                        {src.startsWith('/') ? (
                                            <div style={{ padding: '5px', fontSize: '10px' }}>{files[i].name}</div>
                                        ) : (
                                            <img src={src} alt="preview" />
                                        )}
                                        <button className={styles.removeFile} onClick={() => removeFile(i)}>×</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className={styles.actions}>
                            <button 
                                className={commonStyles.generateButton}
                                onClick={handleGenerate}
                                disabled={loading}
                            >
                                {loading ? '作成中...' : 'AIに問題を頼む'}
                            </button>
                        </div>
                    </div>
                </div>

                {error && <div className={commonStyles.error} style={{ textAlign: 'center' }}>{error}</div>}

                {results.length > 0 && (
                    <div className={styles.resultContainer}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2>生成された問題 ({results.length}問)</h2>
                            <button 
                                className={commonStyles.generateButton}
                                onClick={handleExportPdf}
                                style={{ padding: '0.6rem 2rem', fontSize: '1rem' }}
                            >
                                PDFとしてダウンロード
                            </button>
                        </div>
                        <div className={styles.resultList}>
                            {results.map((p, i) => (
                                <div key={i} className={styles.problemCard}>
                                    <div className={styles.problemHeader}>
                                        <span style={{ fontWeight: 'bold' }}>問題 {i + 1}</span>
                                        <span style={{ fontSize: '0.8rem', color: '#888' }}>
                                            難易度: {p.difficulty}
                                        </span>
                                    </div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <span className={styles.label}>問題文</span>
                                        <div className={styles.latexBox}>{p.stem_latex}</div>
                                    </div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <span className={styles.label}>正解と解説</span>
                                        <div className={styles.latexBox}>{p.answer_latex}</div>
                                    </div>
                                    {p.explanation_latex && (
                                        <div>
                                            <span className={styles.label}>追加解説</span>
                                            <div style={{ fontSize: '0.9rem', color: '#444' }}>{p.explanation_latex}</div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {loading && (
                <div className={commonStyles.modalOverlay}>
                    <div className={commonStyles.modalContent}>
                        <div className={commonStyles.characterWrapper}>
                            <div className={commonStyles.characterBody}></div>
                            <div className={commonStyles.leftLeg}></div>
                            <div className={commonStyles.rightLeg}></div>
                        </div>
                        <h3>{progress || '処理中...'}</h3>
                        <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '1rem' }}>
                            AIが内容を理解し、数学的に正しい問題を生成しています。<br />
                            数分かかる場合があります。
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

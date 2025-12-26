import { useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/AiCreation.module.css';
import commonStyles from '@/styles/Home.module.css'; // Reuse some global styles
import confetti from 'canvas-confetti';
import LatexRenderer from '@/components/LatexRenderer';

interface AIProblem {
    stem_latex: string;
    answer_latex: string;
    explanation_latex: string;
    difficulty: string;
    hints?: string[];
}

export default function AiCreation() {
    const [prompt, setPrompt] = useState('');
    const [count, setCount] = useState(5);
    const [autoCount, setAutoCount] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState('');
    const [results, setResults] = useState<AIProblem[]>([]);
    const [intent, setIntent] = useState('');
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [teachingAssistantMode, setTeachingAssistantMode] = useState(false);
    
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
                    setPreviews(prev => [...prev, '/pdf-icon.png']); 
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
        setIntent('');
        setPdfUrl(null);
        setProgress('AIがリクエストを解析中...');

        try {
            const formData = new FormData();
            formData.append('prompt', prompt);
            formData.append('count', count.toString());
            formData.append('autoCount', autoCount.toString());
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
                        if (data.type === 'complete') {
                            setResults(data.problems);
                            setIntent(data.intent);
                            await handleExportPdf(data.problems, true);
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

    const downloadCurrentPdf = () => {
        if (!pdfUrl) return;
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = pdfUrl;
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        a.download = `Math_AI_${dateStr}.pdf`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 100);
    };

    const handleExportPdf = async (problems: AIProblem[], autoDownload = true) => {
        if (!problems || problems.length === 0) return;
        
        setLoading(true);
        setProgress('PDFを作成中...');
        
        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    providedQuestions: problems.map((p, idx) => ({
                        ...p,
                        id: `ai_prompt_${idx}`,
                        unit_title: 'AI生成問題'
                    })),
                    units: ['ai_prompt'],
                    difficulties: Array.from(new Set(problems.map(p => p.difficulty))),
                    count: problems.length,
                    options: { 
                        stumblingBlock: false, 
                        moreWorkSpace: false,
                        teachingAssistant: teachingAssistantMode 
                    }
                })
            });

            if (!res.ok) throw new Error('PDF作成に失敗しました');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            setPdfUrl(url);

            if (autoDownload) {
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                a.download = `Math_AI_${dateStr}.pdf`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => document.body.removeChild(a), 100);
            }
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
                    <h1>テキスト・ファイルから問題作成</h1>
                    <div></div>
                </div>

                <div className={styles.chatContainer}>
                    <div className={styles.inputArea}>
                        <p style={{ fontSize: '0.95rem', color: '#666', fontWeight: 'bold', marginBottom: '0.2rem' }}>
                            AIへの指示 (ChatGPTのように具体的な要望を伝えてください)
                        </p>
                        <textarea 
                            className={styles.textarea}
                            placeholder="例: 中学3年生レベルの因数分解の問題を5問作ってください。特にたすき掛けを使うものを中心に。"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        />

                        {previews.length > 0 && (
                            <div className={styles.previewArea}>
                                {previews.map((src, i) => (
                                    <div key={i} className={styles.previewItem}>
                                        {src.startsWith('/') ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '10px', padding: '4px', textAlign: 'center' }}>
                                                <span>📄</span>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{files[i].name}</span>
                                            </div>
                                        ) : (
                                            <img src={src} alt="preview" />
                                        )}
                                        <button className={styles.removeFile} onClick={() => removeFile(i)}>×</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className={styles.controlsRow}>
                            <div className={styles.leftControls}>
                                <div className={styles.fileControls}>
                                    <label className={styles.fileLabel}>
                                        <input 
                                            type="file" 
                                            multiple 
                                            accept="image/*,application/pdf"
                                            className={styles.fileInput}
                                            onChange={handleFileChange}
                                        />
                                        ファイルを選択
                                    </label>
                                </div>
                                
                                <div className={styles.problemCount}>
                                    <span>問題数</span>
                                    <div className={styles.countToggle}>
                                        <div 
                                            className={`${styles.toggleOption} ${autoCount ? styles.toggleOptionActive : ''}`}
                                            onClick={() => setAutoCount(true)}
                                        >
                                            お任せ
                                        </div>
                                        <div 
                                            className={`${styles.toggleOption} ${!autoCount ? styles.toggleOptionActive : ''}`}
                                            onClick={() => setAutoCount(false)}
                                        >
                                            指定
                                        </div>
                                    </div>
                                    <input 
                                        type="number" 
                                        min="1" max="20"
                                        value={count}
                                        disabled={autoCount}
                                        onChange={(e) => setCount(parseInt(e.target.value))}
                                        className={styles.numberInput}
                                    />
                                </div>

                                <div className={styles.teachingAssistantToggle} style={{ marginTop: '1rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={teachingAssistantMode} 
                                            onChange={(e) => setTeachingAssistantMode(e.target.checked)}
                                            style={{ marginRight: '0.5rem', width: '16px', height: '16px' }} 
                                        />
                                        ティーチングアシスタントモード
                                    </label>
                                    <p style={{ fontSize: '0.8rem', color: '#888', marginLeft: '1.6rem', marginTop: '0.2rem' }}>
                                        解説に加え、各問題のヒントステップを掲載した講師用ページを追加します。
                                    </p>
                                </div>
                            </div>

                            <button 
                                className={commonStyles.generateButton}
                                onClick={handleGenerate}
                                disabled={loading || (!prompt && files.length === 0)}
                                style={{ padding: '0.9rem 2.5rem', fontSize: '1.1rem', borderRadius: '14px' }}
                            >
                                {loading ? '分析中...' : 'AIに問題を頼む'}
                            </button>
                        </div>
                    </div>
                </div>

                {error && <div className={commonStyles.error} style={{ textAlign: 'center' }}>{error}</div>}
                {results.length > 0 && (
                    <div className={styles.resultContainer}>
                        <div className={styles.intentBox}>
                            <h3>🎯 出題のねらい・構成</h3>
                            <div style={{ whiteSpace: 'pre-wrap' }}>
                                <LatexRenderer content={intent} />
                            </div>
                        </div>

                        <div className={styles.resultHeader}>
                            <h2>作成された問題 ({results.length}問)</h2>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button 
                                    className={commonStyles.secondaryButton || styles.secondaryButton}
                                    onClick={() => setShowPreview(!showPreview)}
                                    style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem', borderRadius: '10px' }}
                                >
                                    {showPreview ? 'プレビューを閉じる' : 'PDFをプレビュー'}
                                </button>
                                <button 
                                    className={commonStyles.generateButton}
                                    onClick={pdfUrl ? downloadCurrentPdf : () => handleExportPdf(results, true)}
                                    style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem', borderRadius: '10px' }}
                                >
                                    ダウンロード
                                </button>
                            </div>
                        </div>

                        {showPreview && pdfUrl && (
                            <div className={styles.pdfPreviewContainer}>
                                <iframe 
                                    src={`${pdfUrl}#toolbar=0`} 
                                    className={styles.pdfIframe}
                                    title="PDF Preview"
                                />
                            </div>
                        )}
                        
                        <div className={styles.resultList}>
                            {results.map((p, i) => (
                                <div key={i} className={styles.problemCard}>
                                    <div className={styles.problemNumber}>Question {i + 1}</div>
                                    <div className={styles.problemDifficulty}>難易度: {p.difficulty}</div>
                                    <div className={styles.latexPreview}>
                                        <LatexRenderer content={p.stem_latex} />
                                    </div>
                                    <details className={styles.answerDetails}>
                                        <summary>正解と解説を確認</summary>
                                        <div className={styles.answerContent}>
                                            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>【正解】</div>
                                            <div className={styles.latexPreview}>
                                                <LatexRenderer content={p.answer_latex} />
                                            </div>
                                            {p.explanation_latex && (
                                                <>
                                                    <div style={{ fontWeight: 'bold', margin: '1rem 0 0.5rem' }}>【解説】</div>
                                                    <div style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
                                                        <LatexRenderer content={p.explanation_latex} />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </details>
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

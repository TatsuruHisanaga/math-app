import { useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/AiCreation.module.css';
import commonStyles from '@/styles/Home.module.css'; // Reuse some global styles
import confetti from 'canvas-confetti';
import LatexRenderer from '@/components/LatexRenderer';
import ProblemEditList from '@/components/ProblemEditList';

interface AIProblem {
    id: string; // Added for ProblemEditList
    stem_latex: string;
    answer_latex: string;
    explanation_latex: string;
    difficulty: string;
    unit_title?: string;
    unit_id?: string;
    hints?: string[];
    history?: AIProblem; // For undo
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
    // const [intent, setIntent] = useState(''); // Removed Intent
    const [pointReview, setPointReview] = useState(''); 
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    
    // Options
    const [aiModel, setAiModel] = useState<'gpt-5.2' | 'gpt-5-mini'>('gpt-5.2');
    const [moreWorkSpace, setMoreWorkSpace] = useState(false);
    // const [teachingAssistantMode, setTeachingAssistantMode] = useState(false); // Removed/Hidden as per user request to be like index.tsx? User said "like unit selection", index.tsx has options. Let's keep it sync.
    // Actually user said "AI model selection and more work space".

    const [previewModalSrc, setPreviewModalSrc] = useState<string | null>(null);
    
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
            setError('プロンプトを入力するか、画像をアップロードしてください。');
            return;
        }

        setLoading(true);
        setError('');
        setResults([]);
        // setIntent('');
        setPdfUrl(null);
        setProgress('問題を作成中...');

        try {
            const formData = new FormData();
            formData.append('prompt', prompt);
            formData.append('count', count.toString());
            formData.append('autoCount', autoCount.toString());
            formData.append('aiModel', aiModel); // Add Model
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
                            // Process problems to include ID and Unit Title if missing
                            const processedProblems = data.problems.map((p: any, idx: number) => ({
                                ...p,
                                id: `ai_${Date.now()}_${idx}`,
                                unit_title: 'AI生成問題'
                            }));
                            setResults(processedProblems);
                            // setIntent(data.intent);
                            if (data.point_review_latex) {
                                setPointReview(data.point_review_latex);
                            }
                            // Generate PDF but DO NOT download automatically. Show preview.
                            await handleExportPdf(processedProblems, data.point_review_latex, false);
                            setShowPreview(true); // Default show preview
                            
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

    const handleExportPdf = async (problems: AIProblem[], pReview: string | null = null, autoDownload = false) => {
        if (!problems || problems.length === 0) return;
        
        setLoading(true);
        setProgress('PDFを作成中...');
        
        const currentPointReview = pReview !== null ? pReview : pointReview;

        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    providedQuestions: problems.map((p, idx) => ({
                        ...p,
                        id: p.id || `ai_prompt_${idx}`,
                        unit_title: p.unit_title || 'AI生成問題'
                    })),
                    units: ['ai_prompt'],
                    difficulties: Array.from(new Set(problems.map(p => p.difficulty))),
                    count: problems.length,
                    pointReview: currentPointReview,
                    options: { 
                        stumblingBlock: false, 
                        moreWorkSpace: moreWorkSpace,
                        teachingAssistant: false 
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
                    <h1>テキスト / 画像から問題を作成</h1>
                    <div></div>
                </div>

                <div className={styles.chatContainer}>
                    <div className={styles.inputArea}>
                        <p style={{ fontSize: '0.95rem', color: '#666', fontWeight: 'bold', marginBottom: '0.2rem' }}>
                            AIへの指示
                        </p>
                        <textarea 
                            className={styles.textarea}
                            placeholder="例: 因数分解の問題を作ってください。特にたすき掛けを使うものを中心に。"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        />

                        {previews.length > 0 && (
                            <div className={styles.previewArea} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '8px' }}>
                                {previews.map((src, i) => (
                                    <div 
                                        key={i} 
                                        className={styles.previewChip}
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            background: 'white', 
                                            padding: '4px 8px', 
                                            borderRadius: '16px', 
                                            border: '1px solid #ddd',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => setPreviewModalSrc(src)}
                                    >
                                        <span style={{ marginRight: '6px' }}>📷</span>
                                        <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {files[i].name}
                                        </span>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                                            style={{ 
                                                marginLeft: '6px', 
                                                border: 'none', 
                                                background: 'transparent', 
                                                color: '#999', 
                                                cursor: 'pointer',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            ×
                                        </button>
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
                                            accept="image/*"
                                            className={styles.fileInput}
                                            onChange={handleFileChange}
                                        />
                                        画像を選択
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
                            </div>
                            
                            {/* Options Row */}
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', width: '100%', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#555' }}>AIモデル:</label>
                                    <select 
                                        value={aiModel} 
                                        onChange={(e) => setAiModel(e.target.value as any)}
                                        style={{ padding: '6px', borderRadius: '6px', border: '1px solid #ccc', background: 'white' }}
                                    >
                                        <option value="gpt-5.2">GPT-5.2 (高品質)</option>
                                        <option value="gpt-5-mini">GPT-5 Mini (高速)</option>
                                    </select>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={moreWorkSpace}
                                            onChange={(e) => setMoreWorkSpace(e.target.checked)}
                                            style={{ marginRight: '6px' }}
                                        />
                                        計算スペースを広くする
                                    </label>
                                </div>
                            </div>

                            <button 
                                className={commonStyles.generateButton}
                                onClick={handleGenerate}
                                disabled={loading || (!prompt && files.length === 0)}
                                style={{ padding: '0.9rem 2.5rem', fontSize: '1.1rem', borderRadius: '14px' }}
                            >
                                {loading ? '作成中...' : 'AIに問題を頼む'}
                            </button>
                        </div>
                    </div>
                </div>

                {error && <div className={commonStyles.error} style={{ textAlign: 'center' }}>{error}</div>}
                {results.length > 0 && (
                    <div className={styles.resultContainer}>


                        <div className={styles.resultHeader} style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem', marginTop: '2rem' }}>
                            <button 
                                className={commonStyles.card || styles.secondaryButton} 
                                onClick={() => setShowPreview(!showPreview)}
                                style={{ padding: '0.8rem 2rem', fontWeight: 'bold' }}
                            >
                                {showPreview ? 'プレビューを隠す' : 'PDFプレビューを表示'}
                            </button>
                            <button 
                                className={commonStyles.generateButton}
                                onClick={pdfUrl ? downloadCurrentPdf : () => handleExportPdf(results, pointReview, true)}
                            >
                                PDFをダウンロード
                            </button>
                        </div>

                        {showPreview && pdfUrl && (
                            <div style={{ width: '100%', height: '600px', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', marginBottom: '2rem' }}>
                                <iframe 
                                    src={`${pdfUrl}#toolbar=0`} 
                                    style={{ width: '100%', height: '100%', border: 'none' }}
                                    title="PDF Preview"
                                />
                            </div>
                        )}
                        
                        
                        <div className={styles.resultList}>
                             <ProblemEditList 
                                problems={results as any} 
                                onDelete={(index) => {
                                    if (confirm('この問題を削除しますか？')) {
                                        setResults(prev => prev.filter((_, i) => i !== index));
                                    }
                                }}
                                onUpdate={(index, updated) => {
                                    setResults(prev => prev.map((p, i) => i === index ? updated as AIProblem : p));
                                }}
                                onRequestPDFUpdate={() => {
                                    handleExportPdf(results, pointReview, false);
                                    // Trigger preview open if closed
                                    if (!showPreview) setShowPreview(true);
                                }}
                             />
                             
                             <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                                <button
                                    onClick={() => {
                                        handleExportPdf(results, pointReview, true);
                                    }}
                                    style={{
                                        padding: '12px 24px',
                                        fontSize: '1.1rem',
                                        fontWeight: 'bold',
                                        color: 'white',
                                        background: '#FF9800',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    🔄 PDFを更新する
                                </button>
                                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                    ※編集・削除を反映して新しいPDFを作成します
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Image Preview Modal */}
            {previewModalSrc && (
                <div 
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.8)', zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer'
                    }}
                    onClick={() => setPreviewModalSrc(null)}
                >
                    <img 
                        src={previewModalSrc} 
                        alt="preview" 
                        style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px' }} 
                    />
                </div>
            )}

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
AIが問題を生成・検証し、PDFを作成しています。
                            数分かかる場合があります。
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

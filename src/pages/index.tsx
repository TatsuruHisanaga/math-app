import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import styles from '@/styles/Home.module.css';
import confetti from 'canvas-confetti';
import { saveAs } from 'file-saver';
import Link from 'next/link';
import LatexRenderer from '@/components/LatexRenderer'; // Import LatexRenderer
import ProblemEditList from '@/components/ProblemEditList'; // Import ProblemEditList

// Type definitions matching backend
type Topic = { id: string; title: string };
type SubUnit = { id: string; title: string; topics?: Topic[] };
type Unit = { id: string; title: string; subUnits?: SubUnit[] };
type UnitMap = { units: Record<string, Unit> };

export default function Home() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Record<string, string[]>>({});
  const [generatedProblems, setGeneratedProblems] = useState<any[]>([]); // New state
  const [pointReview, setPointReview] = useState<string>(''); // New state for Point Review
  const [difficulty, setDifficulty] = useState<string[]>(['L1']);
  /* Options */
  const [count, setCount] = useState<number>(10);
  const [options, setOptions] = useState({
    stumblingBlock: true, // Default to true as requested
    moreWorkSpace: false,
  });
  const [aiModel, setAiModel] = useState<'gpt-5.2' | 'gpt-5-mini'>('gpt-5.2');
  const [additionalRequest, setAdditionalRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [intent, setIntent] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  
  // File Upload State
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [previewModalSrc, setPreviewModalSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expanded Unit List with categories
  const CURRICULUM: { subject: string; units: Unit[] }[] = [
    {
      subject: '数学I',
      units: [
        { 
            id: 'm1_shiki', 
            title: '数と式',
            subUnits: [
                { id: 'm1_shiki_poly', title: '整式の計算', topics: [
                    { id: 'm1_shiki_poly_1', title: '加法・減法・乗法' },
                    { id: 'm1_shiki_poly_2', title: '因数分解' }
                ]},
                { id: 'm1_shiki_real', title: '実数', topics: [
                    { id: 'm1_shiki_real_1', title: '実数・根号計算' },
                    { id: 'm1_shiki_real_2', title: '1次不等式' },
                    { id: 'm1_shiki_real_3', title: '絶対値' }
                ]}
            ] 
        },
        { 
            id: 'm1_shugo', 
            title: '集合と命題',
            subUnits: [
                { id: 'm1_shugo_set', title: '集合', topics: [
                    { id: 'm1_shugo_set_1', title: '集合の要素・包含' },
                    { id: 'm1_shugo_set_2', title: '共通部分・和集合' }
                ]},
                { id: 'm1_shugo_prop', title: '命題', topics: [
                    { id: 'm1_shugo_prop_1', title: '命題と条件' },
                    { id: 'm1_shugo_prop_2', title: '必要・十分条件' },
                    { id: 'm1_shugo_prop_3', title: '逆・裏・対偶' }
                ]}
            ]
        },
        { 
            id: 'm1_2ji_func', 
            title: '2次関数',
            subUnits: [
                { id: 'm1_2ji_graph', title: '2次関数のグラフ', topics: [
                    { id: 'm1_2ji_graph_1', title: 'グラフと平行移動' },
                    { id: 'm1_2ji_graph_2', title: '最大・最小' }
                ]},
                { id: 'm1_2ji_eq', title: '方程式・不等式', topics: [
                    { id: 'm1_2ji_eq_1', title: '2次方程式' },
                    { id: 'm1_2ji_eq_2', title: 'グラフとx軸の共有点' },
                    { id: 'm1_2ji_eq_3', title: '2次不等式' }
                ]}
            ]
        },
        { 
            id: 'm1_trig', 
            title: '図形と計量',
            subUnits: [
                { id: 'm1_trig_ratio', title: '三角比', topics: [
                    { id: 'm1_trig_ratio_1', title: '三角比の定義' },
                    { id: 'm1_trig_ratio_2', title: '相互関係' },
                    { id: 'm1_trig_ratio_3', title: '拡張（鈍角）' }
                ]},
                { id: 'm1_trig_app', title: '図形への応用', topics: [
                    { id: 'm1_trig_app_1', title: '正弦・余弦定理' },
                    { id: 'm1_trig_app_2', title: '面積・空間図形' }
                ]}
            ]
        },
        { 
            id: 'm1_data', 
            title: 'データの分析',
            subUnits: [
                { id: 'm1_data_stat', title: 'データの代表値', topics: [
                    { id: 'm1_data_stat_1', title: '平均・中央・最頻値' },
                    { id: 'm1_data_stat_2', title: '四分位数・箱ひげ図' }
                ]},
                { id: 'm1_data_var', title: '散らばりと相関', topics: [
                    { id: 'm1_data_var_1', title: '分散・標準偏差' },
                    { id: 'm1_data_var_2', title: '相関関係' }
                ]}
            ]
        },
      ]
    },
    {
      subject: '数学A',
      units: [
        { 
            id: 'ma_baai', 
            title: '場合の数と確率',
            subUnits: [
                { id: 'ma_baai_sett', title: '集合の要素の個数', topics: [
                     { id: 'ma_baai_sett_1', title: '和集合・補集合' },
                     { id: 'ma_baai_sett_2', title: '3つの集合' }
                ]},
                { id: 'ma_baai_count', title: '場合の数', topics: [
                    { id: 'ma_baai_count_1', title: '和・積の法則' },
                    { id: 'ma_baai_count_2', title: '樹形図・辞書式' }
                ]},
                { id: 'ma_baai_perm', title: '順列', topics: [
                    { id: 'ma_baai_perm_1', title: '順列(P)・階乗' },
                    { id: 'ma_baai_perm_2', title: '円順列・じゅず順列' },
                    { id: 'ma_baai_perm_3', title: '重複順列' },
                    { id: 'ma_baai_perm_4', title: '同じものを含む順列' }
                ]},
                { id: 'ma_baai_comb', title: '組合せ', topics: [
                    { id: 'ma_baai_comb_1', title: '組合せ(C)' },
                    { id: 'ma_baai_comb_2', title: '組分け' },
                    { id: 'ma_baai_comb_3', title: '重複組合せ(H)' }
                ]},
                { id: 'ma_baai_prob', title: '確率', topics: [
                    { id: 'ma_baai_prob_1', title: '定義・基本性質' },
                    { id: 'ma_baai_prob_2', title: '和事象・排反事象' },
                    { id: 'ma_baai_prob_3', title: '余事象' },
                    { id: 'ma_baai_prob_4', title: '独立試行' },
                    { id: 'ma_baai_prob_5', title: '反復試行' },
                    { id: 'ma_baai_prob_6', title: '条件付き確率' },
                    { id: 'ma_baai_prob_7', title: '期待値' }
                ]}
            ]
        },
        { 
            id: 'ma_seishitsu', 
            title: '整数の性質',
            subUnits: [
                { id: 'ma_seishitsu_div', title: '約数と倍数', topics: [
                    { id: 'ma_seishitsu_div_1', title: '約数・倍数' },
                    { id: 'ma_seishitsu_div_2', title: '最大公約数・最小公倍数' }
                ]},
                { id: 'ma_seishitsu_euclid', title: 'ユークリッド', topics: [
                    { id: 'ma_seishitsu_euclid_1', title: '互除法' },
                    { id: 'ma_seishitsu_euclid_2', title: '不定方程式' }
                ]},
                { id: 'ma_seishitsu_n', title: '記数法', topics: [
                    { id: 'ma_seishitsu_n_1', title: 'n進法' }
                ]}
            ]
        },
        { 
            id: 'ma_zukei', 
            title: '図形の性質',
            subUnits: [
                { id: 'ma_zukei_tri', title: '三角形の性質', topics: [
                    { id: 'ma_zukei_tri_1', title: '五心(重心・外心etc)' },
                    { id: 'ma_zukei_tri_2', title: 'チェバ・メネラウス' }
                ]},
                { id: 'ma_zukei_circ', title: '円の性質', topics: [
                    { id: 'ma_zukei_circ_1', title: '円に内接する四角形' },
                    { id: 'ma_zukei_circ_2', title: '方べき・接弦定理' },
                    { id: 'ma_zukei_circ_3', title: '2円の位置関係' }
                ]}
            ]
        },
      ]
    },
    {
      subject: '数学II',
      units: [
        { 
            id: 'm2_shiki_shomei', 
            title: '式と証明',
            subUnits: [
                { id: 'm2_shiki_poly', title: '式と計算', topics: [
                    { id: 'm2_shiki_poly_1', title: '3次式の展開・因数分解' },
                    { id: 'm2_shiki_poly_2', title: '二項定理' },
                    { id: 'm2_shiki_poly_3', title: '整式の割り算・分数式' }
                ]},
                { id: 'm2_shiki_proof', title: '等式・不等式の証明', topics: [
                    { id: 'm2_shiki_proof_1', title: '恒等式' },
                    { id: 'm2_shiki_proof_2', title: '等式の証明' },
                    { id: 'm2_shiki_proof_3', title: '不等式の証明' }
                ]}
            ]
        },
        { 
            id: 'm2_fuku_2ji', 
            title: '複素数と方程式',
            subUnits: [
                { id: 'm2_fuku_comp', title: '複素数', topics: [
                    { id: 'm2_fuku_comp_1', title: '複素数の演算' },
                    { id: 'm2_fuku_comp_2', title: '負の数の平方根' }
                ]},
                { id: 'm2_fuku_eq', title: '2次方程式', topics: [
                    { id: 'm2_fuku_eq_1', title: '解の判別式' },
                    { id: 'm2_fuku_eq_2', title: '解と係数の関係' }
                ]},
                { id: 'm2_fuku_high', title: '高次方程式', topics: [
                    { id: 'm2_fuku_high_1', title: '剰余の定理・因数定理' },
                    { id: 'm2_fuku_high_2', title: '高次方程式の解法' }
                ]}
            ]
        },
        { 
            id: 'm2_zukei_hoteishiki', 
            title: '図形と方程式',
            subUnits: [
                { id: 'm2_zukei_line', title: '点と直線', topics: [
                    { id: 'm2_zukei_line_1', title: '2点間の距離・内分外分' },
                    { id: 'm2_zukei_line_2', title: '直線の方程式' },
                    { id: 'm2_zukei_line_3', title: '点と直線の距離' }
                ]},
                { id: 'm2_zukei_circle', title: '円', topics: [
                    { id: 'm2_zukei_circle_1', title: '円の方程式' },
                    { id: 'm2_zukei_circle_2', title: '円と直線' },
                    { id: 'm2_zukei_circle_3', title: '2つの円' }
                ]},
                { id: 'm2_zukei_region', title: '軌跡と領域', topics: [
                    { id: 'm2_zukei_region_1', title: '軌跡' },
                    { id: 'm2_zukei_region_2', title: '不等式の表す領域' }
                ]}
            ]
        },
        { 
            id: 'm2_sankaku', 
            title: '三角関数',
            subUnits: [
                { id: 'm2_sankaku_graph', title: '角とグラフ', topics: [
                    { id: 'm2_sankaku_graph_1', title: '一般角・弧度法' },
                    { id: 'm2_sankaku_graph_2', title: '三角関数のグラフ' }
                ]},
                { id: 'm2_sankaku_add', title: '加法定理', topics: [
                    { id: 'm2_sankaku_add_1', title: '加法定理' },
                    { id: 'm2_sankaku_add_2', title: '2倍角・半角の公式' },
                    { id: 'm2_sankaku_add_3', title: '三角関数の合成' }
                ]},
                { id: 'm2_sankaku_eq', title: '方程式・不等式', topics: [
                    { id: 'm2_sankaku_eq_1', title: '三角方程式・不等式' },
                    { id: 'm2_sankaku_eq_2', title: '最大・最小' }
                ]}
            ]
        },
        { 
            id: 'm2_shisu_taisu', 
            title: '指数・対数関数',
            subUnits: [
                { id: 'm2_shisu', title: '指数関数', topics: [
                    { id: 'm2_shisu_1', title: '指数の拡張' },
                    { id: 'm2_shisu_2', title: '指数関数のグラフ' },
                    { id: 'm2_shisu_3', title: '指数方程式・不等式' }
                ]},
                { id: 'm2_taisu', title: '対数関数', topics: [
                    { id: 'm2_taisu_1', title: '対数の性質' },
                    { id: 'm2_taisu_2', title: '対数関数のグラフ' },
                    { id: 'm2_taisu_3', title: '対数方程式・不等式' },
                    { id: 'm2_taisu_4', title: '常用対数' }
                ]}
            ]
        },
        { 
            id: 'm2_bibun_sekibun', 
            title: '微分法・積分法',
            subUnits: [
                { id: 'm2_bibun', title: '微分法', topics: [
                    { id: 'm2_bibun_1', title: '微分係数・導関数' },
                    { id: 'm2_bibun_2', title: '接線の方程式' },
                    { id: 'm2_bibun_3', title: '関数の増減・極値' },
                    { id: 'm2_bibun_4', title: '最大・最小' }
                ]},
                { id: 'm2_sekibun', title: '積分法', topics: [
                    { id: 'm2_sekibun_1', title: '不定積分' },
                    { id: 'm2_sekibun_2', title: '定積分' },
                    { id: 'm2_sekibun_3', title: '定積分と面積' }
                ]}
            ]
        },
      ]
    },
    {
      subject: '数学B',
      units: [
        { 
            id: 'mb_suiretsu', 
            title: '数列',
            subUnits: [
                { id: 'mb_suiretsu_basic', title: '等差・等比数列', topics: [
                    { id: 'mb_suiretsu_basic_1', title: '等差数列' },
                    { id: 'mb_suiretsu_basic_2', title: '等比数列' }
                ]},
                { id: 'mb_suiretsu_various', title: 'いろいろな数列', topics: [
                    { id: 'mb_suiretsu_various_1', title: 'Σの計算' },
                    { id: 'mb_suiretsu_various_2', title: '階差数列' },
                    { id: 'mb_suiretsu_various_3', title: '群数列' }
                ]},
                { id: 'mb_suiretsu_rec', title: '漸化式と帰納法', topics: [
                    { id: 'mb_suiretsu_rec_1', title: '漸化式' },
                    { id: 'mb_suiretsu_rec_2', title: '数学的帰納法' }
                ]}
            ]
        },
        { 
            id: 'mb_toukei', 
            title: '統計的な推測',
            subUnits: [
                { id: 'mb_toukei_dist', title: '確率分布', topics: [
                    { id: 'mb_toukei_dist_1', title: '確率変数・期待値・分散' },
                    { id: 'mb_toukei_dist_2', title: '二項分布' },
                    { id: 'mb_toukei_dist_3', title: '正規分布' }
                ]},
                { id: 'mb_toukei_inf', title: '統計的推測', topics: [
                    { id: 'mb_toukei_inf_1', title: '母集団と標本' },
                    { id: 'mb_toukei_inf_2', title: '区間推定' },
                    { id: 'mb_toukei_inf_3', title: '仮説検定' }
                ]}
            ]
        },
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
        { 
            id: 'm3_kyukan', 
            title: '極限',
            subUnits: [
                { id: 'm3_kyukan_seq', title: '数列の極限', topics: [
                    { id: 'm3_kyukan_seq_1', title: '極限の計算' },
                    { id: 'm3_kyukan_seq_2', title: '無限等比級数' }
                ]},
                { id: 'm3_kyukan_func', title: '関数の極限', topics: [
                    { id: 'm3_kyukan_func_1', title: '関数の極限' },
                    { id: 'm3_kyukan_func_2', title: '三角関数の極限' },
                    { id: 'm3_kyukan_func_3', title: '関数の連続性' }
                ]}
            ]
        },
        { 
            id: 'm3_bibun', 
            title: '微分法',
            subUnits: [
                { id: 'm3_bibun_calc', title: '導関数', topics: [
                    { id: 'm3_bibun_calc_1', title: '積・商・合成関数の微分' },
                    { id: 'm3_bibun_calc_2', title: '逆関数の微分' },
                    { id: 'm3_bibun_calc_3', title: '三角・指数・対数関数の微分' }
                ]},
                { id: 'm3_bibun_app', title: '微分の応用', topics: [
                    { id: 'm3_bibun_app_1', title: '接線・法線' },
                    { id: 'm3_bibun_app_2', title: '平均値の定理' },
                    { id: 'm3_bibun_app_3', title: '関数の増減・極値・凹凸' },
                    { id: 'm3_bibun_app_4', title: '速度・加速度' }
                ]}
            ]
        },
        { 
            id: 'm3_sekibun', 
            title: '積分法',
            subUnits: [
                { id: 'm3_sekibun_calc', title: '不定積分・定積分', topics: [
                    { id: 'm3_sekibun_calc_1', title: '置換積分法' },
                    { id: 'm3_sekibun_calc_2', title: '部分積分法' },
                    { id: 'm3_sekibun_calc_3', title: 'いろいろな関数の積分' }
                ]},
                { id: 'm3_sekibun_app', title: '積分の応用', topics: [
                    { id: 'm3_sekibun_app_1', title: '区分求積法' },
                    { id: 'm3_sekibun_app_2', title: '面積' },
                    { id: 'm3_sekibun_app_3', title: '体積' },
                    { id: 'm3_sekibun_app_4', title: '曲線の長さ' }
                ]}
            ]
        },
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

    // Request notification permission if not already granted/denied
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    setLoading(true);
    setProgress('問題を作成中...');
    setError('');

    try {
      // 1. AI Generation
      const formData = new FormData();
      formData.append('units', JSON.stringify(selectedUnits));
      formData.append('unitDetails', JSON.stringify(selectedTopics));
      formData.append('difficulty', difficulty[0] || 'L1');
      formData.append('count', count.toString());
      formData.append('aiModel', aiModel);
      formData.append('additionalRequest', additionalRequest);
      
      files.forEach(file => {
          formData.append('files', file);
      });

      const res = await fetch('/api/generate_ai', {
        method: 'POST',
        // headers: { 'Content-Type': 'multipart/form-data' }, // Do NOT set Content-Type manually with FormData!
        body: formData
      });

      if (!res.ok) throw new Error('AI Generation failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported');

      const decoder = new TextDecoder();
      let buffer = '';
      let collectedProblems: any[] = [];
      let collectedIntent = ''; // New variable to capture intent
      let collectedPointReview = ''; // Captured review content

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
                setProgress(`問題作成中: ${data.count} / ${data.total} 問完了`);
              } else if (data.type === 'complete') {
                collectedProblems = data.problems;
                collectedIntent = data.intent;
                collectedPointReview = data.point_review_latex; // Capture data
                setPointReview(collectedPointReview); // Store in state for later use
                console.log('Frontend received Point Review:', collectedPointReview?.length);
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

      // Pre-process problems to include ID and Unit Title
      const processedProblems = collectedProblems.map((p, idx) => ({
        ...p,
        id: `ai_${idx}`, // Assign a temporary ID
        unit_title: ALL_UNITS.find(u => u.id === p.unit_id)?.title || p.unit_id
      }));

      setGeneratedProblems(processedProblems); // Store processed problems

      // 2. PDF Generation
      setProgress('PDFファイルを作成中...');
      const pdfRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providedQuestions: processedProblems, // Use processed problems
          units: selectedUnits,
          difficulties: difficulty,
          count: processedProblems.length,
          pointReview: collectedPointReview, // Pass to PDF generator
          options
        })
      });

      if (!pdfRes.ok) throw new Error('PDF Creation failed');

      const blob = await pdfRes.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      const unitNames = selectedUnits
        .map(id => ALL_UNITS.find(u => u.id === id)?.title ?? id)
        .join('_')
        .replace(/[\s\.]+/g, '_'); // Sanitize filename
      a.download = `${unitNames}_${new Date().toISOString().slice(0, 10)}.pdf`;
      
      setPdfUrl(url);
      if (collectedIntent) {
          setIntent(collectedIntent);
      }
      setShowPreview(true);
      
      // Note: We do NOT auto-click download here anymore, we let the user preview first.
      // But if we wanted auto-download, we would do:
      // document.body.appendChild(a); a.click(); setTimeout(...)
      
      // Let's scroll to the results section
      setTimeout(() => {
          const resultsSection = document.getElementById('pdf-results-section');
          if (resultsSection) {
              resultsSection.scrollIntoView({ behavior: 'smooth' });
          }
      }, 100);

      // 3. Success
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Send Desktop Notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('問題作成完了', {
          body: 'PDFの作成が完了しました。',
        });
      }

      // setShowSuccess(true); // Disable modal
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
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `Math_Exercise_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadCurrentPdf = () => {
        if (!pdfUrl) return;
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = pdfUrl;
        const unitNames = selectedUnits
            .map(id => ALL_UNITS.find(u => u.id === id)?.title ?? id)
            .join('_')
            .replace(/[\s\.]+/g, '_');
        a.download = `${unitNames}_${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 100);
  };

  /* New state for expanded units (UI only) */
  const [expandedUnits, setExpandedUnits] = useState<string[]>([]);

  /* Sub-unit toggle logic - UPDATED: Only toggles expansion */
  const toggleUnit = (id: string) => {
    setExpandedUnits(prev => {
      const isExpanded = prev.includes(id);
      if (isExpanded) {
        return prev.filter(u => u !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const deselectUnit = (id: string) => {
    // 1. Remove from selectedUnits
    setSelectedUnits(prev => prev.filter(u => u !== id));
    
    // 2. Remove from selectedTopics (optional, but good for cleanup)
    setSelectedTopics(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
    });
  };

  const toggleTopic = (unitId: string, topicTitle: string) => {
      setSelectedTopics(prev => {
          const current = prev[unitId] || [];
          const exists = current.includes(topicTitle);
          let next;
          if (exists) {
              next = current.filter(t => t !== topicTitle);
          } else {
              next = [...current, topicTitle];
          }
          
          // Sync with selectedUnits
          const nextTopics = next;
          setSelectedUnits(prevUnits => {
              const unitExists = prevUnits.includes(unitId);
              if (nextTopics.length > 0 && !unitExists) {
                  return [...prevUnits, unitId];
              } else if (nextTopics.length === 0 && unitExists) {
                 // Check if other sub-units for this unit have topics? 
                 // The `selectedTopics` struct is flat by unitId, so `next` covers ALL topics for this unitId.
                 return prevUnits.filter(u => u !== unitId);
              }
              return prevUnits;
          });

          return { ...prev, [unitId]: next };
      });
  };

  const toggleSubUnitAllTopics = (unitId: string, sub: SubUnit) => {
      if (!sub.topics) return;
      const topicTitles = sub.topics.map(t => t.title);
      
      setSelectedTopics(prev => {
          const current = prev[unitId] || [];
          const isAllSelected = topicTitles.every(t => current.includes(t));
          
          let next;
          if (isAllSelected) {
              // Deselect all
              next = current.filter(t => !topicTitles.includes(t));
          } else {
              // Select all (union)
              const toAdd = topicTitles.filter(t => !current.includes(t));
              next = [...current, ...toAdd];
          }

          // Sync with selectedUnits
          const nextTopics = next;
          setSelectedUnits(prevUnits => {
              const unitExists = prevUnits.includes(unitId);
              if (nextTopics.length > 0 && !unitExists) {
                  return [...prevUnits, unitId];
              } else if (nextTopics.length === 0 && unitExists) {
                 return prevUnits.filter(u => u !== unitId);
              }
              return prevUnits;
          });

          return { ...prev, [unitId]: next };
      });
  };

  const toggleDifficulty = (d: string) => {
    setDifficulty(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );
  };

  /* Tabbed Selection Implementation */
  const [activeTab, setActiveTab] = useState('1A'); // '1A' | '2B' | '3C'

  const TAB_GROUPS: Record<string, string[]> = {
      '1A': ['数学I', '数学A'],
      '2B': ['数学II', '数学B'],
      '3C': ['数学III', '数学C']
  };

  const visibleCurriculum = CURRICULUM.filter(cat => TAB_GROUPS[activeTab].includes(cat.subject));

  /* Helper for bulk selection */
  const handleDeleteProblem = (index: number) => {
    if (confirm('この問題を削除しますか？\n（削除後は「PDFを更新する」ボタンを押してください）')) {
      setGeneratedProblems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleUpdateProblem = (index: number, updated: any) => {
    setGeneratedProblems(prev => prev.map((p, i) => i === index ? updated : p));
  };

  const handleRegeneratePDF = async () => {
    if (generatedProblems.length === 0) {
      setError('問題がありません');
      return;
    }

    setLoading(true);
    setProgress('PDFを更新中...');
    setError('');

    try {
      const pdfRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providedQuestions: generatedProblems,
          units: selectedUnits,
          difficulties: difficulty,
          count: generatedProblems.length,
          pointReview: pointReview,
          options
        })
      });

      if (!pdfRes.ok) throw new Error('PDF Creation failed');

      const blob = await pdfRes.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      const unitNames = selectedUnits
        .map(id => ALL_UNITS.find(u => u.id === id)?.title ?? id)
        .join('_')
        .replace(/[\s\.]+/g, '_');
      a.download = `${unitNames}_${new Date().toISOString().slice(0, 10)}_updated.pdf`;
      
      setPdfUrl(url);
      setShowPreview(true);
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleSelectAll = (catUnits: Unit[]) => {
      const ids = catUnits.map(u => u.id);
      const isAllSelected = ids.every(id => selectedUnits.includes(id));
      
      if (isAllSelected) {
          setSelectedUnits(prev => prev.filter(id => !ids.includes(id)));
      } else {
          setSelectedUnits(prev => Array.from(new Set([...prev, ...ids])));
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const newFiles = Array.from(e.target.files);
          
          // Validation Constants
          const MAX_FILES = 10;
          const MAX_SIZE_MB = 5;
          const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

          // Check Total Count
          if (files.length + newFiles.length > MAX_FILES) {
              alert(`画像は最大${MAX_FILES}枚までしかアップロードできません。`);
              return;
          }

          // Check File Sizes
          const validFiles: File[] = [];
          for (const file of newFiles) {
              if (file.size > MAX_SIZE_BYTES) {
                  alert(`ファイル「${file.name}」はサイズが大きすぎます（${MAX_SIZE_MB}MB以下にしてください）。`);
                  continue;
              }
              validFiles.push(file);
          }

          if (validFiles.length === 0) return;

          setFiles(prev => [...prev, ...validFiles]);

          validFiles.forEach(file => {
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
          
          // Reset input value to allow selecting the same file again if needed
          if (fileInputRef.current) {
              fileInputRef.current.value = '';
          }
      }
  };

  const removeFile = (index: number) => {
      setFiles(prev => prev.filter((_, i) => i !== index));
      setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Math Exercise Generator</title>
        <meta name="description" content="Generate Math PDFs with LaTeX" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>数学プリントジェネレーター</h1>

        <div className={styles.header}>
          <Link href="/ai-creation" className={styles.card} style={{ border: '2px solid #FFB300', fontWeight: 'bold' }}>
            単元を選ばず、自由入力と画像から問題を作成 (β版)
          </Link>
        </div>

        <section className={styles.section}>
          <h2>
              1. 単元選択
          </h2>

          <div className={styles.toggleGroup} style={{ marginBottom: '1.5rem', background: 'white', border: '1px solid #ddd' }}>
              {Object.keys(TAB_GROUPS).map(tabKey => (
                  <div 
                      key={tabKey}
                      className={`${styles.toggleButton} ${activeTab === tabKey ? styles.active : ''}`}
                      onClick={() => setActiveTab(tabKey)}
                  >
                      {TAB_GROUPS[tabKey].join('・')}
                  </div>
              ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {visibleCurriculum.map(cat => {
              const isAllSelected = cat.units.every(u => selectedUnits.includes(u.id));
              return (
                <div key={cat.subject}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, color: '#666', fontSize: '0.9rem', marginRight: '1rem' }}>{cat.subject}</h3>
                        <button
                            onClick={() => handleSelectAll(cat.units)}
                            style={{
                                fontSize: '0.75rem',
                                padding: '2px 8px',
                                border: '1px solid #ddd',
                                background: isAllSelected ? '#eee' : '#fff',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: '#555'
                            }}
                        >
                            {isAllSelected ? 'すべて解除' : 'すべて選択'}
                        </button>
                    </div>
                    <div className={styles.grid}>
                    {cat.units.map(u => (
                        <button
                        key={u.id}
                        className={`${styles.card} ${expandedUnits.includes(u.id) ? '' : ''}`} // Modified: No active style for parent
                        onClick={() => toggleUnit(u.id)}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', height: 'auto' }}
                        >
                            <span style={{ fontSize: '1rem' }}>{u.title}</span>
                            {/* Sub-units rendering */}
                            {expandedUnits.includes(u.id) && u.subUnits && (
                                <div style={{ 
                                    marginTop: '0.5rem', 
                                    width: '100%', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '4px',
                                    borderTop: '1px solid #eee',
                                    paddingTop: '0.5rem'
                                }}
                                onClick={(e) => e.stopPropagation()} // Stop propagation to prevent closing parent
                                >
                                    {u.subUnits.map(sub => {
                                         // Check detailed topic selection
                                         const currentTopics = selectedTopics[u.id] || [];
                                         const allSubTopicTitles = sub.topics?.map(t => t.title) || [];
                                         // If at least one topic is selected, we consider the sub-unit "active" visually, 
                                         // or we can just rely on individual topic chips.
                                         // Let's rely on individual chips.
                                         const isSubFullySelected = allSubTopicTitles.length > 0 && allSubTopicTitles.every(t => currentTopics.includes(t));

                                         return (
                                            <div key={sub.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <div 
                                                    onClick={() => toggleSubUnitAllTopics(u.id, sub)}
                                                    style={{ 
                                                        fontSize: '0.85rem', 
                                                        color: isSubFullySelected ? '#0070f3' : '#666',
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer',
                                                        padding: '2px 4px',
                                                        marginBottom: '2px'
                                                    }}
                                                >
                                                    {sub.title}
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingLeft: '8px' }}>
                                                    {sub.topics?.map(topic => {
                                                        const isSelected = currentTopics.includes(topic.title);
                                                        return (
                                                            <span 
                                                                key={topic.id}
                                                                onClick={() => toggleTopic(u.id, topic.title)}
                                                                style={{
                                                                    fontSize: '0.75rem',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '4px',
                                                                    border: '1px solid',
                                                                    borderColor: isSelected ? '#ffb74d' : '#ddd', // Orange border if selected
                                                                    background: isSelected ? '#fff3e0' : '#f9f9f9', // Light orange bg if selected,
                                                                    color: isSelected ? '#e65100' : '#888',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                {topic.title}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                         );
                                    })}
                                </div>
                            )}
                        </button>
                    ))}
                    </div>
                </div>
              );
            })}
          </div>
        </section>



        <section className={styles.section}>
          <h2>2. オプション設定</h2>
          <div className={styles.optionsGrid}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={options.moreWorkSpace}
                onChange={(e) => setOptions({ ...options, moreWorkSpace: e.target.checked })}
              />
              広めの計算スペース
            </label>
          </div>
          
          <div style={{ marginTop: '1rem' }}>
             <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>問題数</label>
             <input 
               type="number" 
               value={count} 
               onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
               style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', width: '80px' }}
             />
          </div>

          <div style={{ marginTop: '1rem' }}>
             <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>難易度</label>
             <div style={{ display: 'flex', gap: '0.5rem' }}>
                 {['L1', 'L2', 'L3', 'L4', 'L5'].map(d => (
                     <button
                        key={d}
                        onClick={() => toggleDifficulty(d)}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '20px',
                            border: '1px solid #ccc',
                            background: difficulty.includes(d) ? '#0070f3' : '#fff',
                            color: difficulty.includes(d) ? '#fff' : '#000',
                            cursor: 'pointer'
                        }}
                     >
                        {d === 'L1' ? '基礎1' : d === 'L2' ? '基礎2' : d === 'L3' ? '基礎3' : d === 'L4' ? '標準' : '発展'}
                     </button>
                 ))}
              </div>

              {/* Difficulty Descriptions */}
              <div style={{ marginTop: '0.8rem', fontSize: '0.85rem', color: '#555', background: '#f5f5f5', padding: '0.8rem', borderRadius: '4px' }}>
                  {difficulty.length === 0 ? (
                      <span style={{ color: '#999' }}>難易度を選択してください</span>
                  ) : (
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', listStyleType: 'disc' }}>
                          {['L1', 'L2', 'L3', 'L4', 'L5'].filter(d => difficulty.includes(d)).map(d => {
                              const labels: Record<string, string> = { 'L1': '基礎1', 'L2': '基礎2', 'L3': '基礎3', 'L4': '標準', 'L5': '発展' };
                              const descs: Record<string, string> = {
                                  'L1': '教科書の例題・計算ドリルレベル',
                                  'L2': '教科書の標準問題レベル',
                                  'L3': '教科書の章末応用問題レベル',
                                  'L4': '一般入試標準レベル',
                                  'L5': '難関大入試レベル'
                              };
                              return (
                                  <li key={d} style={{ marginBottom: '0.2rem' }}>
                                      <strong>{labels[d]}</strong>: {descs[d]}
                                  </li>
                              );
                          })}
                      </ul>
                  )}
              </div>
          </div>
          
           <div style={{ marginTop: '1rem' }}>
             <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>AIモデル</label>
             <select 
               value={aiModel} 
               onChange={(e) => setAiModel(e.target.value as any)}
               style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', width: '100%', maxWidth: '300px' }}
             >
               <option value="gpt-5.2">GPT-5.2 (高品質)</option>
               <option value="gpt-5-mini">GPT-5 mini (高速)</option>
             </select>
          </div>

           <div style={{ marginTop: '1.5rem' }}>
             <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                 追加のリクエスト <span style={{ fontWeight: 'normal', fontSize: '0.8rem', color: '#666' }}>（任意）</span>
             </label>
             <textarea
               value={additionalRequest}
               onChange={(e) => setAdditionalRequest(e.target.value)}
               placeholder="例: 文章題を多めにしてほしい、計算問題を重点的に..."
               style={{ 
                   width: '100%', 
                   height: '80px', 
                   padding: '0.5rem', 
                   borderRadius: '4px', 
                   border: '1px solid #ccc',
                   fontFamily: 'inherit'
                }}
                />
                {previews.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #eee', marginTop: '0.5rem' }}>
                        {previews.map((src, i) => (
                            <div 
                                key={i} 
                                style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    background: 'white', 
                                    padding: '4px 8px', 
                                    borderRadius: '16px', 
                                    border: '1px solid #ddd',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
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
                                        fontWeight: 'bold',
                                        fontSize: '1rem',
                                        lineHeight: 1
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <div style={{ marginTop: '0.5rem' }}>
                    <label style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        cursor: 'pointer', 
                        background: '#f0f0f0', 
                        padding: '8px 16px', 
                        borderRadius: '8px',
                        border: '1px solid #ccc',
                        fontWeight: 'bold',
                        color: '#333'
                    }}>
                        <input 
                            type="file" 
                            multiple 
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                        📁 画像を選択
                    </label>
                        <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>
                             ※ワークの問題や手書きのメモなどをアップロードすると、それを参考に問題を作成します。
                         </p>
                </div>

          </div>
        </section>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            className={styles.generateButton}
            onClick={handleAutoGenerate}
            disabled={loading}
          >
            {loading ? '作成中...' : '問題を作成する'}
          </button>
        </div>

        {/* Results Section */}
        {pdfUrl && (
            <div id="pdf-results-section" style={{ marginTop: '3rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>🎉</span> 作成完了！
                </h2>
                
                {intent && (
                    <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
                        <div style={{ 
                            background: '#f0f9ff', 
                            border: '1px solid #bae6fd', 
                            borderRadius: '8px', 
                            padding: '1rem', 
                            maxWidth: '800px',
                            width: '100%'
                        }}>
                             <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#0284c7' }}>
                                AIからのメッセージ:
                            </div>
                            <LatexRenderer content={intent} />
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <button 
                        className={styles.card} 
                        onClick={() => setShowPreview(!showPreview)}
                        style={{ padding: '0.8rem 2rem', fontWeight: 'bold' }}
                    >
                        {showPreview ? 'プレビューを隠す' : 'PDFプレビューを表示'}
                    </button>
                    <button 
                        className={styles.generateButton}
                        onClick={downloadCurrentPdf}
                    >
                        PDFをダウンロード
                    </button>
                </div>

                {showPreview && (
                    <div style={{ width: '100%', height: '600px', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', marginBottom: '2rem' }}>
                        <iframe 
                            src={`${pdfUrl}#toolbar=0`} 
                            style={{ width: '100%', height: '100%', border: 'none' }}
                            title="PDF Preview"
                        />
                    </div>
                )}



                {/* Editable Generated Problems List */}
                {generatedProblems.length > 0 && (
                    <div style={{ marginTop: '2rem', borderTop: '2px dashed #FFB300', paddingTop: '2rem' }}>
                        <ProblemEditList 
                            problems={generatedProblems} 
                            onDelete={handleDeleteProblem}
                            onUpdate={handleUpdateProblem}
                            onRequestPDFUpdate={handleRegeneratePDF}
                        />
                        
                        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                            <button
                                onClick={handleRegeneratePDF}
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
                )}
            </div>
        )}
      </main>

      {(loading || progress || error) && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            {loading ? (
              <>
                <div className={styles.characterWrapper}>
                  <div className={styles.characterBody}></div>
                  <div className={styles.leftLeg}></div>
                  <div className={styles.rightLeg}></div>
                </div>
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


      {/* Floating Selected Units Panel */}
      {selectedUnits.length > 0 && (
          <div className={styles.floatingPanel}>
              <div className={styles.panelHeader}>
                  <span>選択中のトピックス</span>
                  <span 
                    onClick={() => { setSelectedUnits([]); setSelectedTopics({}); }}
                    style={{ fontSize: '0.8rem', cursor: 'pointer', color: '#999', fontWeight: 'normal' }}
                  >
                    すべて解除
                  </span>
              </div>
              <div className={styles.unitList}>
                  {selectedUnits.map(unitId => {
                      const unit = ALL_UNITS.find(u => u.id === unitId);
                      const topics = selectedTopics[unitId];
                      
                      // Case A: Specific topics are selected
                      if (topics && topics.length > 0) {
                          return topics.map(topicTitle => (
                              <div key={`${unitId}-${topicTitle}`} className={styles.unitChip}>
                                  {topicTitle}
                                  <span 
                                      className={styles.chipRemove}
                                      onClick={() => toggleTopic(unitId, topicTitle)}
                                  >
                                      ×
                                  </span>
                              </div>
                          ));
                      }
                      
                      // Case B: No specific topics (Unit as a whole)
                      return (
                          <div key={unitId} className={styles.unitChip}>
                              {unit?.title || unitId}
                              <span 
                                  className={styles.chipRemove}
                                  onClick={() => deselectUnit(unitId)}
                              >
                                  ×
                              </span>
                          </div>
                      );
                  })}
              </div>
              
              {/* Difficulty Descriptions */}
              <div style={{ marginTop: '0.8rem', fontSize: '0.85rem', color: '#555', background: '#f5f5f5', padding: '0.8rem', borderRadius: '4px' }}>
                  {difficulty.length === 0 ? (
                      <span style={{ color: '#999' }}>難易度を選択してください</span>
                  ) : (
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', listStyleType: 'disc' }}>
                          {['L1', 'L2', 'L3', 'L4', 'L5'].filter(d => difficulty.includes(d)).map(d => {
                              const labels: Record<string, string> = { 'L1': '基礎1', 'L2': '基礎2', 'L3': '基礎3', 'L4': '標準', 'L5': '発展' };
                              const descs: Record<string, string> = {
                                  'L1': '教科書の例題・計算ドリルレベル',
                                  'L2': '教科書の標準問題レベル',
                                  'L3': '教科書の章末応用問題レベル',
                                  'L4': '一般入試標準レベル',
                                  'L5': '難関大入試レベル'
                              };
                              return (
                                  <li key={d} style={{ marginBottom: '0.2rem' }}>
                                      <strong>{labels[d]}</strong>: {descs[d]}
                                  </li>
                              );
                          })}
                      </ul>
                  )}
             </div>
              
          </div>
      )}

      {/* Image Preview Modal (Global) */}
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
    </div>
  );
}

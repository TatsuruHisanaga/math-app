import { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '@/styles/Home.module.css';
import confetti from 'canvas-confetti';
import { saveAs } from 'file-saver';
import Link from 'next/link';
import LatexRenderer from '@/components/LatexRenderer'; // Import LatexRenderer

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
  const [difficulty, setDifficulty] = useState<string[]>(['L1']);
  const [count, setCount] = useState<number>(10);
  const [options, setOptions] = useState({
    stumblingBlock: false,
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
    setLoading(true);
    setProgress('問題を作成中...');
    setError('');

    try {
      // 1. AI Generation
      const res = await fetch('/api/generate_ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          units: selectedUnits,
          unitDetails: selectedTopics,
          difficulty: difficulty[0] || 'L1',
          count,
          aiModel,
          additionalRequest
        })
      });

      if (!res.ok) throw new Error('AI Generation failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported');

      const decoder = new TextDecoder();
      let buffer = '';
      let collectedProblems: any[] = [];
      let collectedIntent = ''; // New variable to capture intent

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
                setGeneratedProblems(data.problems); // Store for rendering
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
      
      // Let's scroll to bottom to show results
      setTimeout(() => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);

      // 3. Success
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
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

  /* Sub-unit toggle logic */
  const toggleUnit = (id: string) => {
    setSelectedUnits(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        // Deselecting: Remove from units and clear sub-units
        const next = prev.filter(u => u !== id);
        setSelectedTopics(prevSub => {
            const copy = { ...prevSub };
            delete copy[id];
            return copy;
        });
        return next;
      } else {
        // Selecting: Add to units, but DO NOT select sub-units by default (empty = implied all/generic)
        // We initialize with empty array to allow manual selection
        return [...prev, id];
      }
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
  const handleSelectAll = (catUnits: Unit[]) => {
      const ids = catUnits.map(u => u.id);
      const isAllSelected = ids.every(id => selectedUnits.includes(id));
      
      if (isAllSelected) {
          setSelectedUnits(prev => prev.filter(id => !ids.includes(id)));
      } else {
          setSelectedUnits(prev => Array.from(new Set([...prev, ...ids])));
      }
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
          <Link href="/ai-creation" className={styles.card} style={{ border: '2px solid #FFB300', fontWeight: 'bold' }}>
            ✨ 自由入力・ファイルから作成 (新機能)
          </Link>
        </div>

        <section className={styles.section}>
          <h2>
              1. 単元選択
              <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.5rem', marginLeft: '1rem', verticalAlign: 'middle' }}>
                  {selectedUnits.length === 0 && <span style={{fontSize: '0.9rem', color: '#999', fontWeight: 'normal'}}>（未選択）</span>}
                  {selectedUnits.map(id => {
                      const unit = ALL_UNITS.find(u => u.id === id);
                      return (
                          <span key={id} style={{ 
                              fontSize: '0.8rem', 
                              padding: '2px 8px', 
                              borderRadius: '12px', 
                              background: '#333', 
                              color: '#fff',
                              fontWeight: 'normal' 
                          }}>
                              {unit?.title || id}
                              <span 
                                  onClick={(e) => { e.stopPropagation(); toggleUnit(id); }}
                                  style={{ marginLeft: '6px', cursor: 'pointer', opacity: 0.8 }}
                              >
                                  ×
                              </span>
                          </span>
                      );
                  })}
              </div>
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
                        className={`${styles.card} ${selectedUnits.includes(u.id) ? styles.active : ''}`}
                        onClick={() => toggleUnit(u.id)}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', height: 'auto' }}
                        >
                            <span style={{ fontSize: '1rem' }}>{u.title}</span>
                            
                            {/* Sub-unit / Topic selection */}
                            {selectedUnits.includes(u.id) && u.subUnits && (
                                <div 
                                    onClick={e => e.stopPropagation()} 
                                    style={{ 
                                        marginTop: '1rem', 
                                        width: '100%',
                                        textAlign: 'left'
                                    }}
                                >
                                    {u.subUnits.map(sub => (
                                        <div key={sub.id} style={{ marginBottom: '1rem' }}>
                                            <div style={{fontSize: '0.8rem', fontWeight: 'bold', marginBottom:'6px', color: '#666', borderBottom: '1px solid #eee', paddingBottom: '2px'}}>
                                                {sub.title}
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {sub.topics?.map(topic => {
                                                    const isChecked = (selectedTopics[u.id] || []).includes(topic.title);
                                                    return (
                                                        <button
                                                            key={topic.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleTopic(u.id, topic.title);
                                                            }}
                                                            style={{
                                                                fontSize: '0.75rem',
                                                                padding: '4px 10px',
                                                                borderRadius: '16px',
                                                                border: isChecked ? '1px solid #FFB300' : '1px solid #ddd',
                                                                background: isChecked ? '#FFF8E1' : 'white',
                                                                color: isChecked ? '#B45309' : '#555',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                transition: 'all 0.1s'
                                                            }}
                                                        >
                                                            {isChecked && <span style={{fontSize:'10px'}}>✓</span>}
                                                            {topic.title}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
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
          <h2>2. 難易度 & 設定</h2>
          <div className={styles.settingsGrid}>
            {/* Difficulty */}
            <div className={styles.controlGroup}>
              <h3>難易度</h3>
              <div className={styles.toggleGroup}>
                {[
                  { id: 'L1', label: '基礎' },
                  { id: 'L2', label: '標準' },
                  { id: 'L3', label: '発展' }
                ].map(d => (
                  <div
                    key={d.id}
                    className={`${styles.toggleButton} ${difficulty.includes(d.id) ? styles.active : ''}`}
                    onClick={() => toggleDifficulty(d.id)}
                  >
                    {d.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Count */}
            <div className={styles.controlGroup}>
              <h3>
                問題数
                <span style={{ color: '#FFB300', fontSize: '1.2rem', fontWeight: 'bold' }}>{count}</span>
              </h3>
              <div className={styles.sliderContainer}>
                <span style={{ fontSize: '0.8rem', color: '#999', fontWeight: 'bold' }}>3</span>
                <input
                  type="range" min="3" max="30"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className={styles.rangeInput}
                />
                <span style={{ fontSize: '0.8rem', color: '#999', fontWeight: 'bold' }}>30</span>
              </div>
            </div>

            {/* AI Model */}
            <div className={styles.controlGroup}>
              <h3>AIモデル</h3>
              <div className={styles.modelOptions}>
                {[
                  { id: 'gpt-5.2', name: '高品質 (gpt-5.2)', desc: '高い論理的思考で良問を作成' },
                  { id: 'gpt-5-mini', name: '高速 (gpt-5-mini)', desc: '生成スピードを優先' }
                ].map((m) => (
                  <div
                    key={m.id}
                    className={`${styles.modelCard} ${aiModel === m.id ? styles.selected : ''}`}
                    onClick={() => setAiModel(m.id as any)}
                  >
                    <div className={styles.radioCircle}></div>
                    <div className={styles.modelInfo}>
                      <span className={styles.modelName}>{m.name}</span>
                      <span className={styles.modelDesc}>{m.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Request */}
            <div className={styles.controlGroup} style={{ gridColumn: '1 / -1' }}>
                <h3>その他要望</h3>
                <textarea
                    placeholder="例: 文章題を多めにしてください、計算過程を詳しく書いてください etc."
                    value={additionalRequest}
                    onChange={(e) => setAdditionalRequest(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '1rem',
                        borderRadius: '12px',
                        border: '2px solid #eaeaea',
                        fontSize: '0.95rem',
                        minHeight: '80px',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        boxSizing: 'border-box'
                    }}
                />
            </div>
          </div>
        </section>

        <div className={styles.actions}>
            <button
              className={styles.generateButton}
              onClick={handleAutoGenerate}
              disabled={loading || selectedUnits.length === 0}
            >
              {loading ? '作成中...' : 'プリントを作成'}
            </button>
        </div>

        {/* Results Section */}
        {pdfUrl && (
            <div className={styles.section} style={{ marginTop: '2rem', border: '2px solid #FFB300', background: '#fffcf5' }}>
                <h2 style={{ borderBottom: 'none', textAlign: 'center', fontSize: '1.5rem', marginBottom: '1rem' }}>🎉 生成完了</h2>
                
                {intent && (
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid #eee' }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: '#555' }}>🎯 出題のねらい・構成</h3>
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
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

                {/* Generated Problems List */}
                {generatedProblems.length > 0 && (
                    <div style={{ marginTop: '2rem', borderTop: '2px dashed #FFB300', paddingTop: '2rem' }}>
                        <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#B45309' }}>📖 生成された問題一覧</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {generatedProblems.map((p, idx) => (
                                <div key={idx} style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #eee', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#555', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                                        問{idx + 1}
                                    </div>
                                    <div style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>
                                        <LatexRenderer content={p.stem_latex} />
                                    </div>

                                    <details style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', cursor: 'pointer' }}>
                                        <summary style={{ fontWeight: 'bold', color: '#666' }}>解答・解説を表示</summary>
                                        <div style={{ marginTop: '1rem' }}>
                                            <div style={{ fontWeight: 'bold', color: '#d97706', marginBottom: '0.5rem' }}>【解答】</div>
                                            <div style={{ marginBottom: '1rem' }}>
                                                <LatexRenderer content={p.answer_latex} />
                                            </div>
                                            
                                            {p.explanation_latex && (
                                                <>
                                                    <div style={{ fontWeight: 'bold', color: '#555', marginBottom: '0.5rem' }}>【解説】</div>
                                                    <div style={{ whiteSpace: 'pre-wrap' }}>
                                                        <LatexRenderer content={p.explanation_latex} />
                                                    </div>
                                                </>
                                            )}

                                            {p.teaching_point_latex && (
                                                <div style={{ 
                                                    marginTop: '1.5rem', 
                                                    background: '#e3f2fd', 
                                                    border: '1px solid #90caf9', 
                                                    padding: '1rem', 
                                                    borderRadius: '8px',
                                                    color: '#0d47a1'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                                        <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>💡</span>
                                                        生徒への指導ポイント
                                                    </div>
                                                    <LatexRenderer content={p.teaching_point_latex} />
                                                </div>
                                            )}
                                        </div>
                                    </details>
                                </div>
                            ))}
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


    </div>
  );
}

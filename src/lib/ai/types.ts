export type Difficulty = 'L1' | 'L2' | 'L3';

export type GraphType = 'function' | 'point' | 'segment' | 'polygon';

export interface GraphPoint {
  x: number;
  y: number;
  label?: string;
  color?: string;
}

export interface GraphData {
  type: GraphType;
  expression?: string;
  k?: number;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  points?: GraphPoint[];
}

export interface AIProblemItem {
  stem_latex: string;
  answer_latex: string;
  explanation_latex: string;
  unit_id: string;
  difficulty: Difficulty;
  graph?: GraphData;
}

export interface AIProblemSet {
  problems: AIProblemItem[];
  intent: string;
}

export interface AIFeedbackItem {
  question_id: string;
  explanation_latex: string;
  hint_latex: string;
  common_mistake_latex: string;
}

export interface AIFeedbackSet {
  items: AIFeedbackItem[];
}

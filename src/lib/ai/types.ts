export type Difficulty = 'L1' | 'L2' | 'L3';

export interface AIProblemItem {
  stem_latex: string;
  answer_latex: string;
  explanation_latex: string;
  hint_latex: string;
  common_mistake_latex: string;
  unit_id: string;
  difficulty: Difficulty;
}

export interface AIProblemSet {
  problems: AIProblemItem[];
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

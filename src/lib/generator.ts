import fs from 'fs';
import path from 'path';

// Types
export type Difficulty = 'L1' | 'L2' | 'L3';

export interface QuestionTemplate {
  id: string;
  unit_id: string;
  difficulty: Difficulty;
  stem: string;
  answer: string;
  constraints: Record<string, any>;
}

export interface Unit {
  id: string;
  title_ja: string;
  prerequisites: string[];
  templates: { [key in Difficulty]?: string[] };
}

export interface UnitMap {
  units: Record<string, Unit>;
  symbol_packs: Record<string, any>;
}

export interface Question {
  id: string; // unique instance id
  template_id: string;
  unit_id: string;
  unit_title: string;
  stem_latex: string;
  answer_latex: string;
}

export class QuestionGenerator {
  private unitMap: UnitMap;
  private templates: QuestionTemplate[];
  private templateMap: Map<string, QuestionTemplate>;

  constructor(unitMapPath: string, templatesPath: string) {
    this.unitMap = JSON.parse(fs.readFileSync(unitMapPath, 'utf-8'));
    this.templates = JSON.parse(fs.readFileSync(templatesPath, 'utf-8'));
    this.templateMap = new Map(this.templates.map(t => [t.id, t]));
  }

  // Get prerequisites up to depth 2 (BFS)
  private getPrerequisites(unitId: string, depth: number = 2): string[] {
    const visited = new Set<string>();
    const queue: { id: string; d: number }[] = [{ id: unitId, d: 0 }];
    const prereqs: string[] = [];

    while (queue.length > 0) {
      const { id, d } = queue.shift()!;
      if (d >= depth) continue;

      const unit = this.unitMap.units[id];
      if (!unit) continue;

      for (const pid of unit.prerequisites) {
        if (!visited.has(pid)) {
          visited.add(pid);
          prereqs.push(pid);
          queue.push({ id: pid, d: d + 1 });
        }
      }
    }
    return prereqs;
  }

  // Generate a random integer in range [min, max]
  private randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Simple variable substitution (placeholder: smarter logic needed for math constraints)
  private instantiateTemplate(t: QuestionTemplate): Question {
    // Generate basic variables (simplification for MVP)
    const vars: Record<string, number> = {
      a: this.randInt(2, 9),
      b: this.randInt(2, 9),
      c: this.randInt(2, 9),
      n: this.randInt(2, 5),
      m: this.randInt(2, 5),
      sq: 0 // placeholder
    };
    
    // Derived variables
    vars.sq = vars.a * vars.a; // Perfect square
    vars.sum = vars.a + vars.b;
    vars.prod = vars.a * vars.b;
    vars.nm = vars.n + vars.m;
    vars.nm_mul = vars.n * vars.m;
    vars.ab = vars.a * vars.b;
    vars.ans = vars.a + vars.b; // very naive default
    
    // Special handling for some template patterns could go here
    // For MVP, we do string replacement
    let stem = t.stem;
    let answer = t.answer;

    for (const [key, val] of Object.entries(vars)) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      stem = stem.replace(regex, val.toString());
      answer = answer.replace(regex, val.toString());
    }

    return {
      id: Math.random().toString(36).substr(2, 9),
      template_id: t.id,
      unit_id: t.unit_id,
      unit_title: this.unitMap.units[t.unit_id].title_ja,
      stem_latex: stem,
      answer_latex: answer
    };
  }

  public generateBatch(config: {
    unitIds: string[];
    difficulty: Difficulty[]; // e.g. ['L2']
    count: number;
    usePrereqs: boolean;
  }): Question[] {
    const questions: Question[] = [];
    const mainCount = config.usePrereqs ? Math.floor(config.count * 0.7) : config.count;
    const prereqCount = config.count - mainCount;

    // 1. Main Questions
    for (let i = 0; i < mainCount; i++) {
        // Pick random unit from selection
        const uid = config.unitIds[this.randInt(0, config.unitIds.length - 1)];
        const unit = this.unitMap.units[uid];
        // Pick random difficulty from selection
        const diff = config.difficulty[this.randInt(0, config.difficulty.length - 1)];
        
        const tIds = unit.templates[diff];
        if (tIds && tIds.length > 0) {
            const tId = tIds[this.randInt(0, tIds.length - 1)];
            questions.push(this.instantiateTemplate(this.templateMap.get(tId)!));
        }
    }

    // 2. Prerequisite Questions
    if (prereqCount > 0) {
        const allPrereqs = new Set<string>();
        config.unitIds.forEach(uid => {
            this.getPrerequisites(uid).forEach(p => allPrereqs.add(p));
        });
        const prereqList = Array.from(allPrereqs);
        
        if (prereqList.length > 0) {
            for (let i = 0; i < prereqCount; i++) {
                const uid = prereqList[this.randInt(0, prereqList.length - 1)];
                const unit = this.unitMap.units[uid];
                // Prereqs usually one level lower, or L1 if at bottom. 
                // For MVP simply pick L1 or L2
                const diff: Difficulty = 'L1'; 
                const tIds = unit.templates[diff];
                 if (tIds && tIds.length > 0) {
                    const tId = tIds[this.randInt(0, tIds.length - 1)];
                    questions.push(this.instantiateTemplate(this.templateMap.get(tId)!));
                }
            }
        } else {
             // Fallback if no prerequisites found (add more main questions)
             // ... simplified: just ignore or fill with main
        }
    }

    return questions;
  }
}

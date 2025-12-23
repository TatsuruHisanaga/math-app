
const fs = require('fs');
const path = require('path');

// Mock classes to run locally without compiling TS
class QuestionGenerator {
  constructor(unitMapPath, templatesPath) {
    this.unitMap = JSON.parse(fs.readFileSync(unitMapPath, 'utf-8'));
    this.templates = JSON.parse(fs.readFileSync(templatesPath, 'utf-8'));
    this.templateMap = new Map(this.templates.map(t => [t.id, t]));
  }

  randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  instantiateTemplate(t) {
    const vars = {
      a: this.randInt(2, 9),
      b: this.randInt(2, 9),
      c: this.randInt(2, 9),
      n: this.randInt(2, 5),
      m: this.randInt(2, 5),
      sq: 0
    };
    vars.sq = vars.a * vars.a;
    vars.sum = vars.a + vars.b;
    vars.prod = vars.a * vars.b;
    vars.nm = vars.n + vars.m;
    vars.ans = vars.a + vars.b;

    let stem = t.stem;
    let answer = t.answer;

    for (const [key, val] of Object.entries(vars)) {
      // Logic from src/lib/generator.ts
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      stem = stem.replace(regex, val.toString());
      answer = answer.replace(regex, val.toString());
    }

    return { stem, answer };
  }

  generateBatch() {
     const t = this.templateMap.get('t1_1'); // Test specific template
     if(t) return [this.instantiateTemplate(t)];
     return [];
  }
}

const gen = new QuestionGenerator(
    path.join(__dirname, 'data/unit_map.json'),
    path.join(__dirname, 'data/templates.json')
);

const q = gen.generateBatch()[0];
console.log("Stem:", q.stem);
console.log("Answer:", q.answer);

import fs from 'fs';
import path from 'path';
import { AIClient } from '../../src/lib/ai/client'; // Relative path from scripts/eval/run.ts
import { Judge, EvaluationResult } from './judge';

// Load .env.local manually for script execution
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            // Strip quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
}

// Hardcoded for now, or read from .env
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.error("Error: OPENAI_API_KEY environment variable is not set.");
    process.exit(1);
}

interface TestCase {
    id: string;
    prompt: string;
    unit: string;
    expected_difficulty: string;
    criteria: string[];
}

async function run() {
    console.log("評価実行を開始します...");

    // 1. Load Test Cases
    const casesPath = path.resolve(process.cwd(), 'eval/cases.json');
    if (!fs.existsSync(casesPath)) {
        console.error("エラー: eval/cases.json が見つかりません。");
        process.exit(1);
    }
    const testCases: TestCase[] = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
    console.log(`${testCases.length} 件のテストケースを読み込みました。`);

    // 2. Setup Client and Judge
    const client = new AIClient(apiKey as string);
    const judge = new Judge(client);

    const results: any[] = [];
    let passedCount = 0;

    // 3. Loop through cases
    for (const testCase of testCases) {
        console.log(`\n-----------------------------------`);
        console.log(`ケース実行: ${testCase.id} - ${testCase.prompt}`);
        
        try {
            // Generate Problems
            // Using generateProblems directly (skipping pipeline for pure prompt testing, or we can use pipeline if logic is there)
            // Ideally we test the exact logic the app uses. Currently app uses GenerationPipeline or manual generation.
            // Let's use AIClient.generateProblems for simplicity as a unit test of the prompt logic.
            // But we actually need to test "generate from prompt" logic usually.
            // Since test cases have "unit" AND "prompt", it implies we are testing the flexible generation or the specific unit generation.
            // If "prompt" is natural language, we should use generateProblemsFromPrompt or similar.
            // AIClient has generateProblems (structured from unit/diff) and generateProblemsFromPrompt (flexible).
            
            // The test case format implies flexible prompt testing if "prompt" is NL.
            // But "unit" is also provided.
            // Let's use generateProblemsFromPrompt and inject the constraints into the prompt if needed, 
            // OR use generateProblems if the test case is about a specific unit config.
            
            // Given the first test case: "指数関数のグラフに関する問題を作成して" (Create exp func graph problems), 
            // this is a flexible prompt.
            
            let problemSet;
            const startTime = Date.now();
            
            // Construct a user prompt that includes the NL request + constraints provided by test case metadata
            const fullUserPrompt = `${testCase.prompt}
(Context: Unit ${testCase.unit}, Difficulty ${testCase.expected_difficulty})`;

            const systemPrompt = `You are a professional mathematics teacher. Generate 1 problem based on the request.`; // Reduced count for speed

            // Using the flexible generation method
            problemSet = await client.generateProblemsFromPrompt(
                systemPrompt,
                fullUserPrompt
            );

            const duration = Date.now() - startTime;
            
            if (!problemSet || !problemSet.problems || problemSet.problems.length === 0) {
                console.error("  失敗: 問題が生成されませんでした。");
                results.push({ id: testCase.id, pass: false, score: 0, reason: "No output" });
                continue;
            }

            const problem = problemSet.problems[0]; // Evaluate the first problem for this test

            // Evaluate
            console.log("  生成完了。評価中...");
            const evalResult = await judge.evaluate(
                testCase.prompt, // Original prompt
                problem,
                testCase.criteria
            );

            console.log(`  スコア: ${evalResult.score}/5`);
            console.log(`  理由: ${evalResult.reason}`);
            console.log(`  判定: ${evalResult.pass ? '合格' : '不合格'}`);

            if (evalResult.pass) passedCount++;

            results.push({
                ...testCase,
                output: problem,
                evaluation: evalResult,
                duration
            });

        } catch (e: any) {
            console.error(`  ケース ${testCase.id} の実行中にエラーが発生しました:`, e.message);
            results.push({ id: testCase.id, pass: false, score: 0, reason: `Error: ${e.message}` });
        }
    }

    // 4. Save Logs
    const logDir = path.resolve(process.cwd(), 'eval/runs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logDir, `run-${timestamp}.json`);
    
    fs.writeFileSync(logFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        total: testCases.length,
        passed: passedCount,
        results
    }, null, 2));

    console.log(`\n-----------------------------------`);
    console.log(`評価完了。ログを保存しました: ${logFile}`);
    console.log(`結果: ${passedCount}/${testCases.length} 合格`);

    if (passedCount < testCases.length) {
        process.exit(1);
    }
}

run();

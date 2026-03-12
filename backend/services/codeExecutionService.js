// services/codeExecutionService.js
// Executes user code via the free Piston API (https://github.com/engineer-man/piston)

const axios = require('axios');

const PISTON_API_URL = 'https://emkc.org/api/v2/piston';

// Language → Piston runtime mapping
const LANGUAGE_MAP = {
  'python':     { language: 'python',     version: '3.10.0' },
  'javascript': { language: 'javascript', version: '18.15.0' },
  'java':       { language: 'java',       version: '15.0.2' },
  'cpp':        { language: 'c++',        version: '10.2.0' },
  'c':          { language: 'c',          version: '10.2.0' },
  'typescript': { language: 'typescript', version: '5.0.3' },
};

/**
 * Execute code using the Piston API.
 * @param {string} code - Source code to execute
 * @param {string} language - Language key (python, javascript, java, cpp, c, typescript)
 * @param {string} [stdin] - Optional standard input
 * @returns {Promise<{output: string, stderr: string, exitCode: number, executionTime: number}>}
 */
async function executeCode(code, language, stdin = '') {
  const runtime = LANGUAGE_MAP[language];
  if (!runtime) {
    throw new Error(`Unsupported language: ${language}. Supported: ${Object.keys(LANGUAGE_MAP).join(', ')}`);
  }

  try {
    const response = await axios.post(`${PISTON_API_URL}/execute`, {
      language: runtime.language,
      version: runtime.version,
      files: [{ name: `main.${getExtension(language)}`, content: code }],
      stdin: stdin,
      compile_timeout: 10000,   // 10s compile timeout
      run_timeout: 5000,        // 5s run timeout
      compile_memory_limit: -1, // no limit
      run_memory_limit: -1,     // no limit
    }, {
      timeout: 15000 // 15s total HTTP timeout
    });

    const { run, compile } = response.data;

    // Check for compilation errors first
    if (compile && compile.stderr) {
      return {
        output: '',
        stderr: compile.stderr,
        exitCode: compile.code || 1,
        executionTime: 0,
        compilationError: true
      };
    }

    return {
      output: run.stdout || '',
      stderr: run.stderr || '',
      exitCode: run.code || 0,
      executionTime: 0, // Piston doesn't return timing in free tier
      compilationError: false
    };
  } catch (error) {
    console.error('Piston API error:', error.message);
    throw new Error(`Code execution failed: ${error.message}`);
  }
}

/**
 * Run code against test cases and return results.
 * @param {string} code - Source code
 * @param {string} language - Language key
 * @param {Array<{input: string, expectedOutput: string}>} testCases
 * @returns {Promise<{passed: number, failed: number, total: number, results: Array}>}
 */
async function runTestCases(code, language, testCases) {
  const results = [];
  let passed = 0;

  for (const testCase of testCases) {
    try {
      const result = await executeCode(code, language, testCase.input);
      const actualOutput = result.output.trim();
      const expectedOutput = testCase.expectedOutput.trim();
      const didPass = actualOutput === expectedOutput && result.exitCode === 0;

      if (didPass) passed++;

      results.push({
        input: testCase.input,
        expected: expectedOutput,
        actual: actualOutput,
        passed: didPass,
        stderr: result.stderr || null,
        exitCode: result.exitCode
      });
    } catch (err) {
      results.push({
        input: testCase.input,
        expected: testCase.expectedOutput,
        actual: '',
        passed: false,
        error: err.message
      });
    }
  }

  return {
    passed,
    failed: testCases.length - passed,
    total: testCases.length,
    allPassed: passed === testCases.length,
    results
  };
}

function getExtension(language) {
  const map = {
    'python': 'py', 'javascript': 'js', 'java': 'java',
    'cpp': 'cpp', 'c': 'c', 'typescript': 'ts'
  };
  return map[language] || 'txt';
}

module.exports = { executeCode, runTestCases, LANGUAGE_MAP };

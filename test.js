const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const tesults = require('tesults');
const TesultsReporter = require('./tesults-reporter');

const originalResults = tesults.results;
const originalOutputFileEnv = process.env.TESULTS_OUTPUT_FILE;
const originalCwd = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jest-tesults-reporter-'));
const uploads = [];
let uploadError;

tesults.results = (data, callback) => {
    uploads.push(JSON.parse(JSON.stringify(data)));
    setImmediate(() => callback(uploadError, {
        success: true,
        message: 'ok',
        warnings: [],
        errors: []
    }));
};

const makeResults = () => ({
    testResults: [{
        testFilePath: '/workspace/tests/example.test.js',
        testResults: [{
            title: 'passes',
            fullName: 'checkout passes',
            status: 'passed',
            failureMessages: [],
            ancestorTitles: ['checkout'],
            duration: 12,
            location: { line: 14, column: 5 }
        }, {
            title: 'fails',
            fullName: 'checkout fails',
            status: 'failed',
            failureMessages: ['Expected true to be false', 'second failure detail'],
            ancestorTitles: ['checkout'],
            duration: 8
        }, {
            title: 'is pending',
            fullName: 'is pending',
            status: 'pending',
            failureMessages: [],
            ancestorTitles: [],
            duration: 0
        }]
    }]
});

const complete = async (options, results = makeResults()) => {
    const reporter = new TesultsReporter({}, options);
    await reporter.onRunComplete(new Set(), results);
};

(async () => {
    try {
        process.chdir(tempDir);
        delete process.env.TESULTS_OUTPUT_FILE;

        const filesRoot = path.join(tempDir, 'captured');
        const caseFilesDir = path.join(filesRoot, 'checkout', 'passes');
        const configuredFile = path.join(caseFilesDir, 'runner.log');
        const supplementalFile = path.join(tempDir, 'screenshot.png');
        fs.mkdirSync(caseFilesDir, { recursive: true });
        fs.writeFileSync(configuredFile, 'log');
        fs.writeFileSync(supplementalFile, 'image');

        const targetOnly = new TesultsReporter({}, {
            'tesults-target': 'target-token',
            'tesults-files': filesRoot,
            'tesults-build-name': 'build',
            'tesults-build-desc': 'build description',
            'tesults-build-result': 'PASS',
            'tesults-build-reason': 'build reason'
        });
        targetOnly.onRunStart();
        const state = {
            testPath: '/workspace/tests/example.test.js',
            currentTestName: 'checkout passes'
        };
        TesultsReporter.file(state, supplementalFile);
        TesultsReporter.file(state, supplementalFile);
        TesultsReporter.description(state, 'checkout description');
        TesultsReporter.step(state, { name: 'open cart', result: 'pass', description: 'opened' });
        TesultsReporter.step(state, { name: 'open cart', result: 'pass' });
        TesultsReporter.custom(state, 'Browser', 'chromium');
        await targetOnly.onRunComplete(new Set(), makeResults());

        assert.strictEqual(uploads.length, 1);
        const targetPayload = uploads[0];
        assert.strictEqual(targetPayload.target, 'target-token');
        assert.deepStrictEqual(targetPayload.metadata, {
            integration_name: 'jest-tesults-reporter',
            integration_version: '1.3.0',
            test_framework: 'jest'
        });
        assert.strictEqual(targetPayload.results.cases.length, 4);
        const passed = targetPayload.results.cases[0];
        assert.strictEqual(passed.name, 'passes');
        assert.strictEqual(passed.suite, 'checkout');
        assert.strictEqual(passed.result, 'pass');
        assert.strictEqual(passed.duration, 12);
        assert.deepStrictEqual(JSON.parse(passed._Location), {
            file: '/workspace/tests/example.test.js',
            line: 14,
            column: 5
        });
        assert.deepStrictEqual(passed.files, [configuredFile, supplementalFile]);
        assert.strictEqual(passed.desc, 'checkout description');
        assert.deepStrictEqual(passed.steps, [{ name: 'open cart', result: 'pass', desc: 'opened' }]);
        assert.strictEqual(passed._Browser, 'chromium');
        assert.strictEqual(targetPayload.results.cases[1].result, 'fail');
        assert.strictEqual(targetPayload.results.cases[1].reason, 'Expected true to be false\r\nsecond failure detail');
        assert.strictEqual(targetPayload.results.cases[2].result, 'unknown');
        assert.deepStrictEqual(targetPayload.results.cases[3], {
            suite: '[build]',
            name: 'build',
            desc: 'build description',
            reason: 'build reason',
            result: 'pass',
            files: []
        });

        const fileOnlyPath = path.join(tempDir, 'file-only', 'tesults-results.json');
        await complete({ 'tesults-output-file': fileOnlyPath });
        assert.strictEqual(uploads.length, 1);
        const fileOnlyPayload = JSON.parse(fs.readFileSync(fileOnlyPath, 'utf8'));
        assert.strictEqual(fileOnlyPayload.target, '');
        assert.strictEqual(fileOnlyPayload.results.cases.length, 3);

        const bothPath = path.join(tempDir, 'both', 'tesults-results.json');
        await complete({
            'tesults-target': 'target-token-both',
            'tesults-output-file': bothPath
        });
        assert.strictEqual(uploads.length, 2);
        assert.strictEqual(uploads[1].target, 'target-token-both');
        const bothPayload = JSON.parse(fs.readFileSync(bothPath, 'utf8'));
        assert.strictEqual(bothPayload.target, '');
        assert.deepStrictEqual(bothPayload.results, uploads[1].results);
        assert.deepStrictEqual(bothPayload.metadata, uploads[1].metadata);

        const envOnlyPath = path.join(tempDir, 'env-only', 'tesults-results.json');
        process.env.TESULTS_OUTPUT_FILE = envOnlyPath;
        await complete({});
        assert.ok(fs.existsSync(envOnlyPath));
        assert.strictEqual(uploads.length, 2);

        const envAndTargetPath = path.join(tempDir, 'env-and-target', 'tesults-results.json');
        process.env.TESULTS_OUTPUT_FILE = envAndTargetPath;
        await complete({ 'tesults-target': 'target-token-env' });
        assert.ok(fs.existsSync(envAndTargetPath));
        assert.strictEqual(JSON.parse(fs.readFileSync(envAndTargetPath, 'utf8')).target, '');
        assert.strictEqual(uploads.length, 3);
        assert.strictEqual(uploads[2].target, 'target-token-env');

        const configuredPath = path.join(tempDir, 'env-wins', 'configured.json');
        const envOverridePath = path.join(tempDir, 'env-wins', 'environment.json');
        process.env.TESULTS_OUTPUT_FILE = envOverridePath;
        await complete({ 'tesults-output-file': configuredPath });
        assert.ok(fs.existsSync(envOverridePath));
        assert.ok(!fs.existsSync(configuredPath));

        const emptyEnvFallbackPath = path.join(tempDir, 'empty-env', 'configured.json');
        process.env.TESULTS_OUTPUT_FILE = '';
        await complete({ 'tesults-output-file': emptyEnvFallbackPath });
        assert.ok(fs.existsSync(emptyEnvFallbackPath));

        delete process.env.TESULTS_OUTPUT_FILE;
        await complete({});
        assert.strictEqual(uploads.length, 3);

        uploadError = new Error('upload failed');
        await complete({ 'tesults-target': 'upload-error-target' });
        assert.strictEqual(uploads.length, 4);
        uploadError = undefined;

        await assert.rejects(
            complete({ 'tesults-output-file': tempDir }),
            (err) => err && (err.code === 'EISDIR' || /directory/i.test(err.message))
        );

        await assert.rejects(
            complete({
                'tesults-target': 'target-despite-write-error',
                'tesults-output-file': tempDir
            }),
            (err) => err && (err.code === 'EISDIR' || /directory/i.test(err.message))
        );
        assert.strictEqual(uploads.length, 5);
        assert.strictEqual(uploads[4].target, 'target-despite-write-error');

        console.log('All tests passed.');
    } finally {
        tesults.results = originalResults;
        if (originalOutputFileEnv === undefined) {
            delete process.env.TESULTS_OUTPUT_FILE;
        } else {
            process.env.TESULTS_OUTPUT_FILE = originalOutputFileEnv;
        }
        process.chdir(originalCwd);
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
})().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});

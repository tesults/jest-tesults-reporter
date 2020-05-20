// tesults-reporter.js
const fs = require('fs');
const path = require('path');
const tesults = require('tesults');

class TesultsReporter {
    constructor(globalConfig, options) {
        this._globalConfig = globalConfig;
        this._options = options;
    }

    caseFiles (dir, suite, name) {
        let files = [];
        if (dir !== undefined) {
            try {
            let filesPath = '';
            if (suite === undefined) {
                filesPath = path.join(this._options['tesults-files'], name);
            } else {
                filesPath = path.join(this._options['tesults-files'], suite, name);
            }

            fs.readdirSync(filesPath).forEach(function (file) {
                if (file !== ".DS_Store") { // Exclude os files
                files.push(path.join(filesPath, file));
                }
            });
            } catch (err) { 
                if (err.code === 'ENOENT') {
                    // Normal scenario where no files present: console.log('Tesults error reading case files, check supplied tesults-files arg path is correct.');
                } else {
                    console.log('Tesults error reading case files.')
                }
            }
        }
        return files;
    }

    onRunStart (results, options) {}

    onTestStart (test) {}

    onTestResult (test, testResult, aggregatedResult) {}

    onRunComplete(contexts, results) {
        const targetKey = "tesults-target";
        const filesKey = "tesults-files";
        const buildNameKey = "tesults-build-name";
        const buildDescKey = "tesults-build-desc";
        const buildResultKey = "tesults-build-result";
        const buildReasonKey = "tesults-build-reason";

        if (this._options[targetKey] === undefined) {
            console.log(targetKey + " not provided. Tesults disabled.");
            return;
        }

        let tesultsCases = [];
        let suites = results.testResults;
        for (let i = 0; i < suites.length; i++) {
            let suite = suites[i];
            let cases = suite.testResults;
            for (let j = 0; j < cases.length; j++) {
                let c = cases[j];
                let tesultsCase = {
                    name: c.title,
                    result: 'unknown'
                }
                if (c.status === 'passed') {
                    tesultsCase.result = 'pass';
                }
                if (c.status === 'failed') {
                    tesultsCase.result = 'fail';
                    tesultsCase.reason = c.failureMessages.join('\r\n');
                }
                if (c.ancestorTitles.length > 0) {
                    tesultsCase.suite = c.ancestorTitles.join(' ');
                } else {
                    // can assign suite as file name if no suites option not active
                }
                if (this._options[filesKey] !== undefined) {
                    tesultsCase.files = this.caseFiles(this._options[filesKey], tesultsCase.suite, tesultsCase.name);
                }
                tesultsCase.duration = c.duration;
                tesultsCases.push(tesultsCase);
            }
        }

        if (this._options[buildNameKey] !== undefined) {
            let buildCase = {suite: '[build]', name: this._options[buildNameKey]};
            if (buildCase.name === "") {
                buildCase.name = "-";
            }
            if (this._options[buildDescKey] !== undefined) {
                buildCase.desc = this._options[buildDescKey];
            }
            if (this._options[buildReasonKey] !== undefined) {
                buildCase.reason = this._options[buildReasonKey];
            }
            buildCase.result = 'unknown';
            if (this._options[buildResultKey] !== undefined) {
                let buildResult = this._options[buildResultKey].toLowerCase();
                if (buildResult === "pass" || buildResult === "fail") {
                    buildCase.result = buildResult;
                }
            }
            if (this._options[filesKey] !== undefined) {
                buildCase.files = this.caseFiles(this._options[filesKey], buildCase.suite, buildCase.name);
            }
            tesultsCases.push(buildCase);
        }

        let data = {
            target: this._options[targetKey],
            results: {
                cases: tesultsCases
            }
        }
        
        console.log('Tesults results upload...');
        tesults.results(data, function (err, response) {
            if (err) {
                // err is undefined unless there is a library error
                console.log('Tesults library error, failed to upload.');
            } else {
                console.log('Success: ' + response.success);
                console.log('Message: ' + response.message);
                console.log('Warnings: ' + response.warnings.length);
                console.log('Errors: ' + response.errors.length);
            }
        });
    }

    getLastError () {
        // return new Error('error');
    }
  }
  
  module.exports = TesultsReporter;
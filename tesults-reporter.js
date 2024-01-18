// tesults-reporter.js
const fs = require('fs');
const path = require('path');
const tesults = require('tesults');

const supplementalDataFile = "tesults-supplemental-data-file.json"

const getSupplementalData = () => {
    try {
        let dataString = fs.readFileSync(supplementalDataFile, {encoding: 'utf8'})
        return JSON.parse(dataString)
    } catch (err) {
        console.log("tesults-reporter error getting supplemental data: " + err)
        return {}
    }
}

const setSupplementalData = (data) => {
    try {
        let fileContents = JSON.stringify(data)
        fs.writeFileSync(supplementalDataFile, fileContents)
    } catch (err) {
        console.log("tesults-reporter error saving supplemental data: " + err)
    }
}

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

    onRunStart (results, options) {
        try {
            setSupplementalData({})
        } catch (err) {
            console.log("tesults-reporter error initializing supplemental data: " + err)
        }
    }

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

                // Add supplemental data
                const key = suite.testFilePath + "-" + c.fullName
                const supplemental = getSupplementalData()
                const data = supplemental[key]
                if (data !== undefined) {
                    // files
                    if (data.files !== undefined) {
                        data.files = [...new Set(data.files)]

                        if (tesultsCase.files === undefined) {
                            tesultsCase.files = data.files
                        } else {
                            for (let f = 0; f < data.files.length; f++) {
                                tesultsCase.files.push(data.files[f])
                            }
                        }
                    }
                    // desc
                    tesultsCase.desc = data.desc
                    // steps
                    if (data.steps !== undefined) {
                        let cleaned_steps = []
                        for (let s = 0; s < data.steps.length; s++) {
                            let step = data.steps[s]
                            if (cleaned_steps.length > 0) {
                                let last_step = cleaned_steps[cleaned_steps.length - 1]
                                if (step.name === last_step.name && step.result === last_step.result) {
                                    // Do not add repeated step
                                } else {
                                    cleaned_steps.push(step)
                                }
                            } else {
                                cleaned_steps.push(step)
                            }
                        }
                        tesultsCase.steps = cleaned_steps
                    }
                    // custom
                    Object.keys(data).forEach((key) => {
                        if (key.startsWith("_")) {
                            tesultsCase[key] = data[key]
                        }
                    })
                }
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
            },
            metadata: {
                integration_name: "jest-tesults-reporter",
                integration_version: "1.2.3",
                test_framework: "jest"
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


module.exports.file = (state, path) => {
    if (state === undefined) {
        return
    }

    let supplemental = getSupplementalData()
    const key = state.testPath + "-" + state.currentTestName
    if (supplemental[key] === undefined) {
        supplemental[key] = { files: [path]}
    } else {
        let data = supplemental[key]
        if (data.files === undefined) {
            data.files = [path]
        } else {
            data.files.push(path)
        }
        supplemental[key] = data
    }
    setSupplementalData(supplemental)
}

module.exports.custom = (state, name, value) => {
    if (state === undefined) {
        return
    }

    let supplemental = getSupplementalData()
    const key = state.testPath + "-" + state.currentTestName
    if (supplemental[key] === undefined) {
        supplemental[key] = {}
    }
    supplemental[key]["_" + name] = value
    setSupplementalData(supplemental)
}

module.exports.description = (state, value) => {
    if (state === undefined) {
        return
    }

    let supplemental = getSupplementalData()
    const key = state.testPath + "-" + state.currentTestName
    if (supplemental[key] === undefined) {
        supplemental[key] = {}
    }
    supplemental[key]["desc"] = value
    setSupplementalData(supplemental)
}

module.exports.step =  (state, step) => {
    if (state === undefined || step === undefined) {
        return
    }
    if (step.description !== undefined) {
        step.desc = step.description
        delete step.description
    }
    let supplemental = getSupplementalData()
    const key = state.testPath + "-" + state.currentTestName
    if (supplemental[key] === undefined) {
        supplemental[key] = { steps: [step] }
    } else {
        if (supplemental[key]["steps"] === undefined) {
            supplemental[key]["steps"] = [step]
        } else {
            let steps = supplemental[key]["steps"]
            steps.push(step)
            supplemental[key]["steps"] = steps
        }
    }
    setSupplementalData(supplemental)
}
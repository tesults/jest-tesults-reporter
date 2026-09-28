# Jest Tesults Reporter

Report Jest test results to Tesults, write them to a local JSON file, or do both in the same run.

## Installation

```sh
npm install --save-dev jest-tesults-reporter
```

## Upload results to Tesults

Add the reporter to your Jest configuration with your Tesults target token:

```js
module.exports = {
  reporters: [
    'default',
    ['jest-tesults-reporter', {
      'tesults-target': 'token'
    }]
  ]
};
```

Existing target-only configurations continue to upload results as before.

## Write results locally

Use `tesults-output-file` to write the Tesults JSON payload without uploading it:

```js
module.exports = {
  reporters: [
    'default',
    ['jest-tesults-reporter', {
      'tesults-output-file': './test-results/tesults-results.json'
    }]
  ]
};
```

No Tesults account or target token is required for local output. Parent directories are created automatically. The local payload has an empty `target` value.

`tesults-target` and `tesults-output-file` can be used independently or together. When both are configured, the reporter writes the local payload and uploads the results to Tesults.

The output file can also be supplied through the `TESULTS_OUTPUT_FILE` environment variable. When set to a non-empty value, the environment path overrides the `tesults-output-file` reporter option for that run.

## GitHub Actions reporting

The [Test Automation Reporting for GitHub Actions](https://github.com/tesults/test-automation-reporting) action supplies `TESULTS_OUTPUT_FILE` automatically. Place the action before the Jest test step:

```yaml
- name: Set up test automation reporting
  uses: tesults/test-automation-reporting@v1

- name: Run Jest tests
  run: npm test
```

Keep `jest-tesults-reporter` in your Jest configuration. A target token is optional.

Source locations are included when Jest provides test locations. Enable `testLocationInResults: true` in your Jest configuration when you want file and line links in the GitHub report.

## Documentation

Full Jest reporter documentation is available at https://www.tesults.com/docs?doc=jest.

## Testing

```sh
npm test
```

## Support

support@tesults.com

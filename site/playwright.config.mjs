import { defineConfig } from '@playwright/test';

const artifacts = './tests/.artifacts';
const port = Number(process.env.QA_PORT || 4173);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  outputDir: `${artifacts}/test-results`,
  preserveOutput: 'always',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: [
    ['list'],
    ['html', {
      outputFolder: `${artifacts}/html`,
      open: 'never',
      title: 'Le Sillage — QA de composition',
    }],
    ['json', { outputFile: `${artifacts}/results.json` }],
  ],
  use: {
    baseURL,
    browserName: 'chromium',
    colorScheme: 'light',
    locale: 'fr-FR',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});

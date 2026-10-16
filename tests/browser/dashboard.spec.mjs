import {test, expect} from '@playwright/test';
import {rawRun, rawJob} from '../fixtures.mjs';

test('sample works under a subdirectory without GitHub requests', async ({page}) => {
  const requests = [], failures = [];
  page.on('request', request => {if (request.url().includes('api.github.com')) requests.push(request.url());});
  page.on('response', response => {if (response.status() >= 400) failures.push(response.url());});
  await page.goto('./');
  await expect(page.locator('#success-rate')).toHaveText('%67');
  await expect(page.locator('.run-card')).toHaveCount(8);
  await page.locator('#group-filter').selectOption('failure');
  await expect(page.locator('.run-card')).toHaveCount(2);
  await expect(page.locator('#success-rate')).toHaveText('%67');
  await page.locator('#lesson-before').click();
  await expect(page.locator('#detail-number')).toContainText('#47');
  await expect(page.locator('.sample-explanation')).toContainText('Hata:');
  await page.locator('#lesson-after').click();
  await expect(page.locator('#detail-number')).toContainText('#48');
  await expect(page.locator('.sample-explanation')).toContainText('Düzeltme:');
  await expect(page.locator('#detail-content a')).toHaveCount(0);
  expect(requests).toEqual([]);
  expect(failures).toEqual([]);
});

test('live response renders text safely and fetches the selected attempt', async ({page}) => {
  const requests = [];
  const title = '<img src=x onerror=alert(1)>';
  await page.route('https://api.github.com/**', async route => {
    requests.push(route.request().url());
    const jobs = route.request().url().includes('/jobs');
    await route.fulfill({json: jobs ? {total_count: 1, jobs: [rawJob()]} : {total_count: 3, workflow_runs: [rawRun({display_title: title}), rawRun({id:43, conclusion:'failure'}), rawRun({id:44, conclusion:'cancelled'})]}});
  });
  await page.goto('./');
  await page.locator('#repo-input').fill('test/repo');
  await page.locator('#load-button').click();
  await expect(page.locator('#mode-badge')).toHaveText('GITHUB VERİSİ');
  await expect(page.locator('#success-rate')).toHaveText('%50');
  await expect(page.locator('#rate-detail')).toHaveText('2 sonuç hesaba katıldı · 1 diğer');
  await expect(page.locator('#jobs-container')).toContainText('Run tests');
  await expect(page.locator('.detail-run-title')).toHaveText(title);
  await expect(page.locator('#dashboard img')).toHaveCount(0);
  await expect(page.locator('.github-link')).toHaveAttribute('href', 'https://github.com/test/repo/actions/runs/42/attempts/2');
  await expect(page.locator('.github-link')).toHaveAttribute('rel', 'noopener noreferrer');
  expect(requests.some(url => url.includes('/runs/42/attempts/2/jobs'))).toBe(true);
});

test('API errors stay visible until sample mode is explicitly selected', async ({page}) => {
  await page.route('https://api.github.com/**', route => route.fulfill({status:403, headers:{'x-ratelimit-remaining':'0'}, json:{message:'API rate limit exceeded'}}));
  await page.goto('./');
  await page.locator('#repo-input').fill('test/repo');
  await page.locator('#load-button').click();
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#dashboard')).toBeHidden();
  await expect(page.locator('#load-button')).toBeEnabled();
  await page.locator('#sample-button').click();
  await expect(page.locator('#error')).toBeHidden();
  await expect(page.locator('#dashboard')).toBeVisible();
  await expect(page.locator('#mode-badge')).toContainText('ÖRNEK VERİ');
  await expect(page.locator('#success-rate')).toHaveText('%67');
});

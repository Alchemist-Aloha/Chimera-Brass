import { test, expect } from '@playwright/test';

test('tenor trombone makes live sound and a continuous slide lowers the sounding partial', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#instrument').selectOption('trombone');
  await expect(page.locator('h1')).toHaveText('Trombone laboratory');
  await expect(page.locator('#trombone-assembly')).toBeVisible();
  await expect(page.locator('#trumpet-assembly')).toBeHidden();
  await expect(page.locator('#valve-controls')).toBeHidden();
  await expect(page.locator('#music')).toBeVisible();
  await expect(page.locator('#music-range')).toContainText('E2–B♭4');
  await expect(page.locator('[data-note="40"]')).toContainText('pos 7');
  await expect(page.locator('#bore-length')).toContainText('2.976');
  await page.locator('#setup-play').click();
  await expect.poll(async () => {
    const f = parseFloat(await page.locator('#pitch').innerText());
    return f > 170 && f < 182;
  }).toBe(true);
  const before = parseFloat(await page.locator('#pitch').innerText());
  const path = await page.locator('#trombone-air-path').getAttribute('d');
  await page.locator('#slide-number').fill('100');
  await page.locator('#slide-number').press('Enter');
  await expect(page.locator('#slide')).toHaveValue('100');
  await expect(page.locator('#slide-actual')).toHaveText('100.0 mm');
  await expect(page.locator('#bore-length')).toContainText('3.176');
  await expect(page.locator('#trombone-air-path')).not.toHaveAttribute('d', path);
  await expect.poll(async () => {
    const f = parseFloat(await page.locator('#pitch').innerText());
    return f > 160 && f < before - 4;
  }).toBe(true);
  await expect(page.locator('#setup-play')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => Math.abs(parseFloat(await page.locator('#oral-pressure').innerText()))).toBeGreaterThan(0.1);
  await page.locator('h1').click(); await page.keyboard.press('k');
  await expect(page.locator('#articulation')).toHaveValue('ku');
  await expect(page.locator('#setup-play')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#reset').click();
  await expect(page.locator('#instrument')).toHaveValue('trombone');
  await expect(page.locator('#slide-number')).toHaveValue('0');
  await expect(page.locator('#lipFrequency-number')).toHaveValue('137');
  await expect(page.locator('#setup-play')).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('slide positions, direct-entry validation and instrument-aware presets fit touch viewports', async ({ page }) => {
  await page.goto('/'); await page.locator('#instrument').selectOption('trombone');
  await expect(page.locator('[data-slide-position]')).toHaveCount(7);
  await page.locator('h1').click(); await page.keyboard.press('7');
  await expect(page.locator('[data-slide-position="6"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#slide-number')).toHaveValue('616.5');
  await page.locator('[data-slide-position="0"]').click();
  await expect(page.locator('#slide-number')).toHaveValue('0');
  const path = await page.locator('#trombone-air-path').getAttribute('d');
  await page.locator('#tuning-number').fill('10'); await page.locator('#tuning-number').press('Enter');
  await expect(page.locator('#bore-length')).toContainText('2.996');
  await expect(page.locator('#trombone-air-path')).not.toHaveAttribute('d', path);
  await page.locator('#slide-number').fill('651'); await page.locator('#slide-number').press('Enter');
  await expect(page.locator('#slide-number')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#slide')).toHaveValue('0');
  await page.locator('#slide-number').press('Escape');
  await expect(page.locator('#slide-number')).toHaveValue('0');
  await page.locator('#preset').selectOption('gentle');
  await expect(page.locator('#lipFrequency-number')).toHaveValue('77');
  await page.locator('#preset').selectOption('upper');
  await expect(page.locator('#lipFrequency-number')).toHaveValue('296');
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.value-field:visible').evaluateAll(fields => fields.every(field => field.getBoundingClientRect().width >= 100))).toBe(true);
  }
});

test('switching instruments cancels trumpet playback and restores trumpet MIDI without stale notes', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#score-play').click();
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#instrument').selectOption('trombone');
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#lipFrequency-number')).toHaveValue('137');
  await page.waitForTimeout(1000);
  await expect(page.locator('#lipFrequency-number')).toHaveValue('137');
  await page.locator('#setup-play').click();
  await expect.poll(async () => parseFloat(await page.locator('#pitch').innerText())).toBeGreaterThan(165);
  await page.locator('#instrument').selectOption('trumpet');
  await expect(page.locator('#setup-play')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#trumpet-assembly')).toBeVisible();
  await expect(page.locator('#trombone-assembly')).toBeHidden();
  await expect(page.locator('#bore-length')).toContainText('1.480');
  await expect(page.locator('#lipFrequency-number')).toHaveValue('280');
  await page.locator('[data-note="70"]').click();
  await expect(page.locator('#pitch')).toContainText('B♭4');
  await expect(page.locator('#audio-message')).not.toHaveClass(/error/);
  expect(errors).toEqual([]);
});

test('trombone notes, partial picker and demos use calibrated slide placements', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#instrument').selectOption('trombone');
  await page.locator('[data-slide-position="3"]').click();
  await expect(page.locator('#partials-title')).toHaveText('Notes near position 4');
  await page.locator('[data-partial="50"]').click();
  await expect(page.locator('#setup-play')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pitch')).toContainText('D3', { timeout: 4000 });
  await expect(page.locator('#tuner-note')).toHaveText('D3');
  await page.locator('#setup-play').click();
  await expect(page.locator('#score-description')).not.toBeEmpty();
  await expect(page.locator('#music-message')).toContainText('one octave below');
  await page.locator('[data-note="58"]').click();
  await expect(page.locator('#pitch')).toContainText('B♭3', { timeout: 3000 });
  await page.locator('#score-stop').click();
  await page.locator('#score-play').click();
  await expect(page.locator('#score-current')).toContainText('position', { timeout: 3000 });
  await page.locator('#score-stop').click();
  expect(errors).toEqual([]);
});

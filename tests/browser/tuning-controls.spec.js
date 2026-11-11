import { test, expect } from '@playwright/test';

test('every physical parameter supports direct entry in its displayed units', async ({ page }) => {
  await page.goto('/');
  await page.locator('.advanced > summary').click();
  const values = [
    ['pressure', '6.2', '6.2'], ['lipFrequency', '330', '330'],
    ['opening', '0.25', '0.25'], ['tongue', '80', '0.8'],
    ['tuning', '12.5', '12.5'], ['tractLength', '19.5', '0.195'],
    ['lipQ', '8.2', '8.2'], ['lipMass', '4.5', '4.5'], ['temperature', '25', '25'],
  ];
  for (const [key, displayed, internal] of values) {
    const editor = page.locator(`#${key}-number`);
    await editor.fill(displayed);
    await editor.press('Enter');
    await expect(page.locator(`#${key}`)).toHaveValue(internal);
    await expect(editor).not.toHaveAttribute('aria-invalid', 'true');
  }
  await page.locator('#tongue').fill('0.45');
  await expect(page.locator('#tongue-number')).toHaveValue('45');
  await page.locator('#pressure-number').focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.locator('#pressure')).toHaveValue('6.3');
});

test('invalid entries never reach the model and Escape restores the current value', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const editor = page.locator('#pressure-number');
  for (const value of ['16', '5.25', '']) {
    await editor.fill(value);
    await editor.press('Enter');
    await expect(editor).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#pressure-error')).toContainText('0 to 15 kPa');
    await expect(page.locator('#pressure')).toHaveValue('5.5');
    await editor.focus();
    await editor.press('Escape');
    await expect(editor).toHaveValue('5.5');
    await expect(page.locator('#pressure-error')).toBeHidden();
  }
  await editor.fill('7.2');
  await editor.press('Escape');
  await expect(page.locator('#pressure')).toHaveValue('5.5');
  expect(errors).toEqual([]);
});

test('setup playback, measured feedback and individual restore keep manual breath running', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pressure-number').fill('6.2');
  await page.locator('#pressure-number').press('Enter');
  await page.locator('#opening-number').fill('0.25');
  await page.locator('#opening-number').press('Enter');
  await page.getByRole('button', { name: 'Play setup', exact: true }).click();
  await expect(page.locator('#setup-pitch')).not.toContainText('—', { timeout: 15000 });
  await expect(page.locator('#setup-play')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Restore Breath pressure default', exact: true }).click();
  await expect(page.locator('#pressure-number')).toHaveValue('5.5');
  await expect(page.locator('#opening-number')).toHaveValue('0.25');
  await expect(page.locator('[data-reset="pressure"]')).toBeDisabled();
  await page.waitForTimeout(600);
  await expect.poll(async () => Math.abs(parseFloat(await page.locator('#oral-pressure').innerText()))).toBeGreaterThan(0.1);
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#reset').click();
  await expect(page.locator('#opening-number')).toHaveValue('0.18');
  await expect(page.locator('#setup-play')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#setup-pitch')).toContainText('—', { timeout: 7000 });
});

test('live MIDI updates do not overwrite an in-progress edit and tuning stays live', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#score-play')).toBeEnabled();
  await page.locator('#score-play').click();
  await expect(page.locator('#setup-play')).toHaveAttribute('aria-pressed', 'true');
  const editor = page.locator('#pressure-number');
  await editor.fill('6.2');
  await page.waitForTimeout(1100);
  await expect(editor).toHaveValue('6.2');
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'true');
  await editor.press('Escape');
  await page.locator('#lipFrequency-number').fill('399');
  await page.locator('#lipFrequency-number').press('Escape');
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#tuning-number').fill('10');
  await page.locator('#tuning-number').press('Enter');
  await page.waitForTimeout(900);
  await expect(page.locator('#tuning-number')).toHaveValue('10');
  await expect(page.locator('#setup-play')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#pressure-number').fill('6.2');
  await page.locator('#pressure-number').press('Enter');
  await expect(page.locator('#setup-play')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#pressure-number')).toHaveValue('6.2');
});

test('setup exposes audio errors locally, shows loading and recovers on retry', async ({ page }) => {
  await page.addInitScript(() => {
    window.savedAudioContext = window.AudioContext;
    window.AudioContext = undefined;
  });
  await page.goto('/');
  await page.locator('#setup-play').click();
  await expect(page.locator('#setup-error')).toContainText('AudioWorklet is unavailable');
  await expect(page.locator('#setup-play')).toBeEnabled();
  await expect(page.locator('#setup-play')).toHaveAttribute('aria-pressed', 'false');
  await page.evaluate(() => { window.AudioContext = window.savedAudioContext; });
  await page.route('**/*worklet*', async route => {
    await new Promise(resolve => setTimeout(resolve, 250));
    await route.continue();
  });
  await page.locator('#setup-play').click();
  await expect(page.locator('#setup-play')).toBeDisabled();
  await expect(page.locator('#play')).toBeDisabled();
  await expect(page.locator('#setup-play')).toBeEnabled();
  await expect(page.locator('#setup-error')).toBeHidden();
  await expect(page.locator('#setup-pitch')).not.toContainText('—', { timeout: 15000 });
});

test('tuning is reachable on touch screens and fits small, intermediate and wide viewports', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await page.getByRole('link', { name: 'Tune parameters', exact: true }).tap();
    await expect(page.locator('#setup-play')).toBeInViewport();
    await page.locator('#tuning-number').scrollIntoViewIfNeeded();
    await expect(page.locator('#setup-play')).toBeInViewport();
    await expect(page.locator('#tuning-number')).toBeInViewport();
    await page.locator('.advanced > summary').tap();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const editors = await page.locator('.value-field:visible').evaluateAll(fields => fields.map(field => {
        const r = field.getBoundingClientRect();
        const input = field.querySelector('input');
        return r.width >= 100 && r.left >= 0 && r.right <= innerWidth && input.getBoundingClientRect().width >= 40;
      }));
      expect(editors.every(Boolean)).toBe(true);
    }
  } finally { await context.close(); }
});

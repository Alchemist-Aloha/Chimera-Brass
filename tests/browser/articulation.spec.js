import { test, expect } from '@playwright/test';

test('T and K start and re-tongue live airflow with distinct front/rear contact markers', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('h1').click();
  await page.keyboard.press('t');
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pitch')).toContainText('ct');
  const front = await page.locator('#tongue-contact').getAttribute('d');
  await page.keyboard.press('k');
  await expect(page.locator('#articulation')).toHaveValue('ku');
  await expect(page.locator('#tongue-contact')).not.toHaveAttribute('d', front);
  await page.waitForTimeout(400);
  await expect.poll(async () => Math.abs(parseFloat(await page.locator('#oral-pressure').innerText()))).toBeGreaterThan(0.1);
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#tongue-note').click();
  await page.locator('h1').click();
  await page.keyboard.press('t');
  await expect(page.locator('#articulation')).toHaveValue('tu');
  await expect(page.locator('#tongue-contact')).toHaveAttribute('d', front);
  await page.locator('#play').click();
  await expect(page.locator('#pitch')).toContainText('—', { timeout: 7000 });
  expect(errors).toEqual([]);
});

test('main tuning slide changes the shared drawing and lowers actual concert pitch', async ({ page }) => {
  await page.goto('/');
  const path = await page.locator('[data-main-tube]').first().getAttribute('d');
  const routeLength = await page.locator('#trumpet-air-path').evaluate(p => p.getTotalLength());
  await page.locator('[data-page="music"]').click();
  await page.locator('[data-note="70"]').click();
  await expect(page.locator('#pitch')).toContainText('B♭4', { timeout: 1500 });
  await page.locator('[data-page="lab"]').click();
  const before = parseFloat(await page.locator('#pitch').innerText());
  await page.locator('#tuning').fill('10');
  await expect(page.locator('#tuning-number')).toHaveValue('10');
  await expect(page.locator('#bore-length')).toContainText('1.500');
  await expect(page.locator('[data-main-tube]').first()).not.toHaveAttribute('d', path);
  await expect(page.locator('#water-key')).toHaveAttribute('transform', 'translate(6 0)');
  expect(await page.locator('#trumpet-air-path').evaluate(p => p.getTotalLength()) - routeLength).toBeCloseTo(12, 2);
  await page.waitForTimeout(300);
  await expect.poll(async () => {
    const label = await page.locator('#pitch').innerText();
    return label.includes('B♭4') && parseFloat(label) < before - 1;
  }, { timeout: 4000 }).toBe(true); // the slide travels at hand speed; a loaded worklet reports late
  await expect(page.locator('#pitch')).toContainText('ct');
  await page.locator('#reset').click();
  await expect(page.locator('#tuning')).toHaveValue('0');
  await expect(page.locator('#articulation')).toHaveValue('tu');
  await expect(page.locator('[data-main-tube]').first()).toHaveAttribute('d', path);
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'false');
});

test('tuning and tongue style stay live through MIDI note changes and settling', async ({ page }) => {
  await page.goto('/');
  await page.locator('#articulation').selectOption('ku');
  await page.locator('#tuning').fill('5');
  await page.locator('[data-page="music"]').click();
  await page.locator('#score-play').click();
  await expect(page.locator('#pitch')).not.toContainText('—');
  await page.locator('[data-page="lab"]').click();
  await page.locator('#tuning').fill('10');
  await page.locator('#articulation').selectOption('tu');
  await page.waitForTimeout(2200);
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#score-progress')).not.toHaveAttribute('value', '0');
  await expect(page.locator('#tuning')).toHaveValue('10');
  await expect(page.locator('#articulation')).toHaveValue('tu');
  await expect.poll(async () => Math.abs(parseFloat(await page.locator('#oral-pressure').innerText()))).toBeGreaterThan(0.1);
  await page.locator('[data-page="music"]').click();
  await page.locator('#score-stop').click();
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#audio-message')).not.toHaveClass(/error/);
});

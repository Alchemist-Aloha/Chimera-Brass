import { test, expect } from '@playwright/test';

test('playback spans the workbench and melody uses the full width below both panels', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const bounds = await page.evaluate(() => {
    const box = selector => {
      const { x, y, width, bottom } = document.querySelector(selector).getBoundingClientRect();
      return { x, y, width, bottom };
    };
    return { lab: box('.laboratory'), controls: box('#setup'), music: box('#music'), bar: box('.setup-listen'), nested: !!document.querySelector('#setup .setup-listen') };
  });
  expect(bounds.nested).toBe(false);
  expect(bounds.controls.x).toBeGreaterThan(bounds.lab.x);
  expect(bounds.music.x).toBe(bounds.lab.x);
  expect(Math.abs(bounds.music.width - bounds.lab.width - bounds.controls.width)).toBeLessThan(2);
  expect(bounds.music.y).toBeGreaterThanOrEqual(Math.max(bounds.lab.bottom, bounds.controls.bottom) - 1);
  expect(bounds.bar.width).toBe(bounds.music.width);
  await page.getByRole('link', { name: 'Play a melody', exact: true }).click();
  await expect(page.locator('#setup-play')).toBeInViewport();
  await expect(page.locator('.music-heading')).toBeInViewport();
  await expect(page.locator('#score-play')).toBeEnabled();
});

test('dark native fields, feedback, dialog and validation maintain readable contrast', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('html').evaluate(el => getComputedStyle(el).colorScheme)).toBe('dark');
  const ratios = await page.evaluate(() => {
    const luminance = color => {
      const rgb = color.match(/[\d.]+/g).slice(0, 3).map(n => {
        const s = +n / 255;
        return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
      });
      return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    };
    const root = getComputedStyle(document.documentElement);
    const contrast = (a, b) => {
      const x = luminance(a), y = luminance(b);
      return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
    };
    const color = name => getComputedStyle(document.body).getPropertyValue(name).trim();
    const resolve = name => {
      const probe = document.createElement('span'); probe.style.color = color(name);
      document.body.append(probe); const rgb = getComputedStyle(probe).color; probe.remove(); return rgb;
    };
    return [
      contrast(root.color, root.backgroundColor),
      contrast(resolve('--muted'), getComputedStyle(document.querySelector('#setup')).backgroundColor),
      contrast(getComputedStyle(document.querySelector('#setup-play')).color, getComputedStyle(document.querySelector('#setup-play')).backgroundColor),
      contrast(resolve('--error'), getComputedStyle(document.querySelector('#setup')).backgroundColor),
      contrast(resolve('--control-line'), getComputedStyle(document.querySelector('.value-field')).backgroundColor),
    ];
  });
  for (const ratio of ratios.slice(0, 4)) expect(ratio).toBeGreaterThanOrEqual(4.5);
  expect(ratios[4]).toBeGreaterThanOrEqual(3);
  await page.locator('#pressure-number').fill('16');
  await page.locator('#pressure-number').press('Enter');
  await expect(page.locator('#pressure-error')).toBeVisible();
  await page.locator('#pressure-number').press('Escape');
  await page.locator('#model-notes').click();
  await expect(page.locator('#notes-dialog')).toBeVisible();
  expect(await page.locator('#notes-dialog').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(25, 34, 28)');
  await page.keyboard.press('Escape');
  await expect(page.locator('#notes-dialog')).toBeHidden();
});

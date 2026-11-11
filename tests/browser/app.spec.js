import { test, expect } from '@playwright/test';

test('real AudioWorklet starts silent, self-oscillates, plots and stops', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('ChimeraBrass — A physical sound laboratory');
  await expect(page.getByRole('link', { name: 'ChimeraBrass home' })).toHaveText('ChimeraBrass');
  await expect(page.getByRole('heading', { name: 'Trumpet laboratory' })).toBeVisible();
  await expect(page.locator('#live-status')).toContainText('At rest');
  await expect(page.locator('#pitch')).toContainText('—');
  await page.getByRole('button', { name: 'Start airflow' }).click();
  await expect(page.getByRole('button', { name: 'Stop airflow' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pitch')).not.toContainText('—', { timeout: 15000 });
  await expect(page.locator('#sample-rate')).toContainText('2×');
  await expect(page.locator('#oral-pressure')).not.toContainText('0.00');
  await expect.poll(() => page.locator('#head-sections path').evaluateAll(lines =>
    Math.max(...lines.map(line => Number(line.getAttribute('opacity')))))).toBeGreaterThan(0.2);
  await page.getByRole('button', { name: 'Spectrum', exact: true }).click();
  await expect(page.locator('#signal-caption')).toContainText('SPECTRUM');
  await page.getByRole('button', { name: 'Stop airflow' }).click();
  await expect(page.locator('#pitch')).toContainText('—', { timeout: 7000 });
  await expect(page.locator('#audio-message')).not.toHaveClass(/error/);
  expect(errors).toEqual([]);
});

test('live tongue control reshapes the airway without stopping manual breath', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start airflow' }).click();
  await expect(page.locator('#pitch')).not.toContainText('—');
  const before = await page.locator('#tongue-shape').getAttribute('d');
  await page.locator('#tongue').fill('0.7');
  // Wait past breath decay so stale telemetry cannot hide an accidental note-off.
  await page.waitForTimeout(600);
  await expect.poll(async () => Math.abs(parseFloat(await page.locator('#oral-pressure').innerText()))).toBeGreaterThan(0.1);
  expect(await page.locator('#tongue-shape').getAttribute('d')).not.toBe(before);
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Stop airflow' }).click();
});

test('controls reshape anatomy, change physical path, and reset safely', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#chimera-head')).toBeVisible();
  await expect(page.locator('#head-sections path')).toHaveCount(44);
  const oldTongue = await page.locator('#tongue-shape').getAttribute('d');
  const oldPath = await page.locator('#tract-air').getAttribute('d');
  await page.locator('#tongue').fill('0.9');
  await expect(page.locator('#tongue-number')).toHaveValue('90');
  expect(await page.locator('#tract-air').getAttribute('d')).not.toBe(oldPath);
  expect(await page.locator('#tongue-shape').getAttribute('d')).not.toBe(oldTongue);
  await page.getByRole('button', { name: 'Valve 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Valve 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#bore-length')).toContainText('1.661');
  await page.locator('h1').click();
  await page.keyboard.down('2');
  await expect(page.getByRole('button', { name: 'Valve 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.up('2');
  await expect(page.getByRole('button', { name: 'Valve 2', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.locator('.advanced > summary').click();
  await page.locator('#tractLength').fill('0.2');
  await expect(page.locator('#tractLength-number')).toHaveValue('20');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('#tongue-number')).toHaveValue('45');
  await expect(page.locator('#bore-length')).toContainText('1.480');
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'false');
});

test('all eight valve combinations keep one connected mouth-to-bell cutaway route', async ({ page }) => {
  await page.goto('/');
  const lengths = [];
  let previous = 0;
  for (let mask = 0; mask < 8; mask++) {
    for (let i = 0; i < 3; i++) {
      if ((mask ^ previous) & (1 << i)) await page.getByRole('button', { name: 'Valve ' + (i + 1), exact: true }).click();
      await expect(page.locator('#piston-' + i)).toHaveClass(mask & (1 << i) ? /down/ : /^(?!.*down)/);
    }
    const route = await page.locator('#trumpet-air-path').evaluate(path => {
      const length = path.getTotalLength();
      const start = path.getPointAtLength(0), end = path.getPointAtLength(length);
      return { d: path.getAttribute('d'), length, start: [start.x, start.y], end: [end.x, end.y] };
    });
    expect(route.d.match(/M/g)).toHaveLength(1);
    expect(route.start).toEqual([279, 204]);
    expect(route.end).toEqual([1032, 178]);
    expect(Number.isFinite(route.length)).toBe(true);
    lengths.push(route.length);
    previous = mask;
  }
  for (let mask = 1; mask < 8; mask++) {
    const extra = [0, 1, 2].reduce((sum, i) => sum + (mask & (1 << i) ? lengths[1 << i] - lengths[0] : 0), 0);
    expect(lengths[mask] - lengths[0]).toBeCloseTo(extra, 2);
    expect(lengths[mask]).toBeGreaterThan(lengths[0]);
  }
  await page.screenshot({ path: 'test-results/desktop-valves.png', fullPage: true });
});

test('credits acknowledge reused code and retain licenses, with keyboard dismissal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Credits & licenses' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('not a validated digital twin');
  await expect(page.getByRole('dialog')).toContainText('Chimera Vocal Synth');
  await expect(page.getByRole('dialog')).toContainText('Pink Trombone');
  await expect(page.getByRole('dialog').locator('a[href="./licenses/chimera-MIT.txt"]')).toBeVisible();
  const license = await page.request.get('/licenses/chimera-MIT.txt');
  expect(license.ok()).toBe(true);
  expect(await license.text()).toContain('Jameson Hodge');
  await expect(page.getByRole('dialog')).toContainText('Neil Thapen');
  await expect(page.getByRole('dialog')).toContainText('@tonejs/midi');
  await expect(page.getByRole('dialog')).toContainText('independent adaptation');
  for (const name of ['chimerabrass-MIT', 'pink-trombone-MIT', 'tonejs-midi-MIT', 'midi-file-MIT', 'array-flatten-MIT', 'dm-sans-OFL', 'instrument-serif-OFL', 'yamaha-reference', 'score-sources']) {
    const notice = await page.request.get(`/licenses/${name}.txt`);
    expect(notice.ok(), name).toBe(true);
    expect((await notice.text()).length, name).toBeGreaterThan(100);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('mobile layout fits the viewport with usable controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Start airflow' })).toBeVisible();
  await page.getByRole('button', { name: 'Valve 3', exact: true }).click();
  await expect(page.locator('#extra-length')).toContainText('+28.0');
  await expect(page.locator('[data-note]')).toHaveCount(31);
  await page.locator('.reference > summary').click();
  await expect(page.locator('.reference img')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});

test('MIDI demo drives physical notes, score progress and pistons, then stops safely', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#music');
  await expect(page.locator('#score-timeline .score-note')).toHaveCount(30);
  await expect(page.locator('#score-description')).toContainText('Five semitones lower');
  await expect(page.locator('#score-source')).toHaveAttribute('href', 'https://www.mutopiaproject.org/ftp/BeethovenLv/ode/ode-a4.pdf');
  await page.locator('#score-play').click();
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#score-progress')).not.toHaveAttribute('value', '0', { timeout: 10000 });
  await expect(page.locator('#pitch')).toContainText('B4', { timeout: 1500 });
  await expect(page.locator('#score-current')).toContainText('concert');
  await page.locator('#score-stop').click();
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#pitch')).toContainText('—', { timeout: 7000 });
  expect(errors).toEqual([]);
});

test('William Tell loads its sourced melody excerpt and plays the actual worklet', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#music');
  await page.locator('#music-piece').selectOption('william-tell');
  await expect(page.locator('#score-timeline .score-note')).toHaveCount(39);
  await expect(page.locator('#score-description')).toContainText('71 BPM');
  await expect(page.locator('#score-description')).toContainText('opening gallop theme only');
  await expect(page.locator('#score-source')).toHaveAttribute('href', /abcnotation.com/);
  await expect(page.locator('#midi-download')).toHaveJSProperty('pathname', '/scores/william-tell.mid');
  const midi = await page.request.get('/scores/william-tell.mid');
  expect((await midi.body()).subarray(0, 4).toString()).toBe('MThd');
  const sources = await page.request.get('/licenses/score-sources.txt');
  expect(sources.ok()).toBe(true); expect(await sources.text()).toContain('Peter Chubb');
  await page.locator('#score-play').click();
  await expect(page.locator('#pitch')).toContainText('A4', { timeout: 3000 });
  await page.locator('#music-piece').selectOption('chromatic');
  await expect(page.locator('#score-timeline .score-note')).toHaveCount(31);
  await expect(page.locator('#score-source')).toBeHidden();
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('written note audition sounds at the transposed concert pitch', async ({ page }) => {
  await page.goto('/#music');
  await page.locator('[data-note="70"]').click();
  await expect(page.locator('[data-note="70"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pitch')).toContainText('B♭4', { timeout: 1500 });
  const hz = parseFloat(await page.locator('#pitch').innerText());
  expect(Math.abs(1200 * Math.log2(hz / 466.164))).toBeLessThan(30);
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'false', { timeout: 5000 });
  await expect(page.locator('#pitch')).toContainText('—', { timeout: 7000 });
});

test('MIDI import validates files and can load a selected monophonic track', async ({ page }) => {
  await page.goto('/#music');
  await page.locator('#midi-file').setInputFiles({ name: 'broken.mid', mimeType: 'audio/midi', buffer: Buffer.from([1,2,3]) });
  await expect(page.locator('#music-message')).toContainText('Standard MIDI');
  await expect(page.locator('#score-play')).toBeDisabled();
  await page.locator('#midi-file').setInputFiles('public/scores/chromatic.mid');
  await expect(page.locator('#score-timeline .score-note')).toHaveCount(31);
  await expect(page.locator('#score-play')).toBeEnabled();
  await expect(page.locator('#midi-download')).toBeHidden();
  await expect(page.locator('#score-source')).toBeHidden();
  await expect(page.locator('#score-description')).toBeEmpty();
  await page.locator('#score-play').click();
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Behind the model' }).click();
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'false');
});

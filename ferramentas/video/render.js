const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('child_process');
const path = require('path');
const FFMPEG = process.argv[2];
const formato = process.argv[3] || 'v';
const saida = process.argv[4];
const soQuadro = process.argv[5]; // opcional: segundo para PNG de teste
const FPS = 30;
(async () => {
  const [w, h] = formato === 'h' ? [1920, 1080] : [1080, 1920];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(process.env.PAGINA || 'video.html') + '?f=' + formato);
  await page.evaluate(() => document.fonts.ready);
  if (soQuadro) {
    for (const t of soQuadro.split(',')) {
      await page.evaluate(x => window.render(x), +t);
      await page.screenshot({ path: `${saida}-${t}.png`, clip: { x: 0, y: 0, width: w, height: h } });
    }
    await browser.close(); return;
  }
  const total = await page.evaluate(() => window.TOTAL);
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    ...(process.env.AUDIO ? ['-i', process.env.AUDIO] : ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo']), '-shortest',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', process.env.AUDIO ? '192k' : '64k', '-movflags', '+faststart', saida], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(total * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate(x => window.render(x), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 93, clip: { x: 0, y: 0, width: w, height: h } });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('ok', saida, n, 'quadros');
})();

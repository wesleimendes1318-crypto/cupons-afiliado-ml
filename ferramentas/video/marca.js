// Logo e artes das redes sociais (Weslei, 27/09). Uso: mkdir -p marca && node marca.js
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('path');
const itens = [['simbolo',1024,1024,true],['perfil',1080,1080,false],['horizontal',2000,560,true],['youtube',2560,1440,false],['facebook',1640,624,false],['post',1080,1350,false]];
(async () => {
  const b = await chromium.launch();
  for (const [id,w,h,transp] of itens) {
    const p = await b.newPage({ viewport:{width:w,height:h} });
    await p.goto('file://' + path.resolve('marca.html'));
    await p.evaluate(x => { document.getElementById(x).style.display='block'; return document.fonts.ready; }, id);
    await p.screenshot({ path:`marca/${id}.png`, omitBackground: transp, clip:{x:0,y:0,width:w,height:h} });
    await p.close();
  }
  await b.close(); console.log('ok');
})();

const { chromium } = require('playwright');
const fs = require('node:fs');
const {execSync} = require('node:child_process');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:3000';
const output = 'docs/preview/captures';
const islands = ['about', 'skills', 'projects', 'experience', 'journey', 'contact'];
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport:{width:1920,height:1080}});
  const report = {commit:execSync('git rev-parse HEAD').toString().trim(),renderer:'GitHub Actions Chromium / SwiftShader (software)',screenshots:[],errors:[]};
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error') report.errors.push(m.text().slice(0,1000))});
  async function capture(name,query) {
    await page.goto(`${base}/?${query}`,{timeout:180000,waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__world && (window.__world.getState().sceneReady || window.__world.getState().webglFailed),{timeout:120000});
    if(await page.evaluate(()=>window.__world.getState().webglFailed)) throw new Error('WebGL scene unavailable: '+name);
    await page.evaluate(()=>new Promise(resolve=>{let n=0;function tick(){if(++n>100)resolve();else requestAnimationFrame(tick)}tick()}));
    await page.screenshot({path:`${output}/${name}.jpg`,type:'jpeg',quality:88});
    report.screenshots.push({name,url:page.url()});
    fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));
    console.log('CAPTURED',name);
  }
  try {
    for (const id of islands) await capture(`desktop-${id}`,`solo=${id}&section=${id}&time=0.45`);
    await capture('desktop-yellow-static','solo=static&section=about&time=0.78&cam=61,23,59,86,5,82');
    await capture('desktop-contact-night','solo=contact&section=contact&time=0.85');
    await capture('desktop-intro','time=0.45');
    await page.getByRole('button',{name:'Cliquer pour dévoiler le monde'}).click();
    await page.waitForTimeout(10000);
    await page.screenshot({path:`${output}/desktop-navigation.jpg`,type:'jpeg',quality:88});
    await page.getByRole('button',{name:/Version rapide du portfolio/}).click();
    await page.waitForTimeout(2000);
    await page.screenshot({path:`${output}/desktop-quick.jpg`,type:'jpeg',quality:88});
    await page.setViewportSize({width:390,height:844});
    for(const id of islands) await capture(`mobile-${id}`,`solo=${id}&section=${id}&time=0.45`);
  } finally {
    fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));
    await browser.close();
  }
  if(report.errors.length) console.warn('Browser errors:',report.errors);
})().catch(e=>{console.error(e);process.exitCode=1});

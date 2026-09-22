/* eslint-disable @typescript-eslint/no-require-imports */
const { build } = require('esbuild');
const { chromium } = require('playwright');
const { expect } = require('@playwright/test');
const fs = require('node:fs');
const http = require('node:http');
(async () => {
  fs.mkdirSync('.test-dist/chat', { recursive: true });
  await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ChatAiPanel} from './components/chat/ai-panel';
    const source={id:'94000000-0000-4000-8000-000000000010',created_at:'2026-09-21T12:00:00Z',author:'Ana',body:'Meet at the station at 17:30.'};
    window.fetch=async (_,options)=>{const request=JSON.parse(options.body); return Response.json({ok:true,value:{mode:request.mode,insufficientEvidence:false,items:[{category:'decision',text:'Meet at the station at 17:30.',sources:[source]}],messageCount:55,cutoff:{id:source.id,created_at:source.created_at}}})};
    createRoot(document.getElementById('root')).render(<main><h1>Ride room</h1><ChatAiPanel rideId="94000000-0000-4000-8000-000000000001" latest={source} onUnavailable={()=>{}}/><textarea aria-label="Room composer"/></main>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, jsx: 'automatic', outfile: '.test-dist/chat/modal.js' });
  const css = fs.readdirSync('.next/static/css', { recursive: true }).filter(p => p.endsWith('.css')).map(p => fs.readFileSync('.next/static/css/'+p,'utf8')).join('\n');
  const server = http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?fs.readFileSync('.test-dist/chat/modal.js'):`<html><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><body><div id="root"></div><script src="/app.js"></script></body></html>`)});
  await new Promise(resolve=>server.listen(3103,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({channel:'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:1100,height:850}});
    await page.goto('http://127.0.0.1:3103');
    await page.getByRole('button',{name:'Ask AI',exact:true}).click();
    await expect(page.getByLabel('Your question')).toBeFocused();
    const dialog=page.getByRole('dialog');
    expect(await dialog.evaluate(d=>d.matches(':modal'))).toBe(true);
    for(let i=0;i<8;i++){await page.keyboard.press('Tab');expect(await dialog.evaluate(d=>d.contains(document.activeElement))).toBe(true)}
    await page.getByLabel('Your question').fill('Where are we meeting?');
    await page.getByRole('button',{name:'Ask about chat',exact:true}).click();
    await expect(dialog.getByText('You asked',{exact:true})).toBeVisible();
    await expect(dialog.getByRole('heading',{name:'AI answer'})).toBeVisible();
    await page.screenshot({path:'.test-dist/chat/modal-desktop.png'});
    await page.setViewportSize({width:375,height:850});
    await page.screenshot({path:'.test-dist/chat/modal-mobile.png'});
    expect(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Ask AI',exact:true})).toBeFocused();
    expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');
    console.log('PASS: native modal, focus containment/restoration, Escape, distinct question/answer cards, desktop/mobile layout');
  } finally {if(browser)await browser.close(); await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});


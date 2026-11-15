import {chromium} from '@playwright/test';
import {preview} from 'vite';
import {readFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {unzipSync,strFromU8} from 'fflate';
import assert from 'node:assert/strict';
const server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:false}});
let browser;const requests=[],errors=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
 const context=await browser.newContext({serviceWorkers:'block',permissions:[],acceptDownloads:true});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1'){requests.push(url.hostname);return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.httpServer.address().port);
 await page.getByRole('button',{name:'Entrar a la maqueta'}).click();await page.getByRole('button',{name:'Paciente ficticio',exact:true}).click();
 assert.equal(await page.locator('input[readonly]').first().inputValue(),'PACIENTE-SINTETICO-001');
 await page.getByRole('button',{name:'Hallazgos simulados',exact:true}).click();
 await page.getByRole('button',{name:'Simular dictado',exact:true}).click();await page.getByRole('button',{name:'Procesar demostración'}).click();await page.getByRole('button',{name:'Ver informe de demostración'}).click();
 await page.getByRole('heading',{name:'Informe de demostración'}).waitFor();assert((await page.locator('.organ-html-preview').innerText()).includes('SIMULADO'));
 if(process.env.DEMO_SCREENSHOT_DIR){mkdirSync(process.env.DEMO_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.DEMO_SCREENSHOT_DIR,'desktop-synthetic-demo.png'),fullPage:true});}
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar DOCX sintético'}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'VetTalk-SYNTHETIC-DEMO.docx');const bytes=readFileSync(await download.path());const xml=strFromU8(unzipSync(bytes)['word/document.xml']);assert(xml.includes('NOT FOR CLINICAL USE'));assert(xml.includes('PACIENTE-SINTETICO-001'));
 await page.getByRole('button',{name:'Plantillas ficticias',exact:true}).click();await page.getByRole('radio').nth(1).check();
 await page.getByRole('button',{name:'Hallazgos simulados',exact:true}).click();await page.getByRole('button',{name:'Bazo',exact:false}).click();await page.getByRole('button',{name:'Simular dictado',exact:true}).click();await page.getByRole('button',{name:'Cancelar simulación'}).click();await page.getByRole('status').filter({hasText:'Simulación cancelada'}).waitFor();
 await page.setViewportSize({width:390,height:844});
 if(process.env.DEMO_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.DEMO_SCREENSHOT_DIR,'mobile-synthetic-demo.png'),fullPage:true});
 const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right}))}));
 assert(overflow.scroll<=overflow.width,JSON.stringify(overflow));
 await page.getByRole('button',{name:'Restablecer',exact:true}).click();await page.getByRole('button',{name:'Salir de la maqueta'}).click();await page.getByRole('button',{name:'Entrar a la maqueta'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length,cookies:document.cookie})),{local:0,session:0,cookies:''});assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'PASS',browser:'Chromium',checks:['local session','synthetic patient','organ selection','mock dictation','mock processing','original preview component','synthetic DOCX download','template selection','cancellation','mobile layout','reset/logout','no external requests','no browser storage'],external_requests:requests.length,page_errors:errors.length}));
}finally{await browser?.close();await new Promise(r=>server.httpServer.close(r));}

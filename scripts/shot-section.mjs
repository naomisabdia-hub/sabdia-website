// Screenshot one section of a page at a given viewport, phone-emulated
// under 800px, through Chrome's DevTools protocol (no puppeteer needed).
// Prints the section's position, the page's scrollWidth and any element
// wider than the viewport (horizontal overflow), then saves viewport-sized
// PNGs from the top of the section down.
//   node scripts/shot-section.mjs http://127.0.0.1:9292/ '#properties' out/home 390 844
//   node scripts/shot-section.mjs http://127.0.0.1:9292/collections/for-sale '#propGrid' out/fs 1440 1500
import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const [url, sel, out] = [process.argv[2], process.argv[3], process.argv[4]]; const W=Number(process.argv[5]||390), H=Number(process.argv[6]||844), MOB=W<800;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new','--disable-gpu','--remote-debugging-port=9336','--user-data-dir=/tmp/cdp-prof4','about:blank'], {stdio:'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms)); await sleep(2500);
const t = await (await fetch('http://127.0.0.1:9336/json/new?about:blank', {method:'PUT'})).json();
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
let id=0; const p={}; ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p[m.id])p[m.id](m);};
const send=(method,params={})=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method,params}));});
const ev=async(expr)=>(await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true})).result.result.value;
await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:MOB});
await send('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
await send('Page.enable'); await send('Page.navigate',{url}); await sleep(9000);
const info = await ev(`(()=>{const el=document.querySelector('${sel}'); if(!el) return JSON.stringify({missing:true}); const r=el.getBoundingClientRect(); const over=[]; document.querySelectorAll('body *').forEach(e=>{const b=e.getBoundingClientRect(); const cs=getComputedStyle(e); if(b.width>0&&b.right>${W}+1&&cs.position!=='fixed'&&cs.visibility!=='hidden') over.push(e.tagName.toLowerCase()+'.'+[...e.classList].slice(0,2).join('.')+' r='+Math.round(b.right));}); return JSON.stringify({top:Math.round(r.top+scrollY), height:Math.round(r.height), scrollWidth:document.documentElement.scrollWidth, over:over.slice(0,12)});})()`);
console.log(info); const {top,height} = JSON.parse(info);
// scroll gently down to the section so reveal animations fire
await ev(`(async()=>{for(let y=0;y<${top+height};y+=500){scrollTo(0,y);await new Promise(r=>setTimeout(r,150));}})()`);
let n=0; for (let y=top-60; y<top+height && n<2; y+=H-40, n++) { await ev(`scrollTo(0,${y})`); await sleep(700); const s=await send('Page.captureScreenshot',{format:'png'}); writeFileSync(`${out}-${n}.png`, Buffer.from(s.result.data,'base64')); }
console.log('shots', n); chrome.kill();

const fs=require('fs');
const path=require('path');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..');
function load({url='http://localhost:8765/',storage='ok',seed}={}) {
 const errors=[],requests=[],downloads=[],alerts=[];
 const vc=new VirtualConsole(); vc.on('jsdomError',e=>errors.push(e.message));
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script[^>]*src="(?:app|workflows).js"[^>]*><\/script>/g,'');
 const dom=new JSDOM(html,{url,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
 w.scrollTo=()=>{}; w.confirm=()=>true; w.alert=x=>alerts.push(x);
 w.URL.createObjectURL=b=>{downloads.push(b);return 'blob:qa-'+downloads.length}; w.URL.revokeObjectURL=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){downloads.push({href:this.href,download:this.download})};
 w.fetch=(...args)=>{requests.push(args);throw Error('Unexpected fetch')};
 w.XMLHttpRequest=function(){requests.push('XMLHttpRequest');throw Error('Unexpected XHR')};
 w.WebSocket=function(){requests.push('WebSocket');throw Error('Unexpected WebSocket')};
 if(storage==='disabled') Object.defineProperty(w,'localStorage',{get(){throw new w.DOMException('Storage disabled','SecurityError')}});
 if(seed) Object.entries(seed).forEach(([k,v])=>w.localStorage.setItem(k,v));
 try {for(const file of ['app.js','workflows.js']) {if(!fs.existsSync(path.join(root,file)))continue;const script=w.document.createElement('script');script.textContent=fs.readFileSync(path.join(root,file),'utf8');w.document.body.appendChild(script)}}catch(e){errors.push(e.stack)}
 return {w,dom,errors,requests,downloads,alerts,eval:s=>w.eval(s),text:()=>w.document.body.textContent,click:s=>{const e=w.document.querySelector(s);if(!e)throw Error('Missing '+s);e.click();return e},close:()=>w.close()};
}
module.exports={load,root};
if(require.main===module){const h=load();console.log(JSON.stringify({errors:h.errors,requests:h.requests,text:h.text().slice(0,3000)},null,2));h.close()}

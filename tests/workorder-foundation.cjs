const assert=require('node:assert/strict');
const fs=require('node:fs');
const {load}=require('./harness.cjs');
const results=[];
const KEY='hongchuang-power-demo-v1';
function test(name,fn){const h=load();try{fn(h,h.w,h.w.WF);assert.deepEqual(h.errors,[]);assert.equal(h.requests.length,0);results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',detail:e.stack});}finally{h.close();}}
const rec=(f,id)=>f.getState().records[id];
const state=w=>w.DEMO.getState();
const wo=(w,f,id)=>state(w).work.find(x=>x.id===rec(f,id).workId);
const reload=h=>load({seed:{[KEY]:h.w.localStorage.getItem(KEY)}});
function diagnose(w,f,id){f.switchPerson('operator');assert.equal(f.acknowledge(id,'核验并接管'),true);const wid=rec(f,id).workId;assert.ok(wid,'WO must exist before diagnosis');assert.equal(f.requestDiagnosis(id,'提交诊断'),true);f.switchPerson('analyst');assert.equal(f.analyze(id),true);return wid;}
function approve(w,f,id){const wid=diagnose(w,f,id);f.switchPerson('supervisor');assert.equal(f.decide(id,'approve',f.cases[id].plans[0],'核验后批准'),true);assert.equal(wo(w,f,id).status,'待派单');assert.equal(wo(w,f,id).ownerId,null);assert.equal(f.dispatch(id,'engineer','派给专业人员'),true);f.switchPerson('engineer');assert.equal(f.startWork(id),wid);return wid;}
function submit(f,id){f.cases[id].checks.forEach((_,i)=>assert.equal(f.check(id,i,true),true));assert.equal(f.submitChecks(id,'记录现场证据'),true);}
for(const id of ['battery','cooling','capacity']){
 test(`${id}: atomic takeover creates single stable WO before analysis`,(h,w,f)=>{
  assert.equal(rec(f,id).workId,null);assert.equal(f.acknowledge(id,''),false);assert.equal(state(w).work.length,0);
  assert.equal(f.acknowledge(id,'确认并接管'),true);const r=rec(f,id),work=wo(w,f,id),wid=work.id;
  assert.equal(work.status,'待分析');assert.equal(work.flow,r);assert.equal(work.alarm,f.cases[id].alarm);assert.equal(state(w).alarms.find(a=>a.id===work.alarm).work,wid);
  assert.equal(r.diagnoses.length,0);assert.equal(f.acknowledge(id,'重复双击'),false);assert.equal(state(w).work.filter(x=>x.id===wid).length,1);
  const x=reload(h);try{assert.deepEqual(x.errors,[]);assert.equal(rec(x.w.WF,id).workId,wid);assert.equal(wo(x.w,x.w.WF,id).flow,rec(x.w.WF,id));assert.equal(x.w.WF.acknowledge(id,'刷新后重复'),false);assert.equal(state(x.w).work.length,1);}finally{x.close();}
 });
 test(`${id}: diagnosis approval dispatch retest trace one original WO`,(h,w,f)=>{
  const wid=approve(w,f,id);submit(f,id);assert.equal(f.retest(id,true,'独立测量完成'),true);assert.equal(wo(w,f,id).status,'待验收');assert.notEqual(state(w).alarms.find(a=>a.id===f.cases[id].alarm).status,'已关闭');
  f.switchPerson('supervisor');assert.equal(f.closeCase(id,'supervisor','核验原始与复测证据'),true);const r=rec(f,id),work=wo(w,f,id);
  assert.equal(work.id,wid);assert.equal(work.status,'已关闭');assert.equal(state(w).work.length,1);
  for(const field of ['diagnoses','decisions','tests','history'])for(const record of r[field])assert.equal(record.workId,wid,field+' '+record.id);
  for(const record of work.history)assert.equal(record.workId,wid,'WO history');
  assert.equal(state(w).alarms.find(a=>a.id===work.alarm).status,'已关闭');
 });
 test(`${id}: failed retest and review return retain identity and evidence history`,(h,w,f)=>{
  const wid=approve(w,f,id);submit(f,id);assert.equal(f.retest(id,false,'复测仍异常'),true);assert.equal(wo(w,f,id).status,'处理中');assert.equal(rec(f,id).checks.filter(Boolean).length,0);
  submit(f,id);assert.equal(f.retest(id,true,'第二次复测通过'),true);f.switchPerson('supervisor');assert.equal(f.returnWork(id,'现场照片不完整'),true);assert.equal(wo(w,f,id).status,'处理中');assert.equal(rec(f,id).tests.length,2);assert.equal(rec(f,id).workId,wid);assert.equal(state(w).work.length,1);
 });
 test(`${id}: quality refusal stays on original WO and cannot use stale diagnosis`,(h,w,f)=>{
  const wid=diagnose(w,f,id);f.switchPerson('admin');assert.equal(f.setQuality(id,'缺失'),true);f.switchPerson('analyst');assert.equal(f.analyze(id),false);assert.equal(rec(f,id).diagnoses.at(-1).blocked,true);assert.equal(rec(f,id).diagnoses.at(-1).workId,wid);
  f.switchPerson('admin');assert.equal(f.setQuality(id,'有效'),true);f.switchPerson('supervisor');assert.equal(f.decide(id,'approve',f.cases[id].plans[0],'旧诊断不可审批'),false);f.switchPerson('analyst');assert.equal(f.analyze(id),true);f.switchPerson('supervisor');assert.equal(f.decide(id,'approve',f.cases[id].plans[0],'新诊断有效'),true);assert.equal(state(w).work.length,1);
 });
 test(`${id}: unapproved actors cannot take over dispatch or close`,(h,w,f)=>{
  for(const actor of ['engineer','engineer2','analyst','supervisor','admin']){f.switchPerson(actor);assert.equal(f.acknowledge(id,'越权'),false)}
  diagnose(w,f,id);f.switchPerson('supervisor');assert.equal(f.decide(id,'approve',f.cases[id].plans[0],'批准'),true);const before=state(w).work.length;
  for(const actor of ['operator','engineer','engineer2','analyst','admin']){f.switchPerson(actor);assert.equal(f.dispatch(id,'engineer','越权派单'),false)}
  f.switchPerson('supervisor');assert.equal(f.dispatch(id,'admin','错误执行人'),false);assert.equal(f.dispatch(id,'engineer2','有效派单'),true);f.switchPerson('engineer');assert.equal(f.startWork(id),false);f.switchPerson('engineer2');assert.ok(f.startWork(id));assert.equal(state(w).work.length,before);
 });
}
test('DOM takeover immediately shows WO in detail, work center, and analyst queue',(h,w,f)=>{
 f.open('battery','actions');const input=w.document.querySelector('#wf-note');assert.ok(input);input.value='值班核验后接管';
 const button=[...w.document.querySelectorAll('#entity-drawer button')].find(b=>/确认.*接管/.test(b.textContent));assert.ok(button,'takeover button');button.click();
 const wid=rec(f,'battery').workId;assert.ok(wid);assert.ok(w.document.querySelector('#entity-drawer').textContent.includes(wid),'WO displayed immediately');
 f.close();w.navigate('work');assert.ok(w.document.querySelector('#content').textContent.includes(wid),'WO in actual center row');
 f.open('battery','actions');w.document.querySelector('#wf-note').value='请求分析岗位研判';[...w.document.querySelectorAll('#entity-drawer button')].find(b=>/提交诊断请求/.test(b.textContent)).click();
 f.switchPerson('analyst');f.close();w.navigate('overview');assert.ok(w.document.querySelector('#content').textContent.includes(wid),'same WO in analyst queue');
});
test('ordinary alarm takeover creates once and immediate WO is visible',(h,w,f)=>{
 const a=state(w).alarms.find(a=>!Object.values(f.cases).some(c=>c.alarm===a.id));w.alarmDetail(a.id);w.document.querySelector('[data-tab="actions"]').click();w.document.querySelector('#alarm-reason').value='普通告警接管';
 const button=[...w.document.querySelectorAll('#entity-drawer button')].find(b=>/确认|接管/.test(b.textContent));assert.ok(button);button.click();
 assert.ok(a.work);const work=state(w).work.find(x=>x.id===a.work);assert.ok(work);assert.equal(work.status,'待分析');assert.equal(work.alarm,a.id);assert.equal(state(w).work.length,1);
 w.ackAlarm(a.id);assert.equal(state(w).work.length,1);f.close();w.navigate('work');assert.ok(w.document.querySelector('#content').textContent.includes(work.id));
 const x=reload(h);try{assert.equal(state(x.w).work.length,1);assert.equal(state(x.w).alarms.find(v=>v.id===a.id).work,work.id);assert.deepEqual(x.errors,[]);}finally{x.close()}
});
function manualInput(w,overrides={}){const d=state(w).devices[0];return {title:'设备巡检',site:d.site,device:d.id,type:'预防性巡检',priority:'中',description:'核验设备健康及现场证据',...overrides};}
test('manual creation rejects missing values enum spoof and site-device mismatch atomically',(h,w,f)=>{
 const before=JSON.stringify(state(w).work);
 for(const key of ['title','site','device','type','priority','description'])assert.equal(w.WO.create(manualInput(w,{[key]:''})),false,key);
 for(const value of [{type:'未知类别'},{priority:'未知优先级'},{device:'NO-SUCH-ASSET'},{site:w.WO.sites[1]},{title:'   '},{description:'   '}])assert.equal(w.WO.create(manualInput(w,value)),false,JSON.stringify(value));
 assert.equal(JSON.stringify(state(w).work),before);
});
test('manual standalone and proactive WO preserve source and survive reload without alarm',(h,w,f)=>{
 const id=w.WO.create(manualInput(w)),pid=w.WO.create(manualInput(w,{title:'扩容前主动维护',type:'预测性维护'}));assert.ok(id);assert.ok(pid);assert.notEqual(id,pid);
 const a=w.WO.get(id),b=w.WO.get(pid);assert.equal(a.status,'待分析');assert.equal(a.alarm,null);assert.equal(b.source,'主动预防');assert.equal(b.alarm,null);assert.equal(b.type,'预测性维护');
 const x=reload(h);try{assert.deepEqual(x.errors,[]);assert.equal(state(x.w).work.length,2);assert.ok(x.w.WO.get(id));assert.equal(x.w.WO.get(pid).source,'主动预防');}finally{x.close()}
});
test('manual title and description render as text, never executable markup',(h,w,f)=>{
 const id=w.WO.create(manualInput(w,{title:'<img src=x onerror=alert(1)>',description:'<svg onload=alert(1)>'}));assert.ok(id);w.workDetail(id);
 assert.equal(w.document.querySelectorAll('#entity-drawer img, #entity-drawer svg[onload]').length,0);assert.ok(w.document.querySelector('#entity-drawer').textContent.includes('<img src=x onerror=alert(1)>'));assert.equal(h.alerts.length,0);
});
test('legacy acknowledged cases and ordinary alarms backfill exactly once with system audit',(h,w,f)=>{
 const legacy=JSON.parse(JSON.stringify(state(w)));legacy.journeys.version=3;legacy.work=[];
 for(const id of Object.keys(f.cases))legacy.journeys.records[id]={id,stage:id==='battery'?'acknowledged':'discovered',quality:'有效',diagnoses:[],decisions:[],workId:null,checks:[],tests:[],caseId:null,history:[]};
 const linked=legacy.alarms.find(a=>a.id===f.cases.battery.alarm),ordinary=legacy.alarms.find(a=>!Object.values(f.cases).some(c=>c.alarm===a.id));for(const a of [linked,ordinary]){a.status='已确认';a.work=null;a.acknowledgedBy='operator';a.acknowledgedAt='2026-10-16 00:00:00 UTC';}
 const x=load({seed:{[KEY]:JSON.stringify(legacy)}});try{
  assert.deepEqual(x.errors,[]);assert.equal(state(x.w).work.length,2);const wid=rec(x.w.WF,'battery').workId;assert.ok(wid);assert.ok(state(x.w).alarms.find(a=>a.id===ordinary.id).work);
  const migrations=state(x.w).audits.filter(a=>/迁移/.test(a.action+' '+a.detail));assert.ok(migrations.length,'explicit migration audit');assert.ok(migrations.every(a=>/系统|迁移/.test(a.actor)),'migration never impersonates current operator');
  const y=reload(x);try{assert.deepEqual(y.errors,[]);assert.equal(state(y.w).work.length,2);assert.equal(rec(y.w.WF,'battery').workId,wid);assert.equal(state(y.w).audits.filter(a=>/迁移/.test(a.action+' '+a.detail)).length,migrations.length);}finally{y.close()}
 }finally{x.close()}
});
function next(w,id,options={}){const work=w.WO.get(id);return w.WO.transition(id,'next',work.version,{note:'当前岗位核验并交接',...options});}
test('manual full lifecycle, failed retest, independent acceptance and reopen keep one WO',(h,w,f)=>{
 const id=w.WO.create(manualInput(w));const work=w.WO.get(id);assert.equal(next(w,id),false);
 f.switchPerson('analyst');assert.equal(next(w,id,{plan:'按规程现场检查'}),true);assert.equal(work.status,'待方案审批');
 f.switchPerson('supervisor');assert.equal(next(w,id),true);assert.equal(work.status,'待派单');assert.equal(next(w,id,{assignee:'engineer'}),true);
 f.switchPerson('engineer2');assert.equal(next(w,id),false);f.switchPerson('engineer');assert.equal(next(w,id),true);assert.equal(work.status,'处理中');assert.equal(next(w,id),true);assert.equal(work.status,'待复测');
 assert.equal(next(w,id,{test:'不通过'}),true);assert.equal(work.status,'处理中');assert.equal(next(w,id),true);assert.equal(next(w,id,{test:'通过'}),true);assert.equal(work.status,'待验收');assert.equal(next(w,id),false);
 f.switchPerson('supervisor');assert.equal(next(w,id),true);assert.equal(work.status,'已关闭');assert.equal(work.acceptance.workId,id);
 const history=work.history.length;assert.equal(w.WO.transition(id,'reopen',work.version,{note:'再次核验'}),true);assert.equal(work.status,'待分析');assert.ok(work.history.length>history);assert.equal(work.tests.length,2);assert.equal(state(w).work.length,1);
 for(const field of ['history','evidence','diagnoses','decisions','tests','checkRecords'])for(const record of work[field])assert.equal(record.workId,id,field);
});
test('cancel and reopen linked work preserve historical records and require fresh analysis',(h,w,f)=>{
 const wid=approve(w,f,'battery'),work=w.WO.get(wid);f.switchPerson('operator');assert.equal(w.WO.transition(wid,'cancel',work.version,{note:'越权'}),false);f.switchPerson('supervisor');
 assert.equal(w.WO.transition(wid,'cancel',work.version,{note:'计划变更取消'}),true);assert.equal(work.status,'已取消');const count=work.history.length;
 assert.equal(w.WO.transition(wid,'reopen',work.version,{note:'恢复核验'}),true);assert.equal(work.status,'待分析');assert.equal(rec(f,'battery').workId,wid);assert.ok(work.history.length>count);assert.equal(state(w).work.length,1);assert.equal(f.decide('battery','approve',f.cases.battery.plans[0],'不可使用旧依据'),false);
});
test('manual authorization and optimistic version guards prevent mutations',(h,w,f)=>{
 f.switchPerson('admin');assert.equal(w.WO.create(manualInput(w)),false);f.switchPerson('operator');const id=w.WO.create(manualInput(w)),work=w.WO.get(id);f.switchPerson('analyst');
 const version=work.version;assert.equal(w.WO.transition(id,'next',version,{note:'诊断'}),true);const count=work.history.length;assert.equal(w.WO.transition(id,'next',version,{note:'旧页面重复'}),false);assert.equal(work.history.length,count);assert.equal(w.WO.transition('missing','next',1,{note:'x'}),false);
});
test('manual missing-quality asset cannot produce trusted diagnosis',(h,w,f)=>{
 const d=state(w).devices.find(d=>d.quality==='缺失');assert.ok(d);const id=w.WO.create(manualInput(w,{device:d.id,site:d.site}));assert.ok(id);f.switchPerson('analyst');assert.equal(next(w,id),false);assert.equal(w.WO.get(id).status,'待分析');f.switchPerson('supervisor');assert.equal(next(w,id),false);
});
test('manual DOM form changes site and creates selected asset with source',(h,w,f)=>{
 w.navigate('work');[...w.document.querySelectorAll('#content button')].find(b=>b.textContent==='新建工单').click();w.document.querySelector('#wo-title').value='主动检查上海设备';
 const site=w.document.querySelector('#wo-site');site.value=w.WO.sites[1];site.dispatchEvent(new w.Event('change'));const selected=w.document.querySelector('#wo-device').value;assert.equal(state(w).devices.find(d=>d.id===selected).site,site.value);
 w.document.querySelector('#wo-type').value='预测性维护';w.document.querySelector('#wo-description').value='趋势到阈值前人工检查';[...w.document.querySelectorAll('#dialog button')].find(b=>b.textContent==='创建工单').click();
 const work=state(w).work[0];assert.equal(work.device,selected);assert.equal(work.source,'主动预防');assert.equal(work.alarm,null);assert.ok(h.text().includes(work.id));
});
test('site status counters and work list agree and selection survives cross-page navigation',(h,w,f)=>{
 for(const id of Object.keys(f.cases)){f.switchPerson('operator');f.acknowledge(id,'跨站接管');}f.close();w.navigate('work');
 const site=state(w).devices.find(d=>d.id===f.cases.cooling.device).site;w.selectSite(site);const content=w.document.querySelector('#content');assert.ok(content.textContent.includes(rec(f,'cooling').workId));assert.ok(!content.textContent.includes(rec(f,'battery').workId));
 const counter=[...content.querySelectorAll('.work-status-strip button')].find(b=>b.textContent.includes('待分析'));assert.equal(counter.querySelector('b').textContent,'2');counter.click();assert.equal(w.document.querySelectorAll('#content tbody tr').length,2);
 f.open('cooling','evidence');f.go('monitor','cooling');assert.equal(f.getState().active,'cooling');assert.ok(w.document.querySelector('#entity-drawer').textContent.includes(f.cases.cooling.device));
});
test('ordinary quality recovery requires fresh analysis then retest and independent approval',(h,w,f)=>{
 const id=w.WO.create(manualInput(w));f.switchPerson('analyst');assert.equal(next(w,id),true);f.switchPerson('admin');assert.equal(w.WO.setQuality(id,'迟到'),true);assert.equal(w.WO.setQuality(id,'有效'),true);f.switchPerson('supervisor');assert.equal(next(w,id),false);
 f.switchPerson('analyst');assert.equal(next(w,id),true);f.switchPerson('supervisor');assert.equal(next(w,id),true);assert.equal(next(w,id,{assignee:'engineer'}),true);f.switchPerson('engineer');assert.equal(next(w,id),true);assert.equal(next(w,id),true);
 f.switchPerson('admin');assert.equal(w.WO.setQuality(id,'缺失'),true);f.switchPerson('engineer');assert.equal(next(w,id,{test:'通过'}),false);f.switchPerson('admin');assert.equal(w.WO.setQuality(id,'有效'),true);f.switchPerson('engineer');assert.equal(next(w,id,{test:'通过'}),true);
 f.switchPerson('admin');assert.equal(w.WO.setQuality(id,'迟到'),true);f.switchPerson('supervisor');assert.equal(next(w,id),false);assert.equal(w.WO.get(id).status,'待验收');
});
test('analyst can analyze immediately after takeover without extra operator action',(h,w,f)=>{
 f.acknowledge('battery','接管');const id=rec(f,'battery').workId;f.switchPerson('analyst');assert.equal(f.analyze('battery'),true);assert.equal(rec(f,'battery').diagnoses[0].workId,id);assert.equal(w.WO.get(id).status,'待方案审批');
});
test('ordinary predicted alarm source remains predictive on takeover',(h,w,f)=>{
 const a=state(w).alarms.find(a=>a.source==='预测模拟'&&!Object.values(f.cases).some(c=>c.alarm===a.id));const work=w.WO.acknowledgeAlarm(a.id,'提前核验风险');assert.ok(work);assert.equal(work.source,'预测预警');assert.equal(work.type,'预测性维护');assert.equal(work.alarm,a.id);assert.ok(work.evidence.length);assert.equal(work.evidence[0].workId,work.id);
});
test('legacy pre-work analysis is preserved with explicit migration and references backfilled',(h,w,f)=>{
 const legacy=JSON.parse(JSON.stringify(state(w)));legacy.journeys.version=3;legacy.work=[];const r=legacy.journeys.records.battery;r.stage='analyzed';r.workId=null;
 r.diagnoses=[{id:'DX-battery-LEGACY',event:f.cases.battery.event,evidence:f.cases.battery.evidence,kb:f.cases.battery.kb,actor:'analyst',time:'2026-10-16 10:00',blocked:false,quality:'有效',conclusion:'旧版原始诊断，必须保留'}];r.history=[{id:'TRACE-battery-LEGACY',actor:'analyst',action:'旧版诊断',time:'2026-10-16 10:00',detail:'原始依据'}];
 const a=legacy.alarms.find(a=>a.id===f.cases.battery.alarm);a.status='已确认';a.work=null;
 const x=load({seed:{[KEY]:JSON.stringify(legacy)}});try{assert.deepEqual(x.errors,[]);const rr=rec(x.w.WF,'battery'),work=x.w.WO.get(rr.workId);assert.equal(work.status,'待方案审批');assert.equal(rr.diagnoses.length,1);assert.equal(rr.diagnoses[0].conclusion,r.diagnoses[0].conclusion);assert.equal(rr.diagnoses[0].actor,'analyst');assert.equal(rr.diagnoses[0].workId,work.id);assert.equal(rr.history[0].actor,'analyst');assert.equal(rr.history[0].workId,work.id);assert.ok(rr.history.some(h=>h.actor==='migration'));assert.equal(state(x.w).work.length,1);}finally{x.close()}
});
console.log(JSON.stringify(results,null,2));fs.writeFileSync(__dirname+'/workorder-foundation-results.json',JSON.stringify(results,null,2));process.exitCode=results.some(r=>r.status==='FAIL')?1:0;

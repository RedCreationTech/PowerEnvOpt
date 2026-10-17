const assert=require('node:assert/strict');
const fs=require('node:fs');
const {load}=require('./harness.cjs');
const results=[];
function test(name,fn){const h=load();try{fn(h,h.w,h.w.WF);assert.deepEqual(h.errors,[]);assert.equal(h.requests.length,0);results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',detail:e.stack});}finally{h.close();}}
const row=(f,id)=>f.getState().records[id];
function approve(f,id){assert.equal(f.analyze(id),true);assert.equal(f.decide(id,'approve',f.cases[id].plans[0],'已核验合成证据，批准现场专项检查'),true);assert.ok(f.startWork(id));}
function submit(f,id){f.cases[id].checks.forEach((_,i)=>assert.equal(f.check(id,i,true),true));assert.equal(f.submitChecks(id,'完成模拟检查并记录报告 DEMO-REPORT-01'),true);}
function finish(f,id){approve(f,id);submit(f,id);assert.equal(f.retest(id,true,'模拟同工况复测通过'),true);assert.equal(f.closeCase(id,'陈工','独立核验前后证据'),true);}
function reload(h){return load({seed:{'hongchuang-power-demo-v1':h.w.localStorage.getItem('hongchuang-power-demo-v1')}});}
for(const id of ['battery','cooling','capacity']){
 test(`${id}: complete chain, immutable links, shared alarm/work and provenance`,(h,w,f)=>{
  finish(f,id);const r=row(f,id),c=f.cases[id],s=w.DEMO.getState(),work=s.work.find(x=>x.id===r.workId),alarm=s.alarms.find(x=>x.id===c.alarm);
  assert.equal(r.stage,'closed');assert.equal(work.status,'已关闭');assert.equal(alarm.status,'已关闭');assert.equal(alarm.work,work.id);assert.equal(work.device,c.device);assert.equal(work.alarm,c.alarm);for(const [field,value] of Object.entries({eventId:c.event,evidenceId:c.evidence,diagnosisId:r.diagnoses[0].id,decisionId:r.decisions[0].id,knowledgeId:c.kb}))assert.equal(work[field],value,field);
  assert.equal(r.diagnoses[0].event,c.event);assert.equal(r.diagnoses[0].evidence,c.evidence);assert.equal(r.diagnoses[0].kb,c.kb);assert.ok(f.knowledge[c.kb].sources.every(x=>x[1].startsWith('https://')));
  assert.equal(r.decisions[0].diagnosis,r.diagnoses[0].id);assert.equal(r.tests[0].workId,work.id);assert.deepEqual([...r.tests[0].values],[...c.after]);assert.ok(r.caseId);
  assert.equal(f.analyze(id),false);assert.equal(f.decide(id,'approve',c.plans[0],'tamper'),false);assert.equal(r.diagnoses.length,1);
  for(const p of ['assets','monitor','alarms','assistant','work','health','knowledge','quality','energy']){f.go(p,id);assert.ok(h.text().includes(c.event),p+' event context');assert.ok(h.text().includes(c.device),p+' asset context');}
  f.go('knowledge',id);for(const identifier of [c.kb,c.event,r.diagnoses[0].id,r.decisions[0].id,work.id,r.tests[0].id,r.caseId])assert.ok(h.text().includes(identifier),identifier);
  const h2=reload(h);try{assert.equal(row(h2.w.WF,id).caseId,r.caseId);assert.equal(h2.w.DEMO.getState().work.find(x=>x.id===work.id).status,'已关闭');assert.deepEqual(h2.errors,[])}finally{h2.close();}
 });
 test(`${id}: guards, human decision, defer/reject and duplicate prevention`,(h,w,f)=>{
  const c=f.cases[id],r=row(f,id);assert.equal(f.startWork(id),false);assert.equal(f.decide(id,'approve',c.plans[0],'skip'),false);f.analyze(id);
  assert.equal(f.decide(id,'approve',c.plans[0],''),false);assert.equal(f.decide(id,'approve','unapproved plan','x'),false);
  for(const choice of ['defer','reject']){assert.equal(f.decide(id,choice,c.plans[0],'先补齐证据'),true);assert.equal(f.startWork(id),false);assert.equal(w.DEMO.getState().work.length,0);}
  assert.equal(f.decide(id,'approve',c.plans[0],'人工批准'),true);const first=f.startWork(id);assert.equal(f.startWork(id),first);assert.equal(w.DEMO.getState().work.length,1);
  assert.equal(f.submitChecks(id,'incomplete'),false);assert.equal(f.closeCase(id,'陈工','skip'),false);assert.equal(f.retest(id,true,'skip'),false);
  w.transitionWork(first,'next',1);assert.equal(r.stage,'executing');assert.equal(w.DEMO.getState().work[0].status,'排查中');
 });
 test(`${id}: failed retest backflow, checklist reset, independent review`,(h,w,f)=>{
  approve(f,id);submit(f,id);assert.equal(f.retest(id,true,''),false);assert.equal(f.retest(id,false,'仍存在异常'),true);const r=row(f,id);assert.equal(r.stage,'executing');assert.equal(r.caseId,null);assert.equal(r.checks.filter(Boolean).length,0);assert.equal(f.closeCase(id,'陈工','skip'),false);assert.equal(f.submitChecks(id,'未复查'),false);
  submit(f,id);assert.equal(f.retest(id,true,'重新处置后通过'),true);assert.equal(r.tests.length,2);assert.equal(r.tests[0].passed,false);assert.equal(r.tests[1].passed,true);
  for(const reviewer of ['', '林工','王工'])assert.equal(f.closeCase(id,reviewer,'review'),false);
  assert.equal(f.closeCase(id,'陈工',''),false);assert.equal(f.closeCase(id,'陈工','独立审核'),true);assert.equal(f.closeCase(id,'陈工','重复'),false);
 });
 test(`${id}: quality blocks prediction, decision, retest and closure`,(h,w,f)=>{
  const c=f.cases[id],r=row(f,id);for(const q of ['缺失','迟到']){f.setQuality(id,q);assert.equal(f.analyze(id),false);assert.equal(r.diagnoses.at(-1).blocked,true);assert.equal(f.decide(id,'approve',c.plans[0],'blocked'),false);assert.equal(f.startWork(id),false)}
  f.setQuality(id,'有效');approve(f,id);submit(f,id);f.setQuality(id,'缺失');assert.equal(f.retest(id,true,'bad data'),false);f.setQuality(id,'有效');assert.equal(f.retest(id,true,'fresh data'),true);f.setQuality(id,'迟到');assert.equal(f.closeCase(id,'陈工','bad data'),false);f.setQuality(id,'有效');assert.equal(f.closeCase(id,'陈工','fresh data'),true);
 });
}
test('all three closed counts, independent reset and reload has no stale entities',(h,w,f)=>{
 for(const id of Object.keys(f.cases))finish(f,id);w.navigate('overview');let values=[...w.document.querySelectorAll('#content > .kpis .kpi-value')].map(x=>parseInt(x.textContent));assert.deepEqual(values,[0,0,0,3]);
 const oldId=row(f,'battery').workId;f.reset('battery');assert.equal(w.DEMO.getState().work.length,2);assert.ok(!w.DEMO.getState().work.some(x=>x.id===oldId));const r=row(f,'battery');assert.equal(r.caseId,null);for(const field of ['diagnoses','decisions','tests'])assert.equal(r[field].length,0);assert.equal(row(f,'cooling').stage,'closed');
 const h2=reload(h);try{assert.equal(row(h2.w.WF,'battery').stage,'discovered');assert.equal(h2.w.DEMO.getState().work.length,2)}finally{h2.close()}
 w.resetDemo();assert.equal(w.DEMO.getState().work.length,0);for(const id of Object.keys(f.cases)){assert.equal(row(f,id).stage,'discovered');assert.equal(row(f,id).caseId,null)}
});
test('UI click path executes linked journey and escapes entered text',(h,w,f)=>{
 f.select('battery');let clickText=t=>{const b=[...w.document.querySelectorAll('#content button')].find(x=>x.textContent===t);assert.ok(b,t);b.click();};
 clickText('核验并进入 AI 分析');clickText('生成辅助分析');w.document.querySelector('#wf-note').value='<img src=x onerror=alert(1)> 已核验';clickText('批准方案');clickText('将已批准方案转为工单');
 for(const x of w.document.querySelectorAll('.check-row input')){x.checked=true;x.dispatchEvent(new w.Event('change'));}w.document.querySelector('#wf-work-note').value='记录';clickText('提交排查，进入复测');w.document.querySelector('#wf-work-note').value='复测';clickText('回放复测通过证据');w.document.querySelector('#wf-reviewer').value='陈工';w.document.querySelector('#wf-work-note').value='独立审核';clickText('独立审核并关闭');assert.equal(row(f,'battery').stage,'closed');f.go('assistant','battery');assert.equal(w.document.querySelectorAll('#content img').length,0);
});
test('selection alone is persisted across reload',(h,w,f)=>{f.select('capacity');const h2=reload(h);try{assert.equal(h2.w.WF.getState().active,'capacity')}finally{h2.close()}});
test('quality downgrade does not show active prediction as trusted',(h,w,f)=>{f.select('cooling');f.analyze('cooling');f.setQuality('cooling','缺失');f.go('assistant','cooling');const primary=w.document.querySelector('#content > .grid');assert.ok(primary.textContent.includes('拒绝预测'));assert.ok(!primary.textContent.includes('演示线性外推 +30 分钟约 33°C'));});
test('site-filtered summary matches visible scenario cards',(h,w,f)=>{finish(f,'battery');w.navigate('overview');w.selectSite(w.DEMO.getState().devices.find(x=>x.id===f.cases.battery.device).site);const cards=w.document.querySelectorAll('[data-scenario]');assert.equal(cards.length,1);const values=[...w.document.querySelectorAll('#content > .kpis .kpi-value')].map(x=>parseInt(x.textContent));assert.deepEqual(values,[0,0,0,1]);});
test('invalid API IDs return safely',(h,w,f)=>{for(const fn of ['analyze','startWork','reset'])assert.equal(f[fn]('unknown'),false);assert.equal(f.decide('unknown','approve','x','x'),false);assert.equal(f.check('unknown',0,true),false);assert.equal(f.submitChecks('unknown','x'),false);assert.equal(f.retest('unknown',true,'x'),false);assert.equal(f.closeCase('unknown','陈工','x'),false);assert.equal(f.setQuality('unknown','有效'),false);});
test('corrupt journey reload cleans linked work and alarm together',(h,w,f)=>{approve(f,'battery');const saved=JSON.parse(w.localStorage.getItem('hongchuang-power-demo-v1'));saved.journeys.records.battery.stage='invalid';const x=load({seed:{'hongchuang-power-demo-v1':JSON.stringify(saved)}});try{assert.deepEqual(x.errors,[]);assert.equal(row(x.w.WF,'battery').stage,'discovered');assert.equal(x.w.DEMO.getState().work.filter(a=>a.journey==='battery').length,0);assert.equal(x.w.DEMO.getState().alarms.find(a=>a.id===f.cases.battery.alarm).work,null)}finally{x.close()}});
test('orphan linked work reload recovers instead of throwing',(h,w,f)=>{approve(f,'battery');const saved=JSON.parse(w.localStorage.getItem('hongchuang-power-demo-v1'));saved.work=[];const x=load({seed:{'hongchuang-power-demo-v1':JSON.stringify(saved)}});try{assert.deepEqual(x.errors,[]);assert.equal(row(x.w.WF,'battery').stage,'discovered');assert.equal(x.w.DEMO.getState().alarms.find(a=>a.id===f.cases.battery.alarm).work,null)}finally{x.close()}});
test('shared asset metrics and risk follow scenario closure and reset',(h,w,f)=>{const expected={battery:['单体内阻偏离',31,4],cooling:['机柜进风温度',29.4,23.8],capacity:['支路峰值负载率',84,62]};for(const [id,[name,before,after]] of Object.entries(expected)){const c=f.cases[id],d=w.DEMO.getState().devices.find(x=>x.id===c.device);let p=w.DEMO.points(d).find(x=>x.name===name);assert.equal(p.value,before);assert.ok(p.source_ts.includes(c.evidence));assert.equal(d.riskLabel,'待核验风险');finish(f,id);p=w.DEMO.points(d).find(x=>x.name===name);assert.equal(p.value,after);assert.ok(p.source_ts.includes(row(f,id).tests.at(-1).evidence));assert.equal(d.riskLabel,'已闭环');assert.equal(d.riskStatus,'已闭环');f.go('health',id);assert.ok(!w.document.querySelector('.legacy-explorer'));f.reset(id);assert.equal(w.DEMO.points(d).find(x=>x.name===name).value,before);assert.equal(d.riskLabel,'待核验风险')}});
test('quality recovery requires fresh diagnosis before approval',(h,w,f)=>{f.analyze('battery');f.setQuality('battery','缺失');f.setQuality('battery','有效');assert.equal(f.decide('battery','approve',f.cases.battery.plans[0],'old diagnosis'),false);assert.equal(f.analyze('battery'),true);assert.equal(f.decide('battery','approve',f.cases.battery.plans[0],'fresh diagnosis'),true)});
test('different reviewer with shared surname remains eligible',(h,w,f)=>{approve(f,'battery');submit(f,'battery');f.retest('battery',true,'test');assert.equal(f.closeCase('battery','王晓明','independent reviewer'),true)});
test('asset detail carries selected linked asset into monitor context',(h,w,f)=>{f.select('battery');w.assetDetail(f.cases.cooling.device);const buttons=[...w.document.querySelectorAll('#dialog button')];const target=buttons.find(x=>/实时|测点|证据/.test(x.textContent));assert.ok(target);target.click();assert.equal(f.getState().active,'cooling');assert.ok(w.document.querySelector('.journey-context').textContent.includes(f.cases.cooling.device));});
console.log(JSON.stringify(results,null,2));fs.writeFileSync(__dirname+'/linked-results.json',JSON.stringify(results,null,2));process.exitCode=results.some(r=>r.status==='FAIL')?1:0;

import {parseRepo,groupOf,statusLabel,summary,filterRuns,durationMs,formatDuration,runUrl} from './domain.js';
import type {Run,Job,Repo,Filter} from './domain.js';
import {GitHubClient,ApiError} from './github.js';
import {SAMPLE_REPO,SAMPLE_RUNS,sampleJobs} from './sample.js';
import {LatestRequest} from './session.js';

const el=<T extends HTMLElement=HTMLElement>(id:string)=>{
  const node=document.getElementById(id);if(!node)throw new Error(`Missing ${id}`);return node as T;
};
const create=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className=''):HTMLElementTagNameMap[K]=>{
  const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;
};
const client=new GitHubClient(),loadingRequest=new LatestRequest(),detailRequest=new LatestRequest();
const dateFormat=new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
let mode:'sample'|'live'='sample',repo:Repo=SAMPLE_REPO,runs:Run[]=SAMPLE_RUNS,total=8,selected:Run|null=null,busy=false,nextRefresh=0;
let lastInput='busrabuseucar/csv-doctor';
const number=(n:number)=>n.toLocaleString('tr-TR');
const symbols={success:'✓',failure:'×',active:'◷',other:'−'};
function badge(run:Pick<Run,'status'|'conclusion'>) {return create('span',statusLabel(run),`badge ${groupOf(run)}`);}
function symbol(run:Pick<Run,'status'|'conclusion'>) {const node=create('span',symbols[groupOf(run)],`status-symbol ${groupOf(run)}`);node.setAttribute('aria-hidden','true');return node;}
function link(text:string,url:string,className='') {const node=create('a',text,className);node.href=url;node.target='_blank';node.rel='noopener noreferrer';return node;}
function setBusy(value:boolean,message='') {
  busy=value;el<HTMLButtonElement>('load-button').disabled=value;
  el<HTMLButtonElement>('refresh-button').disabled=value||mode==='sample'||Date.now()<nextRefresh;
  el('status').textContent=message;el('dashboard').setAttribute('aria-busy',String(value));
}
function resetFilters() {
  el<HTMLSelectElement>('group-filter').value='all';
  const workflows=new Map(runs.map(r=>[String(r.workflowId),r.name]));
  const workflow=el<HTMLSelectElement>('workflow-filter'),branch=el<HTMLSelectElement>('branch-filter');
  workflow.replaceChildren(new Option('Tümü',''),...[...workflows].map(([id,name])=>new Option(name,id)));
  branch.replaceChildren(new Option('Tümü',''),...[...new Set(runs.map(r=>r.branch))].sort().map(b=>new Option(b,b)));
}
function updateBudget() {
  el('api-budget').textContent=mode==='sample'?'Örnek modunda GitHub isteği yapılmaz.':client.rate.remaining===null?'GitHub istekleri tarayıcından yapılır. Otomatik yenileme kapalı.':`GitHub istek hakkı: ${client.rate.remaining}${client.rate.resetAt?' · yenilenme '+dateFormat.format(client.rate.resetAt):''}`;
}
function overview() {
  const s=summary(runs);el('repo-name').textContent=repo.fullName;
  el('mode-badge').textContent=mode==='sample'?'ÖRNEK VERİ · CANLI DEĞİL':'GITHUB VERİSİ';
  el('mode-badge').className=`mode-badge${mode==='live'?' live':''}`;
  el('sample-lesson').hidden=mode!=='sample';
  el('success-rate').textContent=s.successRate===null?'—':`%${s.successRate}`;
  el('rate-detail').textContent=`${s.evaluated} sonuç hesaba katıldı · ${s.other} diğer`;
  el('success-count').textContent=number(s.success);el('failure-count').textContent=number(s.failure);el('active-count').textContent=number(s.active);
  el('list-footnote').textContent=mode==='sample'?'8 kurgusal kayıt. Gerçek GitHub çalıştırmaları değildir.':`Toplam ${number(total)} çalıştırmanın en yeni ${number(runs.length)} tanesi alındı. Filtreler bu kayıtlar üzerinde çalışır.`;
  updateBudget();
}
function renderList() {
  const filter:Filter={group:el<HTMLSelectElement>('group-filter').value as Filter['group'],workflow:el<HTMLSelectElement>('workflow-filter').value,branch:el<HTMLSelectElement>('branch-filter').value};
  const filtered=filterRuns(runs,filter);el('run-count').textContent=`${filtered.length} / ${runs.length}`;
  const cards=filtered.map(run=>{
    const button=create('button','','run-card');button.type='button';button.setAttribute('aria-pressed',String(selected?.id===run.id));button.setAttribute('aria-controls','detail-panel');
    const content=create('div');content.append(create('strong',run.title));
    const meta=create('div','','run-meta');meta.append(create('span',`${run.name} #${run.number}`),create('span',`⑂ ${run.branch}`),create('span',run.sha.slice(0,7)||'SHA yok'));content.append(meta);
    const side=create('div','','run-side'),time=create('time',dateFormat.format(new Date(run.createdAt)));time.dateTime=run.createdAt;side.append(time,badge(run));
    button.append(symbol(run),content,side);button.addEventListener('click',()=>{void selectRun(run,true);});return button;
  });
  el('run-list').replaceChildren(...(cards.length?cards:[create('p',runs.length?'Bu filtrelere uyan çalıştırma yok.':'Bu depoda görünür GitHub Actions çalıştırması yok. Başka bir açık depo veya örnek modu seç.','empty')]));
}
function detailShell(run:Run) {
  const content=el('detail-content');content.replaceChildren();el('detail-number').textContent=`#${run.number} · deneme ${run.attempt}`;
  content.append(badge(run),create('h3',run.title,'detail-run-title'));
  const meta=create('div','','detail-meta');meta.append(create('span',run.branch),create('span',run.sha.slice(0,7)||'SHA yok'),create('span',run.event),create('span',run.actor));content.append(meta);
  if(mode==='live')content.append(link('Bu çalıştırmayı GitHub’da aç ↗',runUrl(repo,run),'github-link'));
  else content.append(create('p','Kurgusal çalıştırma; GitHub bağlantısı yok.','detail-note'));
  const jobs=create('div');jobs.id='jobs-container';jobs.setAttribute('aria-live','polite');content.append(jobs);
}
function renderJobs(jobs:Job[],run:Run,partial=false,totalJobs=jobs.length) {
  const container=el('jobs-container');container.replaceChildren();
  if(!jobs.length)container.append(create('p','Bu denemeye ait iş adımı henüz yok. GitHub’daki çalıştırmayı kontrol edebilirsin.','jobs-status'));
  if(partial)container.append(create('p',`${totalJobs} işin ${jobs.length} tanesi gösteriliyor. Tam listeyi GitHub’da aç.`, 'jobs-status'));
  for(const job of jobs) {
    const box=create('section','','job-box'),head=create('div','','job-header'),name=create('div');
    name.append(create('strong',job.name),create('p',`Süre: ${formatDuration(durationMs(job.startedAt,job.completedAt))}`));
    if(mode==='live')name.append(link('İşin loglarını GitHub’da aç ↗',runUrl(repo,run,job)));
    head.append(name,badge(job));box.append(head);
    const list=create('ol','','steps');
    for(const step of job.steps){const li=create('li','','step'),name=create('div');name.append(create('span',step.name,'step-name'),create('span',statusLabel(step),'step-label'));li.append(symbol(step),name,create('span',formatDuration(durationMs(step.startedAt,step.completedAt)),'step-duration'));list.append(li);}
    if(!job.steps.length)box.append(create('p','Adımlar henüz oluşmadı.','jobs-status'));else box.append(list);
    container.append(box);
  }
  if(mode==='sample'&&(run.id===1007||run.id===1008)){
    const note=create('div','','sample-explanation');note.append(create('strong',run.id===1007?'Hata: iptal edilen işi başarılı saymak':'Düzeltme: yalnızca success sonucunu kabul etmek'));
    note.append(create('p','Bu açıklama öğretici örnektir; gerçek bir GitHub logundan alınmadı.'));
    note.append(create('pre',run.id===1007?'const isSuccess = result !== "failure";\n\n// cancelled → true (hatalı)\n// Test beklentisi: false':'const isSuccess = result === "success";\n\n// cancelled → false\n// success   → true'));
    container.append(note);
  }
}
async function selectRun(run:Run,focus=false,force=false) {
  const ticket=detailRequest.begin();selected=run;renderList();detailShell(run);
  if(focus)el('detail-title').focus({preventScroll:false});
  if(mode==='sample'){renderJobs(sampleJobs(run),run);return;}
  el('jobs-container').append(create('p','İş adımları GitHub’dan alınıyor…','jobs-status'));
  try {
    const result=await client.jobs(repo,run,ticket.signal,force);
    if(!detailRequest.current(ticket))return;
    renderJobs(result.jobs,run,result.partial,result.total);updateBudget();
  } catch(error) {
    if(!detailRequest.current(ticket))return;
    const box=create('div','','detail-error');box.setAttribute('role','alert');box.append(create('p',error instanceof Error?error.message:'İş adımları alınamadı.'));
    const retry=create('button','Adımları tekrar getir','secondary');retry.type='button';retry.addEventListener('click',()=>{void selectRun(run,false,true);});box.append(retry);el('jobs-container').replaceChildren(box);updateBudget();
  }
}
function showSample() {
  loadingRequest.cancel();detailRequest.cancel();mode='sample';repo=SAMPLE_REPO;runs=SAMPLE_RUNS;total=runs.length;selected=null;el('error').hidden=true;el('dashboard').hidden=false;
  el('snapshot-time').textContent='4 Eylül 2026 tarihli kurgusal örnek. Zamanlar tarayıcının saat diliminde.';
  resetFilters();overview();setBusy(false,'Örnek modu açık. Bu sonuçlar gerçek bir depoya ait değil.');void selectRun(SAMPLE_RUNS[1]!);
}
async function loadRepo(input:string,force=false) {
  let target:Repo;try{target=parseRepo(input);}catch(error){el('error-message').textContent=(error as Error).message;el('error').hidden=false;return;}
  lastInput=target.fullName;el<HTMLInputElement>('repo-input').value=target.fullName;
  const ticket=loadingRequest.begin();detailRequest.cancel();selected=null;el('error').hidden=true;el('dashboard').hidden=true;
  setBusy(true,`${target.fullName} çalıştırmaları alınıyor…`);
  try {
    const data=await client.runs(target,ticket.signal,force);
    if(!loadingRequest.current(ticket))return;
    mode='live';repo=target;runs=data.runs;total=data.total;nextRefresh=Date.now()+15000;
    el('dashboard').hidden=false;el('snapshot-time').textContent=`Son görüntü: ${dateFormat.format(new Date())} · yanıtlar en fazla 60 sn önbellekte tutulur. Otomatik yenileme yok.`;
    resetFilters();overview();renderList();setBusy(false,`${runs.length} çalıştırma alındı.`);
    setTimeout(()=>{if(!busy&&mode==='live'&&Date.now()>=nextRefresh)el<HTMLButtonElement>('refresh-button').disabled=false;},15100);
    if(runs[0])void selectRun(runs[0]);else{el('detail-number').textContent='';el('detail-content').replaceChildren(create('p','İncelenecek çalıştırma yok.','empty'));}
  } catch(error) {
    if(!loadingRequest.current(ticket))return;
    setBusy(false,'');
    let message=error instanceof Error?error.message:'GitHub’dan veri alınamadı.';
    if(error instanceof ApiError&&error.kind==='rate-limit'&&error.retryAt)message+=` Bildirilen yenilenme zamanı: ${dateFormat.format(error.retryAt)}.`;
    el('error-message').textContent=message;el('error').hidden=false;
  }
}
el<HTMLFormElement>('repo-form').addEventListener('submit',event=>{event.preventDefault();void loadRepo(el<HTMLInputElement>('repo-input').value);});
el('sample-button').addEventListener('click',showSample);
el('retry-button').addEventListener('click',()=>{void loadRepo(el<HTMLInputElement>('repo-input').value||lastInput,true);});
el('refresh-button').addEventListener('click',()=>{if(!busy&&Date.now()>=nextRefresh&&mode==='live')void loadRepo(repo.fullName,true);});
for(const id of ['group-filter','workflow-filter','branch-filter'])el(id).addEventListener('change',renderList);
document.querySelectorAll<HTMLButtonElement>('[data-repo]').forEach(button=>button.addEventListener('click',()=>{void loadRepo(button.dataset.repo!);}));
for(const [id,runId] of [['lesson-before',1007],['lesson-after',1008]] as const)el(id).addEventListener('click',()=>{if(mode==='sample'){resetFilters();void selectRun(SAMPLE_RUNS.find(r=>r.id===runId)!,true);}});
showSample();

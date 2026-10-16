export type Repo = { owner: string; name: string; fullName: string };
export type Run = {
  id:number; workflowId:number; name:string; title:string; branch:string; sha:string;
  number:number; attempt:number; event:string; status:string; conclusion:string|null;
  createdAt:string; startedAt:string|null; updatedAt:string; actor:string;
};
export type Step = { number:number; name:string; status:string; conclusion:string|null; startedAt:string|null; completedAt:string|null };
export type Job = { id:number; runId:number; name:string; status:string; conclusion:string|null; startedAt:string|null; completedAt:string|null; steps:Step[] };
export type RunGroup = 'success'|'failure'|'active'|'other';
export type RunsPage = { runs:Run[]; total:number };
export type JobsPage = { jobs:Job[]; total:number; partial:boolean };
export type Filter = { group:RunGroup|'all'; workflow:string; branch:string };

export class DataError extends Error { constructor(message:string) { super(message); this.name='DataError'; } }
export function parseRepo(input:string):Repo {
  let value=input.trim();
  if (/^https?:\/\//i.test(value)) {
    let url:URL;
    try { url=new URL(value); } catch { throw new DataError('Geçerli bir GitHub depo bağlantısı yaz.'); }
    if (url.protocol!=='https:' || url.hostname!=='github.com' || url.port || url.username || url.password || url.search || url.hash) throw new DataError('Yalnızca https://github.com/kullanıcı/depo bağlantısı kabul edilir.');
    value=url.pathname.replace(/^\//,'').replace(/\/$/,'');
  }
  value=value.replace(/\.git$/,'');
  const parts=value.split('/'); const owner=parts[0] ?? '', name=parts[1] ?? '';
  if (parts.length!==2 || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(name) || name==='.' || name==='..') throw new DataError('Depoyu kullanıcı/depo biçiminde yaz. Örnek: busrabuseucar/csv-doctor');
  return {owner,name,fullName:`${owner}/${name}`};
}
function object(value:unknown):Record<string,unknown> {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new DataError('GitHub beklenmeyen bir yanıt gönderdi.');
  return value as Record<string,unknown>;
}
function integer(value:unknown, positive=false):number {
  if (typeof value!=='number' || !Number.isSafeInteger(value) || value<(positive?1:0)) throw new DataError('GitHub yanıtındaki kayıt numarası geçersiz.');
  return value;
}
function str(value:unknown,fallback='—',max=240):string { return typeof value==='string' && value.length ? value.slice(0,max) : fallback; }
function date(value:unknown,required=false):string|null {
  if (typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,19) === value.slice(0,19)) return value;
  }
  if (required) throw new DataError('GitHub yanıtındaki tarih geçersiz.');
  return null;
}
export function normalizeRuns(payload:unknown):RunsPage {
  const p=object(payload);
  if (!Array.isArray(p.workflow_runs) || p.workflow_runs.length>100) throw new DataError('Çalıştırma listesi beklenen biçimde değil.');
  const seen=new Set<number>();
  const runs:Run[]=p.workflow_runs.map(item=>{
    const r=object(item), id=integer(r.id,true);
    if (seen.has(id)) throw new DataError('GitHub yanıtında yinelenen çalıştırma var.'); seen.add(id);
    return {id,workflowId:integer(r.workflow_id,true),name:str(r.name,'İsimsiz iş akışı'),title:str(r.display_title,str(r.name)),branch:str(r.head_branch,'(dal yok)'),sha:typeof r.head_sha==='string' && /^[0-9a-f]{40,64}$/i.test(r.head_sha)?r.head_sha:'',number:integer(r.run_number,true),attempt:integer(r.run_attempt??1,true),event:str(r.event,'unknown',80),status:str(r.status,'unknown',80),conclusion:typeof r.conclusion==='string'?r.conclusion.slice(0,80):null,createdAt:date(r.created_at,true)!,startedAt:date(r.run_started_at),updatedAt:date(r.updated_at,true)!,actor:str(r.actor && typeof r.actor==='object' ? (r.actor as Record<string,unknown>).login : null,'—',80)};
  }).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||b.id-a.id);
  return {runs,total:integer(p.total_count)};
}
export function normalizeJobs(payload:unknown,runId:number):{jobs:Job[];total:number} {
  const p=object(payload);
  if (!Array.isArray(p.jobs) || p.jobs.length>100) throw new DataError('İş adımları beklenen biçimde değil.');
  const jobs=p.jobs.map(item=>{
    const j=object(item);
    if (integer(j.run_id,true)!==runId) throw new DataError('İş adımları seçilen çalıştırmayla eşleşmiyor.');
    if (!Array.isArray(j.steps) || j.steps.length>1000) throw new DataError('İş adımları okunamadı.');
    return {id:integer(j.id,true),runId,name:str(j.name),status:str(j.status,'unknown'),conclusion:typeof j.conclusion==='string'?j.conclusion.slice(0,80):null,startedAt:date(j.started_at),completedAt:date(j.completed_at),steps:j.steps.map(item=>{
      const s=object(item); return {number:integer(s.number,true),name:str(s.name),status:str(s.status,'unknown'),conclusion:typeof s.conclusion==='string'?s.conclusion.slice(0,80):null,startedAt:date(s.started_at),completedAt:date(s.completed_at)};
    })};
  });
  return {jobs,total:integer(p.total_count)};
}
const failed=new Set(['failure','timed_out','action_required','startup_failure']);
const active=new Set(['queued','in_progress','waiting','pending','requested']);
export function groupOf(run:Pick<Run,'status'|'conclusion'>):RunGroup {
  if(active.has(run.status)) return 'active';
  if(run.status!=='completed') return 'other';
  if(run.conclusion==='success') return 'success';
  return run.conclusion && failed.has(run.conclusion)?'failure':'other';
}
export function statusLabel(run:Pick<Run,'status'|'conclusion'>):string {
  const states:Record<string,string>={queued:'Sırada',in_progress:'Çalışıyor',waiting:'Onay bekliyor',pending:'Bekliyor',requested:'İstendi'};
  if(run.status!=='completed') return Object.hasOwn(states,run.status) ? states[run.status]! : 'Bilinmeyen durum';
  const results:Record<string,string>={success:'Başarılı',failure:'Başarısız',timed_out:'Süre aşıldı',action_required:'İşlem gerekli',startup_failure:'Başlatılamadı',cancelled:'İptal edildi',skipped:'Atlandı',neutral:'Nötr',stale:'Süresi geçti'};
  return Object.hasOwn(results,run.conclusion??'') ? results[run.conclusion!]! : 'Sonuç bilinmiyor';
}
export function filterRuns(runs:Run[],filter:Filter):Run[] {
  return runs.filter(r=>(filter.group==='all'||groupOf(r)===filter.group) && (!filter.workflow||String(r.workflowId)===filter.workflow) && (!filter.branch||r.branch===filter.branch));
}
export function summary(runs:Run[]) {
  const counts={success:0,failure:0,active:0,other:0};
  runs.forEach(r=>counts[groupOf(r)]++);
  const evaluated=counts.success+counts.failure;
  return {...counts,total:runs.length,evaluated,successRate:evaluated?Math.round(counts.success/evaluated*100):null};
}
export function durationMs(start:string|null,end:string|null):number|null {
  if(!start||!end) return null;
  const duration=Date.parse(end)-Date.parse(start);
  return Number.isFinite(duration)&&duration>=0?duration:null;
}
export function formatDuration(ms:number|null):string {
  if(ms===null) return '—';
  const seconds=Math.round(ms/1000);return seconds<60?`${seconds} sn`:`${Math.floor(seconds/60)} dk ${seconds%60} sn`;
}
export function runUrl(repo:Repo,run:Run,job?:Job):string {
  if(!Number.isSafeInteger(run.id)||run.id<1||!Number.isSafeInteger(run.attempt)||run.attempt<1) throw new DataError('Geçersiz çalıştırma.');
  const base=`https://github.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/actions/runs/${run.id}`;
  return job?`${base}/job/${integer(job.id,true)}`:`${base}/attempts/${run.attempt}`;
}

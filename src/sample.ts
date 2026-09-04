import type {Run,Job} from './domain.js';
export const SAMPLE_REPO={owner:'demo',name:'checkout-api',fullName:'demo/checkout-api'};
const base={workflowId:101,name:'Tests & build',branch:'main',attempt:1,event:'push',actor:'demo-developer'};
function run(id:number,number:number,title:string,status:string,conclusion:string|null,time:string,extra:Partial<Run>={}):Run {
  return {...base,id,number,title,status,conclusion,sha:id.toString(16).padStart(40,'0'),createdAt:`2026-09-04T${time}:00Z`,startedAt:`2026-09-04T${time}:03Z`,updatedAt:`2026-09-04T${time}:55Z`,...extra};
}
export const SAMPLE_RUNS:Run[]=[
  run(1008,48,'fix: iptal edilen çalıştırmayı başarı sayma','completed','success','13:40'),
  run(1007,47,'test: iptal durumuna regresyon testi ekle','completed','failure','13:32'),
  run(1006,46,'feat: iş adımlarını göster','in_progress',null,'13:28',{branch:'feat/job-details'}),
  run(1005,45,'docs: kurulum adımlarını güncelle','completed','success','13:15'),
  run(1004,44,'refactor: durum eşlemesini ayır','completed','cancelled','12:54',{branch:'refactor/status'}),
  run(1003,43,'chore: tip kontrolü ekle','completed','success','12:20'),
  run(1002,12,'build: eksik dosya referansı','completed','failure','11:42',{workflowId:102,name:'Static checks'}),
  run(1001,42,'feat: temel çalıştırma listesi','completed','success','11:10')
];
export function sampleJobs(run:Run):Job[] {
  const fail=run.conclusion==='failure',working=run.status==='in_progress',cancelled=run.conclusion==='cancelled';
  const steps=['Ortamı hazırla','Bağımlılıkları kur','Birim testlerini çalıştır','Uygulamayı derle'];
  const start=Date.parse(run.startedAt!);
  return [{id:run.id*10,runId:run.id,name:'verify',status:run.status,conclusion:run.conclusion,startedAt:run.startedAt,completedAt:working?null:new Date(start+51000).toISOString(),steps:steps.map((name,index)=>{
    const conclusion=index<2?'success':index===2?(fail?'failure':cancelled?'cancelled':working?null:'success'):(fail||cancelled?'skipped':working?null:'success');
    return {number:index+1,name,status:working&&index>=2?(index===2?'in_progress':'queued'):'completed',conclusion,startedAt:working&&index>2?null:new Date(start+index*12000).toISOString(),completedAt:working&&index>=2?null:new Date(start+index*12000+11000).toISOString()};
  })}];
}

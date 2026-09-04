export function rawRun(overrides={}) {
  return {id:42,workflow_id:7,name:'CI',display_title:'test: status mapping',head_branch:'main',head_sha:'a'.repeat(40),run_number:3,run_attempt:2,event:'push',status:'completed',conclusion:'success',created_at:'2026-09-04T10:00:00Z',run_started_at:'2026-09-04T10:00:02Z',updated_at:'2026-09-04T10:01:00Z',actor:{login:'test-user'},...overrides};
}
export function rawJob(overrides={}) {
  return {id:77,run_id:42,name:'verify',status:'completed',conclusion:'success',started_at:'2026-09-04T10:00:02Z',completed_at:'2026-09-04T10:01:00Z',steps:[{number:1,name:'Run tests',status:'completed',conclusion:'success',started_at:'2026-09-04T10:00:10Z',completed_at:'2026-09-04T10:00:45Z'}],...overrides};
}
export const jsonResponse=(data,init={})=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json','x-ratelimit-remaining':'59','x-ratelimit-reset':'1788526800'},...init});

import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRepo,normalizeRuns,normalizeJobs,groupOf,statusLabel,summary,filterRuns,runUrl,durationMs,formatDuration} from '../dist/domain.js';
import {SAMPLE_RUNS,sampleJobs} from '../dist/sample.js';
import {LatestRequest} from '../dist/session.js';
import {rawRun,rawJob} from './fixtures.mjs';
const normalize=(...runs)=>normalizeRuns({total_count:runs.length,workflow_runs:runs}).runs;

test('accepts a repository slug or canonical HTTPS GitHub clone URL',()=>{
  assert.equal(parseRepo(' busrabuseucar/csv-doctor ').fullName,'busrabuseucar/csv-doctor');
  assert.equal(parseRepo('https://github.com/busrabuseucar/Ministock.git/').fullName,'busrabuseucar/Ministock');
});
test('rejects credentials, external origins, path injection and malformed repositories',()=>{
  for(const value of ['https://github.com.evil.test/a/b','https://user:secret@github.com/a/b','http://github.com/a/b','a/../b','a/%2e%2e','a/b?token=x','https://github.com/a/b#fragment','https://github.com/a/b/actions','a/..','-owner/repo','a/'])assert.throws(()=>parseRepo(value));
});
test('cancelled, skipped and unknown outcomes are never reported as success',()=>{
  for(const conclusion of ['cancelled','skipped','neutral','stale','unexpected',null])assert.equal(groupOf({status:'completed',conclusion}),'other');
  assert.equal(groupOf({status:'mystery',conclusion:'success'}),'other');
});
test('active state takes precedence over a stale conclusion',()=>{
  for(const status of ['queued','in_progress','waiting','pending','requested'])assert.equal(groupOf({status,conclusion:'success'}),'active');
});
test('failure-like terminal conclusions map to failure with a specific visible label',()=>{
  for(const conclusion of ['failure','timed_out','action_required','startup_failure'])assert.equal(groupOf({status:'completed',conclusion}),'failure');
  assert.equal(statusLabel({status:'completed',conclusion:'cancelled'}),'İptal edildi');
  assert.equal(statusLabel({status:'completed',conclusion:'timed_out'}),'Süre aşıldı');
});
test('success rate excludes cancelled and running records and handles empty denominators',()=>{
  assert.deepEqual(summary(SAMPLE_RUNS),{total:8,success:4,failure:2,active:1,other:1,evaluated:6,successRate:67});
  assert.equal(summary([]).successRate,null);
  assert.equal(summary(normalize(rawRun({conclusion:'cancelled'}))).successRate,null);
});
test('filters combine result, workflow identity and branch without mutating input',()=>{
  const results=filterRuns(SAMPLE_RUNS,{group:'failure',workflow:'101',branch:'main'});
  assert.deepEqual(results.map(r=>r.id),[1007]);assert.equal(SAMPLE_RUNS.length,8);
});
test('normalization sorts newest first and permits nullable branches or deleted actors',()=>{
  const runs=normalize(rawRun({id:1,head_branch:null,actor:null}),rawRun({id:2,created_at:'2026-09-04T11:00:00Z'}));
  assert.equal(runs[0].id,2);assert.equal(runs[1].branch,'(dal yok)');assert.equal(runs[1].actor,'—');
});
test('malformed payloads and duplicate IDs fail instead of producing misleading statistics',()=>{
  for(const payload of [null,{}, {total_count:1,workflow_runs:[rawRun({id:-1})]}, {total_count:1,workflow_runs:[rawRun({created_at:'invalid'})]}, {total_count:2,workflow_runs:[rawRun(),rawRun()]}])assert.throws(()=>normalizeRuns(payload));
});
test('job responses must belong to the selected run and retain step conclusions',()=>{
  assert.throws(()=>normalizeJobs({total_count:1,jobs:[rawJob({run_id:99})]},42));
  const result=normalizeJobs({total_count:1,jobs:[rawJob()]},42);
  assert.equal(result.jobs[0].steps[0].conclusion,'success');
});
test('run and job links are constructed from validated identities, not API html_url',()=>{
  const run=normalize(rawRun({html_url:'javascript:alert(1)'}))[0];const repo=parseRepo('a/b');
  assert.equal(runUrl(repo,run),'https://github.com/a/b/actions/runs/42/attempts/2');
  assert.equal(runUrl(repo,run,{id:77}),'https://github.com/a/b/actions/runs/42/job/77');
});
test('duration uses actual start/end timestamps and unknown duration stays unknown',()=>{
  assert.equal(durationMs('2026-09-04T10:00:00Z','2026-09-04T10:01:05Z'),65000);
  assert.equal(durationMs('2026-09-04T10:00:00Z',null),null);
  assert.equal(durationMs('2026-09-04T10:01:00Z','2026-09-04T10:00:00Z'),null);
  assert.equal(formatDuration(65000),'1 dk 5 sn');assert.equal(formatDuration(null),'—');
});
test('the sample demonstrates a failed test followed by a successful fix',()=>{
  const before=sampleJobs(SAMPLE_RUNS.find(r=>r.id===1007))[0];
  const after=sampleJobs(SAMPLE_RUNS.find(r=>r.id===1008))[0];
  assert.equal(before.steps[2].conclusion,'failure');assert.equal(before.steps[3].conclusion,'skipped');
  assert.equal(after.steps[2].conclusion,'success');assert.equal(after.steps[3].conclusion,'success');
});
test('switching requests aborts the older selection and prevents stale rendering',()=>{
  const latest=new LatestRequest(),old=latest.begin(),current=latest.begin();
  assert.equal(old.signal.aborted,true);assert.equal(latest.current(old),false);assert.equal(latest.current(current),true);
});
test('switching to sample mode invalidates an in-flight live response',()=>{
  const latest=new LatestRequest(),ticket=latest.begin();latest.cancel();assert.equal(latest.current(ticket),false);assert.equal(ticket.signal.aborted,true);
});

test('invalid calendar dates and missing UTC markers are rejected',()=>{
  for(const created_at of ['2026-02-30T10:00:00Z','2026-09-04T24:00:00Z','2026-09-04T10:00:00'])
    assert.throws(()=>normalize(rawRun({created_at})));
  assert.equal(normalize(rawRun({created_at:'2024-02-29T10:00:00.123Z'}))[0].createdAt,'2024-02-29T10:00:00.123Z');
  assert.equal(normalize(rawRun({run_started_at:'2026-02-30T10:00:00Z'}))[0].startedAt,null);
});
test('prototype property names are unknown status labels',()=>{
  for(const key of ['constructor','toString','__proto__']) {
    assert.equal(statusLabel({status:key,conclusion:null}),'Bilinmeyen durum');
    assert.equal(statusLabel({status:'completed',conclusion:key}),'Sonuç bilinmiyor');
  }
});

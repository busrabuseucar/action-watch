import test from 'node:test';
import assert from 'node:assert/strict';
import {GitHubClient} from '../dist/github.js';
import {parseRepo,normalizeRuns} from '../dist/domain.js';
import {rawRun,rawJob,jsonResponse} from './fixtures.mjs';
const repo=parseRepo('busrabuseucar/csv-doctor');
const run=normalizeRuns({total_count:1,workflow_runs:[rawRun()]}).runs[0];

test('fetches only 30 runs using a read-only token-free GitHub request',async()=>{
  const requests=[];const client=new GitHubClient(async(url,init)=>{requests.push({url,init});return jsonResponse({total_count:1,workflow_runs:[rawRun()]});});
  const result=await client.runs(repo);
  assert.equal(result.runs[0].id,42);assert.match(requests[0].url,/^https:\/\/api\.github\.com\/repos\/busrabuseucar\/csv-doctor\/actions\/runs\?per_page=30&page=1$/);
  assert.equal(requests[0].init.method,'GET');assert.equal(requests[0].init.credentials,'omit');assert.equal(requests[0].init.headers.Authorization,undefined);
  assert.equal(client.rate.remaining,59);
});
test('a cache hit does not extend its 60-second lifetime; force refresh bypasses it',async()=>{
  let now=0,count=0;const client=new GitHubClient(async()=>{count++;return jsonResponse({total_count:1,workflow_runs:[rawRun()]});},()=>now);
  await client.runs(repo);now=59000;await client.runs(repo);assert.equal(count,1);
  now=61000;await client.runs(repo);assert.equal(count,2);await client.runs(repo,undefined,true);assert.equal(count,3);
});
test('jobs are fetched for the exact selected attempt and pages are combined',async()=>{
  const paths=[];const client=new GitHubClient(async url=>{paths.push(url);const page=new URL(url).searchParams.get('page');return jsonResponse({total_count:101,jobs:page==='1'?Array.from({length:100},(_,i)=>rawJob({id:i+1})):[rawJob({id:101})]});});
  const result=await client.jobs(repo,run);
  assert.equal(result.jobs.length,101);assert.equal(result.partial,false);assert.equal(paths.length,2);assert.match(paths[0],/\/runs\/42\/attempts\/2\/jobs/);
});
test('job pagination stops at 300 and explicitly marks partial results',async()=>{
  let count=0;const client=new GitHubClient(async()=>{const offset=count++*100;return jsonResponse({total_count:350,jobs:Array.from({length:100},(_,i)=>rawJob({id:offset+i+1}))});});
  const result=await client.jobs(repo,run);assert.equal(count,3);assert.equal(result.jobs.length,300);assert.equal(result.partial,true);assert.equal(result.total,350);
});
test('HTTP 404 tells the user the repository may be private or missing',async()=>{
  const client=new GitHubClient(async()=>jsonResponse({}, {status:404}));await assert.rejects(client.runs(repo),{kind:'not-found'});
});
test('primary rate-limit errors retain a reset time',async()=>{
  const client=new GitHubClient(async()=>jsonResponse({}, {status:403,headers:{'x-ratelimit-remaining':'0','x-ratelimit-reset':'1788526800'}}));
  await assert.rejects(client.runs(repo),{kind:'rate-limit',retryAt:1788526800000});
});
test('429 honors retry-after seconds and does not automatically retry',async()=>{
  let requests=0;const client=new GitHubClient(async()=>{requests++;return jsonResponse({}, {status:429,headers:{'retry-after':'120'}});},()=>1000);
  await assert.rejects(client.runs(repo),{kind:'rate-limit',retryAt:121000});assert.equal(requests,1);
});
test('forbidden and server errors are distinguishable',async()=>{
  for(const [status,kind] of [[403,'forbidden'],[500,'server']]){const client=new GitHubClient(async()=>jsonResponse({}, {status}));await assert.rejects(client.runs(repo),{kind});}
});
test('malformed JSON and unexpected API shapes are rejected and never cached',async()=>{
  let count=0;const client=new GitHubClient(async()=>{count++;return count===1?new Response('<html>error</html>'):jsonResponse({unexpected:true});});
  await assert.rejects(client.runs(repo),{kind:'data'});await assert.rejects(client.runs(repo),{name:'DataError'});assert.equal(count,2);
});
test('network failures have a usable fallback error',async()=>{
  const client=new GitHubClient(async()=>{throw new TypeError('fetch failed');});await assert.rejects(client.runs(repo),{kind:'network'});
});
test('an externally cancelled request is not mislabeled as a connection failure',async()=>{
  const controller=new AbortController();controller.abort();let calls=0;
  const client=new GitHubClient(async()=>{calls++;return jsonResponse({});});await assert.rejects(client.runs(repo,controller.signal),{name:'AbortError'});assert.equal(calls,0);
});
test('a slow request becomes a timeout without a retry storm',async()=>{
  const client=new GitHubClient(async(_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})),Date.now,10);
  await assert.rejects(client.runs(repo),{kind:'timeout'});
});
test('oversized responses fail before JSON normalization',async()=>{
  const client=new GitHubClient(async()=>new Response(' '.repeat(4*1024*1024+1)));await assert.rejects(client.runs(repo),{kind:'data'});
});

import {normalizeRuns,normalizeJobs,DataError,parseRepo} from './domain.js';
import type {Repo,Run,RunsPage,JobsPage} from './domain.js';

export class ApiError extends Error {
  constructor(public kind:'not-found'|'rate-limit'|'forbidden'|'server'|'network'|'timeout'|'data',message:string,public retryAt:number|null=null) {super(message);this.name='ApiError';}
}
type CacheEntry={data:unknown;time:number};
type Fetcher=(input:string,init?:RequestInit)=>Promise<Response>;
export class GitHubClient {
  private cache=new Map<string,CacheEntry>();
  public rate:{remaining:number|null;resetAt:number|null}={remaining:null,resetAt:null};
  constructor(private fetcher:Fetcher=(url,init)=>fetch(url,init),private now:()=>number=Date.now,private timeoutMs=12000) {}
  private async request(path:string,signal?:AbortSignal,force=false):Promise<unknown> {
    if(signal?.aborted) throw new DOMException('Aborted','AbortError');
    const entry=this.cache.get(path);
    if(!force&&entry&&this.now()-entry.time<60000) return entry.data;
    const controller=new AbortController();let timedOut=false;
    const abort=()=>controller.abort(); signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},this.timeoutMs);
    try {
      const response=await this.fetcher(`https://api.github.com${path}`,{method:'GET',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'},credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
      const remaining=response.headers.get('x-ratelimit-remaining'),reset=response.headers.get('x-ratelimit-reset');
      this.rate={remaining:remaining!==null&&/^\d+$/.test(remaining)?Number(remaining):null,resetAt:reset!==null&&/^\d+$/.test(reset)?Number(reset)*1000:null};
      if(!response.ok) {
        const retry=response.headers.get('retry-after');
        const retryAt=retry&&/^\d+$/.test(retry)?this.now()+Number(retry)*1000:retry&&Number.isFinite(Date.parse(retry))?Date.parse(retry):this.rate.resetAt;
        if(response.status===429||(response.status===403&&(this.rate.remaining===0||retry!==null))) throw new ApiError('rate-limit','GitHub istek sınırına ulaşıldı. Bir süre sonra tekrar dene veya örnek modu aç.',retryAt);
        if(response.status===404) throw new ApiError('not-found','Depo bulunamadı veya herkese açık değil. Kullanıcı ve depo adını kontrol et.');
        if(response.status===403||response.status===401) throw new ApiError('forbidden','GitHub bu isteğe izin vermedi. Depo erişimini kontrol et veya daha sonra tekrar dene.');
        throw new ApiError('server',`GitHub yanıt veremedi (HTTP ${response.status}). Yeniden deneyebilirsin.`);
      }
      const reader=response.body?.getReader();
      if(!reader) throw new ApiError('data','GitHub boş bir yanıt gönderdi.');
      const chunks:Uint8Array[]=[];let length=0;
      try {
        while(true) {
          const {value,done}=await reader.read();if(done)break;
          length+=value.byteLength;
          if(length>4*1024*1024){await reader.cancel();throw new ApiError('data','GitHub yanıtı bu demo için fazla büyük.');}
          chunks.push(value);
        }
      } finally {reader.releaseLock();}
      const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      let data:unknown;
      try {data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));} catch {throw new ApiError('data','GitHub yanıtı okunamadı. Tekrar dene.');}
      // Only normalized successes are cached by their caller.
      return data;
    } catch(error) {
      if(signal?.aborted)throw new DOMException('Aborted','AbortError');
      if(timedOut)throw new ApiError('timeout','GitHub yanıtı zaman aşımına uğradı. Tekrar dene veya örnek modu kullan.');
      if(error instanceof ApiError||error instanceof DataError)throw error;
      throw new ApiError('network','GitHub’a ulaşılamadı. Bağlantını kontrol et veya örnek modu aç.');
    } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  private remember(path:string,data:unknown) {
    if(this.cache.get(path)?.data===data)return;
    this.cache.set(path,{data,time:this.now()});
    if(this.cache.size>30)this.cache.delete(this.cache.keys().next().value!);
  }
  async runs(repo:Repo,signal?:AbortSignal,force=false):Promise<RunsPage> {
    const safe=parseRepo(repo.fullName);
    const path=`/repos/${safe.owner}/${safe.name}/actions/runs?per_page=30&page=1`;
    const data=await this.request(path,signal,force);const normalized=normalizeRuns(data);this.remember(path,data);return normalized;
  }
  async jobs(repo:Repo,run:Run,signal?:AbortSignal,force=false):Promise<JobsPage> {
    const safe=parseRepo(repo.fullName);
    if(!Number.isSafeInteger(run.id)||run.id<1||!Number.isSafeInteger(run.attempt)||run.attempt<1)throw new DataError('Geçersiz çalıştırma numarası.');
    const jobs:JobsPage['jobs']=[];let total=0;
    const seen=new Set<number>();
    for(let page=1;page<=3;page++) {
      const path=`/repos/${safe.owner}/${safe.name}/actions/runs/${run.id}/attempts/${run.attempt}/jobs?per_page=100&page=${page}`;
      const data=await this.request(path,signal,force);const normalized=normalizeJobs(data,run.id);this.remember(path,data);total=normalized.total;
      for(const job of normalized.jobs)if(!seen.has(job.id)){seen.add(job.id);jobs.push(job);}
      if(normalized.jobs.length<100||jobs.length>=total)break;
    }
    return {jobs,total,partial:jobs.length<total};
  }
}

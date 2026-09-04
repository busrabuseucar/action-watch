/** Prevent a response from a previous repository/run from replacing a newer selection. */
export class LatestRequest {
  private id=0;
  private controller:AbortController|null=null;
  begin() {this.controller?.abort();this.controller=new AbortController();return {id:++this.id,signal:this.controller.signal};}
  current(ticket:{id:number;signal:AbortSignal}) {return ticket.id===this.id&&!ticket.signal.aborted;}
  cancel() {this.controller?.abort();this.id++;}
}

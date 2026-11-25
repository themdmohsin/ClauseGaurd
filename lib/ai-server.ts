import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { runtimeValue } from "./runtime";

export const json=(body:unknown,status=200,extra:Record<string,string>={})=>Response.json(body,{status,headers:{"Cache-Control":"no-store",...extra}});
const usage=new Map<string,number[]>();
const running=new Set<string>();
export async function guardedAI<T>(request:Request,schema:z.ZodType<T>,run:(data:T,client:Anthropic,model:string)=>Promise<unknown>){
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return json({error:"Submit this request from ClauseGuard."},403);
  if(!request.headers.get("content-type")?.includes("application/json"))return json({error:"A JSON request is required."},415);
  const apiKey=runtimeValue("ANTHROPIC_API_KEY");
  if(!apiKey)return json({error:"Live Claude features need the owner's server API key."},503);
  let input:unknown;
  try{
    const reader=request.body?.getReader();if(!reader)return json({error:"The request is empty."},400);
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>700000){await reader.cancel();return json({error:"The request is too large. Shorten the document or conversation."},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    input=JSON.parse(new TextDecoder().decode(bytes));
  }catch{return json({error:"The request could not be read."},400);}
  const parsed=schema.safeParse(input);if(!parsed.success)return json({error:parsed.error.issues[0]?.message??"Check the document and consent."},400);
  const identity=request.headers.get("oai-authenticated-user-id")??"private-owner";
  const now=Date.now();for(const [key,times]of usage)if(times.every(t=>t<now-3600000))usage.delete(key);
  const recent=(usage.get(identity)??[]).filter(t=>t>now-3600000);
  if(running.has(identity)||recent.length>=30)return json({error:"Please wait. Chat and revision tools allow one request at a time and up to 30 attempts per hour on this server."},429,{"Retry-After":"60"});
  usage.set(identity,[...recent,now]);running.add(identity);
  try{return json(await run(parsed.data,new Anthropic({apiKey,timeout:90000,maxRetries:0}),runtimeValue("ANTHROPIC_MODEL")||"claude-sonnet-4-6"));}
  catch(error){
    if(error instanceof Anthropic.AuthenticationError)return json({error:"Claude rejected the server key. Ask the owner to check API access."},502);
    if(error instanceof Anthropic.RateLimitError)return json({error:"Claude's usage limit was reached. Try again later."},429);
    if(error instanceof Anthropic.APIConnectionTimeoutError)return json({error:"Claude timed out. Try a shorter request."},504);
    return json({error:error instanceof IncompleteOutputError?error.message:"Claude could not complete a verified response. Try again; your original agreement has not been changed."},502);
  }finally{running.delete(identity);}
}
class IncompleteOutputError extends Error{}
export async function structuredAnswer<T>(client:Anthropic,model:string,schema:z.ZodType<T>,system:string,input:unknown,maxTokens:number):Promise<T>{
  const response=await client.messages.create({model,max_tokens:maxTokens,system,messages:[{role:"user",content:JSON.stringify(input)}],output_config:{format:zodOutputFormat(schema)}});
  if(response.stop_reason!=="end_turn")throw new IncompleteOutputError("Claude did not finish the response. Try fewer clauses or a shorter question. No partial result has been applied.");
  return schema.parse(JSON.parse(response.content.filter(b=>b.type==="text").map(b=>b.text).join("")));
}

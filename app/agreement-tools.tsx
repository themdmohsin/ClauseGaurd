"use client";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Sparkles, LoaderCircle, FilePenLine, Check, Download, Printer, CircleHelp, TriangleAlert, RotateCcw } from "lucide-react";
import { chatResultSchema, composeDraft, revisionResultSchema, type ChatAnswer, type Proposal, type RevisionResult } from "@/lib/collaboration";
import { locateQuote, MAX_CHARACTERS, type AnalysisRequest, type AnalysisResult } from "@/lib/analysis";
import { DEMO_RESULT } from "@/lib/demo";

type Turn={role:"user"|"assistant";content:string;answer?:ChatAnswer;version:"original"|"proposed draft";example?:boolean};
type Props={view:"chat"|"revise";agreement:AnalysisRequest;result:AnalysisResult;configured:boolean;onSource:(page:number,quote:string)=>void;onDraftSource:()=>void};
function saveText(name:string,text:string){const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export default function AgreementTools({view,agreement,result,configured,onSource,onDraftSource}:Props){
  const [toolConsent,setToolConsent]=useState(result.mode==="live");
  const [turns,setTurns]=useState<Turn[]>([]);
  const [question,setQuestion]=useState("");
  const [chatVersion,setChatVersion]=useState<"original"|"proposed draft">("original");
  const [preferences,setPreferences]=useState("");
  const [targets,setTargets]=useState(result.report.findings.map((_,i)=>i));
  const [revision,setRevision]=useState<RevisionResult|null>(null);
  const [accepted,setAccepted]=useState<string[]>([]);
  const [draft,setDraft]=useState("");
  const [draftEdited,setDraftEdited]=useState(false);
  const [generatedFrom,setGeneratedFrom]=useState<string[]>([]);
  const [draftReviewed,setDraftReviewed]=useState(false);
  const [busy,setBusy]=useState<"chat"|"revise"|null>(null);
  const [error,setError]=useState("");
  const [exampleRevision,setExampleRevision]=useState(false);
  const abort=useRef<AbortController|null>(null);
  const end=useRef<HTMLDivElement>(null);
  useEffect(()=>()=>abort.current?.abort(),[]);
  useEffect(()=>{end.current?.scrollIntoView({block:"nearest",behavior:"smooth"});},[turns,busy]);
  useEffect(()=>{setError("");},[view]);
  const ready=configured&&toolConsent&&!busy;
  const proposals=revision?.proposals??[];
  const stale=draft&&JSON.stringify([...accepted].sort())!==JSON.stringify([...generatedFrom].sort());
  const history=turns.filter(t=>t.version===chatVersion).slice(-10).map(({role,content})=>({role,content}));

  async function request(path:string,body:unknown){
    const controller=new AbortController();abort.current=controller;
    const timeout=setTimeout(()=>controller.abort(),105000);
    try{
      const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal});
      const data=await response.json();
      if(!response.ok)throw new Error(typeof data==="object"&&data!==null&&"error"in data&&typeof data.error==="string"?data.error:"The request could not be completed.");
      return data;
    }catch(e){if(controller.signal.aborted)throw new Error("The request was cancelled or timed out. Your original agreement is unchanged.");throw e;}
    finally{clearTimeout(timeout);if(abort.current===controller)abort.current=null;}
  }
  async function send(value=question){
    if(!ready||value.trim().length<3)return;
    if(chatVersion==="proposed draft"&&(!draft||draft.length>MAX_CHARACTERS)){setError("Generate a draft under 60,000 characters first.");return;}
    const text=value.trim();setQuestion("");setError("");setBusy("chat");
    const version=chatVersion;
    const next:Turn={role:"user",content:text,version};setTurns(prev=>[...prev,next]);
    try{
      const source=version==="original"?agreement:{...agreement,pages:[{number:1,text:draft}],documentName:"Proposed draft"};
      const data=chatResultSchema.parse(await request("/api/chat",{agreement:{...source,consent:true},question:text,history,documentVersion:version}));
      setTurns(prev=>[...prev,{role:"assistant",content:data.answer,answer:data,version}]);
    }catch(e){setError(e instanceof Error?e.message:"Unable to send your question.");setQuestion(text);setTurns(prev=>prev.filter(t=>t!==next));}
    finally{setBusy(null);}
  }
  async function suggest(){
    if(!ready||!targets.length)return;
    if(draft&&!window.confirm("Generating new suggestions will replace the current suggestions and proposed draft. Continue?"))return;
    setBusy("revise");setError("");
    try{
      const data=revisionResultSchema.parse(await request("/api/revise",{agreement:{...agreement,consent:true},findings:targets.map(i=>result.report.findings[i]),preferences}));
      setRevision(data);setAccepted(data.proposals.map(p=>p.id));setDraft("");setDraftEdited(false);setExampleRevision(false);setDraftReviewed(false);setTurns(prev=>prev.filter(t=>t.version==="original"));setChatVersion("original");
    }catch(e){setError(e instanceof Error?e.message:"Unable to generate suggestions.");}
    finally{setBusy(null);}
  }
  function generate(){
    if(draftEdited&&!window.confirm("Regenerating will replace your manual edits with the selected clause revisions. Continue?"))return;
    try{setDraft(composeDraft(agreement.pages,proposals.filter(p=>accepted.includes(p.id))));setGeneratedFrom([...accepted]);setDraftEdited(false);setDraftReviewed(false);setError("");setTurns(prev=>prev.filter(t=>t.version==="original"));}
    catch(e){setError(e instanceof Error?e.message:"The selected changes could not be applied.");}
  }
  function exampleConversation(){
    const finding=DEMO_RESULT.report.findings[2];
    const answer:ChatAnswer={answer:"Under the sample termination clause, the client can end the engagement without notice and require you to refund payments, including fees for work you have already completed. This could leave you unpaid for time spent. A possible negotiation is payment for completed work and committed costs, with a clear notice period. This describes the written clause; it does not determine enforceability or your legal remedies.",citations:[{page:1,quote:finding.quote}],followUpQuestions:["How could we make cancellation fairer to both parties?"],warnings:[]};
    setTurns(prev=>[...prev,{role:"user",content:"What happens if the client cancels?",version:"original",example:true},{role:"assistant",content:answer.answer,answer,version:"original",example:true}]);setChatVersion("original");
  }
  function exampleRevisions(){
    const definitions=[
      {index:0,replacement:"The Client will review deliverables against the agreed written project requirements within 10 business days of delivery, identifying any material non-conformities in writing. The Contractor will have a reasonable opportunity to correct them. Only the reasonably disputed portion of the balance may be withheld; undisputed amounts remain payable within the agreed 90-day payment period.",title:"Use objective acceptance and proportionate withholding",rationale:"Replaces subjective approval with a defined review process. The 10-business-day review period is a proposed commercial term to negotiate; the original payment period is retained.",firstPartyImpact:"The Client can identify genuine delivery issues and withhold only the disputed portion.",secondPartyImpact:"The Contractor gets timely feedback and payment of undisputed fees.",tradeOff:"The parties must agree on the review period and objective requirements."},
      {index:2,replacement:"On termination, the Client will pay for work completed in accordance with the agreed requirements and reasonable, non-cancellable costs approved by the Client before termination. Payments already made will be credited against those amounts. The Contractor will refund only any excess balance, and will provide the Client with work paid for under this clause.",title:"Pay fairly for completed work on cancellation",rationale:"Replaces a blanket refund with a reconciliation of work completed, approved costs, and payments received.",firstPartyImpact:"The Client pays for value delivered and receives any excess prepayment back.",secondPartyImpact:"The Contractor is compensated for completed work and approved commitments.",tradeOff:"Both parties should agree how completed work will be valued."},
    ];
    const p:Proposal[]=definitions.map(({index,...rest},i)=>({id:`example-${i+1}`,page:1,original:DEMO_RESULT.report.findings[index].quote,...rest}));
    setRevision({introduction:"Illustrative sample suggestions. These two edits preserve the rest of the sample agreement; several other flagged issues remain unresolved.",proposals:p,openQuestions:["Agree an objective review period.","The IP assignment and uncapped liability still need negotiation."],warnings:[]});setAccepted(p.map(x=>x.id));setDraft("");setDraftEdited(false);setExampleRevision(true);setDraftReviewed(false);setError("");
  }
  function exportDraft(){
    if(!draft||!draftReviewed)return;
    const note=`PROPOSED AGREEMENT — FOR BOTH PARTIES TO REVIEW\n${exampleRevision?"ILLUSTRATIVE DEMO DRAFT\n":""}Based on: ${agreement.documentName}\n${generatedFrom.length} selected clause revisions applied${draftEdited?"; manually edited afterwards":""}. This is not a signed agreement or a guarantee of legal safety.\n\n`;
    saveText("clauseguard-proposed-agreement.txt",note+draft+"\n\nUNRESOLVED QUESTIONS\n"+(revision?.openQuestions.map(q=>`- ${q}`).join("\n")||"Review all remaining terms and flagged issues with both parties."));
  }
  function showDraftQuote(quote:string){onDraftSource();setTimeout(()=>{const editor=document.getElementById("proposed-draft-editor") as HTMLTextAreaElement|null;if(editor){editor.focus();const range=locateQuote(draft,quote);if(range)editor.setSelectionRange(...range);editor.scrollIntoView({behavior:"smooth",block:"center"});}},20);}

  return <section className="agreement-tools">
    <div className="tool-heading"><span className="tool-icon">{view==="chat"?<MessageSquare size={23}/>:<FilePenLine size={23}/>}</span><div><h2>{view==="chat"?"Ask about your agreement":"Build a more balanced draft"}</h2><p>{view==="chat"?"Talk through the details, with answers grounded in the selected document.":"Review proposed wording, choose your changes, then generate the complete agreement."}</p></div></div>
    {!toolConsent&&<label className="tool-consent"><input type="checkbox" checked={toolConsent} onChange={e=>setToolConsent(e.target.checked)}/><span>Use live Claude for chat and drafting. Agreement text, my questions, conversation history and drafting preferences will be sent to Anthropic. No chat or draft is saved by ClauseGuard.</span></label>}
    {!configured&&<p className="setup-note">Live tools need the owner’s Claude API key. Sample examples remain available.</p>}
    {error&&<div className="error" role="alert"><TriangleAlert size={18}/>{error}</div>}
    <div hidden={view!=="chat"} className="chat-layout">
      <div className="chat-card card"><div className="chat-top"><div><span className="chat-dot"/>AGREEMENT CONVERSATION</div><button className="text-button" disabled={Boolean(busy)} onClick={()=>{setTurns([]);setError("");}}><RotateCcw size={14}/>Clear chat</button></div>
        <div className="chat-version"><label>Ask about <select value={chatVersion} disabled={Boolean(busy)} onChange={e=>setChatVersion(e.target.value as typeof chatVersion)}><option value="original">Original agreement</option><option value="proposed draft" disabled={!draft}>Proposed draft{draftEdited?" (includes your edits)":""}</option></select></label>{chatVersion==="proposed draft"&&<p>Draft citations refer to text section 1. Previous original-document turns are excluded.</p>}</div>
        <div className="chat-messages" aria-live="polite">
          {!turns.length&&<div className="chat-empty"><MessageSquare size={31}/><h3>What would you like to understand?</h3><p>Ask about a payment deadline, a cancellation clause, or how two terms work together.</p><div className="starter-questions">{["What are my main obligations?","What happens if either party cancels?","Which terms should both parties clarify?"].map(q=><button key={q} disabled={!ready} onClick={()=>void send(q)}>{q}</button>)}</div>{result.mode==="demo"&&<button className="secondary-button" onClick={exampleConversation}>Show example conversation</button>}</div>}
          {turns.map((turn,i)=><article className={`chat-turn ${turn.role}`} key={i}><div className="turn-label">{turn.role==="user"?"YOU":"CLAUSEGUARD"}<span>{turn.example?"Illustrative example":turn.version}</span></div><p>{turn.content}</p>{turn.answer&&<><div className="citation-list">{turn.answer.citations.map((c,j)=><button key={j} onClick={()=>turn.version==="original"?onSource(c.page,c.quote):showDraftQuote(c.quote)}><FilePenLine size={13}/>{turn.version==="original"?`Original · p. ${c.page}`:"Draft · section 1"}<q>{c.quote}</q></button>)}</div>{turn.answer.warnings.map((w,j)=><p className="citation-warning" key={j}>{w}</p>)}{i===turns.length-1&&<div className="followups">{turn.answer.followUpQuestions.map(q=><button key={q} disabled={!ready} onClick={()=>void send(q)}>{q}</button>)}</div>}</>}</article>)}
          {busy==="chat"&&<div className="chat-thinking" role="status"><LoaderCircle className="spin" size={17}/>Reading the agreement and your question…</div>}<div ref={end}/>
        </div>
        <form className="chat-composer" onSubmit={e=>{e.preventDefault();void send();}}><label htmlFor="agreement-question" className="sr-only">Your agreement question</label><textarea id="agreement-question" value={question} maxLength={2000} disabled={Boolean(busy)} placeholder="Ask a question about this agreement…" onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send();}}}/><button type="submit" className="primary-button" disabled={!ready||question.trim().length<3} aria-label="Send question"><Send size={17}/></button></form><p className="tool-footnote">Enter to send · Shift + Enter for a new line · Answers can be wrong; check the source.</p>
      </div><aside className="tool-side card"><h3>A useful place to start</h3><p>“Can the client keep my work if they haven’t paid?”</p><p>“Explain the termination terms with an example.”</p><p>“Does this protect both parties equally?”</p><div><CircleHelp size={19}/><p>Chat explains the selected document. Use the draft tab to review and apply wording changes.</p></div>{draft&&<p className="draft-available"><Check size={15}/>Your proposed draft is also available in the document selector.</p>}</aside>
    </div>
    <div hidden={view!=="revise"} className="revision-workspace">
      <div className="revision-intro card"><div><h3>1. Choose the issues to address</h3><p>Suggestions aim to balance both parties’ interests. They are negotiation proposals, not a legal clearance.</p></div><div className="target-list">{result.report.findings.map((f,i)=><label key={i}><input type="checkbox" checked={targets.includes(i)} disabled={Boolean(busy)} onChange={e=>setTargets(prev=>e.target.checked?[...prev,i]:prev.filter(n=>n!==i))}/><span className={`badge ${f.severity}`}>{f.severity.toUpperCase()}</span><span>{f.title}</span></label>)}</div>{!result.report.findings.length&&<p>No sourced flags are available to revise. Ask a question or review the original agreement.</p>}<label className="preferences-label">Drafting preferences <span>Optional</span><textarea value={preferences} maxLength={2000} disabled={Boolean(busy)} onChange={e=>setPreferences(e.target.value)} placeholder="e.g. Keep the project fee unchanged; suggest fair cancellation terms for both parties."/></label><div className="revision-actions"><button className="primary-button" disabled={!ready||!targets.length} onClick={()=>void suggest()}>{busy==="revise"?<LoaderCircle className="spin" size={17}/>:<Sparkles size={17}/>} {busy==="revise"?"Drafting proposed clauses…":"Suggest balanced revisions"}</button>{result.mode==="demo"&&<button className="secondary-button" disabled={Boolean(busy)} onClick={exampleRevisions}>Load example revisions</button>}</div>{busy==="revise"&&<p className="loading-hint" role="status">Claude is checking the original terms and drafting alternatives. Allow up to 90 seconds.</p>}</div>
      {revision&&<><div className="revision-summary"><h3>2. Review and select proposed changes</h3><p>{revision.introduction}</p>{exampleRevision&&<span className="badge medium">ILLUSTRATIVE SAMPLE — NO AI CALL</span>}</div>{revision.warnings.map((w,i)=><div className="warning" key={i}>{w}</div>)}{!proposals.length&&<div className="empty-state"><p>No uniquely verified replacements were returned. Your original agreement remains unchanged. Try selecting fewer issues.</p></div>}
        {proposals.map(p=><article className={`proposal-card card ${accepted.includes(p.id)?"accepted":""}`} key={p.id}><div className="proposal-top"><label><input type="checkbox" checked={accepted.includes(p.id)} onChange={e=>setAccepted(prev=>e.target.checked?[...prev,p.id]:prev.filter(id=>id!==p.id))}/><span>Include this revision</span></label><button className="text-button" onClick={()=>onSource(p.page,p.original)}>View original · p. {p.page}</button></div><h3>{p.title}</h3><div className="clause-comparison"><div><h4>ORIGINAL WORDING</h4><p>{p.original}</p></div><div><h4>PROPOSED REPLACEMENT</h4><p>{p.replacement}</p></div></div><p className="revision-rationale">{p.rationale}</p><div className="party-impact"><div><strong>First party</strong><p>{p.firstPartyImpact}</p></div><div><strong>Other party</strong><p>{p.secondPartyImpact}</p></div></div><div className="tradeoff"><ScaleIcon/><p><strong>To negotiate:</strong> {p.tradeOff}</p></div></article>)}
        {revision.openQuestions.length>0&&<section className="open-questions card"><h3>Still to agree between the parties</h3><ul>{revision.openQuestions.map((q,i)=><li key={i}>{q}</li>)}</ul></section>}
        <div className="generate-row"><div><h3>3. Generate the complete proposed agreement</h3><p>Only selected replacements are applied. All other extracted text is preserved.</p></div><button className="primary-button" disabled={!accepted.length||Boolean(busy)} onClick={generate}><FilePenLine size={17}/>{draft?"Regenerate draft":"Generate proposed agreement"}</button></div>
      </>}
      {draft&&<section className="draft-editor card"><div className="draft-editor-heading"><div><span className="badge medium">PROPOSED DRAFT · FOR REVIEW</span><h3>Your complete agreement</h3><p>{generatedFrom.length} selected changes applied{draftEdited?" · Includes manual edits":""}. Original PDF layout is not retained.</p></div></div>{stale&&<div className="warning">Your clause selection changed after this draft was generated. Regenerate to apply the current selection; your existing draft has not changed.</div>}<label className="sr-only" htmlFor="proposed-draft-editor">Edit proposed agreement</label><textarea id="proposed-draft-editor" value={draft} onChange={e=>{setDraft(e.target.value);setDraftEdited(true);setDraftReviewed(false);setTurns(prev=>prev.filter(t=>t.version==="original"));}}/><div className="draft-count">{draft.length.toLocaleString()} characters · Editable draft</div><label className="draft-review-check"><input type="checkbox" checked={draftReviewed} onChange={e=>setDraftReviewed(e.target.checked)}/><span>I understand this is a proposed draft for both parties to review. Unselected risks may remain; legal safety and enforceability are not guaranteed.</span></label><div className="draft-export-actions"><button className="primary-button" disabled={!draftReviewed||Boolean(stale)} onClick={exportDraft}><Download size={17}/>Download proposed agreement</button><button className="secondary-button" disabled={!draftReviewed||Boolean(stale)} onClick={()=>window.print()}><Printer size={17}/>Print / Save PDF</button><button className="secondary-button" onClick={()=>{saveText("clauseguard-change-summary.txt",proposals.filter(p=>generatedFrom.includes(p.id)).map(p=>`${p.title}\nORIGINAL: ${p.original}\nPROPOSED: ${p.replacement}\nWHY: ${p.rationale}\nFIRST PARTY: ${p.firstPartyImpact}\nOTHER PARTY: ${p.secondPartyImpact}\nTRADE-OFF: ${p.tradeOff}`).join("\n\n")+(draftEdited?"\n\nManual edits were made after generation; compare against the exported draft.":""));}}>Download change summary</button></div><article className="print-agreement"><h1>Proposed agreement — for review</h1><p>Not signed. Requires both parties’ agreement and appropriate legal review.</p><pre>{draft}</pre><h2>Unresolved questions</h2><ul>{revision?.openQuestions.map(q=><li key={q}>{q}</li>)}</ul></article></section>}
    </div>
  </section>;
}
function ScaleIcon(){return <span aria-hidden="true">⚖</span>;}


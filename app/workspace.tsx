"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ShieldCheck, FileText, UploadCloud, Plus, Sparkles, ChevronDown, ChevronRight, Check, X, LockKeyhole, CircleHelp, BookOpen, Scale, Download, TriangleAlert, LoaderCircle, ClipboardList, ScanText, PanelLeftClose, Menu } from "lucide-react";
import { attentionLevel, locateQuote, resultSchema, MAX_CHARACTERS, type AnalysisRequest, type AnalysisResult, type Finding, type Page } from "@/lib/analysis";
import { DEMO_NAME, DEMO_PAGES, DEMO_RESULT } from "@/lib/demo";

import AgreementTools from "./agreement-tools";
import { extractDocument } from "@/lib/extract-document";

type Info = "method" | "privacy" | null;
export default function Workspace() {
  const [tab, setTab] = useState<"upload" | "paste">("upload");
  const [text, setText] = useState("");
  const [pages, setPages] = useState<Page[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<AnalysisRequest["agreementType"]>("Auto-detect");
  const [perspective, setPerspective] = useState<AnalysisRequest["perspective"]>("Individual signing");
  const [jurisdiction, setJurisdiction] = useState("");
  const [consent, setConsent] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [reviewTab, setReviewTab] = useState<"report"|"chat"|"revise">("report");
  const [ocrEnabled,setOcrEnabled] = useState(true);
  const [ocrPages,setOcrPages] = useState<number[]>([]);
  const [ocrWarnings,setOcrWarnings] = useState<string[]>([]);
  const [ocrReviewed,setOcrReviewed] = useState(false);
  const [extractionProgress,setExtractionProgress] = useState("");
  const extractionRequest=useRef<AbortController|null>(null);
  const [sourceCitation,setSourceCitation]=useState<{page:number;quote:string}|null>(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<number | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [info, setInfo] = useState<Info>(null);
  const [drag, setDrag] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const marker = useRef<HTMLElement>(null);
  const sourcePanel = useRef<HTMLDivElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const dialogClose = useRef<HTMLButtonElement>(null);
  const generation = useRef(0);
  const effectivePages = tab === "paste" ? [{ number: 1, text }] : pages;
  const characterCount = effectivePages.reduce((n, p) => n + p.text.length, 0);

  useEffect(() => { fetch("/api/status").then(r => r.json()).then(d => setConfigured(typeof d === "object" && d !== null && "configured" in d && d.configured === true)).catch(() => setConfigured(null)); return () => { activeRequest.current?.abort(); extractionRequest.current?.abort(); }; }, []);
  useEffect(() => { if (sourceOpen && (selected !== null || sourceCitation !== null)) marker.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [selected, sourceOpen, sourceCitation]);
  useEffect(() => {
    if (!info) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogClose.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setInfo(null); if (event.key === "Tab") { event.preventDefault(); dialogClose.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [info]);

  function reset() {
    extractionRequest.current?.abort(); setOcrPages([]);setOcrWarnings([]);setOcrReviewed(false);setReviewTab("report");setSourceCitation(null);
    generation.current++; const previousRequest = activeRequest.current; activeRequest.current = null; previousRequest?.abort(); setBusy(false); setExtracting(false); setResult(null); setPages([]); setText(""); setName(""); setConsent(false); setError(""); setSelected(null); setSourceOpen(false); setFilter("all"); setMobileMenu(false);
    if (input.current) input.current.value = "";
  }
  function demo() {
    reset(); setTab("upload"); setPages(DEMO_PAGES); setName(DEMO_NAME); setResult(DEMO_RESULT); setType("Freelance"); setPerspective("Freelancer");
  }
  async function readFile(file?: File) {
    if (!file || busy || extracting) return;
    const id = ++generation.current;
    const controller=new AbortController();extractionRequest.current=controller;
    setError("");setExtracting(true);setPages([]);setName("");setOcrPages([]);setOcrWarnings([]);setOcrReviewed(false);setExtractionProgress("Reading your document…");
    try {
      const extracted=await extractDocument(file,{ocr:ocrEnabled,progress:message=>{if(id===generation.current)setExtractionProgress(message);},signal:controller.signal});
      if(id===generation.current){setPages(extracted.pages);setOcrPages(extracted.ocrPages);setOcrWarnings(extracted.warnings);setName(file.name.slice(0,180));setConsent(false);}
    }catch(e){if(id===generation.current&&!controller.signal.aborted)setError(e instanceof Error&&!/password|destroy|worker/i.test(e.message)?e.message:"This PDF could not be read. Try an unlocked, clearer PDF or paste the complete agreement.");}
    finally{if(id===generation.current){setExtracting(false);extractionRequest.current=null;}if(input.current)input.current.value="";}
  }
  async function analyze() {
    if (busy) return;
    setError("");
    if (characterCount < 100 || characterCount > MAX_CHARACTERS) { setError("Add between 100 and 60,000 characters of agreement text."); return; }
    if(tab==="upload"&&ocrPages.length&&!ocrReviewed){setError("Review and confirm the OCR text before analysis.");return;}
    if (!consent) { setError("Please confirm that you agree to send the agreement text to Anthropic for analysis."); return; }
    setBusy(true);
    const controller = new AbortController(); activeRequest.current = controller;
    const timer = setTimeout(() => controller.abort(), 105_000);
    try {
      const documentName = tab === "paste" ? "Pasted agreement" : name;
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ pages: effectivePages, documentName, agreementType: type, jurisdiction, perspective, consent }) });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "The review could not be completed.");
      setPages(effectivePages); setName(documentName); setResult(resultSchema.parse(data)); setSelected(null); setFilter("all");
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to connect. Please try again."); else if (activeRequest.current === controller) setError("The review was cancelled or timed out. Please try again."); }
    finally { clearTimeout(timer); if (activeRequest.current === controller) { setBusy(false); activeRequest.current = null; } }
  }
  function showSource(index: number) { setReviewTab("report");setSourceCitation(null);setSelected(index); setSourceOpen(true); setTimeout(() => sourcePanel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 20); }
  function exportReport() {
    if (!result) return;
    const r = result.report;
    const content = [`CLAUSEGUARD AGREEMENT REVIEW`, `Document: ${name}`, `Mode: ${result.mode === "demo" ? "ILLUSTRATIVE DEMO — not live AI" : "Claude analysis"}`, `Model: ${result.model} | Prompt: ${result.promptVersion}`, "", r.summary, "", "KEY OBLIGATIONS", ...r.obligations.map(x=>`• ${x}`), "", "FLAGGED CLAUSES", ...r.findings.map((f,i)=>`\n${i+1}. [${f.severity.toUpperCase()}] ${f.title}\nPage ${f.page}: “${f.quote}”\nMeaning: ${f.explanation}\nPotential impact: ${f.implication}\nAsk: ${f.question}`), "", "MISSING INFORMATION", ...r.missingInformation.map(x=>`• ${x}`), "", "LIMITATIONS", ...r.limitations, ...result.warnings, "", "Informational assistance, not legal advice. A lack of flags does not mean an agreement is safe to sign."].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "clauseguard-review.txt"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const findings = result?.report.findings ?? [];
  const selectedFinding = selected !== null ? findings[selected] : undefined;
  function highlighted(page: Page) {
    const citation=sourceCitation??selectedFinding;
    if (!citation || citation.page !== page.number) return page.text;
    const location = locateQuote(page.text, citation.quote);
    return location ? <>{page.text.slice(0,location[0])}<mark ref={marker}>{page.text.slice(...location)}</mark>{page.text.slice(location[1])}</> : page.text;
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to workspace</a>
    <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
      <a href="/" className="brand" aria-label="ClauseGuard home"><span className="brand-icon"><ShieldCheck size={23}/></span>ClauseGuard<span className="brand-dot">.</span></a>
      <div className="workspace-label">YOUR WORKSPACE</div>
      <nav aria-label="Main navigation"><button className="nav-item active" onClick={reset}><ScanText size={19}/>Agreement review<span className="nav-indicator"/></button><button className="nav-item" onClick={()=>setInfo("method")}><BookOpen size={19}/>How it works</button></nav>
      <div className="sidebar-note"><span className="tiny-icon"><Sparkles size={18}/></span><h3>A little clarity goes a long way.</h3><p>Understand what you’re agreeing to, before you put pen to paper.</p><button onClick={demo}>Explore a sample <ArrowUpRight size={16}/></button></div>
      <div className="sidebar-bottom"><div className="private-note"><LockKeyhole size={15}/>Private workspace</div><button className="nav-item" onClick={()=>setInfo("privacy")}><CircleHelp size={18}/>Privacy & information</button><div className="profile"><span className="avatar">Y</span><div><strong>Your workspace</strong><small>Personal agreement review</small></div></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-toggle" aria-label="Toggle menu" onClick={()=>setMobileMenu(!mobileMenu)}><Menu size={20}/></button><span>Workspace</span><ChevronRight size={14}/><strong>Agreement review</strong></div><span className="powered"><Sparkles size={14}/>Powered by Claude</span></header>
      <main id="main" className="main-content">
        <div className="page-heading"><div><div className="eyebrow"><span/>CLARITY BEFORE COMMITMENT</div><h1>{result ? "Your agreement, unpacked." : "Read between the lines."}</h1><p>{result ? "A clearer view of the terms, trade-offs, and questions worth asking." : "Make sense of the fine print. Know what to ask before you sign."}</p></div>{result ? <button className="secondary-button" onClick={reset}><Plus size={17}/>New review</button> : <span className="heading-art" aria-hidden="true"><FileText size={43} strokeWidth={1.2}/><ShieldCheck size={28}/></span>}</div>
        {!result ? <>
          <div className="step-track"><span className="step current"><b>1</b>Add your agreement</span><i/><span className="step"><b>2</b>Let’s look closer</span><i/><span className="step"><b>3</b>Review with clarity</span></div>
          <div className="input-layout"><section className="card input-card" aria-labelledby="input-title"><div className="card-top"><div><h2 id="input-title">Start with your agreement</h2><p>A few minutes now. Fewer surprises later.</p></div><span className="step-label">STEP 01</span></div>
            <div className="tabs" role="tablist" aria-label="Input method"><button role="tab" aria-selected={tab==="upload"} className={tab==="upload"?"selected":""} disabled={busy||extracting} onClick={()=>{setTab("upload");setError("");setConsent(false);}}><UploadCloud size={17}/>Upload document</button><button role="tab" aria-selected={tab==="paste"} className={tab==="paste"?"selected":""} disabled={busy||extracting} onClick={()=>{setTab("paste");setError("");setConsent(false);}}><ClipboardList size={17}/>Paste text</button></div>
            {tab === "upload" ? <><input ref={input} className="sr-only" type="file" accept=".pdf,.txt,application/pdf,text/plain" aria-label="Choose agreement file" onChange={e=>void readFile(e.target.files?.[0])}/><button disabled={busy||extracting} className={`dropzone ${drag ? "dragging" : ""} ${pages.length ? "has-file" : ""}`} onClick={()=>input.current?.click()} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);void readFile(e.dataTransfer.files[0]);}}>{extracting ? <LoaderCircle className="spin" size={30}/> : <span className="upload-icon">{pages.length ? <FileText size={28}/> : <UploadCloud size={28}/>}</span>}<strong>{extracting ? extractionProgress : name || "Drop your agreement here"}</strong><span>{pages.length ? `${pages.length} ${pages.length===1?"page":"pages"} · ${characterCount.toLocaleString()} characters · Click to replace` : <>or <em>browse files</em> from your device</>}</span><small>PDF or TXT · Up to 5 MB · 30 pages</small></button></> : <div className="text-input"><label className="sr-only" htmlFor="agreement-text">Agreement text</label><textarea id="agreement-text" placeholder="Paste your complete agreement here…" value={text} disabled={busy} onChange={e=>{setText(e.target.value);setConsent(false);}}/><div className={characterCount>MAX_CHARACTERS?"over-limit":""}>{characterCount.toLocaleString()} / 60,000 characters</div></div>}
            <label className="ocr-toggle" hidden={tab!=="upload"}><input type="checkbox" checked={ocrEnabled} disabled={busy||extracting} onChange={e=>setOcrEnabled(e.target.checked)}/><span>Free OCR for scanned pages <small>English · On your device · Up to 10 OCR pages</small></span></label>
            {extracting&&<button className="text-button cancel-extraction" onClick={()=>{generation.current++;extractionRequest.current?.abort();setExtracting(false);setError("Document reading cancelled. Choose a file to start again.");}}>Cancel reading</button>}
            {tab==="upload"&&ocrPages.length>0&&<section className="ocr-review"><h3>Check the recognised text before analysis</h3><p>OCR was used on {ocrPages.length} page{ocrPages.length===1?"":"s"}. Recognition can change amounts, names, dates and punctuation. Compare this text with your original scan.</p>{ocrWarnings.map((w,i)=><p className="citation-warning" key={i}>{w}</p>)}<details open><summary>Review and correct OCR pages</summary>{pages.filter(p=>ocrPages.includes(p.number)).map(page=><label key={page.number}>Page {page.number}<textarea aria-label={"OCR text page "+page.number} value={page.text} onChange={e=>{setPages(prev=>prev.map(p=>p.number===page.number?{...p,text:e.target.value}:p));setOcrReviewed(false);setConsent(false);}}/></label>)}</details><label className="ocr-review-check"><input type="checkbox" checked={ocrReviewed} onChange={e=>setOcrReviewed(e.target.checked)}/><span>I checked the recognised text against the original and corrected any errors I found.</span></label></section>}
            <div className="document-hint"><LockKeyhole size={14}/><span>Your file stays on your device until you choose to analyse.</span></div>
            <div className="context-heading">A little context <span>helps us read from your perspective</span></div><div className="form-grid"><label>Agreement type<div className="select-wrap"><select value={type} disabled={busy} onChange={e=>setType(e.target.value as typeof type)}>{["Auto-detect","Rental","Freelance","Employment","Service"].map(x=><option key={x}>{x}</option>)}</select><ChevronDown size={16}/></div></label><label>Your role<div className="select-wrap"><select value={perspective} disabled={busy} onChange={e=>setPerspective(e.target.value as typeof perspective)}>{["Individual signing","Tenant","Freelancer","Employee","Customer"].map(x=><option key={x}>{x}</option>)}</select><ChevronDown size={16}/></div></label><label className="full-width">Country or jurisdiction <span className="optional">Optional</span><input value={jurisdiction} maxLength={100} disabled={busy} placeholder="e.g. India, Maharashtra" onChange={e=>setJurisdiction(e.target.value)}/></label></div>
            <label className="consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>I agree to send the extracted agreement text to Anthropic (Claude) for analysis, agreement chat and draft suggestions. Questions and drafting preferences I submit are also sent to Anthropic. ClauseGuard does not save my document, chat or draft.</span></label>
            {configured===false && <div className="setup-note"><span className="setup-dot"/><span>Demo ready. Live analysis needs the owner’s Claude API key.</span></div>}
            {error && <div className="error" role="alert"><TriangleAlert size={17}/>{error}</div>}
            <button className="primary-button analyze-button" disabled={busy||extracting||configured!==true||characterCount<100||characterCount>MAX_CHARACTERS||!consent||(tab==="upload"&&ocrPages.length>0&&!ocrReviewed)} onClick={()=>void analyze()}>{busy ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={18}/>} {busy ? "Reading the fine print…" : "Analyse agreement"}</button>{busy && <p className="loading-hint" role="status">Claude is reading the complete extracted text. This may take up to 90 seconds.</p>}
            <div className="sample-prompt">Just looking around? <button onClick={demo} disabled={busy}>Try a sample agreement <ArrowUpRight size={14}/></button></div>
          </section>
          <aside className="review-preview"><div className="preview-title"><span className="mini-line"/>WHAT YOU’LL WALK AWAY WITH</div><h2>Less legal jargon.<br/>More peace of mind.</h2><p className="preview-lead">A practical review that puts the important details in plain sight.</p><Feature icon={<TriangleAlert size={20}/>} title="Risks, brought to light" text="Spot one-sided terms, unexpected costs, and obligations worth a second look." color="orange"/><Feature icon={<ScanText size={20}/>} title="Plain-language explanations" text="Understand what a clause says and what it could mean for you." color="purple"/><Feature icon={<ClipboardList size={20}/>} title="Better questions to ask" text="Go into the conversation with specific points to clarify before signing." color="green"/><div className="clause-preview"><div><span className="badge high">HIGH ATTENTION</span><span className="preview-example">EXAMPLE FINDING</span></div><blockquote>“The provider may change fees at any time without prior notice.”</blockquote><p><strong>In plain English</strong>Your costs could increase without warning.</p><div className="ask-preview"><CircleHelp size={16}/><span>Can price changes require advance notice?</span></div></div></aside></div>
          <div className="trust-strip"><span><Check size={16}/>Source-linked findings</span><span><Check size={16}/>No account setup needed</span><span><Check size={16}/>Written for real people</span></div>
        </> : <>
          {result.mode==="demo" && <div className="demo-banner"><Sparkles size={17}/><div><strong>You’re exploring a sample review.</strong> This risk report is illustrative. Live chat and drafting use Claude when enabled.</div><button onClick={reset}>Review your own</button></div>}
          <div className="report-document"><div className="document-symbol"><FileText size={23}/></div><div><h2>{name}</h2><p>{result.report.documentType} · {pages.length} {pages.length===1?"page":"pages"} · {result.mode==="demo"?"Demo report":"Claude review"}</p></div><button className="secondary-button export-button" onClick={exportReport}><Download size={16}/>Export report</button></div>
          <div className="review-tabs" role="tablist" aria-label="Agreement workspace"><button role="tab" aria-selected={reviewTab==="report"} className={reviewTab==="report"?"selected":""} onClick={()=>setReviewTab("report")}><ScanText size={17}/>Risk review</button><button role="tab" aria-selected={reviewTab==="chat"} className={reviewTab==="chat"?"selected":""} onClick={()=>setReviewTab("chat")}><CircleHelp size={17}/>Ask your agreement</button><button role="tab" aria-selected={reviewTab==="revise"} className={reviewTab==="revise"?"selected":""} onClick={()=>setReviewTab("revise")}><FileText size={17}/>Balanced draft</button></div>
          <div hidden={reviewTab!=="report"}>
          <div className="stat-grid"><div className="stat-card attention"><span>OVERALL ATTENTION</span><strong>{attentionLevel(findings)}<TriangleAlert size={24}/></strong><p>Based on flagged clauses, not legal validity</p></div>{(["high","medium","low"] as const).map(level=><div className={`stat-card ${level}`} key={level}><span>{level.toUpperCase()} ATTENTION</span><strong>{findings.filter(f=>f.severity===level).length.toString().padStart(2,"0")}</strong><p>{level==="high"?"Prioritise these conversations":level==="medium"?"Worth clarifying":"Smaller points to understand"}</p></div>)}</div>
          <section className="summary-card"><div className="summary-icon"><Sparkles size={20}/></div><div><h2>The big picture</h2><p>{result.report.summary}</p></div></section>
          {result.warnings.length>0 && <div className="warning" role="alert">{result.warnings.map((w,i)=><p key={i}>{w}</p>)}</div>}
          <div className={`report-layout ${sourceOpen?"with-source":""}`}><section><div className="findings-header"><h2>Clauses to look closer at <span>{findings.length}</span></h2><button className="text-button" onClick={()=>setSourceOpen(!sourceOpen)}>{sourceOpen?<PanelLeftClose size={16}/>:<FileText size={16}/>} {sourceOpen?"Hide source":"View document"}</button></div><div className="filter-tabs" aria-label="Filter findings">{["all","high","medium","low"].map(level=><button key={level} aria-pressed={filter===level} className={filter===level?"selected":""} onClick={()=>setFilter(level)}>{level==="all"?"All findings":`${level[0].toUpperCase()+level.slice(1)} attention`}</button>)}</div><div className="findings-list">{findings.map((f,i)=>filter!=="all"&&f.severity!==filter?null:<FindingCard key={i} finding={f} index={i} onSource={()=>showSource(i)}/>)}{!findings.some(f=>filter==="all"||f.severity===filter) && <div className="empty-state"><ShieldCheck size={28}/><h3>No {filter==="all"?"":filter+" attention "}findings to show</h3><p>A lack of flagged clauses does not mean an agreement is safe to sign. Review the original text and the limitations below.</p></div>}</div></section>
          {sourceOpen && <aside className="source-panel" ref={sourcePanel}><div className="source-title"><div><FileText size={17}/><strong>Source document</strong></div><button className="icon-button" aria-label="Close source document" onClick={()=>setSourceOpen(false)}><X size={18}/></button></div><p className="source-caption">Extracted text · Original page references</p><div className="source-pages">{pages.map(page=><article key={page.number}><span className="source-page-label">{tab==="paste"?"TEXT SECTION":"PAGE"} {page.number}</span><pre>{highlighted(page)}</pre></article>)}</div></aside>}</div>
          <div className="report-bottom-grid"><ReportList title="Your key obligations" icon={<ClipboardList size={19}/>} items={result.report.obligations}/><ReportList title="Information to clarify" icon={<CircleHelp size={19}/>} items={result.report.missingInformation}/></div><details className="limitations"><summary>Review limitations & methodology <ChevronDown size={16}/></summary><ul>{result.report.limitations.map((l,i)=><li key={i}>{l}</li>)}<li>This review may miss risks or misinterpret terms. Verify the extracted text against your original document.</li></ul><p>{result.model} · {result.promptVersion} · Risk levels describe practical attention, not legal enforceability.</p></details>
          </div><div hidden={reviewTab==="report"}><AgreementTools view={reviewTab==="revise"?"revise":"chat"} agreement={{pages,documentName:name,agreementType:type,jurisdiction,perspective,consent:true}} result={result} configured={configured===true} onDraftSource={()=>setReviewTab("revise")} onSource={(page,quote)=>{setSourceCitation({page,quote});setSelected(null);setSourceOpen(true);setReviewTab("report");setTimeout(()=>sourcePanel.current?.scrollIntoView({behavior:"smooth",block:"nearest"}),20);}}/></div>
        </>}
        <footer><Scale size={17}/><p>Clarity is a starting point. ClauseGuard provides informational assistance, not legal advice.<br/><span>For decisions with significant consequences, consult a qualified legal professional.</span></p><button onClick={()=>setInfo("privacy")}>Privacy</button></footer>
      </main>
    </div>
    {info && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setInfo(null);}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="icon-button modal-close" ref={dialogClose} aria-label="Close information" onClick={()=>setInfo(null)}><X size={20}/></button><span className="modal-icon">{info==="method"?<BookOpen size={25}/>:<LockKeyhole size={25}/>}</span><h2 id="modal-title">{info==="method"?"A clearer way to review agreements.":"Your documents deserve care."}</h2>{info==="method"?<><p>Upload a text-based PDF or TXT file, or paste the complete agreement. Add your role and optional jurisdiction, then confirm before sending text to Claude.</p><p>Claude reviews the complete extracted text against a defined risk rubric. Findings include plain-language explanations and questions to ask. Quotations are checked against the cited page; unmatched findings are omitted with a warning.</p><p><strong>High</strong> means potentially substantial exposure or rights loss. <strong>Medium</strong> means a meaningful restriction or cost worth clarifying. <strong>Low</strong> means a smaller practical concern.</p><p>Up to 5 MB, 30 pages, and 60,000 characters. English scanned PDFs use free browser-based OCR, up to 10 OCR pages per agreement. Review and correct the recognised text before analysis. OCR can miss or misread content. A review can miss issues and does not establish legal enforceability.</p></>:<><p>Files and scanned-page OCR are processed in your browser using locally served OCR assets. When you choose Analyse, extracted text, your role, agreement type, and jurisdiction are sent through the server to Anthropic’s Claude API. Agreement chat also sends your questions and conversation context; draft suggestions send selected findings and your drafting preferences.</p><p>ClauseGuard does not save your agreement, report, conversation or proposed draft to a database, browser storage, or application logs. They remain in this browser session until you start a new review or reload the page. Hosting providers may retain routine request metadata.</p><p>Anthropic’s API data handling and retention terms apply to the text it receives. Remove personal or confidential information you do not want to send, and review the provider’s terms before analysing sensitive agreements.</p><p>The sample report is hand-authored and makes no AI request. Your API key belongs in server configuration, never in an uploaded agreement or this interface.</p></>}</section></div>}
  </div>;
}

function Feature({icon,title,text,color}:{icon:React.ReactNode;title:string;text:string;color:string}) {return <div className="feature"><span className={`feature-icon ${color}`}>{icon}</span><div><h3>{title}</h3><p>{text}</p></div></div>;}
function FindingCard({finding:f,index,onSource}:{finding:Finding;index:number;onSource:()=>void}) {return <article className={`finding-card severity-${f.severity}`}><div className="finding-top"><span className={`badge ${f.severity}`}>{f.severity.toUpperCase()} ATTENTION</span><span className="category">{f.category}</span><span className="finding-number">{String(index+1).padStart(2,"0")}</span></div><h3>{f.title}</h3><blockquote>“{f.quote}”<button onClick={onSource}>View in source · p. {f.page}<ArrowUpRight size={13}/></button></blockquote><div className="finding-explanations"><div><h4>What it means</h4><p>{f.explanation}</p></div><div><h4>How it could affect you</h4><p>{f.implication}</p></div></div><div className="question-box"><CircleHelp size={17}/><div><strong>A QUESTION WORTH ASKING</strong><p>{f.question}</p></div></div></article>;}
function ReportList({title,icon,items}:{title:string;icon:React.ReactNode;items:string[]}) {return <section className="report-list card"><h2>{icon}{title}</h2>{items.length?<ul>{items.map((item,i)=><li key={i}>{item}</li>)}</ul>:<p>No items identified. Check the original agreement.</p>}</section>;}




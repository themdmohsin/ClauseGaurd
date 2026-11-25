import { MAX_CHARACTERS, MAX_FILE_BYTES, MAX_PAGES, type Page } from "./analysis";
import type { Worker } from "tesseract.js";
export type Extraction = {pages:Page[];ocrPages:number[];warnings:string[]};
export async function extractDocument(file:File,options:{ocr:boolean;progress:(message:string)=>void;signal:AbortSignal}):Promise<Extraction>{
  if(file.size>MAX_FILE_BYTES)throw new Error("Choose a file smaller than 5 MB.");
  const {signal,progress}=options;
  const check=()=>{if(signal.aborted)throw new Error("Document reading cancelled.");};
  let pdf:import("pdfjs-dist").PDFDocumentLoadingTask|undefined;
  let worker:Worker|undefined;
  let canvas:HTMLCanvasElement|undefined;
  const cancel=()=>{void worker?.terminate();void pdf?.destroy();};
  signal.addEventListener("abort",cancel,{once:true});
  try{
    check();
    if(/\.txt$/i.test(file.name)){
      const text=await file.text();check();
      if(text.includes("\u0000"))throw new Error("Save your text document as UTF-8 and try again.");
      if(text.length<100||text.length>MAX_CHARACTERS)throw new Error("Use an agreement between 100 and 60,000 characters.");
      return {pages:[{number:1,text}],ocrPages:[],warnings:[]};
    }
    if(!/\.pdf$/i.test(file.name))throw new Error("Choose a PDF or a UTF-8 .txt file.");
    const pdfjs=await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc="/pdf.worker-6.5.438.min.mjs";
    const bytes=new Uint8Array(await file.arrayBuffer());check();
    if(!new TextDecoder().decode(bytes.slice(0,1024)).includes("%PDF-"))throw new Error("This file does not appear to be a PDF.");
    pdf=pdfjs.getDocument({data:bytes,useSystemFonts:true});
    pdf.onPassword=()=>{void pdf?.destroy();};
    const document=await pdf.promise;check();
    if(document.numPages>MAX_PAGES)throw new Error("Use a PDF with no more than 30 pages.");
    const pages:Page[]=[],ocrPages:number[]=[],warnings:string[]=[];
    for(let i=1;i<=document.numPages;i++){
      check();progress(`Reading page ${i} of ${document.numPages}…`);
      const page=await document.getPage(i);
      const content=await page.getTextContent();
      let text=content.items.map(item=>"str"in item?item.str+(item.hasEOL?"\n":" "):"").join("").trim();
      const ops=await page.getOperatorList();
      const hasImage=ops.fnArray.some(op=>[pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject,pdfjs.OPS.paintImageMaskXObject].includes(op));
      if(text.length<50||hasImage){
        if(!options.ocr)throw new Error(`Page ${i} may contain scanned content. Enable free OCR and upload again so no image text is silently missed.`);
        if(ocrPages.length>=10)throw new Error("This version supports up to 10 OCR pages per document. Choose a shorter scan; no partial document has been accepted.");
        if(!worker){
          progress("Loading free English OCR on your device…");
          const tesseract=await import("tesseract.js");
          worker=await tesseract.createWorker("eng",1,{workerPath:"/ocr/worker.min.js",corePath:"/ocr",langPath:"/ocr",workerBlobURL:false,logger:message=>{if(message.status==="recognizing text")progress(`Recognising page ${i} of ${document.numPages} · ${Math.round(message.progress*100)}%`);}});
          check();
        }
        const base=page.getViewport({scale:1});
        const scale=Math.min(2.5,Math.sqrt(6_000_000/(base.width*base.height)));
        const viewport=page.getViewport({scale});
        canvas=documentGlobal().createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        const context=canvas.getContext("2d");if(!context)throw new Error("Your browser could not prepare this page for OCR.");
        await page.render({canvas,canvasContext:context,viewport,background:"white"}).promise;check();
        const recognition=await worker.recognize(canvas);check();
        text=recognition.data.text.trim();ocrPages.push(i);
        if(recognition.data.confidence<75)warnings.push(`Page ${i}: OCR confidence is ${Math.round(recognition.data.confidence)}%. Check names, amounts, dates and punctuation carefully.`);
        canvas.width=0;canvas.height=0;canvas=undefined;
      }
      if(text.length<30)throw new Error(`Page ${i} is blank or could not be read reliably, even with OCR. Use a clearer complete copy or paste its text. No page has been silently skipped.`);
      pages.push({number:i,text});
      if(pages.reduce((n,p)=>n+p.text.length,0)>MAX_CHARACTERS)throw new Error("The document exceeds 60,000 characters. No pages have been omitted.");
      page.cleanup();
    }
    if(pages.reduce((n,p)=>n+p.text.length,0)<100)throw new Error("The document has too little readable agreement text.");
    return {pages,ocrPages,warnings};
  }finally{
    signal.removeEventListener("abort",cancel);
    if(canvas){canvas.width=0;canvas.height=0;}
    await worker?.terminate().catch(()=>{});await pdf?.destroy().catch(()=>{});
  }
}
// Avoid shadowing the browser document with PDFDocumentProxy.
function documentGlobal(){return globalThis.document;}

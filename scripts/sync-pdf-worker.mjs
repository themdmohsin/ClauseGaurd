import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
// Serve the worker as an untransformed asset. Development transforms can inject
// window-only code, which fails in a real browser Worker.
mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
copyFileSync(new URL("../node_modules/pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), new URL("../public/pdf.worker-6.5.438.min.mjs", import.meta.url));
const ocr=new URL("../public/ocr/",import.meta.url);
mkdirSync(ocr,{recursive:true});
copyFileSync(new URL("../node_modules/tesseract.js/dist/worker.min.js",import.meta.url),new URL("worker.min.js",ocr));
const core=new URL("../node_modules/tesseract.js-core/",import.meta.url);
for(const name of readdirSync(core))if(name.includes("lstm")&&(name.endsWith(".wasm")||name.endsWith(".wasm.js")))copyFileSync(new URL(name,core),new URL(name,ocr));
// LSTM English language data; no document or page is sent to an OCR service.
copyFileSync(new URL("../node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz",import.meta.url),new URL("eng.traineddata.gz",ocr));

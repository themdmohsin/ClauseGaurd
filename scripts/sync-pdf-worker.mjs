import { copyFileSync, mkdirSync } from "node:fs";
// Serve the worker as an untransformed asset. Development transforms can inject
// window-only code, which fails in a real browser Worker.
mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
copyFileSync(new URL("../node_modules/pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), new URL("../public/pdf.worker-6.5.438.min.mjs", import.meta.url));

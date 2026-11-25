# ClauseGuard

An agreement review website with PDF/TXT upload, free browser OCR for English scans, contextual Claude review, source quotations, conversational questions, clause revision proposals, and full proposed agreement export. Clearly labelled examples work without an API key.

## Stack

TypeScript and React with Next.js App Router conventions, using Vinext/Vite for the Sites Cloudflare Worker deployment. Styling uses CSS and Tailwind. Claude calls use the official Anthropic SDK and Zod structured output validation. PDF.js extracts text locally in the browser. This build is configured for Sites, rather than the initially suggested Vercel deployment.

## Local development

Use Node 22.13+ (Node 24 recommended).

```powershell
npm install
Copy-Item .env.example .dev.vars
```

Open `.dev.vars` in your editor and set `ANTHROPIC_API_KEY` to your key. The file is ignored by Git. Do not paste a key into the browser, source files, or chat. `ANTHROPIC_MODEL` defaults to `claude-sonnet-4-6`; choose a supported structured-output model available to your account if needed.

```powershell
npm run dev
```

Open the Local URL printed by the server. Choose **Try a sample agreement** to explore without a key. The sample report is hand-authored; it is never represented as an API result. For a real review, add the complete agreement, choose your perspective, and confirm that its extracted text may be sent to Anthropic.

## Hosted Claude configuration

The Site is owner-private. Configure `ANTHROPIC_API_KEY` using Sites runtime environment variables, then deploy a saved version to apply the environment revision. `.env` or `.dev.vars` files do not configure hosted secrets. An optional `ANTHROPIC_MODEL` selects the model. No secret is exposed through `/api/status`.

## Checks

```powershell
npm run test
npm run typecheck
npm run build
```

## Review design

- `lib/analysis.ts`: versioned prompt, schemas, risk rubric, quote verification and source offset mapping.
- `app/api/analyze/route.ts`: backend-only SDK call, bounded body reading, input validation, timeouts, response validation, and safe error messages.
- `app/workspace.tsx`: local extraction, consent, demo, reports and source highlighting.
- `tests/analysis.test.ts`: hallucinated quote rejection, page validation, whitespace handling, input limits, and demo integrity.
- `lib/collaboration.ts`: chat schemas, citation verification, revision prompts, replacement verification, and deterministic draft composition.
- `app/api/chat/route.ts` and `app/api/revise/route.ts`: backend Claude conversation and drafting endpoints.
- `app/agreement-tools.tsx`: conversation, document-version selector, revision selection, editable draft, TXT export and browser print / Save PDF.
- `lib/extract-document.ts`: PDF text extraction and in-browser English OCR via Tesseract.js.
- `tests/collaboration.test.ts`: source citation validation, overlap/ambiguity rejection, unchanged-text preservation, and context limits.

The full extracted text is sent in one request, allowing cross-clause context within the first-version limits. No silent truncation or partial review is allowed. Missing information is separate from sourced findings. A quotation must match its cited page after whitespace normalization; otherwise the finding is omitted and a warning is shown. This verifies provenance, not the accuracy of the interpretation.

## Limits and data handling

- 5 MB files, 30 pages, 60,000 extracted characters; 100-character minimum.
- Text-based PDFs, UTF-8 TXT, and English scanned PDFs. At most 10 OCR pages within the 30-page document limit. Image-containing or sparse pages use OCR when enabled; unreadable/blank or password-protected PDFs are rejected with no silent omissions. Handwriting, complex tables and reliable visual layout interpretation remain limitations.
- Extracted text may differ from the PDF layout; users should compare it to the original.
- No document database, agreement browser persistence, or agreement content logging. Documents, chats, suggestions and drafts stay in React memory until reload or a new review. OCR may cache only its language resources locally. Exported files are saved on the user's device.
- Agreement text and selected context are sent to Anthropic on analysis, chat and revision requests after consent. Chat includes recent conversation context; revisions include selected findings and drafting preferences. Anthropic's API terms and retention policies apply; no claim of zero third-party retention is made.
- The API includes best-effort, in-memory per-isolate limits of 10 attempts/hour and one concurrent request per identity. These reset on worker restart and are **not a global spending cap**. Before public access, add durable distributed rate limiting, authentication enforcement, abuse protection, and an API account spending cap.
- This is informational assistance, not legal advice or a guarantee that every risk is identified. Model output can be wrong. No enforceability assessment or legal research is performed.

## Agreement chat and proposed drafts

After analysis, use **Ask your agreement** for document-grounded questions. Exact quotations are verified against the selected document; unmatched citations are omitted with a warning. The prompt avoids inventing computed monetary totals; a currency-amount check withholds answers containing common currency figures absent from the selected text. This is a bounded check, not complete financial or semantic validation. Original and proposed-draft questions use separate conversation context. Editing/regenerating a draft clears prior draft-specific context. Chat is limited to 2,000 characters per question and 30,000 characters of recent history. The chat/revision endpoints share best-effort per-isolate limits of 30 attempts/hour and one concurrent request per identity, separate from analysis limits. These are not durable distributed limits.

Use **Balanced draft** to choose flagged issues and add preferences. Claude proposes replacement passages with effects for both parties, trade-offs, and open questions. Each original passage must uniquely match a page; ambiguous, unchanged and overlapping edits are omitted. Only selected replacements are applied, from the end of each page backwards, preserving all other extracted text exactly. This avoids regenerating the entire agreement with the model. It does not validate legal substance or ensure consistency of all cross-references.

Generated agreements are editable, labelled **proposed drafts for review**, and downloadable as TXT with a separate change summary. Browser print / Save PDF is available. PDF formatting, signatures and images are not preserved. Commercial changes are negotiation suggestions; both parties must review and agree before use. Unselected risks may remain. Export requires acknowledging these limits, never an assertion that the draft is legally safe.

## Free scanned-page OCR

PDF.js renders pages locally and Tesseract.js 7 recognises English text in a browser worker. OCR worker/core files and English language data are served from this Site, copied from pinned npm packages by `scripts/sync-pdf-worker.mjs` before dev/build. The OCR process makes no paid API calls and sends no scan to an OCR service. Claude analysis/chat/drafting still consume the owner's API usage.

Recognised pages must be reviewed and confirmed before analysis. Users can correct the text. Low recognition confidence is shown as a warning. The first OCR use downloads language and WASM assets; processing time depends on the device. Reproduce the browser test with `node tests/create-scanned-fixture.mjs`, then upload `work/fixtures/scanned-agreement.pdf`. Microsoft Windows.Media.Ocr requires a native packaged Windows app and is not a cross-platform website OCR option.

## Evaluation still required

Representative evaluation across agreement types remains necessary. Track material risk recall, false positives on balanced terms, quotation accuracy, cross-clause reasoning, role sensitivity, revision fairness and resistance to embedded document instructions. Deterministic tests do not establish legal or model accuracy. Live smoke checks exercise original-document chat, verified clause revisions, and proposed-draft chat with fictional contracts; these checks do not constitute a legal audit.

Official API references: https://platform.claude.com/docs/en/build-with-claude/structured-outputs and https://platform.claude.com/docs/en/about-claude/models/overview

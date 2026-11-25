# ClauseGuard

A first working version of an agreement review website: PDF/TXT upload, pasted text, contextual Claude review, verified source quotations, risk filters, highlighted extracted text, and downloadable reports. A clearly labelled sample works without an API key.

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

The full extracted text is sent in one request, allowing cross-clause context within the first-version limits. No silent truncation or partial review is allowed. Missing information is separate from sourced findings. A quotation must match its cited page after whitespace normalization; otherwise the finding is omitted and a warning is shown. This verifies provenance, not the accuracy of the interpretation.

## Limits and data handling

- 5 MB files, 30 pages, 60,000 extracted characters; 100-character minimum.
- Text-based PDFs and UTF-8 TXT only. Scanned, unreadable, password-protected, or sparse PDF pages are rejected. OCR, reliable visual layout interpretation, tables, and image analysis are future work.
- Extracted text may differ from the PDF layout; users should compare it to the original.
- No document database, browser persistence, or agreement content logging. Documents and reports stay in React memory until a reload or a new review. Exported reports are saved on the user's device.
- Agreement text and selected context are sent to Anthropic only on analysis. Anthropic's API terms and retention policies apply; no claim of zero third-party retention is made.
- The API includes best-effort, in-memory per-isolate limits of 10 attempts/hour and one concurrent request per identity. These reset on worker restart and are **not a global spending cap**. Before public access, add durable distributed rate limiting, authentication enforcement, abuse protection, and an API account spending cap.
- This is informational assistance, not legal advice or a guarantee that every risk is identified. Model output can be wrong. No enforceability assessment or legal research is performed.

## Evaluation still required

Live output quality requires an API key and a representative, consented test set across agreement types. Track material risk recall, false positives on balanced terms, quotation accuracy, cross-clause reasoning, role sensitivity, and resistance to embedded document instructions. The deterministic automated tests do not establish legal or model accuracy. Live Claude calls cannot be verified until a key is configured.

Official API references: https://platform.claude.com/docs/en/build-with-claude/structured-outputs and https://platform.claude.com/docs/en/about-claude/models/overview

import { test } from "node:test";
import assert from "node:assert/strict";
import { locateQuote, requestSchema, reportSchema, verifyReport, attentionLevel } from "../lib/analysis.ts";
import { DEMO_PAGES, DEMO_RESULT } from "../lib/demo.ts";

test("the sample report validates and all quotes exist on their cited pages", () => {
  const report = reportSchema.parse(DEMO_RESULT.report);
  const checked = verifyReport(report, DEMO_PAGES);
  assert.equal(checked.warnings.length, 0);
  assert.equal(checked.report.findings.length, 5);
});
test("invented quotations and incorrect page references are omitted with warnings", () => {
  const original = DEMO_RESULT.report.findings[0];
  const report = { ...DEMO_RESULT.report, findings: [original, { ...original, quote: "This clause was never present in the agreement." }, { ...original, page: 20 }] };
  const checked = verifyReport(report, DEMO_PAGES);
  assert.equal(checked.report.findings.length, 1);
  assert.equal(checked.warnings.length, 2);
});
test("quote matching tolerates extraction whitespace and maps to original offsets", () => {
  const text = "Before. The  Client\nmay withhold\t payment. After.";
  const location = locateQuote(text, "The Client may withhold payment.");
  assert.ok(location);
  assert.equal(text.slice(...location), "The  Client\nmay withhold\t payment.");
  assert.equal(locateQuote(text, "the client may withhold payment."), null);
});
const request = { pages: DEMO_PAGES, documentName: "Sample", agreementType: "Freelance", jurisdiction: "", perspective: "Freelancer", consent: true };
test("requests require consent and reject incomplete or oversized content", () => {
  assert.equal(requestSchema.safeParse(request).success, true);
  assert.equal(requestSchema.safeParse({ ...request, consent: false }).success, false);
  assert.equal(requestSchema.safeParse({ ...request, pages: [{ number: 1, text: "short" }] }).success, false);
  assert.equal(requestSchema.safeParse({ ...request, pages: [{ number: 1, text: "a".repeat(60001) }] }).success, false);
  assert.equal(requestSchema.safeParse({ ...request, pages: [DEMO_PAGES[0], DEMO_PAGES[0]] }).success, false);
  assert.equal(requestSchema.safeParse({ ...request, pages: Array.from({length:31},(_,i)=>({number:i+1,text:"a".repeat(100)})) }).success, false);
});
test("attention is based on findings and never describes zero findings as safe", () => {
  assert.equal(attentionLevel(DEMO_RESULT.report.findings), "High");
  assert.equal(attentionLevel([]), "No flags");
});

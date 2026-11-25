import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { requestSchema, reportSchema, verifyReport, SYSTEM_PROMPT, PROMPT_VERSION } from "@/lib/analysis";
import { runtimeValue } from "@/lib/runtime";
// Best-effort per-isolate budget protection. Keep owner-private until distributed limits are added.
const attempts = new Map<string, number[]>();
const busy = new Set<string>();
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Please submit the agreement from ClauseGuard." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Send a JSON agreement." }, 415);
  const apiKey = runtimeValue("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "Live analysis is not configured yet. The site owner needs to add ANTHROPIC_API_KEY as a server secret. Explore the sample report meanwhile." }, 503);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "The agreement is empty." }, 400);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 500_000) { await reader.cancel(); return json({ error: "This request is too large. Use an agreement under 60,000 characters." }, 413); }
    chunks.push(value);
  }
  let parsed;
  try {
    const data = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    parsed = requestSchema.safeParse(JSON.parse(new TextDecoder().decode(data)));
  } catch { return json({ error: "The request could not be read. Please try again." }, 400); }
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Check your agreement and consent." }, 400);
  const identity = request.headers.get("oai-authenticated-user-id") ?? "private-owner";
  const now = Date.now();
  if (attempts.size > 500) for (const [key, times] of attempts) if (times.every(t => t < now - 3_600_000)) attempts.delete(key);
  const recent = (attempts.get(identity) ?? []).filter(t => t > now - 3_600_000);
  if (recent.length >= 10 || busy.has(identity)) return json({ error: "Please wait before another review. Up to 10 attempts per hour are available on this server." }, 429, { "Retry-After": "60" });
  attempts.set(identity, [...recent, now]); busy.add(identity);
  const model = runtimeValue("ANTHROPIC_MODEL") || "claude-sonnet-4-6";
  try {
    const client = new Anthropic({ apiKey, timeout: 90_000, maxRetries: 0 });
    const message = await client.messages.create({ model, max_tokens: 10000, system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify({ context: { agreementType: parsed.data.agreementType, jurisdiction: parsed.data.jurisdiction || "Not specified", perspective: parsed.data.perspective }, documentPages: parsed.data.pages }) }],
      output_config: { format: zodOutputFormat(reportSchema) },
    });
    if (message.stop_reason !== "end_turn") return json({ error: "Claude could not complete a reliable report. Try a shorter agreement; no partial report has been shown." }, 502);
    const output = message.content.filter(block => block.type === "text").map(block => block.text).join("");
    const report = reportSchema.parse(JSON.parse(output));
    return json({ ...verifyReport(report, parsed.data.pages), mode: "live", model, promptVersion: PROMPT_VERSION });
  } catch (error) {
    // Never log agreement contents, upstream errors, or credentials.
    if (error instanceof Anthropic.AuthenticationError) return json({ error: "Claude rejected the server API key. Ask the site owner to check the key and API access." }, 502);
    if (error instanceof Anthropic.RateLimitError) return json({ error: "Claude's usage limit has been reached. Please try again later." }, 429);
    if (error instanceof Anthropic.APIConnectionTimeoutError) return json({ error: "The review timed out. Try again with a shorter document." }, 504);
    return json({ error: "The analysis could not be completed or verified. Please retry. Your agreement has not been saved by ClauseGuard." }, 502);
  } finally { busy.delete(identity); }
}

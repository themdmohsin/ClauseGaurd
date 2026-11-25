import { runtimeValue } from "@/lib/runtime";
export async function GET() {
  return Response.json({ configured: Boolean(runtimeValue("ANTHROPIC_API_KEY")) }, { headers: { "Cache-Control": "no-store" } });
}

import { env } from "cloudflare:workers";
export function runtimeValue(name: string): string | undefined {
  const value = (env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" ? value : process.env[name];
}

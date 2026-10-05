import "server-only";
import { getStore } from "./store";
import { clinicNow } from "./time";

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });

/** Simple per-IP daily limit for write endpoints. */
export async function overLimit(req: Request, bucket: string, max: number) {
  const n = await getStore().bump(`${bucket}:${clientIp(req)}:${clinicNow().date}`);
  return n > max;
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

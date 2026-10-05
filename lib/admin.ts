import "server-only";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";

/** Demo admin: password from ADMIN_PASSWORD (defaults to "demo" so visitors can look around). */
export const adminPassword = () => process.env.ADMIN_PASSWORD || "demo";
export const isDemoAdmin = () => !process.env.ADMIN_PASSWORD;
const token = () => createHash("sha256").update("mira-admin:" + adminPassword()).digest("hex").slice(0, 32);

export async function isAdmin() {
  return (await cookies()).get("mira_admin")?.value === token();
}
export const adminCookie = () => ({ name: "mira_admin", value: token(), httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 8 });

/** Hides personal data on the public demo admin. */
export const maskName = (n: string) => n.split(/\s+/).map((w) => (w ? w[0] + "•".repeat(Math.max(1, w.length - 1)) : w)).join(" ");
export const maskPhone = (p: string) => (p.length > 3 ? "•".repeat(p.length - 3) + p.slice(-3) : "•••");

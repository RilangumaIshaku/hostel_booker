import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

export async function getStudentId() {
  const { url, anonKey } = supabaseConfig();
  const jar = await cookies();
  let token: string = jar.get("student_access_token")?.value ?? "";
  if (!token) return null;
  const readUser = () => fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  let response = await readUser();
  if (!response.ok) {
    const refreshToken = jar.get("student_refresh_token")?.value;
    if (!refreshToken) return null;
    const refreshed = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }), cache: "no-store",
    });
    if (!refreshed.ok) return null;
    const session = await refreshed.json();
    if (typeof session.access_token !== "string" || typeof session.refresh_token !== "string") return null;
    token = session.access_token;
    const secure = process.env.NODE_ENV === "production";
    jar.set("student_access_token", token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: session.expires_in ?? 3600 });
    jar.set("student_refresh_token", session.refresh_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    response = await readUser();
  }
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user.id === "string" ? user.id : null;
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseConfig } from "@/lib/server/config";

export async function POST() {
  const jar = await cookies();
  const token = jar.get("student_access_token")?.value;
  if (token) {
    try {
      const { url, anonKey } = supabaseConfig();
      await fetch(`${url}/auth/v1/logout`, { method: "POST", headers: { apikey: anonKey, Authorization: `Bearer ${token}` }, cache: "no-store" });
    } catch { /* Local cookies are still cleared below. */ }
  }
  const response = NextResponse.json({ message: "Signed out." });
  response.cookies.set("student_access_token", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set("student_refresh_token", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

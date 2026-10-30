import { NextRequest, NextResponse } from "next/server";
import { supabaseConfig } from "@/lib/server/config";

export async function POST(request: NextRequest) {
  try {
    const { url, anonKey } = supabaseConfig();
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    const result = NextResponse.json({ message: "Signed in." });
    const secure = process.env.NODE_ENV === "production";
    result.cookies.set("student_access_token", payload.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: payload.expires_in ?? 3600 });
    result.cookies.set("student_refresh_token", payload.refresh_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return result;
  } catch {
    return NextResponse.json({ error: "Account service is not configured yet." }, { status: 503 });
  }
}

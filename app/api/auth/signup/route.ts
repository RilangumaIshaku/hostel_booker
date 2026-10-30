import { NextRequest, NextResponse } from "next/server";
import { supabaseConfig } from "@/lib/server/config";

export async function POST(request: NextRequest) {
  try {
    const { url, anonKey } = supabaseConfig();
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || password.length < 10 || password.length > 256) {
      return NextResponse.json({ error: "Enter an email and a password of at least 10 characters." }, { status: 400 });
    }
    const response = await fetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) return NextResponse.json({ error: payload.msg ?? payload.message ?? "Could not create account." }, { status: response.status });
    if (!payload.access_token || !payload.refresh_token) {
      return NextResponse.json({ message: "Check your email to confirm your account, then sign in." }, { status: 201 });
    }
    const result = NextResponse.json({ message: "Account created." }, { status: 201 });
    const secure = process.env.NODE_ENV === "production";
    result.cookies.set("student_access_token", payload.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: payload.expires_in ?? 3600 });
    result.cookies.set("student_refresh_token", payload.refresh_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return result;
  } catch {
    return NextResponse.json({ error: "Account service is not configured yet." }, { status: 503 });
  }
}

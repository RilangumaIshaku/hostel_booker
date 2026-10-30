import { NextRequest, NextResponse } from "next/server";
import { getStudentId } from "@/lib/server/student-session";
import { supabaseConfig } from "@/lib/server/config";
import { encryptPortalSecret } from "@/lib/server/portal-secrets";

export async function GET() {
  try {
    const userId = await getStudentId();
    if (!userId) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    const { url, serviceKey } = supabaseConfig();
    const response = await fetch(`${url}/rest/v1/portal_connections?user_id=eq.${userId}&select=connected_at`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: "no-store",
    });
    if (!response.ok) throw new Error();
    const rows = await response.json();
    return NextResponse.json({ connected: rows.length > 0, connectedAt: rows[0]?.connected_at ?? null });
  } catch {
    return NextResponse.json({ error: "Could not load portal connection." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getStudentId();
    if (!userId) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password || username.length > 128 || password.length > 256) {
      return NextResponse.json({ error: "Enter your FUTMINNA username and password." }, { status: 400 });
    }
    const { url, serviceKey } = supabaseConfig();
    const response = await fetch(`${url}/rest/v1/portal_connections?on_conflict=user_id`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        user_id: userId,
        encrypted_username: encryptPortalSecret(userId, username),
        encrypted_password: encryptPortalSecret(userId, password),
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error();
    return NextResponse.json({ connected: true });
  } catch {
    return NextResponse.json({ error: "Could not save the portal connection. Check server setup and try again." }, { status: 503 });
  }
}

export async function DELETE() {
  try {
    const userId = await getStudentId();
    if (!userId) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    const { url, serviceKey } = supabaseConfig();
    const response = await fetch(`${url}/rest/v1/portal_connections?user_id=eq.${userId}`, {
      method: "DELETE",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: "no-store",
    });
    if (!response.ok) throw new Error();
    return NextResponse.json({ connected: false });
  } catch {
    return NextResponse.json({ error: "Could not remove the portal connection." }, { status: 503 });
  }
}

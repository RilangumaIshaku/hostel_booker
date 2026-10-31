import { NextRequest, NextResponse } from "next/server";
import { getStudentId } from "@/lib/server/student-session";
import { supabaseConfig } from "@/lib/server/config";

const hostel = "Needs Assessment Hostel";
const roomOrder = ["Room of 2", "Room of 4"];

export async function GET() {
  try {
    const userId = await getStudentId();
    if (!userId) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    const { url, serviceKey } = supabaseConfig();
    const response = await fetch(`${url}/rest/v1/booking_jobs?user_id=eq.${userId}&select=id,run_mode,session,hostel_preference,room_preferences,starts_at,status,result_code,result_message,created_at&order=created_at.desc&limit=10`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: "no-store",
    });
    if (!response.ok) throw new Error();
    const connectionResponse = await fetch(`${url}/rest/v1/portal_connections?user_id=eq.${userId}&select=connected_at`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: "no-store",
    });
    if (!connectionResponse.ok) throw new Error();
    const connections = await connectionResponse.json();
    const automationEnabled = process.env.BOOKING_AUTOMATION_ENABLED === "true";
    return NextResponse.json({
      jobs: await response.json(),
      connected: connections.length > 0,
      canSchedule: automationEnabled && connections.length > 0,
      sessionCheckEnabled: process.env.SESSION_CHECK_ENABLED === "true" && connections.length > 0,
      automationEnabled,
    });
  } catch {
    return NextResponse.json({ error: "Could not load booking jobs." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await getStudentId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  try {
    const body = await request.json();
    const runMode = body.runMode === "session_check" ? "session_check" : "booking";
    if (runMode === "booking" && process.env.BOOKING_AUTOMATION_ENABLED !== "true") {
      return NextResponse.json({ error: "Booking automation is switched off on the worker. Enable BOOKING_AUTOMATION_ENABLED after a successful fees check." }, { status: 409 });
    }
    if (runMode === "session_check" && process.env.SESSION_CHECK_ENABLED !== "true") {
      return NextResponse.json({ error: "Portal sign-in checks are not enabled on this service." }, { status: 409 });
    }
    const startsAt = typeof body.startsAt === "string" ? new Date(body.startsAt) : new Date(Number.NaN);
    if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Choose a future booking start time." }, { status: 400 });
    }
    const { url, serviceKey } = supabaseConfig();
    const connectionResponse = await fetch(`${url}/rest/v1/portal_connections?user_id=eq.${userId}&select=user_id`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: "no-store",
    });
    if (!connectionResponse.ok || (await connectionResponse.json()).length === 0) {
      return NextResponse.json({ error: "Connect your FUTMINNA portal account first." }, { status: 409 });
    }
    const response = await fetch(`${url}/rest/v1/booking_jobs`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ user_id: userId, run_mode: runMode, session: "2026/2027", hostel_preference: hostel, room_preferences: roomOrder, starts_at: startsAt.toISOString() }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error();
    const rows = await response.json();
    return NextResponse.json({ job: rows[0] }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not schedule this booking job." }, { status: 503 });
  }
}

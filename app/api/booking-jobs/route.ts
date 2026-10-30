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
    const response = await fetch(`${url}/rest/v1/booking_jobs?user_id=eq.${userId}&select=id,session,hostel_preference,room_preferences,starts_at,status,result_code,result_message,created_at&order=created_at.desc&limit=10`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: "no-store",
    });
    if (!response.ok) throw new Error();
    return NextResponse.json({ jobs: await response.json() });
  } catch {
    return NextResponse.json({ error: "Could not load booking jobs." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await getStudentId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (process.env.BOOKING_AUTOMATION_ENABLED !== "true") {
    return NextResponse.json({ error: "Booking is not enabled until the accommodation page and selection flow have been verified." }, { status: 409 });
  }

  try {
    const body = await request.json();
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
      body: JSON.stringify({ user_id: userId, session: "2026/2027", hostel_preference: hostel, room_preferences: roomOrder, starts_at: startsAt.toISOString() }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error();
    const rows = await response.json();
    return NextResponse.json({ job: rows[0] }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not schedule this booking job." }, { status: 503 });
  }
}

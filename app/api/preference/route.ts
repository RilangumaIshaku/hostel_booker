import { NextRequest, NextResponse } from "next/server";
import { getStudentId } from "@/lib/server/student-session";
import { supabaseConfig } from "@/lib/server/config";
import { findHostel, resolveBookingTarget } from "@/lib/hostels.mjs";

type SupabaseHead = { apikey: string; Authorization: string };

export async function GET() {
  try {
    const userId = await getStudentId();
    if (!userId) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    const { url, serviceKey } = supabaseConfig();
    const response = await fetch(`${url}/rest/v1/student_preferences?user_id=eq.${userId}&select=gender,hostel_id,updated_at`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } satisfies SupabaseHead,
      cache: "no-store",
    });
    if (!response.ok) throw new Error();
    const rows = await response.json();
    const saved = rows[0];
    if (!saved) return NextResponse.json({ preference: null });
    const hostel = findHostel(saved.hostel_id);
    return NextResponse.json({
      preference: { gender: saved.gender, hostelId: saved.hostel_id, updatedAt: saved.updated_at },
      hostel: hostel ? { id: hostel.id, name: hostel.name, portalName: hostel.portalName, price: hostel.price, rooms: hostel.rooms, detail: hostel.detail ?? null } : null,
    });
  } catch {
    return NextResponse.json({ error: "Could not load your hostel choice." }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  const userId = await getStudentId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  try {
    const body = await request.json();
    const gender = typeof body.gender === "string" ? body.gender : "";
    const hostelId = typeof body.hostelId === "string" ? body.hostelId : "";
    let target;
    try {
      target = resolveBookingTarget({ gender, hostelId });
    } catch (error) {
      const code = (error as { code?: string }).code ?? "invalid_choice";
      return NextResponse.json({ error: (error as Error).message, code }, { status: 400 });
    }
    const { url, serviceKey } = supabaseConfig();
    const response = await fetch(`${url}/rest/v1/student_preferences?on_conflict=user_id`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        gender: target.gender,
        hostel_id: target.hostelId,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error();
    return NextResponse.json({ preference: { gender: target.gender, hostelId: target.hostelId }, target });
  } catch {
    return NextResponse.json({ error: "Could not save your hostel choice. Check the server setup and try again." }, { status: 503 });
  }
}

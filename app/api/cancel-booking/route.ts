import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

const BOOKING_SECRET = process.env.BOOKING_SECRET || "";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const token = searchParams.get("token");

  if (!id || !token) {
    return NextResponse.redirect(new URL('/error?message=Invalid+link', request.url));
  }

  // Verify token
  const encoder = new TextEncoder();
  const tokenData = encoder.encode(`${id}-${BOOKING_SECRET}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", tokenData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const expectedToken = btoa(String.fromCharCode(...hashArray));

  if (token !== expectedToken) {
    return NextResponse.redirect(new URL('/error?message=Invalid+token', request.url));
  }

  const supabase = await createClient();

  // Update booking status to 'cancelada'
  const { error } = await supabase
    .from("reserva")
    .update({ estado: 'cancelada' })
    .eq("id", id);

  if (error) {
    console.error("Error canceling booking:", error);
    return NextResponse.redirect(new URL('/error?message=Could+not+cancel+booking', request.url));
  }

  return NextResponse.redirect(new URL(`/booking-cancelled?id=${id}`, request.url));
}

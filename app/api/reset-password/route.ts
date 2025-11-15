import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Check if user is authenticated and is admin/owner
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("usuario")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (!userData || (userData.rol !== "admin" && userData.rol !== "owner")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { barberId, email, nombre } = await request.json();

    // Call the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('reset-barber-password', {
      body: {
        barberId,
        email,
        nombre
      }
    });

    if (error) {
      console.error("Error calling edge function:", error);
      return NextResponse.json({ 
        error: error.message || "Error calling edge function",
        details: error
      }, { status: 500 });
    }

    if (data?.error) {
      console.error("Edge function returned error:", data.error);
      return NextResponse.json({ 
        error: data.error,
        details: data
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

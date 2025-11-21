import { createClient } from "@/utils/supabase/server";
import { encrypt, decrypt } from "@/utils/encryption";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile, error } = await supabase
            .from("usuario")
            .select("*")
            .eq("id", user.id)
            .single();

        if (error) {
            console.error("Error fetching profile:", error);
            return NextResponse.json({ error: "Error fetching profile" }, { status: 500 });
        }

        // Decrypt RUT if present
        if (profile.rut) {
            profile.rut = decrypt(profile.rut);
        }

        return NextResponse.json(profile);
    } catch (error) {
        console.error("Error in GET /api/profile:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Encrypt RUT if present
        const updateData = { ...body };
        if (updateData.rut) {
            updateData.rut = encrypt(updateData.rut);
        }

        const { data, error } = await supabase
            .from("usuario")
            .update(updateData)
            .eq("id", user.id)
            .select()
            .single();

        if (error) {
            console.error("Error updating profile:", error);
            return NextResponse.json({ error: "Error updating profile" }, { status: 500 });
        }

        // Return decrypted data
        if (data.rut) {
            data.rut = decrypt(data.rut);
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error in PUT /api/profile:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

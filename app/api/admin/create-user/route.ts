import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    const { email, nombre, apellido, telefono, rol, especialidad } = await request.json();

    if (!email || !nombre || !apellido || !rol) {
      return NextResponse.json(
        { error: 'email, nombre, apellido, and rol are required' },
        { status: 400 }
      );
    }

    // Check if email belongs to a soft-deleted user
    const { data: softDeletedUser } = await supabaseAdmin
      .from('usuario')
      .select('id, nombre, apellido, deleted_at')
      .eq('correo', email)
      .not('deleted_at', 'is', null)
      .single();

    // If soft-deleted user exists, permanently delete them
    // With ON DELETE CASCADE, all related records will be automatically deleted by the database
    if (softDeletedUser) {
      console.log(`Found soft-deleted user with email ${email}, permanently deleting...`);

      const userId = softDeletedUser.id;

      try {
        // Delete from usuario table - CASCADE will handle all related records
        await supabaseAdmin.from('usuario').delete().eq('id', userId);

        // Delete from auth.users
        await supabaseAdmin.auth.admin.deleteUser(userId);

        console.log(`Successfully permanently deleted soft-deleted user ${userId}`);
      } catch (deleteError) {
        console.error('Error permanently deleting soft-deleted user:', deleteError);
        return NextResponse.json(
          { error: 'Error al limpiar usuario anterior eliminado' },
          { status: 500 }
        );
      }
    }

    // Check if user already exists by email in auth (for non-deleted users)
    const { data: existingAuthUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingAuthUser?.users?.find(u => u.email === email);

    if (userExists) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con este correo electrónico' },
        { status: 400 }
      );
    }

    // Create auth user via Admin API with auto-confirm (we'll send our own email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: crypto.randomUUID(), // Temporary password that will be replaced
      email_confirm: true, // Auto-confirm, we handle our own email flow
      user_metadata: {
        nombre,
        apellido,
        needs_password_email: true, // Flag to send password email
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create auth user' },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // Check if usuario record already exists (in case of retry)
    const { data: existingUsuario } = await supabaseAdmin
      .from('usuario')
      .select('id')
      .eq('id', userId)
      .single();

    // Create usuario record only if it doesn't exist
    if (!existingUsuario) {
      const { error: usuarioError } = await supabaseAdmin
        .from('usuario')
        .insert({
          id: userId,
          nombre,
          apellido,
          correo: email,
          telefono: telefono || null,
          rol,
        });

      if (usuarioError) {
        console.error('Error creating usuario:', usuarioError);
        // Delete the auth user if usuario creation fails
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json(
          { error: 'Failed to create usuario record', details: usuarioError.message },
          { status: 500 }
        );
      }
    }

    // Check if barbero record already exists
    const { data: existingBarbero } = await supabaseAdmin
      .from('barbero')
      .select('id')
      .eq('id', userId)
      .single();

    // Create barbero record if applicable and doesn't exist
    if ((rol === 'barbero' || especialidad) && !existingBarbero) {
      const { error: barberoError } = await supabaseAdmin
        .from('barbero')
        .insert({
          id: userId,
          nombre,
          apellido,
          especialidad: especialidad || null,
        });

      if (barberoError) {
        console.error('Error creating barbero:', barberoError);
        // Don't fail the entire operation
      }
    }

    // Call edge function to set password and send welcome email
    try {
      const edgeResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          userId,
          email,
          nombre,
          apellido,
          rol,
          especialidad: especialidad || null,
        })
      });

      const edgeData = await edgeResponse.json();

      if (!edgeResponse.ok) {
        console.error('Edge function error:', edgeData);
        // User created but email failed
        return NextResponse.json({
          success: true,
          userId,
          email,
          nombre,
          apellido,
          rol,
          especialidad,
          warning: 'Usuario creado pero hubo un error al enviar el correo'
        });
      }
    } catch (emailError) {
      console.error('Error calling edge function:', emailError);
      // Continue even if email fails
    }

    return NextResponse.json({
      success: true,
      userId,
      email,
      nombre,
      apellido,
      rol,
      especialidad,
    });

  } catch (error: unknown) {
    console.error('Error in create-user route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

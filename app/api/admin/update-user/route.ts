import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/utils/supabase/service-role';
import { requireAdmin } from '@/lib/admin-auth';

const ROLES = ['admin', 'profesional'];

/**
 * Cambia el rol y la especialidad de un miembro del equipo. Cada barbero
 * administra su propia cuenta (correo, teléfono, contraseña); el admin solo
 * define su rol en la barbería. Usa service role tras verificar que es admin.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('response' in auth) return auth.response;
  const idBarberia = auth.ctx.barberia.id_barberia;

  try {
    const { userId, rol, especialidad } = await request.json();

    if (!userId || (rol && !ROLES.includes(rol))) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleClient();

    // Solo se editan miembros del equipo de esta barbería
    const { data: membresia } = await supabaseAdmin
      .from('usuario_barberia')
      .select('rol')
      .eq('id_usuario', userId)
      .eq('id_barberia', idBarberia)
      .in('rol', ROLES)
      .maybeSingle();

    if (!membresia) {
      return NextResponse.json({ error: 'El usuario no pertenece al equipo' }, { status: 404 });
    }

    if (rol && rol !== membresia.rol) {
      if (userId === auth.ctx.userId) {
        return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 400 });
      }
      const { error } = await supabaseAdmin
        .from('usuario_barberia')
        .update({ rol })
        .eq('id_usuario', userId)
        .eq('id_barberia', idBarberia);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // Pasar a barbero crea (o reactiva) su ficha de profesional
    if ((rol ?? membresia.rol) === 'profesional') {
      const { error } = await supabaseAdmin
        .from('profesional')
        .upsert(
          { id_barberia: idBarberia, id_profesional: userId, activo: true, ...(especialidad !== undefined ? { especialidad: especialidad || null } : {}) },
          { onConflict: 'id_barberia,id_profesional' }
        );
      if (error) {
        return NextResponse.json({ error: error.code === '23514' ? error.message : 'Error al actualizar el barbero' }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error in update-user route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

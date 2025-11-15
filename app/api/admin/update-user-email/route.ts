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
    const { userId, newEmail } = await request.json();

    if (!userId || !newEmail) {
      return NextResponse.json(
        { error: 'userId and newEmail are required' },
        { status: 400 }
      );
    }

    // Update auth user email
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: true, // Auto-confirm new email
    });

    if (error) {
      console.error('Error updating auth user email:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: data.user,
    });

  } catch (error: any) {
    console.error('Error in update-user-email route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const bookingId = searchParams.get('id')

    if (!token || !bookingId) {
      return NextResponse.redirect(new URL('/error?message=Invalid+link', request.url))
    }

    // Verify token (must match Supabase Edge Function SHA-256 generation)
    const bookingSecret = process.env.BOOKING_SECRET || 'default-secret-change-me'
    
    // Generate expected token using same SHA-256 method as Edge Function
    const encoder = new TextEncoder()
    const encodedData = encoder.encode(`${bookingId}-${bookingSecret}`)
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedData)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const expectedToken = Buffer.from(hashArray).toString('base64')
    
    if (token !== expectedToken) {
      return NextResponse.redirect(new URL('/error?message=Invalid+token', request.url))
    }

    const supabase = await createClient()

    // Update booking status
    const { data, error } = await supabase
      .from('reserva')
      .update({ estado: 'confirmada' })
      .eq('id', bookingId)
      .select()

    console.log('Update attempt:', { bookingId, data, error })

    if (error) {
      console.error('Error updating booking:', error)
      return NextResponse.redirect(new URL('/error?message=Could+not+confirm+booking', request.url))
    }

    if (!data || data.length === 0) {
      console.error('No rows updated - booking may not exist or RLS policy blocking update')
      return NextResponse.redirect(new URL('/error?message=Booking+not+found+or+permission+denied', request.url))
    }

    // Redirect to success page
    return NextResponse.redirect(new URL('/booking-confirmed', request.url))
  } catch (error) {
    console.error('Confirmation error:', error)
    return NextResponse.redirect(new URL('/error?message=Server+error', request.url))
  }
}

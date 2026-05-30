import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status_id = searchParams.get('status_id');
  const billcode = searchParams.get('billcode');
  const booking_id = searchParams.get('booking_id');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002';

  if (!booking_id) {
    return NextResponse.redirect(`${siteUrl}/?payment=error`);
  }

  // status_id = 1 means Success in ToyyibPay
  if (status_id === '1') {
    // Update booking in Supabase
    const { error } = await supabase
      .from('bookings')
      .update({ 
        payment_status: 'Paid',
        bank_reference: `TOYYIBPAY_${billcode}` 
      })
      .eq('id', booking_id);

    if (error) {
      console.error('Failed to update booking status:', error);
      return NextResponse.redirect(`${siteUrl}/?payment=db_error`);
    }

    return NextResponse.redirect(`${siteUrl}/?payment=success`);
  } else {
    // Payment failed or pending
    return NextResponse.redirect(`${siteUrl}/?payment=failed`);
  }
}

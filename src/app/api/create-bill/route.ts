import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { bookingId, fullName, email, amount, icNumber } = await req.json();

    const secretKey = process.env.TOYYIBPAY_SECRET_KEY;
    const categoryCode = process.env.TOYYIBPAY_CATEGORY_CODE;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002'; // Change in Vercel

    if (!secretKey || !categoryCode) {
      throw new Error('Missing ToyyibPay credentials');
    }

    const billName = `Vehicle Booking - ${bookingId.slice(0, 8)}`;
    const billDescription = `Payment for Vehicle Bailment Agreement`;
    
    // ToyyibPay requires amount in cents (sen)
    const billAmount = Math.round(amount * 100).toString(); 

    const formData = new URLSearchParams();
    formData.append('userSecretKey', secretKey);
    formData.append('categoryCode', categoryCode);
    formData.append('billName', billName);
    formData.append('billDescription', billDescription);
    formData.append('billPriceSetting', '1');
    formData.append('billPayorInfo', '1');
    formData.append('billAmount', billAmount);
    formData.append('billReturnUrl', `${siteUrl}/api/payment-callback?booking_id=${bookingId}`);
    formData.append('billCallbackUrl', `${siteUrl}/api/payment-webhook`); // Optional webhook
    formData.append('billExternalReferenceNo', bookingId);
    formData.append('billTo', fullName);
    formData.append('billEmail', email || 'no-email@example.com');
    formData.append('billPhone', '0123456789'); // Dummy if not provided
    formData.append('billSplitPayment', '0');
    formData.append('billSplitPaymentArgs', '');
    formData.append('billPaymentChannel', '0');
    formData.append('billDisplayMerchant', '1');
    formData.append('billContentEmail', 'Thank you for your vehicle booking payment.');
    formData.append('billChargeToCustomer', '1'); // Customer pays the FPX fee

    const response = await fetch('https://toyyibpay.com/index.php/api/createBill', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (Array.isArray(data) && data[0]?.BillCode) {
      const billCode = data[0].BillCode;
      return NextResponse.json({ url: `https://toyyibpay.com/${billCode}` });
    } else {
      console.error('ToyyibPay Error:', data);
      throw new Error('Failed to create ToyyibPay bill');
    }
  } catch (error: any) {
    console.error('Create Bill Route Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

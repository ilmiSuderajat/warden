import { NextResponse } from 'next/server';
import md5 from 'md5';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, orderId, productDetails, customerName, email } = body;

    const merchantCode = process.env.DUITKU_MERCHANT_CODE!;
    const apiKey = process.env.DUITKU_API_KEY!;
    
    // RUMUS SIGNATURE DUITKU: merchantCode + orderId + amount + apiKey
    const signature = md5(merchantCode + orderId + amount + apiKey);

    const payload = {
      merchantCode,
      paymentAmount: amount,
      merchantOrderId: orderId,
      productDetails,
      email,
      customerVaName: customerName, // Nama yang muncul di VA/QRIS
      signature,
      callbackUrl: `https://warden-blond.vercel.app/api/callback`,
      returnUrl: `https://warden-blond.vercel.app/checkout/success`,
      expiryPeriod: 1440 // 24 jam
    };

    const response = await fetch('https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
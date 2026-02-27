import { NextResponse } from 'next/server';
import md5 from 'md5';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, orderId, productDetails, customerName, email } = body;

    const merchantCode = process.env.DUITKU_MERCHANT_CODE;
    const apiKey = process.env.DUITKU_API_KEY;

    // Proteksi jika env belum diset
    if (!merchantCode || !apiKey) {
      return NextResponse.json({ statusMessage: "Konfigurasi API Duitku belum lengkap di Vercel" }, { status: 500 });
    }

    // WAJIB: Amount harus integer (angka bulat) tanpa titik/koma
    const amountInt = Math.floor(Number(amount));
    
    // RUMUS SIGNATURE: merchantCode + orderId + amount + apiKey
    const signature = md5(merchantCode + orderId + amountInt + apiKey);

    const payload = {
      merchantCode,
      paymentAmount: amountInt,
      merchantOrderId: orderId.toString(),
      productDetails,
      email,
      customerVaName: customerName,
      signature,
      callbackUrl: `https://warden-blond.vercel.app/api/callback`,
      returnUrl: `https://warden-blond.vercel.app/checkout/success`,
      expiryPeriod: 1440
    };

    const response = await fetch('https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    // Log ke Vercel untuk debug
    console.log("Payload yang dikirim:", payload);
    console.log("Respon Duitku:", result);

    if (response.ok && result.paymentUrl) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ 
        statusMessage: result.statusMessage || "Gagal mendapatkan link pembayaran",
        raw: result 
      }, { status: 400 });
    }
  } catch (error) {
    console.error("Internal Error:", error);
    return NextResponse.json({ statusMessage: "Terjadi kesalahan internal server" }, { status: 500 });
  }
}
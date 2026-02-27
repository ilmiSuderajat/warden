import { NextResponse } from 'next/server';
import md5 from 'md5';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, orderId, productDetails, customerName, email } = body;

    const merchantCode = process.env.DUITKU_MERCHANT_CODE!;
    const apiKey = process.env.DUITKU_API_KEY!;
    
    // RUMUS SIGNATURE DUITKU: merchantCode + orderId + amount + apiKey
    // Pastikan amount diubah menjadi string agar konsisten
    const signature = md5(merchantCode + orderId + String(amount) + apiKey);

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

    // PERBAIKAN: Isi parameter fetch dengan benar
    const response = await fetch('https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    console.log("Respon Duitku:", result); // Lihat di terminal/log vercel

    if (response.ok && result.paymentUrl) {
      return NextResponse.json(result);
    } else {
      // Biar muncul di alert browser kamu error detailnya
      return NextResponse.json({ 
        statusMessage: result.statusMessage || "Gagal dapet Payment URL",
        raw: result 
      }, { status: 400 });
    }
  } catch (error) {
    console.error("Error Duitku:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
import crypto from 'node:crypto';

export interface RazorpayConfigStatus {
  configured: boolean;
  mode: 'LIVE' | 'TEST_MODE';
  keyId: string | null;
}

export function getRazorpayConfigStatus(): RazorpayConfigStatus {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || null;
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || null;
  const configured = Boolean(keyId && keySecret);
  return {
    configured,
    mode: configured ? 'LIVE' : 'TEST_MODE',
    keyId: configured ? keyId : null,
  };
}

export async function createGatewayOrder(params: {
  amountInRupees: number;
  currency: string;
  receipt: string;
}): Promise<{
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  testMode: boolean;
  keyId: string | null;
}> {
  const amountPaise = Math.max(100, Math.round(params.amountInRupees * 100));
  const status = getRazorpayConfigStatus();

  if (status.configured && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    const auth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: params.currency || 'INR',
        receipt: params.receipt,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Razorpay order creation failed: ${errText}`);
    }

    const data = (await response.json()) as { id: string; amount: number; currency: string };
    return {
      razorpayOrderId: data.id,
      amountPaise: data.amount,
      currency: data.currency,
      testMode: false,
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  }

  // Test mode abstraction when Razorpay keys are not set in .env
  return {
    razorpayOrderId: `order_test_${crypto.randomBytes(6).toString('hex')}`,
    amountPaise,
    currency: params.currency || 'INR',
    testMode: true,
    keyId: null,
  };
}

export function verifyRazorpaySignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) {
    // Only valid for test-mode simulated verification if explicitly marked test_mode
    return params.razorpayOrderId.startsWith('order_test_') && params.razorpaySignature === 'test_verified';
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(params.razorpaySignature, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyWebhookSignature(rawBody: string, signatureHeader?: string): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!webhookSecret || !signatureHeader) return false;
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signatureHeader, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

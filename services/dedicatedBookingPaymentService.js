/**
 * Payment service for Dedicated Booking: pre-authorize (Stripe) and capture.
 * Stub when STRIPE_SECRET_KEY is not set.
 */

let stripe = null;
let stripeInit = null;
async function getStripe() {
  if (stripeInit !== null) return stripeInit;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    stripeInit = Promise.resolve(null);
    return stripeInit;
  }
  try {
    const mod = await import('stripe');
    stripe = mod.default(key);
    stripeInit = Promise.resolve(stripe);
  } catch (e) {
    console.warn('Stripe not installed or invalid key. Dedicated booking payment will be stubbed.');
    stripe = null;
    stripeInit = Promise.resolve(null);
  }
  return stripeInit;
}

const CURRENCY = process.env.DEDICATED_BOOKING_CURRENCY || 'sar';

/**
 * Create PaymentIntent (pre-authorize). Amount in smallest unit (e.g. halalas for SAR).
 * @param {number} amountTotal - total in main unit (e.g. SAR)
 * @param {string} bookingId
 * @param {string} [customerId]
 * @returns {{ paymentIntentId: string | null, clientSecret: string | null } }
 */
export async function createPaymentIntent(amountTotal, bookingId, customerId = null) {
  const stripeClient = await getStripe();
  if (!stripeClient) {
    return { paymentIntentId: null, clientSecret: null };
  }
  const amount = Math.round(amountTotal * 100);
  const params = {
    amount: Math.max(100, amount),
    currency: CURRENCY,
    automatic_payment_methods: { enabled: true },
    metadata: { bookingId },
    capture_method: 'manual',
  };
  if (customerId) params.customer = customerId;
  const pi = await stripeClient.paymentIntents.create(params);
  return { paymentIntentId: pi.id, clientSecret: pi.client_secret };
}

/**
 * Capture PaymentIntent.
 * @param {string} paymentIntentId
 */
export async function capturePaymentIntent(paymentIntentId) {
  const stripeClient = await getStripe();
  if (!stripeClient || !paymentIntentId) return;
  await stripeClient.paymentIntents.capture(paymentIntentId);
}

/**
 * Cancel (release) PaymentIntent.
 * @param {string} paymentIntentId
 */
export async function cancelPaymentIntent(paymentIntentId) {
  const stripeClient = await getStripe();
  if (!stripeClient || !paymentIntentId) return;
  await stripeClient.paymentIntents.cancel(paymentIntentId);
}

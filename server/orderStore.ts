import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { LicenseTierId } from '../src/data/products';
import { getProductById, calculateItemPrice, LICENSE_OPTIONS, STANDARD_LICENSE } from '../src/data/products';

export type PaymentMethodType = 'card' | 'mobile_money';
export type PaymentStatusType =
  | 'pending'
  | 'processing'
  | 'successful'
  | 'failed'
  | 'verification_required';
export type OrderStatusType =
  | 'pending_payment'
  | 'paid'
  | 'fulfilled'
  | 'payment_failed'
  | 'cancelled';

export interface OrderLineItemInput {
  productId: string;
  licenseTier: LicenseTierId;
}

export interface OrderLineItem {
  productId: string;
  productName: string;
  slug: string;
  licenseTier: LicenseTierId;
  licenseName: string;
  unitPrice: number;
  verifiedPageCount: number;
  verifiedFileCount: number;
  downloadToken: string;
  tokenExpiresAt: string; // ISO timestamp
  downloadCount: number;
}

export interface PaymentDetails {
  method: PaymentMethodType;
  provider: 'lipila';
  referenceId: string; // Unique Lipila transaction reference
  status: PaymentStatusType;
  currency: 'ZMW';
  amount: number;
  customerPhone?: string;
  cardRedirectionUrl?: string;
  externalTransactionId?: string;
  lastCheckedAt?: string;
  errorMessage?: string;
}

export interface OrderRecord {
  orderId: string;
  idempotencyKey: string;
  referenceId: string; // Lipila referenceId mapped 1:1
  customerEmail: string;
  customerName: string;
  items: OrderLineItem[];
  subtotal: number;
  total: number;
  currency: 'ZMW';
  orderStatus: OrderStatusType;
  paymentStatus: PaymentStatusType;
  paymentMethod?: PaymentMethodType;
  payment: PaymentDetails;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  customerCountry?: string;
  customerCity?: string;
  customerAddress?: string;
  customerZip?: string;
  confirmationEmailStatus?: 'pending' | 'sending' | 'sent' | 'failed';
  confirmationEmailMessageId?: string;
  confirmationEmailSentAt?: string;
  confirmationEmailAttempts?: number;
  confirmationEmailError?: string;
  lastEmailAttemptAt?: string;
}

const SECRET_SIGNING_KEY =
  process.env.DOWNLOAD_TOKEN_SECRET || 'tkd-fallback-signing-key';
const DATA_FILE = path.resolve(process.cwd(), 'server', '.orders-store.json');
const TMP_DATA_FILE = path.resolve(
  process.env.TMPDIR || process.env.TEMP || '/tmp',
  '.tkd-orders-store.json'
);

// In-memory cache synced with disk for atomic operations & persistence
const ordersById = new Map<string, OrderRecord>();
const ordersByReferenceId = new Map<string, string>();
const ordersByIdempotencyKey = new Map<string, string>();

function loadOrdersFromPath(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed: OrderRecord[] = JSON.parse(raw);
      for (const order of parsed) {
        ordersById.set(order.orderId, order);
        if (order.referenceId) {
          ordersByReferenceId.set(order.referenceId, order.orderId);
        }
        if (order.payment?.externalTransactionId) {
          ordersByReferenceId.set(order.payment.externalTransactionId, order.orderId);
        }
        if (order.payment?.referenceId) {
          ordersByReferenceId.set(order.payment.referenceId, order.orderId);
        }
        if (order.idempotencyKey) {
          ordersByIdempotencyKey.set(order.idempotencyKey, order.orderId);
        }
      }
    }
  } catch {
    // Ignore read errors
  }
}

function loadPersistedOrders() {
  loadOrdersFromPath(DATA_FILE);
  if (DATA_FILE !== TMP_DATA_FILE) {
    loadOrdersFromPath(TMP_DATA_FILE);
  }
}

function persistOrders() {
  const list = Array.from(ordersById.values());
  const serialized = JSON.stringify(list, null, 2);

  // Attempt writing to primary location (local dev / persistent server)
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, serialized, 'utf-8');
    return;
  } catch {
    // Falls through to writable serverless /tmp directory
  }

  // Fallback to /tmp in serverless environments (Netlify / AWS Lambda)
  try {
    const tmpDir = path.dirname(TMP_DATA_FILE);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    fs.writeFileSync(TMP_DATA_FILE, serialized, 'utf-8');
  } catch {
    // In-memory map remains authoritative for the lifecycle of the instance
  }
}

loadPersistedOrders();

export function createSignedDownloadToken(
  orderId: string,
  productId: string,
  licenseTier: LicenseTierId,
  expiresAtMs: number
): string {
  const payload = `${orderId}:${productId}:${licenseTier}:${expiresAtMs}`;
  const signature = crypto
    .createHmac('sha256', SECRET_SIGNING_KEY)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

export function verifySignedDownloadToken(token: string): {
  valid: boolean;
  reason?: 'expired' | 'invalid_signature' | 'malformed' | 'order_not_paid';
  orderId?: string;
  productId?: string;
  licenseTier?: LicenseTierId;
  order?: OrderRecord;
} {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 5) {
      return { valid: false, reason: 'malformed' };
    }
    const [orderId, productId, licenseTierRaw, expiresAtStr, providedSig] = parts;
    const expiresAtMs = Number(expiresAtStr);
    if (!orderId || !productId || Number.isNaN(expiresAtMs)) {
      return { valid: false, reason: 'malformed' };
    }

    const expectedPayload = `${orderId}:${productId}:${licenseTierRaw}:${expiresAtMs}`;
    const expectedSig = crypto
      .createHmac('sha256', SECRET_SIGNING_KEY)
      .update(expectedPayload)
      .digest('hex');

    if (providedSig !== expectedSig) {
      return { valid: false, reason: 'invalid_signature' };
    }

    if (Date.now() > expiresAtMs) {
      return { valid: false, reason: 'expired', orderId, productId };
    }

    const order = ordersById.get(orderId);
    if (!order || order.paymentStatus !== 'successful' || order.orderStatus !== 'paid') {
      return { valid: false, reason: 'order_not_paid', orderId, productId };
    }

    const hasEntitlement = order.items.some(item => item.productId === productId);
    if (!hasEntitlement) {
      return { valid: false, reason: 'invalid_signature', orderId, productId };
    }

    return {
      valid: true,
      orderId,
      productId,
      licenseTier: licenseTierRaw as LicenseTierId,
      order,
    };
  } catch {
    return { valid: false, reason: 'malformed' };
  }
}

export interface CreateOrderParams {
  idempotencyKey: string;
  customerEmail: string;
  customerName?: string;
  items: OrderLineItemInput[];
  paymentMethod: PaymentMethodType;
  customerPhone?: string;
  customerCountry?: string;
  customerCity?: string;
  customerAddress?: string;
  customerZip?: string;
}

/**
 * Creates an authoritative pending order BEFORE initiating collection with Lipila.
 * Guarantees that callbacks can immediately be matched to an existing order record.
 */
export function createPendingOrder(params: CreateOrderParams): {
  success: boolean;
  error?: string;
  order?: OrderRecord;
} {
  const email = (params.customerEmail || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      success: false,
      error: 'Please provide a valid email address for order confirmation and PDF delivery.',
    };
  }

  if (!params.items || !Array.isArray(params.items) || params.items.length === 0) {
    return { success: false, error: 'Your cart is empty. Please add at least one digital PDF bundle.' };
  }

  if (!params.idempotencyKey || typeof params.idempotencyKey !== 'string') {
    return { success: false, error: 'Missing transaction idempotency key.' };
  }

  // Idempotency check: return existing order if already submitted
  const existingOrderId = ordersByIdempotencyKey.get(params.idempotencyKey);
  if (existingOrderId) {
    const existingOrder = ordersById.get(existingOrderId);
    if (existingOrder) {
      return { success: true, order: existingOrder };
    }
  }

  // Deduplicate products (1 copy per bundle for digital downloads)
  const uniqueItemsMap = new Map<string, LicenseTierId>();
  for (const item of params.items) {
    const tier: LicenseTierId =
      item.licenseTier === 'commercial'
        ? 'commercial'
        : item.licenseTier === 'personal'
        ? 'personal'
        : 'standard';
    uniqueItemsMap.set(item.productId, tier);
  }

  const orderId = `TKD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  // Generate unique Lipila referenceId
  const referenceId = `LIP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const builtItems: OrderLineItem[] = [];
  let subtotal = 0;

  for (const [productId, licenseTier] of uniqueItemsMap.entries()) {
    const product = getProductById(productId);
    if (!product) {
      return { success: false, error: `Requested digital bundle (${productId}) does not exist.` };
    }

    const unitPrice = calculateItemPrice(product, licenseTier);
    const licenseInfo = LICENSE_OPTIONS[licenseTier] || STANDARD_LICENSE;
    subtotal = Math.round((subtotal + unitPrice) * 100) / 100;

    // Do NOT issue download tokens for pending orders
    builtItems.push({
      productId: product.id,
      productName: product.name,
      slug: product.slug,
      licenseTier,
      licenseName: licenseInfo.name,
      unitPrice,
      verifiedPageCount: product.verifiedPageCount,
      verifiedFileCount: product.verifiedFileCount,
      downloadToken: '', // only granted once payment is verified successful
      tokenExpiresAt: '',
      downloadCount: 0,
    });
  }

  const order: OrderRecord = {
    orderId,
    idempotencyKey: params.idempotencyKey,
    referenceId,
    customerEmail: email,
    customerName: (params.customerName || 'Valued Creator').trim(),
    items: builtItems,
    subtotal,
    total: subtotal,
    currency: 'ZMW',
    orderStatus: 'pending_payment',
    paymentStatus: 'pending',
    paymentMethod: params.paymentMethod,
    payment: {
      method: params.paymentMethod,
      provider: 'lipila',
      referenceId,
      status: 'pending',
      currency: 'ZMW',
      amount: subtotal,
      customerPhone: params.customerPhone?.trim(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customerCountry: params.customerCountry?.trim(),
    customerCity: params.customerCity?.trim(),
    customerAddress: params.customerAddress?.trim(),
    customerZip: params.customerZip?.trim(),
  };

  ordersById.set(orderId, order);
  ordersByReferenceId.set(referenceId, orderId);
  ordersByIdempotencyKey.set(params.idempotencyKey, orderId);
  persistOrders();

  return { success: true, order };
}

/**
 * Atomically marks an order as paid and issues signed 24h download tokens.
 * Only called after server-side payment verification (callback or check-status).
 */
export function markOrderAsPaid(
  referenceOrOrderId: string,
  externalTransactionId?: string
): OrderRecord | undefined {
  loadPersistedOrders();
  const clean = referenceOrOrderId.trim();
  let order = ordersById.get(clean);
  if (!order) {
    const orderId = ordersByReferenceId.get(clean);
    if (orderId) order = ordersById.get(orderId);
  }
  if (!order) {
    for (const o of ordersById.values()) {
      if (
        o.orderId === clean ||
        o.referenceId === clean ||
        o.payment?.externalTransactionId === clean ||
        o.payment?.referenceId === clean
      ) {
        order = o;
        break;
      }
    }
  }
  if (!order) return undefined;

  // Idempotency: if already paid, do not re-issue or mutate
  if (order.paymentStatus === 'successful' && order.orderStatus === 'paid') {
    return order;
  }

  const expiresAtMs = Date.now() + 1000 * 60 * 60 * 24; // 24-hour validity
  const expiresAtIso = new Date(expiresAtMs).toISOString();

  // Grant download tokens now that payment is confirmed
  order.items = order.items.map(item => ({
    ...item,
    downloadToken: createSignedDownloadToken(order.orderId, item.productId, item.licenseTier, expiresAtMs),
    tokenExpiresAt: expiresAtIso,
  }));

  order.orderStatus = 'paid';
  order.paymentStatus = 'successful';
  order.payment.status = 'successful';
  if (externalTransactionId) {
    order.payment.externalTransactionId = externalTransactionId;
    ordersByReferenceId.set(externalTransactionId.trim(), order.orderId);
  }
  order.updatedAt = new Date().toISOString();
  order.completedAt = new Date().toISOString();

  ordersById.set(order.orderId, order);
  persistOrders();
  return order;
}

/**
 * Mark an order payment as failed. Never grants download tokens.
 */
export function markOrderAsFailed(referenceOrOrderId: string, reason?: string): OrderRecord | undefined {
  loadPersistedOrders();
  const clean = referenceOrOrderId.trim();
  let order = ordersById.get(clean);
  if (!order) {
    const orderId = ordersByReferenceId.get(clean);
    if (orderId) order = ordersById.get(orderId);
  }
  if (!order) {
    for (const o of ordersById.values()) {
      if (
        o.orderId === clean ||
        o.referenceId === clean ||
        o.payment?.externalTransactionId === clean ||
        o.payment?.referenceId === clean
      ) {
        order = o;
        break;
      }
    }
  }
  if (!order) return undefined;

  // Stale event protection: do not downgrade an already paid order
  if (order.paymentStatus === 'successful' || order.orderStatus === 'paid') {
    return order;
  }

  order.orderStatus = 'payment_failed';
  order.paymentStatus = 'failed';
  order.payment.status = 'failed';
  order.payment.errorMessage = reason || 'Payment authorization failed or was declined';
  order.updatedAt = new Date().toISOString();

  ordersById.set(order.orderId, order);
  persistOrders();
  return order;
}

/**
 * Store Card Redirection URL returned by Lipila
 */
export function setOrderCardRedirectionUrl(
  orderId: string,
  cardRedirectionUrl: string
): OrderRecord | undefined {
  loadPersistedOrders();
  const order = ordersById.get(orderId);
  if (!order) return undefined;
  order.payment.cardRedirectionUrl = cardRedirectionUrl;
  order.payment.status = 'processing';
  order.updatedAt = new Date().toISOString();
  ordersById.set(orderId, order);
  persistOrders();
  return order;
}

/**
 * Link an external gateway transaction reference (e.g. LPLXC-...) to an order
 */
export function setOrderProviderReference(
  orderId: string,
  providerReference: string
): OrderRecord | undefined {
  loadPersistedOrders();
  const order = ordersById.get(orderId.trim());
  if (!order) return undefined;
  const cleanRef = providerReference.trim();
  if (cleanRef) {
    order.payment.externalTransactionId = cleanRef;
    ordersByReferenceId.set(cleanRef, order.orderId);
    order.updatedAt = new Date().toISOString();
    ordersById.set(order.orderId, order);
    persistOrders();
  }
  return order;
}

/**
 * Reset a pending or failed order for payment retry (card or mobile money).
 * Generates a fresh provider referenceId for Lipila and maps it immediately.
 * Never modifies an order that is already paid.
 */
export function prepareOrderForPaymentRetry(
  orderId: string,
  newMethod?: PaymentMethodType
): OrderRecord | undefined {
  loadPersistedOrders();
  const clean = orderId.trim();
  let order = ordersById.get(clean);
  if (!order) {
    const foundId = ordersByReferenceId.get(clean);
    if (foundId) order = ordersById.get(foundId);
  }
  if (!order) return undefined;

  // Never downgrade or mutate an already paid order
  if (order.orderStatus === 'paid' && order.paymentStatus === 'successful') {
    return order;
  }

  // Generate fresh referenceId for this attempt
  const newRef = `LIP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  order.referenceId = newRef;
  order.orderStatus = 'pending_payment';
  order.paymentStatus = 'pending';
  if (newMethod) {
    order.paymentMethod = newMethod;
    order.payment.method = newMethod;
  }
  order.payment.referenceId = newRef;
  order.payment.status = 'pending';
  order.payment.errorMessage = undefined;
  order.payment.cardRedirectionUrl = undefined;
  order.updatedAt = new Date().toISOString();

  ordersById.set(order.orderId, order);
  ordersByReferenceId.set(newRef, order.orderId);
  persistOrders();
  return order;
}

/**
 * Rehydrate a pending order into memory & disk cache for serverless container resilience
 */
export function rehydrateOrder(incoming: OrderRecord): OrderRecord {
  loadPersistedOrders();
  const existing = ordersById.get(incoming.orderId);
  if (existing) {
    return existing;
  }
  ordersById.set(incoming.orderId, incoming);
  if (incoming.referenceId) {
    ordersByReferenceId.set(incoming.referenceId, incoming.orderId);
  }
  if (incoming.payment?.externalTransactionId) {
    ordersByReferenceId.set(incoming.payment.externalTransactionId, incoming.orderId);
  }
  if (incoming.payment?.referenceId) {
    ordersByReferenceId.set(incoming.payment.referenceId, incoming.orderId);
  }
  if (incoming.idempotencyKey) {
    ordersByIdempotencyKey.set(incoming.idempotencyKey, incoming.orderId);
  }
  persistOrders();
  return incoming;
}

export function getOrderByOrderId(orderId: string): OrderRecord | undefined {
  loadPersistedOrders();
  const clean = orderId.trim();
  const direct = ordersById.get(clean);
  if (direct) return direct;

  const byRef = ordersByReferenceId.get(clean);
  if (byRef) return ordersById.get(byRef);

  for (const o of ordersById.values()) {
    if (
      o.orderId === clean ||
      o.referenceId === clean ||
      o.payment?.externalTransactionId === clean
    ) {
      return o;
    }
  }
  return undefined;
}

export function getOrderByReferenceId(referenceId: string): OrderRecord | undefined {
  loadPersistedOrders();
  const clean = referenceId.trim();
  if (!clean) return undefined;

  const orderId = ordersByReferenceId.get(clean);
  if (orderId) {
    const order = ordersById.get(orderId);
    if (order) return order;
  }

  const byOrderId = ordersById.get(clean);
  if (byOrderId) return byOrderId;

  for (const o of ordersById.values()) {
    if (
      o.referenceId === clean ||
      o.orderId === clean ||
      o.payment?.externalTransactionId === clean ||
      o.payment?.referenceId === clean
    ) {
      ordersByReferenceId.set(clean, o.orderId);
      return o;
    }
  }

  return undefined;
}

export function getOrderByIdAndEmail(orderId: string, email?: string): OrderRecord | undefined {
  loadPersistedOrders();
  const order = getOrderByOrderId(orderId);
  if (!order || order.paymentStatus !== 'successful') return undefined;
  if (email && order.customerEmail.toLowerCase() !== email.trim().toLowerCase()) {
    return undefined;
  }
  return order;
}

export function getPaidOrdersByEmail(email: string): OrderRecord[] {
  loadPersistedOrders();
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];
  const results: OrderRecord[] = [];
  for (const order of ordersById.values()) {
    if (order.paymentStatus === 'successful' && order.customerEmail.toLowerCase() === normalized) {
      results.push(order);
    }
  }
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function refreshOrderDownloadTokens(orderId: string, email: string): OrderRecord | undefined {
  const order = getOrderByIdAndEmail(orderId, email);
  if (!order) return undefined;

  const newExpiresAtMs = Date.now() + 1000 * 60 * 60 * 24;
  order.items = order.items.map(item => ({
    ...item,
    downloadToken: createSignedDownloadToken(order.orderId, item.productId, item.licenseTier, newExpiresAtMs),
    tokenExpiresAt: new Date(newExpiresAtMs).toISOString(),
  }));

  ordersById.set(order.orderId, order);
  persistOrders();
  return order;
}

export function incrementItemDownloadCount(orderId: string, productId: string) {
  const order = ordersById.get(orderId);
  if (!order) return;
  const item = order.items.find(i => i.productId === productId);
  if (item) {
    item.downloadCount += 1;
    persistOrders();
  }
}

/**
 * Atomically checks and claims sending rights for an order confirmation email.
 * Guarantees that concurrent callbacks or webhook replays will not send duplicate emails.
 */
export function claimEmailSendingRights(orderId: string, isManualResend = false): boolean {
  const order = ordersById.get(orderId);
  if (!order) return false;

  // Only paid orders are eligible for confirmation emails
  if (order.paymentStatus !== 'successful' || order.orderStatus !== 'paid') {
    return false;
  }

  // If already successfully sent and not an explicit resend, do not send again
  if (order.confirmationEmailStatus === 'sent' && !isManualResend) {
    return false;
  }

  // Prevent race condition if another thread or request is currently sending
  if (order.confirmationEmailStatus === 'sending') {
    // If it's been sending for less than 30 seconds, treat as locked
    const lastAttempt = order.lastEmailAttemptAt ? new Date(order.lastEmailAttemptAt).getTime() : 0;
    if (Date.now() - lastAttempt < 30_000) {
      return false;
    }
  }

  // Rate limiting for manual resend: at most once every 60 seconds
  if (isManualResend && order.lastEmailAttemptAt) {
    const elapsed = Date.now() - new Date(order.lastEmailAttemptAt).getTime();
    if (elapsed < 60_000) {
      return false;
    }
  }

  order.confirmationEmailStatus = 'sending';
  order.confirmationEmailAttempts = (order.confirmationEmailAttempts || 0) + 1;
  order.lastEmailAttemptAt = new Date().toISOString();
  order.updatedAt = new Date().toISOString();
  ordersById.set(orderId, order);
  persistOrders();

  return true;
}

/**
 * Records successful dispatch of confirmation email with provider messageId.
 */
export function recordEmailSendSuccess(orderId: string, messageId: string): void {
  const order = ordersById.get(orderId);
  if (!order) return;

  const now = new Date().toISOString();
  order.confirmationEmailStatus = 'sent';
  order.confirmationEmailMessageId = messageId;
  order.confirmationEmailSentAt = now;
  order.lastEmailAttemptAt = order.lastEmailAttemptAt || now;
  order.confirmationEmailError = undefined;
  order.updatedAt = now;
  ordersById.set(orderId, order);
  persistOrders();
}

/**
 * Records failed email dispatch attempt.
 */
export function recordEmailSendFailure(orderId: string, error: string): void {
  const order = ordersById.get(orderId);
  if (!order) return;

  order.confirmationEmailStatus = 'failed';
  order.confirmationEmailError = error;
  order.updatedAt = new Date().toISOString();
  ordersById.set(orderId, order);
  persistOrders();
}


import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Trash2,
  ArrowLeft,
  AlertCircle,
  FileText,
  CheckCircle2,
  Loader2,
  CreditCard,
  Smartphone,
  Info,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../data/products';
import {
  createCheckoutOrder,
  initiateLipilaCardPayment,
  initiateLipilaMobileMoneyPayment,
  checkOrderStatus,
} from '../services/api';
import type { PaymentMethodType } from '../../server/orderStore';

export const CheckoutPage: React.FC = () => {
  const { items, itemCount, subtotal, total, removeItem, clearCart } = useCart();
  const navigate = useNavigate();

  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('card');
  const [mobileNumber, setMobileNumber] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  // Submission & status state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [pendingReferenceId, setPendingReferenceId] = useState<string | null>(null);
  const [pendingPromptNotice, setPendingPromptNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollTimeoutReached, setPollTimeoutReached] = useState(false);
  const [isManualChecking, setIsManualChecking] = useState(false);
  const pollCountRef = useRef(0);
  const pollInFlightRef = useRef(false);

  // Generate an idempotency key per cart state & email
  const idempotencyKey = useMemo(() => {
    const itemSig = items.map(i => `${i.product.id}:${i.licenseTier}`).join('|');
    return `idem-${btoa(
      encodeURIComponent(`${customerEmail.trim().toLowerCase()}-${itemSig}-${paymentMethod}`)
    ).slice(0, 24)}-${Date.now()}`;
  }, [customerEmail, items, paymentMethod]);

  // Active polling for mobile-money / pending card payment completion
  useEffect(() => {
    if (!pendingOrderId || pollTimeoutReached) return;

    let isMounted = true;
    pollCountRef.current = 0;

    const interval = setInterval(async () => {
      // Guard against overlapping poll requests
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      pollCountRef.current += 1;

      // Timeout after 45 attempts (~2.5 minutes)
      if (pollCountRef.current > 45) {
        if (isMounted) {
          setPollTimeoutReached(true);
        }
        clearInterval(interval);
        pollInFlightRef.current = false;
        return;
      }

      try {
        const res = await checkOrderStatus(pendingOrderId);
        if (!isMounted) return;

        const pStatus = res.paymentStatus || res.order?.paymentStatus;
        const oStatus = res.orderStatus || res.order?.orderStatus;

        if (pStatus === 'successful' || oStatus === 'paid') {
          clearInterval(interval);
          clearCart();
          const targetOrder = res.order;
          navigate(
            `/order-confirmation/${encodeURIComponent(pendingOrderId)}?email=${encodeURIComponent(
              targetOrder?.customerEmail || customerEmail
            )}`,
            { state: { order: targetOrder } }
          );
        } else if (pStatus === 'failed' || oStatus === 'payment_failed') {
          clearInterval(interval);
          setIsSubmitting(false);
          setPendingOrderId(null);
          setPendingPromptNotice(null);
          setPollTimeoutReached(false);

          const reasonCode = res.failureReason || '';
          const msg = res.message || res.order?.payment?.errorMessage || '';

          if (
            reasonCode === 'INSUFFICIENT_FUNDS' ||
            msg.toLowerCase().includes('insufficient') ||
            msg.toLowerCase().includes('balance') ||
            msg.toLowerCase().includes('funds')
          ) {
            setErrorMessage(
              'Payment failed — insufficient mobile money balance. Please top up your Airtel Money wallet and try again.'
            );
          } else if (
            reasonCode === 'PAYMENT_CANCELLED' ||
            msg.toLowerCase().includes('cancel') ||
            msg.toLowerCase().includes('reject') ||
            msg.toLowerCase().includes('decline')
          ) {
            setErrorMessage('Payment was declined or cancelled on your mobile device.');
          } else if (
            reasonCode === 'PAYMENT_EXPIRED' ||
            msg.toLowerCase().includes('expire') ||
            msg.toLowerCase().includes('time')
          ) {
            setErrorMessage('Payment authorization prompt timed out. Please try again.');
          } else {
            setErrorMessage(
              msg || 'Payment was declined or cancelled. No charges were made and no files were released.'
            );
          }
        }
      } catch {
        // Continue polling
      } finally {
        pollInFlightRef.current = false;
      }
    }, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
      pollInFlightRef.current = false;
    };
  }, [pendingOrderId, pollTimeoutReached, clearCart, navigate, customerEmail]);

  const handleManualCheckStatus = async () => {
    if (!pendingOrderId) return;
    setIsManualChecking(true);
    try {
      const res = await checkOrderStatus(pendingOrderId);
      const pStatus = res.paymentStatus || res.order?.paymentStatus;
      const oStatus = res.orderStatus || res.order?.orderStatus;

      if (pStatus === 'successful' || oStatus === 'paid') {
        clearCart();
        const targetOrder = res.order;
        navigate(
          `/order-confirmation/${encodeURIComponent(pendingOrderId)}?email=${encodeURIComponent(
            targetOrder?.customerEmail || customerEmail
          )}`,
          { state: { order: targetOrder } }
        );
        return;
      }

      if (pStatus === 'failed' || oStatus === 'payment_failed') {
        setPendingOrderId(null);
        setPendingPromptNotice(null);
        setPollTimeoutReached(false);

        const reasonCode = res.failureReason || '';
        const msg = res.message || res.order?.payment?.errorMessage || '';

        if (
          reasonCode === 'INSUFFICIENT_FUNDS' ||
          msg.toLowerCase().includes('insufficient') ||
          msg.toLowerCase().includes('balance') ||
          msg.toLowerCase().includes('funds')
        ) {
          setErrorMessage(
            'Payment failed — insufficient mobile money balance. Please top up your Airtel Money wallet and try again.'
          );
        } else {
          setErrorMessage(msg || 'Payment authorization failed or was declined.');
        }
        return;
      }

      setPendingPromptNotice('Status check complete: payment is still awaiting approval on your phone.');
    } catch {
      setErrorMessage('Unable to reach payment verification server. Please try again.');
    } finally {
      setIsManualChecking(false);
    }
  };

  const handleCancelPendingPayment = () => {
    setPendingOrderId(null);
    setPendingPromptNotice(null);
    setPollTimeoutReached(false);
    setIsSubmitting(false);
  };

  const sanitizeErrorMessage = (msg?: string): string => {
    if (!msg) return 'Unable to complete transaction. Please try again.';
    if (
      msg.includes('Unexpected token') ||
      msg.includes('<!doctype') ||
      msg.includes('<html') ||
      msg.includes('is not valid JSON') ||
      msg.includes('SPA fallback')
    ) {
      return 'The payment gateway is temporarily unreachable. Please check your connection or try again shortly.';
    }
    return msg;
  };

  const handleStartPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = customerEmail.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address so we can deliver your PDF download links.');
      return;
    }

    if (paymentMethod === 'mobile_money') {
      const cleanPhone = mobileNumber.replace(/[\s+-]/g, '');
      if (!cleanPhone || cleanPhone.length < 9) {
        setErrorMessage(
          'Please enter a valid mobile money number (e.g. 097xxxxxxx or 26097xxxxxxx) to receive the payment prompt.'
        );
        return;
      }
    }

    if (!agreedToTerms) {
      setErrorMessage('Please confirm that you understand this is a digital PDF download purchase.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Your cart is empty.');
      return;
    }

    setIsSubmitting(true);
    setPendingPromptNotice(null);

    try {
      // Step 1: Create pending order in backend
      const orderRes = await createCheckoutOrder({
        idempotencyKey,
        customerEmail: trimmedEmail,
        customerName: customerName.trim() || 'Valued Creator',
        items: items.map(i => ({
          productId: i.product.id,
          licenseTier: i.licenseTier,
        })),
        paymentMethod,
        customerPhone: paymentMethod === 'mobile_money' ? mobileNumber : undefined,
      });

      if (!orderRes.success || !orderRes.order) {
        setErrorMessage(sanitizeErrorMessage(orderRes.error));
        setIsSubmitting(false);
        return;
      }

      const order = orderRes.order;

      // Step 2A: Card Payment via Lipila
      if (paymentMethod === 'card') {
        const cardRes = await initiateLipilaCardPayment(order.orderId);
        if (!cardRes.success || !cardRes.cardRedirectionUrl) {
          setErrorMessage(
            sanitizeErrorMessage(cardRes.error || 'Failed to initialize card payment with Lipila. Please try again.')
          );
          setIsSubmitting(false);
          return;
        }

        // If in simulated sandbox mode, simulate redirect return
        if (cardRes.cardRedirectionUrl.includes('sandbox_card_redirect=true')) {
          setPendingOrderId(order.orderId);
          setPendingPromptNotice(
            'Sandbox Card Checkout active. Simulating secure payment verification...'
          );
          setTimeout(() => {
            clearCart();
            navigate(`/order-confirmation/${encodeURIComponent(order.orderId)}?email=${encodeURIComponent(order.customerEmail)}`);
          }, 2000);
          return;
        }

        // Redirect to Lipila's hosted checkout page for Visa/Mastercard/Amex
        window.location.href = cardRes.cardRedirectionUrl;
        return;
      }

      // Step 2B: Mobile Money Payment via Lipila
      if (paymentMethod === 'mobile_money') {
        const momoRes = await initiateLipilaMobileMoneyPayment(order.orderId, mobileNumber);
        setIsSubmitting(false); // Dispatched prompt! Clear connecting spinner!

        if (!momoRes.success) {
          setErrorMessage(
            sanitizeErrorMessage(momoRes.error || 'Failed to send mobile money prompt. Please check your number.')
          );
          return;
        }

        setPendingOrderId(order.orderId);
        if (momoRes.providerReference || momoRes.referenceId) {
          setPendingReferenceId(momoRes.providerReference || momoRes.referenceId || null);
        }
        setPendingPromptNotice(
          momoRes.message ||
            'Payment request sent to your mobile phone. Please check your phone now and enter your PIN to approve the transaction.'
        );
        pollCountRef.current = 0;
        setPollTimeoutReached(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setErrorMessage(sanitizeErrorMessage(msg));
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl p-10 border border-charcoal/10 shadow-editorial">
          <div className="w-12 h-12 rounded-full bg-ivory border border-charcoal/10 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-brandBlue" />
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-charcoal">
            Your digital cart is empty
          </h1>
          <p className="text-sm text-charcoal/70 mt-2 max-w-md mx-auto">
            Add one or more PDF design bundles to your cart before proceeding to digital checkout.
          </p>
          <Link
            to="/shop"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-charcoal px-6 py-3 text-sm font-semibold text-white hover:bg-brandBlue-dark transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Shop</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="mb-8">
        <Link
          to="/shop"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-charcoal/75 hover:text-charcoal"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Continue Shopping</span>
        </Link>
        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-charcoal mt-2">
          Digital Checkout &amp; Instant Delivery
        </h1>
        <p className="text-sm text-charcoal/75 mt-1">
          Settlement in <strong>Zambian Kwacha (ZMW)</strong>. Pay securely via Lipila using Visa, Mastercard, American Express, or Mobile Money.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Delivery Email & Lipila Payment Gateway Selection */}
        <form onSubmit={handleStartPayment} className="lg:col-span-7 space-y-6" noValidate>
          {/* Step 1: Digital Delivery Information */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-charcoal/15 shadow-editorial space-y-5">
            <div className="flex items-center justify-between border-b border-softGrey pb-3">
              <h2 className="font-heading font-bold text-lg text-charcoal">
                1. Digital Delivery Information (Guest Checkout)
              </h2>
              <span className="text-xs font-semibold text-brandBlue-dark bg-brandBlue-light px-2.5 py-1 rounded">
                Instant Delivery
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="checkout-email"
                  className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5"
                >
                  Email Address for PDF Delivery &amp; Order Receipt *
                </label>
                <input
                  id="checkout-email"
                  type="email"
                  required
                  disabled={isSubmitting}
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-charcoal/25 bg-ivory px-4 py-3 text-sm text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-brandBlue focus:bg-white disabled:opacity-60"
                />
                <p className="text-[11px] text-charcoal/65 mt-1.5">
                  Your order confirmation and lifetime download lookup are linked to this email address.
                </p>
              </div>

              <div>
                <label
                  htmlFor="checkout-name"
                  className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5"
                >
                  Your Name or Studio Name (Printed on Licence Certificate)
                </label>
                <input
                  id="checkout-name"
                  type="text"
                  disabled={isSubmitting}
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="e.g., Alex Banda / Studio Creatives"
                  className="w-full rounded-xl border border-charcoal/25 bg-ivory px-4 py-3 text-sm text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-brandBlue focus:bg-white disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Lipila Payment Method Selection */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-charcoal/15 shadow-editorial space-y-5">
            <div className="flex items-center justify-between border-b border-softGrey pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-brandBlue" />
                <h2 className="font-heading font-bold text-lg text-charcoal">
                  2. Payment Method (Powered by Lipila)
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-charcoal/70 bg-ivory px-2 py-0.5 rounded border border-charcoal/10">
                <Lock className="w-3 h-3 text-brandBlue" />
                SSL Encrypted
              </span>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-xs font-bold uppercase tracking-wider text-charcoal mb-2">
                Select your payment method:
              </legend>

              {/* Card Option (Visa, Mastercard, Amex via Lipila Hosted Checkout) */}
              <label
                className={`flex items-start gap-3.5 rounded-xl p-4 border cursor-pointer transition-all ${
                  paymentMethod === 'card'
                    ? 'bg-brandBlue-light/60 border-brandBlue ring-2 ring-brandBlue/20'
                    : 'bg-ivory/60 border-charcoal/15 hover:bg-ivory'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="card"
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                  disabled={isSubmitting}
                  className="mt-1"
                />
                <div className="flex-1 text-xs sm:text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-heading font-bold text-charcoal text-sm sm:text-base">
                      Debit / Credit Card
                    </span>
                    <span className="text-[11px] font-semibold tracking-wider text-charcoal/70 uppercase">
                      Visa · Mastercard · Amex
                    </span>
                  </div>
                  <p className="text-charcoal/75 text-xs mt-1 leading-relaxed">
                    You will be redirected to Lipila’s secure hosted checkout page to enter your card details. We never see or store your card information.
                  </p>
                </div>
              </label>

              {/* Mobile Money Option (Airtel, MTN, Zamtel via Lipila) */}
              <label
                className={`flex items-start gap-3.5 rounded-xl p-4 border cursor-pointer transition-all ${
                  paymentMethod === 'mobile_money'
                    ? 'bg-brandBlue-light/60 border-brandBlue ring-2 ring-brandBlue/20'
                    : 'bg-ivory/60 border-charcoal/15 hover:bg-ivory'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="mobile_money"
                  checked={paymentMethod === 'mobile_money'}
                  onChange={() => setPaymentMethod('mobile_money')}
                  disabled={isSubmitting}
                  className="mt-1"
                />
                <div className="flex-1 text-xs sm:text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-heading font-bold text-charcoal text-sm sm:text-base flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-brandBlue-dark" />
                      Mobile Money
                    </span>
                    <span className="text-[11px] font-semibold tracking-wider text-charcoal/70 uppercase">
                      Airtel · MTN · Zamtel
                    </span>
                  </div>
                  <p className="text-charcoal/75 text-xs mt-1 leading-relaxed">
                    Enter your mobile money number below. A payment prompt will be pushed straight to your handset for PIN authorization.
                  </p>
                </div>
              </label>
            </fieldset>

            {/* Mobile Money Number Field (rendered when Mobile Money is selected) */}
            {paymentMethod === 'mobile_money' && (
              <div className="rounded-xl bg-ivory p-4 border border-brandBlue/30 space-y-2 mt-3">
                <label
                  htmlFor="checkout-phone"
                  className="block text-xs font-bold uppercase tracking-wider text-charcoal"
                >
                  Mobile Money Account Number *
                </label>
                <div className="relative">
                  <input
                    id="checkout-phone"
                    type="tel"
                    required
                    disabled={isSubmitting}
                    value={mobileNumber}
                    onChange={e => setMobileNumber(e.target.value)}
                    placeholder="e.g. 0971234567 or 260971234567"
                    className="w-full rounded-xl border border-charcoal/25 bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-charcoal/40 font-mono focus:outline-none focus:ring-2 focus:ring-brandBlue disabled:opacity-60"
                  />
                </div>
                <p className="text-[11px] text-charcoal/65">
                  Supported networks: Airtel Money, MTN Mobile Money, Zamtel Kwacha.
                </p>
              </div>
            )}

            {/* Terms Checkbox */}
            <label className="flex items-start gap-2.5 pt-2 cursor-pointer text-xs text-charcoal/80">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={e => setAgreedToTerms(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 rounded border-charcoal/30"
              />
              <span>
                I understand that this purchase is for <strong>digital PDF files only</strong> (instant download; no physical shipping) and I agree to the licence terms.
              </span>
            </label>

            {/* Pending Notice / Phone Prompt Screen */}
            {pendingPromptNotice && (
              <div
                role="status"
                className="rounded-xl p-4 sm:p-5 bg-amber-50 border border-amber-200 text-charcoal text-xs sm:text-sm flex flex-col gap-3 shadow-xs"
              >
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-1">
                    <p className="font-heading font-bold text-amber-900 text-sm">
                      Awaiting Payment Authorization...
                    </p>
                    <p className="text-amber-800 leading-relaxed">{pendingPromptNotice}</p>
                    {pendingReferenceId && (
                      <p className="text-[11px] text-amber-700 font-mono pt-0.5">
                        Gateway Ref: {pendingReferenceId}
                      </p>
                    )}
                  </div>
                </div>

                {pollTimeoutReached ? (
                  <div className="border-t border-amber-200/80 pt-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-900">
                      Payment authorization is taking longer than usual. If you already entered your PIN and approved the prompt on your phone, click below:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleManualCheckStatus}
                        disabled={isManualChecking}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-charcoal text-white font-semibold text-xs hover:bg-brandBlue-dark transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isManualChecking ? 'animate-spin' : ''}`} />
                        <span>{isManualChecking ? 'Checking...' : 'Check Status Now'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelPendingPayment}
                        className="px-3.5 py-2 rounded-lg bg-white border border-charcoal/20 text-charcoal font-medium text-xs hover:bg-softGrey transition-colors"
                      >
                        Cancel & Try Again
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between border-t border-amber-200/60 pt-2.5 text-[11px] text-amber-800">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                      Checking payment status automatically...
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelPendingPayment}
                      className="underline font-medium hover:text-amber-950 transition-colors"
                    >
                      Cancel & Retry
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Error Message Alert */}
            {errorMessage && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 border border-red-200 p-4 sm:p-5 flex flex-col gap-2.5 text-xs sm:text-sm text-red-900 shadow-xs"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-heading font-bold text-red-900 text-sm">Payment Unsuccessful</p>
                    <p className="leading-relaxed text-red-800">{errorMessage}</p>
                  </div>
                </div>

                {errorMessage.toLowerCase().includes('insufficient') && (
                  <div className="bg-white/80 rounded-lg p-3 border border-red-200 text-xs text-charcoal/80 mt-1 space-y-1">
                    <p className="font-semibold text-red-950">Next steps to complete your purchase:</p>
                    <ul className="list-disc list-inside space-y-1 text-charcoal/70 pl-0.5">
                      <li>Top up your Airtel Money account via your bank or mobile agent.</li>
                      <li>Ensure your wallet balance covers the full order total of <strong>{formatPrice(total)}</strong>.</li>
                      <li>Click &ldquo;Pay with Lipila&rdquo; below once your account has been credited.</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Pay Now Button */}
            <button
              type="submit"
              disabled={isSubmitting || Boolean(pendingOrderId && !pollTimeoutReached)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-charcoal px-6 py-4 text-sm sm:text-base font-semibold text-white hover:bg-brandBlue-dark disabled:opacity-60 transition-colors shadow-editorial active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-brandBlue" />
                  <span>Connecting to Lipila Gateway...</span>
                </>
              ) : pendingOrderId ? (
                <>
                  <Smartphone className="w-5 h-5 text-amber-400 animate-pulse" />
                  <span>Awaiting Mobile Approval...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 text-brandBlue" />
                  <span>
                    Pay with Lipila — {formatPrice(total)}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Right Column: Order Summary & Licence Controls */}
        <aside className="lg:col-span-5 bg-white rounded-2xl p-6 sm:p-7 border border-charcoal/15 shadow-editorial space-y-5 lg:sticky lg:top-24">
          <div className="flex items-center justify-between border-b border-softGrey pb-3">
            <h2 className="font-heading font-bold text-lg text-charcoal">
              Order Summary ({itemCount} {itemCount === 1 ? 'Bundle' : 'Bundles'})
            </h2>
            <span className="text-xs font-medium text-charcoal/65">Instant Delivery</span>
          </div>

          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {items.map(item => (
              <div
                key={item.product.id}
                className="rounded-xl bg-ivory p-4 border border-charcoal/10 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brandBlue-dark">
                      {item.product.verifiedPageCount} Pages · {item.product.verifiedFileCount} PDFs
                    </span>
                    <h3 className="font-heading font-bold text-sm text-charcoal">
                      {item.product.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.product.id)}
                    disabled={isSubmitting}
                    className="p-1 text-charcoal/50 hover:text-red-600 transition-colors disabled:opacity-50"
                    aria-label={`Remove ${item.product.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-charcoal/10 text-xs">
                  <span className="font-semibold text-brandBlue-dark">Standard Commercial Licence</span>
                  <span className="font-heading font-extrabold text-sm text-charcoal">
                    {formatPrice(item.unitPrice)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-softGrey pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-charcoal/75">
              <span>Subtotal</span>
              <span className="font-semibold text-charcoal">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-charcoal/65">
              <span>Instant Digital Delivery</span>
              <span className="font-semibold text-brandBlue-dark">FREE</span>
            </div>
            <div className="pt-2 border-t border-softGrey flex justify-between items-baseline">
              <span className="font-heading font-bold text-base text-charcoal">Total Due</span>
              <span className="font-heading font-extrabold text-2xl text-charcoal">
                {formatPrice(total)}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-ivory p-3.5 border border-charcoal/10 space-y-1.5 text-xs text-charcoal/80">
            <div className="flex items-center gap-1.5 font-bold text-charcoal">
              <CheckCircle2 className="w-4 h-4 text-brandBlue-dark" />
              <span>Lipila Verified Digital Delivery:</span>
            </div>
            <p className="leading-relaxed">
              Once Lipila verifies your transaction as successful, your order is instantly unlocked with signed 24-hour PDF download links and lifetime lookup access.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

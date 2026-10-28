import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useLocation, Link } from 'react-router-dom';
import {
  CheckCircle2,
  Download,
  FileText,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  XCircle,
  ArrowRight,
  Mail,
  Clock,
} from 'lucide-react';
import type { OrderRecord, OrderLineItem } from '../../server/orderStore';
import { getProductById } from '../data/products';
import {
  checkOrderStatus,
  lookupCustomerOrders,
  triggerProtectedPdfDownload,
  refreshOrderTokensRequest,
  resendConfirmationEmailRequest,
} from '../services/api';

export const OrderConfirmationPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const emailParam = searchParams.get('email') || '';

  const [order, setOrder] = useState<OrderRecord | null>(() => {
    const stateOrder = (location.state as { order?: OrderRecord } | null)?.order;
    return stateOrder && stateOrder.orderId === orderId ? stateOrder : null;
  });

  const [loading, setLoading] = useState<boolean>(!order);
  const [downloadingProductId, setDownloadingProductId] = useState<string | null>(null);
  const [downloadStatusMessage, setDownloadStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const reconcileOrder = async () => {
      // 1. Try checking status with backend (reconciles with Lipila if pending)
      const res = await checkOrderStatus(orderId);
      if (cancelled) return;
      if (res.order) {
        setOrder(res.order);
        setLoading(false);
        return;
      }

      // 2. If email is provided, try customer lookup
      if (emailParam) {
        const lookup = await lookupCustomerOrders(emailParam, orderId);
        if (cancelled) return;
        if (lookup.orders.length > 0) {
          setOrder(lookup.orders[0]);
          setLoading(false);
          return;
        }
      }

      setLoading(false);
    };

    reconcileOrder();

    // Auto-poll status while order is pending payment
    const interval = setInterval(() => {
      if (!cancelled) {
        checkOrderStatus(orderId).then(res => {
          if (!cancelled && res.order) {
            setOrder(res.order);
            if (res.order.orderStatus !== 'pending_payment') {
              clearInterval(interval);
            }
          }
        });
      }
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderId, emailParam]);

  const handleDownloadBundle = async (item: OrderLineItem) => {
    if (!order) return;
    const product = getProductById(item.productId);
    if (!product) {
      setDownloadStatusMessage({
        type: 'error',
        text: 'Product metadata could not be found for this bundle.',
      });
      return;
    }

    setDownloadingProductId(item.productId);
    setDownloadStatusMessage(null);

    const res = await triggerProtectedPdfDownload({
      downloadToken: item.downloadToken,
      product,
      orderId: order.orderId,
      customerEmail: order.customerEmail,
      licenseTier: item.licenseTier,
    });

    setDownloadingProductId(null);
    if (res.ok) {
      setDownloadStatusMessage({
        type: 'success',
        text: `Downloaded "${item.productName}" (${item.verifiedPageCount} PDF pages) with your embedded licence certificate.`,
      });
    } else {
      setDownloadStatusMessage({
        type: 'error',
        text:
          res.error ||
          'Download failed or token expired. Click "Refresh 24h Download Links" below or contact support@twokidsdesign.com.',
      });
    }
  };

  const [resendingEmail, setResendingEmail] = useState<boolean>(false);
  const [emailStatusNote, setEmailStatusNote] = useState<string | null>(null);

  const handleRefreshLinks = async () => {
    if (!order) return;
    const res = await refreshOrderTokensRequest(order.orderId, order.customerEmail);
    if (res.order) {
      setOrder(res.order);
      setDownloadStatusMessage({
        type: 'success',
        text: 'Issued fresh 24-hour signed download links for all bundles in your order.',
      });
    } else {
      setDownloadStatusMessage({
        type: 'error',
        text: res.error || 'Unable to refresh download tokens.',
      });
    }
  };

  const handleResendEmail = async () => {
    if (!order || resendingEmail) return;
    setResendingEmail(true);
    setEmailStatusNote(null);

    const res = await resendConfirmationEmailRequest(order.orderId, order.customerEmail);
    setResendingEmail(false);
    if (res.success) {
      setEmailStatusNote(`Confirmation email sent to ${order.customerEmail}! Check your inbox.`);
    } else {
      setEmailStatusNote(res.error || 'Unable to send email. Please wait a minute or contact support.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-sm font-semibold text-charcoal/70">
          Verifying your order entitlement and preparing secure PDF download links...
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl p-8 sm:p-10 border border-charcoal/15 shadow-editorial space-y-4">
          <AlertCircle className="w-10 h-10 text-brandBlue mx-auto" />
          <h1 className="font-heading font-extrabold text-2xl text-charcoal">
            Verify Your Email to Access Order {orderId}
          </h1>
          <p className="text-sm text-charcoal/75">
            For download security, paid PDF bundles require verification of the customer email address used at checkout.
          </p>
          <Link
            to={`/downloads?orderId=${encodeURIComponent(orderId || '')}`}
            className="inline-flex items-center gap-2 rounded-xl bg-charcoal px-5 py-3 text-sm font-semibold text-white hover:bg-brandBlue-dark transition-colors"
          >
            <span>Go to Customer Order Lookup</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Payment Failed State
  if (order.orderStatus === 'payment_failed' || order.paymentStatus === 'failed') {
    const isMobileMoney = order.payment?.method === 'mobile_money';
    const isInsufficientFunds =
      (order.payment?.errorMessage || '').toLowerCase().includes('insufficient') ||
      (order.payment?.errorMessage || '').toLowerCase().includes('balance');

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-red-200 shadow-editorial space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center shrink-0 border border-red-200">
              <XCircle className="w-7 h-7 text-red-600" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-red-600">
                PAYMENT AUTHORIZATION DECLINED
              </span>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-charcoal">
                {isMobileMoney
                  ? 'Your Mobile Money Payment Could Not Be Completed'
                  : 'Your Card Payment Could Not Be Completed'}
              </h1>
              <p className="text-xs sm:text-sm text-charcoal/75">
                Order ID: <strong className="font-mono text-charcoal">{order.orderId}</strong> · Reference: <strong className="font-mono text-charcoal">{order.referenceId}</strong>
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-5 space-y-2 text-xs sm:text-sm text-charcoal/80">
            <h3 className="font-bold text-charcoal flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Why did this happen?</span>
            </h3>
            <p>
              The payment gateway reported: <strong className="text-red-700 font-mono">{order.payment?.errorMessage || (isMobileMoney ? 'TRANSACTION_DECLINED' : 'UNAUTHORIZED_CARD')}</strong>
            </p>
            {isMobileMoney ? (
              <ul className="list-disc list-inside space-y-1 text-charcoal/70 pl-1">
                {isInsufficientFunds ? (
                  <>
                    <li><strong>Insufficient Balance:</strong> Your Airtel Money account had insufficient balance to cover the bundle total of <strong>{order.currency} {order.total.toFixed(2)}</strong>.</li>
                    <li><strong>Wallet Top-up:</strong> Please top up your wallet via your bank, agent, or USSD and try again.</li>
                  </>
                ) : (
                  <>
                    <li><strong>Prompt Expired or Cancelled:</strong> The authorization prompt on your phone was cancelled, declined, or timed out before PIN entry.</li>
                    <li><strong>SIM/Network Delay:</strong> Ensure your phone has stable network coverage to receive USSD authorization push notifications.</li>
                  </>
                )}
              </ul>
            ) : (
              <ul className="list-disc list-inside space-y-1 text-charcoal/70 pl-1">
                <li><strong>E-Commerce / Online Transactions:</strong> Some bank cards have online or remote purchases disabled by default until enabled in your banking app.</li>
                <li><strong>3D Secure Verification:</strong> An SMS OTP or banking app authorization may have expired or was not approved.</li>
                <li><strong>Card Issuer Block:</strong> Your card issuer may have flagged the transaction for security or cross-border rules.</li>
              </ul>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to="/checkout"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-charcoal px-6 py-3.5 text-sm font-semibold text-white hover:bg-brandBlue-dark transition-colors shadow-xs"
            >
              <span>{isMobileMoney ? 'Try Again with Mobile Money or Card' : 'Try Again or Pay with Mobile Money'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="mailto:support@twokidsdesign.com"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-charcoal hover:bg-softGrey border border-charcoal/15 transition-colors"
            >
              <Mail className="w-4 h-4 text-brandBlue" />
              <span>Contact Support</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Awaiting Payment Confirmation State
  if (order.orderStatus === 'pending_payment') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-charcoal/15 shadow-editorial space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-200">
              <Clock className="w-7 h-7 text-amber-600 animate-pulse" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-600">
                AWAITING PAYMENT CONFIRMATION
              </span>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-charcoal">
                Verifying Your Transaction...
              </h1>
              <p className="text-xs sm:text-sm text-charcoal/75">
                Order Reference: <strong className="font-mono text-charcoal">{order.orderId}</strong> · Amount: <strong className="text-charcoal">{order.currency} {order.total.toFixed(2)}</strong>
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-ivory border border-charcoal/10 p-5 space-y-2 text-xs sm:text-sm text-charcoal/80">
            <p>
              If you just submitted your card or mobile money details, we are actively checking confirmation with Lipila.
              Your licensed download links will appear here automatically once payment is verified.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                checkOrderStatus(order.orderId).then(res => {
                  if (res.order) setOrder(res.order);
                  setLoading(false);
                });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-charcoal px-6 py-3.5 text-sm font-semibold text-white hover:bg-brandBlue-dark transition-colors shadow-xs"
            >
              <RefreshCw className="w-4 h-4 text-brandBlue" />
              <span>Check Status Now</span>
            </button>
            <Link
              to="/downloads"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-charcoal hover:bg-softGrey border border-charcoal/15 transition-colors"
            >
              <span>Go to Order Lookup</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      {/* Order Confirmation Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-charcoal/15 shadow-editorial space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-softGrey pb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-mint flex items-center justify-center shrink-0 border border-charcoal/15">
              <CheckCircle2 className="w-7 h-7 text-charcoal" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-brandBlue-dark">
                PAYMENT VERIFIED · INSTANT DIGITAL DELIVERY
              </span>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-charcoal mt-0.5">
                Thank you, {order.customerName}! Your PDF bundles are ready.
              </h1>
              <p className="text-xs sm:text-sm text-charcoal/75 mt-1">
                Order Reference: <strong className="font-mono text-charcoal">{order.orderId}</strong> · Sent to{' '}
                <strong className="text-charcoal">{order.customerEmail}</strong>
              </p>
            </div>
          </div>

          <div className="bg-ivory rounded-xl px-4 py-3 border border-charcoal/10 text-right shrink-0">
            <span className="text-[11px] text-charcoal/65 block">Amount Paid</span>
            <span className="font-heading font-extrabold text-xl text-charcoal">
              {order.currency} {order.total.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Automated Order Confirmation Email Notice Card */}
        <div className="rounded-2xl bg-brandBlue-light/40 border border-brandBlue/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-brandBlue-dark shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-bold text-charcoal">
                Order confirmation email sent to <span className="text-brandBlue-dark font-mono">{order.customerEmail}</span>
              </p>
              <p className="text-xs text-charcoal/75 leading-relaxed">
                Contains your full VAT receipt, itemized bundle summary, and permanent access link to your files.
              </p>
              {emailStatusNote && (
                <p className="text-xs font-semibold text-brandBlue-dark mt-1">
                  {emailStatusNote}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleResendEmail}
            disabled={resendingEmail}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-charcoal hover:bg-brandBlue hover:text-white border border-charcoal/15 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resendingEmail ? 'animate-spin' : ''}`} />
            <span>{resendingEmail ? 'Sending...' : 'Resend Email'}</span>
          </button>
        </div>

        {/* Status Feedback Alert */}
        {downloadStatusMessage && (
          <div
            role="status"
            className={`rounded-xl p-4 border flex items-start gap-3 text-xs sm:text-sm ${
              downloadStatusMessage.type === 'success'
                ? 'bg-mint/40 border-charcoal/20 text-charcoal'
                : 'bg-red-50 border-red-300 text-red-900'
            }`}
          >
            {downloadStatusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-brandBlue-dark shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <span>{downloadStatusMessage.text}</span>
          </div>
        )}

        {/* Purchased Digital Bundles Download List */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading font-bold text-lg text-charcoal">
              Your Licensed PDF Downloads ({order.items.length})
            </h2>
            <button
              type="button"
              onClick={handleRefreshLinks}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brandBlue-dark hover:underline"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh 24h Download Links</span>
            </button>
          </div>

          <div className="space-y-3" data-testid="order-download-items">
            {order.items.map(item => (
              <div
                key={item.productId}
                className="rounded-2xl bg-ivory p-5 border border-charcoal/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-bold text-brandBlue-dark border border-charcoal/10">
                      <FileText className="w-3 h-3" />
                      {item.verifiedPageCount} Pages · {item.verifiedFileCount} PDFs
                    </span>
                    <span className="text-xs font-semibold text-charcoal/75">
                      {item.licenseName}
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-base sm:text-lg text-charcoal">
                    {item.productName}
                  </h3>
                  <p className="text-xs text-charcoal/65 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brandBlue" />
                    <span>
                      Signed Link Valid Until:{' '}
                      {new Date(item.tokenExpiresAt).toLocaleString()}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadBundle(item)}
                  disabled={downloadingProductId === item.productId}
                  data-testid={`download-btn-${item.productId}`}
                  className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-charcoal px-5 py-3.5 text-xs sm:text-sm font-semibold text-white hover:bg-brandBlue-dark transition-colors shadow-xs disabled:opacity-60"
                >
                  <Download className="w-4 h-4 text-brandBlue" />
                  <span>
                    {downloadingProductId === item.productId
                      ? 'Preparing PDF...'
                      : 'Download PDF Bundle'}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Re-download & Support Instructions */}
        <div className="rounded-2xl bg-brandBlue-light/50 p-5 border border-brandBlue/20 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-charcoal/80">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-brandBlue-dark shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-charcoal">Need to download again later?</p>
              <p className="mt-1 leading-relaxed">
                Visit the{' '}
                <Link to="/downloads" className="underline font-semibold text-brandBlue-dark">
                  Customer Downloads Library
                </Link>{' '}
                anytime and enter <strong>{order.customerEmail}</strong> to retrieve your orders and generate fresh download links.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-brandBlue-dark shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-charcoal">Having trouble with a file?</p>
              <p className="mt-1 leading-relaxed">
                If a download is interrupted or you need assistance printing your PDF sheets, email{' '}
                <a
                  href={`mailto:support@twokidsdesign.com?subject=Order%20${order.orderId}`}
                  className="underline font-semibold text-brandBlue-dark"
                >
                  support@twokidsdesign.com
                </a>{' '}
                with Order ID <strong>{order.orderId}</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Download,
  Search,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import type { OrderRecord, OrderLineItem } from '../../server/orderStore';
import { getProductById } from '../data/products';
import {
  lookupCustomerOrders,
  triggerProtectedPdfDownload,
  refreshOrderTokensRequest,
} from '../services/api';

export const DownloadsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [orderIdInput, setOrderIdInput] = useState(searchParams.get('orderId') || '');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFeedback(null);

    if (!email.trim()) {
      setFeedback({
        type: 'error',
        text: 'Please enter the email address you used during checkout.',
      });
      return;
    }

    setLoading(true);
    const result = await lookupCustomerOrders(email.trim(), orderIdInput.trim() || undefined);
    setLoading(false);
    setSearched(true);
    setOrders(result.orders);

    if (result.error && result.orders.length === 0) {
      setFeedback({ type: 'error', text: result.error });
    }
  };

  useEffect(() => {
    if (searchParams.get('email')) {
      handleLookup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownloadItem = async (order: OrderRecord, item: OrderLineItem) => {
    const product = getProductById(item.productId);
    if (!product) return;

    const key = `${order.orderId}:${item.productId}`;
    setDownloadingKey(key);
    setFeedback(null);

    const res = await triggerProtectedPdfDownload({
      downloadToken: item.downloadToken,
      product,
      orderId: order.orderId,
      customerEmail: order.customerEmail,
      licenseTier: item.licenseTier,
    });

    setDownloadingKey(null);
    if (res.ok) {
      setFeedback({
        type: 'success',
        text: `Downloaded "${item.productName}" (${item.verifiedPageCount} pages) for order ${order.orderId}.`,
      });
    } else {
      setFeedback({
        type: 'error',
        text: res.error || 'Download link expired. Click "Refresh Links" to issue a new 24-hour token.',
      });
    }
  };

  const handleRefreshOrder = async (order: OrderRecord) => {
    const res = await refreshOrderTokensRequest(order.orderId, order.customerEmail);
    if (res.order) {
      setOrders(prev => prev.map(o => (o.orderId === order.orderId ? res.order! : o)));
      setFeedback({
        type: 'success',
        text: `Refreshed 24-hour download tokens for Order ${order.orderId}.`,
      });
    } else {
      setFeedback({
        type: 'error',
        text: res.error || 'Could not refresh download links.',
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
      {/* Header & Lookup Form */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-charcoal/15 shadow-editorial space-y-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brandBlue-dark mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>CUSTOMER DOWNLOAD LIBRARY</span>
          </div>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-charcoal">
            Access Your Purchased PDF Bundles
          </h1>
          <p className="text-sm sm:text-base text-charcoal/75 mt-2 leading-relaxed">
            Enter the email address used at checkout to retrieve your verified orders, re-download your PDF bundles, or issue fresh 24-hour signed download links.
          </p>
        </div>

        <form onSubmit={handleLookup} className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 pt-2">
          <div className="sm:col-span-5">
            <label htmlFor="lookup-email" className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
              Checkout Email Address *
            </label>
            <input
              id="lookup-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-charcoal/25 bg-ivory px-4 py-3 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-brandBlue focus:bg-white"
            />
          </div>

          <div className="sm:col-span-4">
            <label htmlFor="lookup-order-id" className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
              Order ID (Optional)
            </label>
            <input
              id="lookup-order-id"
              type="text"
              value={orderIdInput}
              onChange={e => setOrderIdInput(e.target.value)}
              placeholder="e.g., TKD-..."
              className="w-full rounded-xl border border-charcoal/25 bg-ivory px-4 py-3 text-sm text-charcoal font-mono focus:outline-none focus:ring-2 focus:ring-brandBlue focus:bg-white"
            />
          </div>

          <div className="sm:col-span-3 flex items-end">
            <button
              type="submit"
              disabled={loading}
              data-testid="lookup-orders-btn"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-charcoal px-5 py-3 text-sm font-semibold text-white hover:bg-brandBlue-dark transition-colors"
            >
              <Search className="w-4 h-4 text-brandBlue" />
              <span>{loading ? 'Searching...' : 'Find Orders'}</span>
            </button>
          </div>
        </form>

        {feedback && (
          <div
            role="status"
            className={`rounded-xl p-4 border flex items-start gap-3 text-xs sm:text-sm ${
              feedback.type === 'success'
                ? 'bg-mint/40 border-charcoal/20 text-charcoal'
                : 'bg-red-50 border-red-300 text-red-900'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-brandBlue-dark shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}
      </div>

      {/* Results List */}
      {searched && orders.length === 0 && !feedback && (
        <div className="bg-white rounded-2xl p-10 border border-charcoal/10 text-center space-y-3 shadow-editorial">
          <FileText className="w-8 h-8 text-brandBlue mx-auto" />
          <h2 className="font-heading font-bold text-xl text-charcoal">
            No verified orders found for "{email}"
          </h2>
          <p className="text-xs sm:text-sm text-charcoal/70 max-w-md mx-auto">
            Double-check the spelling of your email address, or browse our shop to place your first digital bundle order.
          </p>
          <Link
            to="/shop"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-charcoal px-5 py-2.5 text-xs font-semibold text-white hover:bg-brandBlue-dark"
          >
            <span>Browse All PDF Bundles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-6" data-testid="customer-orders-list">
          {orders.map(order => (
            <div
              key={order.orderId}
              className="bg-white rounded-2xl p-6 sm:p-8 border border-charcoal/15 shadow-editorial space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-softGrey pb-4">
                <div>
                  <span className="text-xs font-mono font-bold text-brandBlue-dark">
                    ORDER #{order.orderId}
                  </span>
                  <p className="text-xs text-charcoal/65 mt-0.5">
                    Purchased on {new Date(order.createdAt).toLocaleDateString()} · Total Paid:{' '}
                    {order.currency} {order.total.toFixed(2)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRefreshOrder(order)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal/20 bg-ivory px-3 py-1.5 text-xs font-semibold text-charcoal hover:bg-softGrey transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-brandBlue-dark" />
                  <span>Refresh Links</span>
                </button>
              </div>

              <div className="space-y-3">
                {order.items.map(item => {
                  const isBusy = downloadingKey === `${order.orderId}:${item.productId}`;
                  return (
                    <div
                      key={item.productId}
                      className="rounded-xl bg-ivory p-4 border border-charcoal/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <span className="text-[11px] font-bold text-brandBlue-dark uppercase tracking-wider">
                          {item.verifiedPageCount} Pages · {item.licenseName}
                        </span>
                        <h3 className="font-heading font-bold text-base text-charcoal">
                          {item.productName}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadItem(order, item)}
                        disabled={isBusy}
                        className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-charcoal px-4 py-2.5 text-xs font-semibold text-white hover:bg-brandBlue-dark transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 text-brandBlue" />
                        <span>{isBusy ? 'Downloading...' : 'Download PDF'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

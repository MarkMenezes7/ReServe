import { useEffect, useState, type ChangeEvent } from 'react';
import { X, Package, MapPin, Clock, Navigation, Truck, Heart } from 'lucide-react';
import { ngoApi } from '../../services/api';
import { emitNgoSync } from '../../utils/ngoSync';
import type { Claim, Listing } from '../../types';
import { useToast } from '../ToastProvider';
import './NgoDeliveryClaimModal.css';

const WEBSITE_UPI_ID = 'reserve@upi';

interface DeliveryQuoteBreakdown {
  baseFare: number;
  baseDistanceKm: number;
  perKmRate: number;
  extraDistanceKm: number;
  distanceFare: number;
  totalFare: number;
}

interface DeliveryQuote {
  deliveryDistance: number;
  deliveryFee: number;
  pricingModel: string;
  breakdown: DeliveryQuoteBreakdown;
}

interface NgoDeliveryClaimModalProps {
  listing: Listing | null;
  onClose: () => void;
  onClaimed?: (claim: Claim) => void;
}

export default function NgoDeliveryClaimModal({ listing, onClose, onClaimed }: NgoDeliveryClaimModalProps) {
  const [deliveryMethod, setDeliveryMethod] = useState<'self-pickup' | 'platform-delivery'>('self-pickup');
  const [ngoLocation, setNgoLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [estimatedFee, setEstimatedFee] = useState(0);
  const [estimatedDistanceKm, setEstimatedDistanceKm] = useState<number | null>(null);
  const [fareBreakdown, setFareBreakdown] = useState<DeliveryQuoteBreakdown | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [paymentTransactionId, setPaymentTransactionId] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [paymentScreenshotPreview, setPaymentScreenshotPreview] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const { showToast } = useToast();

  const userId = Number(localStorage.getItem('userId') || '0');

  useEffect(() => {
    if (!listing) return;

    setDeliveryMethod('self-pickup');
    setNgoLocation(null);
    setEstimatedFee(0);
    setEstimatedDistanceKm(null);
    setFareBreakdown(null);
    setQuoteLoading(false);
    setQuoteError('');
    setPaymentTransactionId('');
    setPaymentScreenshot(null);
    setPaymentScreenshotPreview('');

    void fetchDeliveryQuote(listing, null);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setNgoLocation(loc);
          void fetchDeliveryQuote(listing, loc);
        },
        () => {
          // Location permission denied - fall back to donor-only quote.
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [listing]);

  async function fetchDeliveryQuote(targetListing: Listing, coords: { lat: number; lng: number } | null) {
    try {
      setQuoteLoading(true);
      setQuoteError('');

      const quote = (await ngoApi.getDeliveryQuote({
        listingId: targetListing.id,
        ngoLatitude: coords?.lat ?? null,
        ngoLongitude: coords?.lng ?? null,
      })) as DeliveryQuote;

      setEstimatedFee(Number(quote.deliveryFee) || 0);
      setEstimatedDistanceKm(Number(quote.deliveryDistance) || null);
      setFareBreakdown(quote.breakdown || null);
    } catch (error) {
      setEstimatedFee(0);
      setEstimatedDistanceKm(null);
      setFareBreakdown(null);
      const message = error instanceof Error ? error.message : 'Unable to calculate delivery fee';
      setQuoteError(message);
    } finally {
      setQuoteLoading(false);
    }
  }

  async function handleClaim() {
    if (!listing) return;

    if (!userId) {
      showToast('Please login again and retry.', 'error');
      return;
    }

    try {
      setClaimLoading(true);
      const scheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

      let response: { message: string; claim: Claim };

      if (deliveryMethod === 'platform-delivery') {
        if (quoteLoading) {
          showToast('Please wait while delivery fee is being calculated.', 'error');
          return;
        }

        if (!(estimatedFee > 0) || estimatedDistanceKm == null) {
          showToast('Unable to calculate delivery fee. Please allow location and try again.', 'error');
          return;
        }

        if (!paymentTransactionId.trim()) {
          showToast('Please enter transaction ID.', 'error');
          return;
        }

        if (!paymentScreenshot) {
          showToast('Please upload payment screenshot.', 'error');
          return;
        }

        const formData = new FormData();
        formData.append('listingId', String(listing.id));
        formData.append('ngoId', String(userId));
        formData.append('scheduledTime', scheduledTime);
        formData.append('deliveryMethod', deliveryMethod);
        formData.append('ngoLatitude', String(ngoLocation?.lat ?? ''));
        formData.append('ngoLongitude', String(ngoLocation?.lng ?? ''));
        formData.append('quotedDeliveryFee', String(estimatedFee));
        formData.append('quotedDeliveryDistance', String(estimatedDistanceKm));
        formData.append('paymentTransactionId', paymentTransactionId.trim());
        formData.append('paymentScreenshot', paymentScreenshot);

        response = (await ngoApi.claimListing(formData)) as { message: string; claim: Claim };
      } else {
        response = (await ngoApi.claimListing({
          listingId: listing.id,
          ngoId: userId,
          scheduledTime,
          deliveryMethod,
          ngoLatitude: ngoLocation?.lat || null,
          ngoLongitude: ngoLocation?.lng || null,
        })) as { message: string; claim: Claim };
      }

      showToast(response.message || 'Food claimed successfully!', 'success');
      emitNgoSync('claim-created');
      onClaimed?.(response.claim);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to claim food';
      showToast(message, 'error');
    } finally {
      setClaimLoading(false);
    }
  }

  function handlePaymentScreenshotChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setPaymentScreenshot(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPaymentScreenshotPreview(url);
    } else {
      setPaymentScreenshotPreview('');
    }
  }

  if (!listing) return null;

  return (
    <div className="ngo-claim-modal-overlay" onClick={onClose}>
      <div className="ngo-claim-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ngo-claim-modal-header">
          <h2>Claim: {listing.foodName}</h2>
          <button className="ngo-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="ngo-claim-modal-info">
          <div className="ngo-info-row">
            <Package size={16} />
            <span>{listing.quantity} {listing.unit} - {listing.category}</span>
          </div>
          <div className="ngo-info-row">
            <MapPin size={16} />
            <span>{listing.pickupLocation}</span>
          </div>
          <div className="ngo-info-row">
            <Clock size={16} />
            <span>Best before: {new Date(listing.bestBefore).toLocaleString()}</span>
          </div>
        </div>

        <div className="ngo-delivery-options">
          <h3>How would you like to collect?</h3>

          <label
            className={`ngo-delivery-option-card ${deliveryMethod === 'self-pickup' ? 'selected' : ''}`}
            onClick={() => setDeliveryMethod('self-pickup')}
          >
            <input
              type="radio"
              name="delivery"
              checked={deliveryMethod === 'self-pickup'}
              onChange={() => setDeliveryMethod('self-pickup')}
            />
            <div className="ngo-option-icon self">
              <Navigation size={24} />
            </div>
            <div className="ngo-option-content">
              <strong>Self Pickup</strong>
              <p>Your organization picks up the food directly from the donor</p>
              <span className="ngo-option-price free">Free</span>
            </div>
          </label>

          <label
            className={`ngo-delivery-option-card ${deliveryMethod === 'platform-delivery' ? 'selected' : ''}`}
            onClick={() => setDeliveryMethod('platform-delivery')}
          >
            <input
              type="radio"
              name="delivery"
              checked={deliveryMethod === 'platform-delivery'}
              onChange={() => setDeliveryMethod('platform-delivery')}
            />
            <div className="ngo-option-icon delivery">
              <Truck size={24} />
            </div>
            <div className="ngo-option-content">
              <strong>Platform Delivery</strong>
              <p>We'll deliver the food to your location (fee based on distance)</p>
              {quoteLoading ? (
                <span className="ngo-option-price paid">Calculating fare...</span>
              ) : estimatedFee > 0 && estimatedDistanceKm != null ? (
                <span className="ngo-option-price paid">Pay Rs {estimatedFee} ({estimatedDistanceKm} km)</span>
              ) : quoteError ? (
                <span className="ngo-option-price paid">Unable to calculate fare</span>
              ) : (
                <span className="ngo-option-price paid">Calculating fare...</span>
              )}
            </div>
          </label>
        </div>

        {deliveryMethod === 'platform-delivery' && (
          <>
            <div className="ngo-delivery-note">
              <Truck size={16} />
              <span>Delivery is managed by ReServe admin. You'll receive tracking updates via notifications.</span>
            </div>

            <div className="ngo-payment-proof-box">
              <h4>Pay Delivery Fee Before Dispatch</h4>
              <p className="ngo-payment-upi">
                Website UPI ID: <strong>{WEBSITE_UPI_ID}</strong>
              </p>

              <div className="ngo-payment-amount-row">
                <span>Payable Amount</span>
                <strong>{estimatedFee > 0 ? `Rs ${estimatedFee}` : '-'}</strong>
              </div>
              {estimatedDistanceKm != null && (
                <p className="ngo-payment-distance-row">Distance: {estimatedDistanceKm} km</p>
              )}
              {fareBreakdown && (
                <p className="ngo-payment-fare-rule">
                  Meter model: Rs {fareBreakdown.baseFare} for first {fareBreakdown.baseDistanceKm} km, then Rs {fareBreakdown.perKmRate}/km.
                </p>
              )}
              {quoteLoading && <p className="ngo-payment-quote-loading">Calculating delivery fare...</p>}
              {!!quoteError && <p className="ngo-payment-quote-error">{quoteError}</p>}

              <label className="ngo-payment-field">
                <span>Transaction ID</span>
                <input
                  type="text"
                  value={paymentTransactionId}
                  onChange={(e) => setPaymentTransactionId(e.target.value)}
                  placeholder="Enter UPI transaction/reference ID"
                />
              </label>

              <label className="ngo-payment-field">
                <span>Payment Screenshot</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePaymentScreenshotChange} />
              </label>

              {paymentScreenshotPreview && (
                <div className="ngo-payment-preview-wrap">
                  <img src={paymentScreenshotPreview} alt="Payment screenshot preview" className="ngo-payment-preview" />
                </div>
              )}

              <p className="ngo-payment-help">
                After submission, admin verifies transaction ID and screenshot. Only then delivery becomes available for live dispatch tracking.
              </p>
            </div>
          </>
        )}

        <div className="ngo-claim-modal-actions">
          <button className="ngo-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="ngo-btn-confirm-claim"
            onClick={() => void handleClaim()}
            disabled={
              claimLoading ||
              (deliveryMethod === 'platform-delivery' && (
                quoteLoading ||
                !(estimatedFee > 0) ||
                estimatedDistanceKm == null ||
                !paymentTransactionId.trim() ||
                !paymentScreenshot
              ))
            }
          >
            {claimLoading ? 'Claiming...' : (
              <>
                <Heart size={18} />
                {deliveryMethod === 'self-pickup' ? 'Claim and Self-Pickup' : 'Claim and Request Delivery'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

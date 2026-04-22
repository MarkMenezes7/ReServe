import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  TrendingUp,
  Users,
  Heart,
  Calendar,
  MapPin,
  Clock,
  Search,
  Grid,
  List,
  X,
  Truck,
  Navigation,
} from 'lucide-react';
import NGOLayout from '../../components/NGOLayout';
import './NGODashboard.css';
import VerificationBanner from '../../components/common/VerificationBanner';

const WEBSITE_UPI_ID = 'reserve@upi';

interface Stats {
  totalCollections: number;
  activeClaims: number;
  foodCollected: number;
  peopleFed: number;
}

interface Listing {
  id: number;
  foodName: string;
  category: string;
  foodType: string;
  quantity: number;
  unit: string;
  description: string;
  bestBefore: string;
  pickupLocation: string;
  donorName: string;
  organizationName: string;
  status: string;
  latitude?: number;
  longitude?: number;
  storageType?: string;
}

interface Claim {
  id: number;
  foodName: string;
  quantity: number;
  unit: string;
  donorName: string;
  organizationName: string;
  status: string;
  scheduledTime: string;
  pickupLocation: string;
  phone: string;
  deliveryMethod?: string;
  deliveryFee?: number;
  deliveryDistance?: number;
  deliveryStatus?: string;
  paymentStatus?: 'not-required' | 'pending-verification' | 'verified' | 'rejected';
  paymentTransactionId?: string;
  paymentScreenshotUrl?: string;
  paymentRejectReason?: string;
}

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

const MUMBAI_DEMO_TAG_REGEX = /\s*\[MUMBAI_DEMO_FRESH_[^\]]+\]\s*/gi;

function cleanListingDescription(description?: string): string {
  return (description || '').replace(MUMBAI_DEMO_TAG_REGEX, ' ').replace(/\s{2,}/g, ' ').trim();
}

const NGODashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalCollections: 0,
    activeClaims: 0,
    foodCollected: 0,
    peopleFed: 0,
  });
  const [listings, setListings] = useState<Listing[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'browse' | 'claims'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [claimModal, setClaimModal] = useState<Listing | null>(null);
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
  const navigate = useNavigate();

  const userId = localStorage.getItem('userId');

  useEffect(() => {
    // Check authentication
    if (!localStorage.getItem('isAuthenticated')) {
      navigate('/login');
      return;
    }

    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

      // Fetch stats
      const statsRes = await fetch(`http://localhost:5000/api/ngo/stats/${userId}`, { headers });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch available listings
      const listingsRes = await fetch('http://localhost:5000/api/ngo/listings', { headers });
      if (listingsRes.ok) {
        const listingsData = await listingsRes.json();
        setListings(listingsData);
      }

      // Fetch claims
      const claimsRes = await fetch(`http://localhost:5000/api/ngo/claims/${userId}`, { headers });
      if (claimsRes.ok) {
        const claimsData = await claimsRes.json();
        setClaims(claimsData);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const fetchDeliveryQuote = async (listing: Listing, coords?: { lat: number; lng: number } | null) => {
    try {
      setQuoteLoading(true);
      setQuoteError('');

      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/ngo/delivery-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          listingId: listing.id,
          ngoLatitude: coords?.lat ?? null,
          ngoLongitude: coords?.lng ?? null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate delivery fee');
      }

      const quote = data as DeliveryQuote;
      setEstimatedFee(Number(quote.deliveryFee) || 0);
      setEstimatedDistanceKm(Number(quote.deliveryDistance) || null);
      setFareBreakdown(quote.breakdown || null);
    } catch (error) {
      setEstimatedFee(0);
      setEstimatedDistanceKm(null);
      setFareBreakdown(null);
      setQuoteError((error as Error).message || 'Unable to calculate delivery fee');
    } finally {
      setQuoteLoading(false);
    }
  };

  useEffect(() => {
    if (claimModal && deliveryMethod === 'platform-delivery' && estimatedFee <= 0 && !quoteLoading) {
      fetchDeliveryQuote(claimModal, ngoLocation);
    }
  }, [claimModal, deliveryMethod, ngoLocation]);

  const handleClaim = async (listingId: number) => {
    // Called from modal after delivery method is selected
    try {
      setClaimLoading(true);
      const scheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const token = localStorage.getItem('token');

      let response: Response;

      if (deliveryMethod === 'platform-delivery') {
        if (quoteLoading) {
          alert('Please wait while delivery fee is being calculated.');
          setClaimLoading(false);
          return;
        }
        if (!(estimatedFee > 0) || estimatedDistanceKm == null) {
          alert('Unable to calculate delivery fee. Please allow location and try again.');
          setClaimLoading(false);
          return;
        }
        if (!paymentTransactionId.trim()) {
          alert('Please enter transaction ID.');
          setClaimLoading(false);
          return;
        }
        if (!paymentScreenshot) {
          alert('Please upload payment screenshot.');
          setClaimLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('listingId', String(listingId));
        formData.append('ngoId', String(userId || ''));
        formData.append('scheduledTime', scheduledTime);
        formData.append('deliveryMethod', deliveryMethod);
        formData.append('ngoLatitude', String(ngoLocation?.lat ?? ''));
        formData.append('ngoLongitude', String(ngoLocation?.lng ?? ''));
        formData.append('quotedDeliveryFee', String(estimatedFee));
        formData.append('quotedDeliveryDistance', String(estimatedDistanceKm));
        formData.append('paymentTransactionId', paymentTransactionId.trim());
        formData.append('paymentScreenshot', paymentScreenshot);

        response = await fetch('http://localhost:5000/api/ngo/claim', {
          method: 'POST',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: formData,
        });
      } else {
        response = await fetch('http://localhost:5000/api/ngo/claim', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            listingId,
            ngoId: userId,
            scheduledTime,
            deliveryMethod,
            ngoLatitude: ngoLocation?.lat || null,
            ngoLongitude: ngoLocation?.lng || null,
          }),
        });
      }

      const data = await response.json();

      if (response.ok) {
        alert(data.message || 'Food claimed successfully!');
        setClaimModal(null);
        setPaymentTransactionId('');
        setPaymentScreenshot(null);
        setPaymentScreenshotPreview('');
        fetchData();
      } else {
        alert(data.error || 'Failed to claim food');
      }
    } catch (error) {
      console.error('Error claiming food:', error);
      alert('Failed to claim food');
    } finally {
      setClaimLoading(false);
    }
  };

  const openClaimModal = (listing: Listing) => {
    setClaimModal(listing);
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

    fetchDeliveryQuote(listing, null);

    // Try to get NGO location for distance calculation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setNgoLocation(loc);
          fetchDeliveryQuote(listing, loc);
        },
        () => { /* location denied, no problem */ },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  const handleMarkCollected = async (claimId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/claims/${claimId}/collect`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        alert('Marked as collected');
        fetchData();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating claim:', error);
      alert('Failed to update status');
    }
  };

  const calculateTimeLeft = (bestBefore: string) => {
    const now = new Date();
    const expiry = new Date(bestBefore);
    const diff = expiry.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 0) return 'Expired';
    if (hours < 6) return `${hours}h left`;
    if (hours < 24) return `${hours}h left`;
    const days = Math.floor(hours / 24);
    return `${days}d left`;
  };

  const getUrgencyColor = (bestBefore: string) => {
    const now = new Date();
    const expiry = new Date(bestBefore);
    const diff = expiry.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 6) return 'urgent';
    if (hours < 12) return 'warning';
    return 'normal';
  };

  const filteredListings = listings.filter(listing => {
    const matchesSearch = listing.foodName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         listing.donorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || listing.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', 'cooked-meals', 'bakery', 'dairy', 'fruits-vegetables', 'packaged-food'];

  const handlePaymentScreenshotChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setPaymentScreenshot(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPaymentScreenshotPreview(url);
    } else {
      setPaymentScreenshotPreview('');
    }
  };

  return (
    <NGOLayout>
      <div className="ngo-dashboard-content">

        <VerificationBanner userType="ngo" />

        {/* Tab Switcher */}
        <div className="dashboard-tabs">
          <button
            className={`dashboard-tab ${activeTab === 'browse' ? 'active' : ''}`}
            onClick={() => setActiveTab('browse')}
          >
            <Package size={18} />
            Browse Food
          </button>
          <button
            className={`dashboard-tab ${activeTab === 'claims' ? 'active' : ''}`}
            onClick={() => setActiveTab('claims')}
          >
            <Calendar size={18} />
            My Claims
          </button>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <motion.div
            className="stat-card"
            whileHover={{ scale: 1.02, y: -5 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="stat-icon-wrapper bg-green">
              <Package className="stat-icon" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalCollections}</div>
              <div className="stat-label">Total Collections</div>
            </div>
          </motion.div>

          <motion.div
            className="stat-card"
            whileHover={{ scale: 1.02, y: -5 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="stat-icon-wrapper bg-blue">
              <Calendar className="stat-icon" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.activeClaims}</div>
              <div className="stat-label">Active Claims</div>
            </div>
          </motion.div>

          <motion.div
            className="stat-card"
            whileHover={{ scale: 1.02, y: -5 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="stat-icon-wrapper bg-orange">
              <TrendingUp className="stat-icon" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.foodCollected} kg</div>
              <div className="stat-label">Food Collected</div>
            </div>
          </motion.div>

          <motion.div
            className="stat-card"
            whileHover={{ scale: 1.02, y: -5 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="stat-icon-wrapper bg-purple">
              <Users className="stat-icon" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.peopleFed}</div>
              <div className="stat-label">People Fed</div>
            </div>
          </motion.div>
        </div>

        {/* Content Area */}
        <div className="content-area">
          {activeTab === 'browse' && (
            <>
              {/* Filters */}
              <div className="filters-bar">
                <div className="search-box">
                  <Search className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search food or donor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <select
                  className="filter-select"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat === 'all' ? 'All Categories' : cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </option>
                  ))}
                </select>

                <div className="view-toggle">
                  <button
                    className={viewMode === 'grid' ? 'active' : ''}
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid size={20} />
                  </button>
                  <button
                    className={viewMode === 'list' ? 'active' : ''}
                    onClick={() => setViewMode('list')}
                  >
                    <List size={20} />
                  </button>
                </div>
              </div>

              {/* Listings */}
              {loading ? (
                <div className="loading-state">Loading available food...</div>
              ) : filteredListings.length === 0 ? (
                <div className="empty-state">
                  <Package size={64} />
                  <h3>No food available</h3>
                  <p>Check back later for new donations</p>
                </div>
              ) : (
                <div className={`listings-grid ${viewMode}`}>
                  {filteredListings.map((listing) => {
                    const cleanedDescription = cleanListingDescription(listing.description);
                    return (
                      <motion.div
                        key={listing.id}
                        className={`listing-card ${getUrgencyColor(listing.bestBefore)}`}
                        whileHover={{ scale: 1.02, y: -5 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="listing-header">
                          <div className="listing-badge">{listing.category}</div>
                          <div className={`urgency-badge ${getUrgencyColor(listing.bestBefore)}`}>
                            <Clock size={14} />
                            {calculateTimeLeft(listing.bestBefore)}
                          </div>
                        </div>

                        <h3 className="listing-title">{listing.foodName}</h3>

                        <div className="listing-details">
                          <div className="detail-row">
                            <Package size={16} />
                            <span>{listing.quantity} {listing.unit}</span>
                          </div>
                          <div className="detail-row">
                            <Users size={16} />
                            <span>{listing.organizationName}</span>
                          </div>
                          <div className="detail-row">
                            <MapPin size={16} />
                            <span>{listing.pickupLocation}</span>
                          </div>
                        </div>

                        {cleanedDescription && (
                          <p className="listing-description">{cleanedDescription}</p>
                        )}

                        <button
                          className="claim-btn"
                          onClick={() => openClaimModal(listing)}
                        >
                          <Heart size={18} />
                          Claim Food
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'claims' && (
            <div className="claims-section">
              <h2 className="section-title">My Claims</h2>
              {claims.length === 0 ? (
                <div className="empty-state">
                  <Calendar size={64} />
                  <h3>No claims yet</h3>
                  <p>Browse available food and make your first claim</p>
                </div>
              ) : (
                <div className="claims-list">
                  {claims.map((claim) => (
                    <motion.div
                      key={claim.id}
                      className="claim-card"
                      whileHover={{ scale: 1.01 }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="claim-header">
                        <h3>{claim.foodName}</h3>
                        <span className={`status-badge ${claim.status}`}>
                          {claim.status}
                        </span>
                      </div>

                      <div className="claim-details">
                        <div className="detail-row">
                          <Package size={16} />
                          <span>{claim.quantity} {claim.unit}</span>
                        </div>
                        <div className="detail-row">
                          <Users size={16} />
                          <span>{claim.organizationName}</span>
                        </div>
                        <div className="detail-row">
                          <MapPin size={16} />
                          <span>{claim.pickupLocation}</span>
                        </div>
                        {claim.scheduledTime && (
                          <div className="detail-row">
                            <Clock size={16} />
                            <span>{new Date(claim.scheduledTime).toLocaleString()}</span>
                          </div>
                        )}
                        {claim.paymentStatus === 'rejected' && claim.paymentRejectReason && (
                          <div className="detail-row">
                            <X size={16} />
                            <span>Payment note: {claim.paymentRejectReason}</span>
                          </div>
                        )}
                        <div className="detail-row">
                          {claim.deliveryMethod === 'platform-delivery' ? (
                            <>
                              <Truck size={16} />
                              <span>Platform Delivery — ₹{claim.deliveryFee || 0}</span>
                              {claim.paymentStatus && (
                                <span className={`payment-badge ${claim.paymentStatus}`}>
                                  {claim.paymentStatus.replace('-', ' ')}
                                </span>
                              )}
                              {claim.deliveryStatus && (
                                <span className={`delivery-badge ${claim.deliveryStatus}`}>
                                  {claim.deliveryStatus}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <Navigation size={16} />
                              <span>Self Pickup</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="claim-actions">
                        <button className="btn-secondary" onClick={() => navigate('/chat')}>
                          Contact Donor
                        </button>
                        <button
                          className="btn-primary"
                          onClick={() => handleMarkCollected(claim.id)}
                          disabled={claim.deliveryMethod === 'platform-delivery' && claim.deliveryStatus !== 'delivered'}
                        >
                          {claim.deliveryMethod === 'platform-delivery' && claim.deliveryStatus !== 'delivered'
                            ? 'Await Delivery'
                            : 'Mark Collected'}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Claim Modal with Delivery Options */}
      <AnimatePresence>
        {claimModal && (
          <motion.div
            className="claim-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setClaimModal(null)}
          >
            <motion.div
              className="claim-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="claim-modal-header">
                <h2>Claim: {claimModal.foodName}</h2>
                <button className="close-btn" onClick={() => setClaimModal(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="claim-modal-info">
                <div className="info-row">
                  <Package size={16} />
                  <span>{claimModal.quantity} {claimModal.unit} — {claimModal.category}</span>
                </div>
                <div className="info-row">
                  <MapPin size={16} />
                  <span>{claimModal.pickupLocation}</span>
                </div>
                <div className="info-row">
                  <Clock size={16} />
                  <span>Best before: {new Date(claimModal.bestBefore).toLocaleString()}</span>
                </div>
              </div>

              <div className="delivery-options">
                <h3>How would you like to collect?</h3>
                
                <label
                  className={`delivery-option-card ${deliveryMethod === 'self-pickup' ? 'selected' : ''}`}
                  onClick={() => setDeliveryMethod('self-pickup')}
                >
                  <input
                    type="radio"
                    name="delivery"
                    checked={deliveryMethod === 'self-pickup'}
                    onChange={() => setDeliveryMethod('self-pickup')}
                  />
                  <div className="option-icon self">
                    <Navigation size={24} />
                  </div>
                  <div className="option-content">
                    <strong>Self Pickup</strong>
                    <p>Your organization picks up the food directly from the donor</p>
                    <span className="option-price free">Free</span>
                  </div>
                </label>

                <label
                  className={`delivery-option-card ${deliveryMethod === 'platform-delivery' ? 'selected' : ''}`}
                  onClick={() => setDeliveryMethod('platform-delivery')}
                >
                  <input
                    type="radio"
                    name="delivery"
                    checked={deliveryMethod === 'platform-delivery'}
                    onChange={() => setDeliveryMethod('platform-delivery')}
                  />
                  <div className="option-icon delivery">
                    <Truck size={24} />
                  </div>
                  <div className="option-content">
                    <strong>Platform Delivery</strong>
                    <p>We'll deliver the food to your location (fee based on distance)</p>
                    {quoteLoading ? (
                      <span className="option-price paid">Calculating fare...</span>
                    ) : estimatedFee > 0 && estimatedDistanceKm != null ? (
                      <span className="option-price paid">Pay ₹{estimatedFee} ({estimatedDistanceKm} km)</span>
                    ) : quoteError ? (
                      <span className="option-price paid">Unable to calculate fare</span>
                    ) : (
                      <span className="option-price paid">Calculating fare...</span>
                    )}
                  </div>
                </label>
              </div>

              {deliveryMethod === 'platform-delivery' && (
                <>
                  <div className="delivery-note">
                    <Truck size={16} />
                    <span>Delivery is managed by ReServe admin. You'll receive tracking updates via notifications.</span>
                  </div>

                  <div className="payment-proof-box">
                    <h4>Pay Delivery Fee Before Dispatch</h4>
                    <p className="payment-upi">
                      Website UPI ID: <strong>{WEBSITE_UPI_ID}</strong>
                    </p>

                    <div className="payment-amount-row">
                      <span>Payable Amount</span>
                      <strong>{estimatedFee > 0 ? `₹${estimatedFee}` : '—'}</strong>
                    </div>
                    {estimatedDistanceKm != null && (
                      <p className="payment-distance-row">
                        Distance: {estimatedDistanceKm} km
                      </p>
                    )}
                    {fareBreakdown && (
                      <p className="payment-fare-rule">
                        Meter model: ₹{fareBreakdown.baseFare} for first {fareBreakdown.baseDistanceKm} km, then ₹{fareBreakdown.perKmRate}/km.
                      </p>
                    )}
                    {quoteLoading && <p className="payment-quote-loading">Calculating delivery fare...</p>}
                    {!!quoteError && <p className="payment-quote-error">{quoteError}</p>}

                    <label className="payment-field">
                      <span>Transaction ID</span>
                      <input
                        type="text"
                        value={paymentTransactionId}
                        onChange={(e) => setPaymentTransactionId(e.target.value)}
                        placeholder="Enter UPI transaction/reference ID"
                      />
                    </label>

                    <label className="payment-field">
                      <span>Payment Screenshot</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePaymentScreenshotChange} />
                    </label>

                    {paymentScreenshotPreview && (
                      <div className="payment-preview-wrap">
                        <img src={paymentScreenshotPreview} alt="Payment screenshot preview" className="payment-preview" />
                      </div>
                    )}

                    <p className="payment-help">
                      After submission, admin verifies transaction ID and screenshot. Only then delivery becomes available for live dispatch tracking.
                    </p>
                  </div>
                </>
              )}

              <div className="claim-modal-actions">
                <button className="btn-cancel" onClick={() => setClaimModal(null)}>
                  Cancel
                </button>
                <button
                  className="btn-confirm-claim"
                  onClick={() => handleClaim(claimModal.id)}
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
                      {deliveryMethod === 'self-pickup' ? 'Claim & Self-Pickup' : `Claim & Request Delivery`}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </NGOLayout>
  );
};

export default NGODashboard;

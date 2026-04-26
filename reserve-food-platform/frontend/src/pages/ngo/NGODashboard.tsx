import { motion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
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
import { claimsApi, ngoApi } from '../../services/api';
import { emitNgoSync, subscribeNgoSync } from '../../utils/ngoSync';
import './NGODashboard.css';
import VerificationBanner from '../../components/common/VerificationBanner';
import NgoDeliveryClaimModal from '../../components/common/NgoDeliveryClaimModal';
import type { Claim, Listing } from '../../types';

interface Stats {
  totalCollections: number;
  activeClaims: number;
  foodCollected: number;
  peopleFed: number;
}

const MUMBAI_DEMO_TAG_REGEX = /\s*\[MUMBAI_DEMO_FRESH_[^\]]+\]\s*/gi;

function cleanListingDescription(description?: string): string {
  return (description || '').replace(MUMBAI_DEMO_TAG_REGEX, ' ').replace(/\s{2,}/g, ' ').trim();
}

const NGODashboard = () => {
  const defaultStats: Stats = {
    totalCollections: 0,
    activeClaims: 0,
    foodCollected: 0,
    peopleFed: 0,
  };

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
  const navigate = useNavigate();

  const userId = Number(localStorage.getItem('userId') || '0');

  const fetchData = useCallback(async (showLoader = true) => {
    if (!userId) {
      setStats(defaultStats);
      setListings([]);
      setClaims([]);
      setLoading(false);
      return;
    }

    try {
      if (showLoader) {
        setLoading(true);
      }

      const [statsData, listingsData, claimsData] = await Promise.all([
        ngoApi.getStats(userId),
        ngoApi.getListings(),
        ngoApi.getClaims(userId),
      ]);

      setStats(statsData || defaultStats);
      setListings((listingsData || []) as unknown as Listing[]);
      setClaims((claimsData || []) as unknown as Claim[]);
    } catch (error) {
      console.error('Error fetching NGO dashboard data:', error);
      if (showLoader) {
        setStats(defaultStats);
        setListings([]);
        setClaims([]);
      }
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    // Check authentication
    if (!localStorage.getItem('isAuthenticated')) {
      navigate('/login');
      return;
    }

    void fetchData();
  }, [fetchData, navigate]);

  useEffect(() => {
    const unsubscribe = subscribeNgoSync(() => {
      void fetchData(false);
    });

    return unsubscribe;
  }, [fetchData]);

  const openClaimModal = (listing: Listing) => {
    setClaimModal(listing);
  };

  const handleMarkCollected = async (claimId: number) => {
    try {
      await claimsApi.collect(claimId);
      alert('Marked as collected');
      await fetchData(false);
      emitNgoSync('claim-collected');
    } catch (error) {
      console.error('Error updating claim:', error);
      const message = error instanceof Error ? error.message : 'Failed to update status';
      alert(message);
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
                         (listing.donorName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || listing.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', 'cooked-meals', 'bakery', 'dairy', 'fruits-vegetables', 'packaged-food'];

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
                            <span>{listing.organizationName || listing.donorName || 'Donor'}</span>
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
                          <span>{claim.quantity || 0} {claim.unit || 'kg'}</span>
                        </div>
                        <div className="detail-row">
                          <Users size={16} />
                          <span>{claim.organizationName || claim.donorName || 'Donor'}</span>
                        </div>
                        <div className="detail-row">
                          <MapPin size={16} />
                          <span>{claim.pickupLocation || 'Pickup location shared in chat'}</span>
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
                        {claim.deliveryMethod === 'platform-delivery' && (
                          <button className="btn-secondary" onClick={() => navigate('/ngo/delivery-map')}>
                            Track Delivery
                          </button>
                        )}
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

      <NgoDeliveryClaimModal
        listing={claimModal}
        onClose={() => setClaimModal(null)}
        onClaimed={() => {
          void fetchData(false);
        }}
      />
    </NGOLayout>
  );
};

export default NGODashboard;

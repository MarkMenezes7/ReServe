import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Leaf,
  Package,
  TrendingUp,
  Users,
  Heart,
  Calendar,
  MapPin,
  Clock,
  LogOut,
  Search,
  Grid,
  List,
  Sparkles,
    Menu,
    X,
    MessageCircle,
    Truck,
    Navigation,
    DollarSign,
  } from 'lucide-react';
import './NGODashboard.css';
import VerificationBanner from '../../components/common/VerificationBanner';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [claimModal, setClaimModal] = useState<Listing | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<'self-pickup' | 'platform-delivery'>('self-pickup');
  const [ngoLocation, setNgoLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [estimatedFee, setEstimatedFee] = useState(0);
  const [claimLoading, setClaimLoading] = useState(false);
  const navigate = useNavigate();

  const userId = localStorage.getItem('userId');
  const userName = localStorage.getItem('userName');

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

  const handleClaim = async (listingId: number) => {
    // Called from modal after delivery method is selected
    try {
      setClaimLoading(true);
      const scheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const token = localStorage.getItem('token');

      const response = await fetch('http://localhost:5000/api/ngo/claim', {
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

      const data = await response.json();

      if (response.ok) {
        alert(data.message || 'Food claimed successfully!');
        setClaimModal(null);
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
    setEstimatedFee(0);
    // Try to get NGO location for distance calculation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setNgoLocation(loc);
          // Calculate estimated distance and fee
          if (listing.latitude && listing.longitude) {
            const R = 6371;
            const dLat = (loc.lat - listing.latitude) * Math.PI / 180;
            const dLon = (loc.lng - listing.longitude) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(listing.latitude * Math.PI / 180) * Math.cos(loc.lat * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
            const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            setEstimatedFee(Math.round(30 + dist * 8));
          }
        },
        () => { /* location denied, no problem */ },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
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

  return (
    <div className="ngo-dashboard">
      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <Leaf className="logo-icon" />
            <span className="logo-text">ReServe</span>
          </div>
          <button className="close-sidebar" onClick={() => setSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>

        <div className="user-info">
          <div className="user-avatar">
            <Heart className="avatar-icon" />
          </div>
          <div className="user-details">
            <h3>{userName}</h3>
            <span className="user-badge">NGO</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'browse' ? 'active' : ''}`}
            onClick={() => setActiveTab('browse')}
          >
            <Package className="nav-icon" />
            <span>Browse Food</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'claims' ? 'active' : ''}`}
            onClick={() => setActiveTab('claims')}
          >
            <Calendar className="nav-icon" />
            <span>My Claims</span>
          </button>
          <button
            className="nav-item"
            onClick={() => navigate('/ngo/forecast')}
          >
            <Sparkles className="nav-icon" />
            <span>ML Forecast</span>
          </button>
          <button
            className="nav-item"
            onClick={() => navigate('/ngo/impact')}
          >
            <TrendingUp className="nav-icon" />
            <span>Impact</span>
          </button>
          <button
            className="nav-item"
            onClick={() => navigate('/ngo/map')}
          >
            <MapPin className="nav-icon" />
            <span>Map View</span>
          </button>
          <button
            className="nav-item"
            onClick={() => navigate('/chat')}
          >
            <MessageCircle className="nav-icon" />
            <span>Chat</span>
          </button>
        </nav>

        <button className="logout-btn" onClick={handleLogout}>
          <LogOut className="logout-icon" />
          <span>Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Top Bar */}
        <div className="top-bar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <h1 className="page-title">NGO Dashboard</h1>
          <div className="top-actions">
            <span className="welcome-text">Welcome, {userName}</span>
          </div>
        </div>

        <VerificationBanner userType="ngo" />

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
                  {filteredListings.map((listing) => (
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

                      {listing.description && (
                        <p className="listing-description">{listing.description}</p>
                      )}

                      <button
                        className="claim-btn"
                        onClick={() => openClaimModal(listing)}
                      >
                        <Heart size={18} />
                        Claim Food
                      </button>
                    </motion.div>
                  ))}
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
                        <div className="detail-row">
                          {claim.deliveryMethod === 'platform-delivery' ? (
                            <>
                              <Truck size={16} />
                              <span>Platform Delivery — ₹{claim.deliveryFee || 0}</span>
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
                        >
                          Mark Collected
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

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
                    {estimatedFee > 0 ? (
                      <span className="option-price paid">
                        <DollarSign size={14} />
                        Est. ₹{estimatedFee}
                      </span>
                    ) : (
                      <span className="option-price paid">Fee calculated on confirm</span>
                    )}
                  </div>
                </label>
              </div>

              {deliveryMethod === 'platform-delivery' && (
                <div className="delivery-note">
                  <Truck size={16} />
                  <span>Delivery is managed by ReServe admin. You'll receive tracking updates via notifications.</span>
                </div>
              )}

              <div className="claim-modal-actions">
                <button className="btn-cancel" onClick={() => setClaimModal(null)}>
                  Cancel
                </button>
                <button
                  className="btn-confirm-claim"
                  onClick={() => handleClaim(claimModal.id)}
                  disabled={claimLoading}
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
    </div>
  );
};

export default NGODashboard;

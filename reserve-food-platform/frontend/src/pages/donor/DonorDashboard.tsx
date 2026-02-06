import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Leaf,
  Package,
  TrendingUp,
  Heart,
  Calendar,
  Plus,
  LogOut,
  Menu,
  X,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  MessageCircle,
} from 'lucide-react';
import './DonorDashboard.css';
import { Claim, DonorStats, Listing } from '../../types';

const DonorDashboard = () => {
  const [stats, setStats] = useState<DonorStats>({
    totalDonations: 0,
    activeListings: 0,
    totalClaims: 0,
    foodSaved: 0,
  });
  const [listings, setListings] = useState<Listing[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'listings' | 'claims'>('overview');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'claimed' | 'collected' | 'expired'>('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');
  const userName = localStorage.getItem('userName');

  useEffect(() => {
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
      const statsRes = await fetch(`http://localhost:5000/api/donor/stats/${userId}`, { headers });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch listings
      const listingsRes = await fetch(`http://localhost:5000/api/donor/listings/${userId}?status=${filterStatus}`, { headers });
      if (listingsRes.ok) {
        const listingsData = await listingsRes.json();
        setListings(listingsData);
      }

      // Fetch claims on donor listings
      const claimsRes = await fetch(`http://localhost:5000/api/donor/claims/${userId}`, { headers });
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

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [filterStatus]);

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="status-icon active" />;
      case 'claimed':
        return <Clock className="status-icon claimed" />;
      case 'collected':
        return <CheckCircle className="status-icon collected" />;
      case 'expired':
        return <AlertCircle className="status-icon expired" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'claimed':
        return 'status-claimed';
      case 'collected':
        return 'status-collected';
      case 'expired':
        return 'status-expired';
      default:
        return '';
    }
  };

  return (
    <div className="donor-dashboard">
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
            <Package className="avatar-icon" />
          </div>
          <div className="user-details">
            <h3>{userName}</h3>
            <span className="user-badge">Donor</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <TrendingUp className="nav-icon" />
            <span>Overview</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'listings' ? 'active' : ''}`}
            onClick={() => setActiveTab('listings')}
          >
            <Package className="nav-icon" />
            <span>My Listings</span>
          </button>
          <button
            className="nav-item"
            onClick={() => navigate('/donor/add')}
          >
            <Plus className="nav-icon" />
            <span>Add Listing</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'claims' ? 'active' : ''}`}
            onClick={() => setActiveTab('claims')}
          >
            <Calendar className="nav-icon" />
            <span>Claims</span>
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
          <h1 className="page-title">Donor Dashboard</h1>
          <button
            className="btn-add-mobile"
            onClick={() => navigate('/donor/add')}
          >
            <Plus size={20} />
            <span>Add Food</span>
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
              <div className="stat-value">{stats.totalDonations}</div>
              <div className="stat-label">Total Donations</div>
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
              <CheckCircle className="stat-icon" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.activeListings}</div>
              <div className="stat-label">Active Listings</div>
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
              <Heart className="stat-icon" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalClaims}</div>
              <div className="stat-label">Total Claims</div>
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
              <TrendingUp className="stat-icon" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.foodSaved} kg</div>
              <div className="stat-label">Food Saved</div>
            </div>
          </motion.div>
        </div>

        {/* Content Area */}
        <div className="content-area">
          {activeTab === 'overview' && (
            <div className="overview-section">
              <h2 className="section-title">Welcome back, {userName}!</h2>
              <p className="section-subtitle">
                You're making a real difference in reducing food waste. Keep up the great work!
              </p>

              <div className="quick-actions">
                <motion.button
                  className="action-card"
                  whileHover={{ scale: 1.02, y: -5 }}
                  onClick={() => navigate('/donor/add')}
                >
                  <Plus className="action-icon" />
                  <h3>Add New Listing</h3>
                  <p>List surplus food for NGOs to claim</p>
                </motion.button>

                <motion.button
                  className="action-card"
                  whileHover={{ scale: 1.02, y: -5 }}
                  onClick={() => setActiveTab('listings')}
                >
                  <Package className="action-icon" />
                  <h3>View Listings</h3>
                  <p>Manage your food donations</p>
                </motion.button>

                <motion.button
                  className="action-card"
                  whileHover={{ scale: 1.02, y: -5 }}
                >
                  <TrendingUp className="action-icon" />
                  <h3>View Analytics</h3>
                  <p>Track your impact over time</p>
                </motion.button>
              </div>

              <div className="recent-activity">
                <h3>Recent Listings</h3>
                {listings.slice(0, 5).map((listing) => (
                  <div key={listing.id} className="activity-item">
                    <div className={`activity-status ${getStatusColor(listing.status)}`}>
                      {getStatusIcon(listing.status)}
                    </div>
                    <div className="activity-details">
                      <h4>{listing.foodName}</h4>
                      <p>
                        {listing.quantity} {listing.unit} • {listing.category}
                      </p>
                    </div>
                    <span className="activity-time">
                      {new Date(listing.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'listings' && (
            <div className="listings-section">
              <div className="listings-header">
                <h2 className="section-title">My Listings</h2>
                <select
                  className="filter-select"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="claimed">Claimed</option>
                  <option value="collected">Collected</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              {loading ? (
                <div className="loading-state">Loading listings...</div>
              ) : listings.length === 0 ? (
                <div className="empty-state">
                  <Package size={64} />
                  <h3>No listings yet</h3>
                  <p>Start by adding your first food listing</p>
                  <button
                    className="btn-primary"
                    onClick={() => navigate('/donor/add')}
                  >
                    <Plus size={20} />
                    Add Listing
                  </button>
                </div>
              ) : (
                <div className="listings-table">
                  {listings.map((listing) => (
                    <motion.div
                      key={listing.id}
                      className="listing-row"
                      whileHover={{ scale: 1.01 }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="listing-info">
                        <h3>{listing.foodName}</h3>
                        <p>
                          {listing.quantity} {listing.unit} • {listing.category}
                        </p>
                      </div>

                      <div className={`listing-status ${getStatusColor(listing.status)}`}>
                        {getStatusIcon(listing.status)}
                        <span>{listing.status}</span>
                      </div>

                      <div className="listing-date">
                        <Calendar size={16} />
                        <span>{new Date(listing.bestBefore).toLocaleDateString()}</span>
                      </div>

                      <div className="listing-actions">
                        <button className="btn-icon" title="View">
                          <Eye size={18} />
                        </button>
                        <button className="btn-icon" title="Edit">
                          <Edit size={18} />
                        </button>
                        <button className="btn-icon danger" title="Delete">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'claims' && (
            <div className="claims-section">
              <h2 className="section-title">Claims On Your Listings</h2>
              {claims.length === 0 ? (
                <div className="empty-state">
                  <Calendar size={64} />
                  <h3>No claims yet</h3>
                  <p>Once NGOs claim your listings, they will appear here.</p>
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
                        <span className={`status-badge ${claim.status}`}>{claim.status}</span>
                      </div>

                      <div className="claim-details">
                        <div className="detail-row">
                          <Package size={16} />
                          <span>{claim.quantity} {claim.unit}</span>
                        </div>
                        <div className="detail-row">
                          <Heart size={16} />
                          <span>{claim.organizationName || claim.ngoName}</span>
                        </div>
                        <div className="detail-row">
                          <Calendar size={16} />
                          <span>{claim.scheduledTime ? new Date(claim.scheduledTime).toLocaleString() : 'Pickup pending'}</span>
                        </div>
                      </div>

                      <div className="claim-actions">
                        <button className="btn-secondary" onClick={() => navigate('/chat')}>
                          Contact NGO
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
    </div>
  );
};

export default DonorDashboard;

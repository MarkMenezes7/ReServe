import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Leaf,
  Users,
  Package,
  ShieldCheck,
  BarChart3,
  MessageSquare,
  Star,
  TrendingUp,
  LogOut,
  Menu,
  X,
  CheckCircle,
  XCircle,
  Trash2,
  Search,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Eye,
  Shield,
  UserCheck,
  UserX,
  AlertTriangle,
  Inbox,
  ClipboardList,
  Activity,
  ChevronRight,
  Truck,
  Navigation,
  DollarSign,
  Clock,
} from 'lucide-react';
import './AdminDashboard.css';
import { AdminStats, User, Listing, Claim, Review, ContactMessage } from '../../types';

type TabType = 'overview' | 'verifications' | 'users' | 'listings' | 'claims' | 'reviews' | 'messages' | 'deliveries';

interface Delivery {
  id: number; listingId: number; ngoId: number; claimStatus: string;
  deliveryMethod: string; deliveryFee: number; deliveryDistance: number;
  deliveryStatus: string; scheduledTime: string; createdAt: string;
  paymentUpiId?: string;
  paymentTransactionId?: string;
  paymentScreenshotUrl?: string;
  paymentStatus?: 'not-required' | 'pending-verification' | 'verified' | 'rejected';
  paymentVerifiedAt?: string;
  paymentRejectReason?: string;
  foodName: string; quantity: number; unit: string; pickupLocation: string;
  category: string; storageType: string;
  donorName: string; donorOrg: string; donorPhone: string;
  ngoName: string; ngoOrg: string; ngoPhone: string;
}

interface DeliveryStats {
  total: number; paymentPendingVerification?: number; pending: number; inTransit: number; delivered: number;
  totalRevenue: number; avgDistance: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem('userName') || 'Admin';

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingVerifications, setPendingVerifications] = useState<User[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [listings, setListings] = useState<Listing[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [deliveryStats, setDeliveryStats] = useState<DeliveryStats | null>(null);
  const [deliveryFilter, setDeliveryFilter] = useState('all');

  // Verification request states
  interface VerificationRequest {
    id: number; userId: number; businessName: string; businessType: string;
    fssaiNumber: string; gstNumber: string; description: string; certificateDetails: string;
    documentUrl: string | null;
    status: string; adminNotes: string; submittedAt: string; reviewedAt: string;
    name: string; email: string; userType: string; organizationName: string; phone: string; city: string;
  }
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [verificationFilter, setVerificationFilter] = useState('pending');
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [paymentReviewNotes, setPaymentReviewNotes] = useState<Record<number, string>>({});

  // Filter states
  const [userSearch, setUserSearch] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [userVerifiedFilter, setUserVerifiedFilter] = useState('all');
  const [listingSearch, setListingSearch] = useState('');
  const [listingStatusFilter, setListingStatusFilter] = useState('all');
  const [claimStatusFilter, setClaimStatusFilter] = useState('all');

  const token = localStorage.getItem('token');
  const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/admin/stats', { headers });
      if (res.ok) setStats(await res.json());
    } catch (err) { console.error('Stats error:', err); }
  }, []);

  const fetchPendingVerifications = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/admin/pending-verifications', { headers });
      if (res.ok) setPendingVerifications(await res.json());
    } catch (err) { console.error('Pending verifications error:', err); }
  }, []);

  const fetchVerificationRequests = useCallback(async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/verification-requests?status=${verificationFilter}`, { headers });
      if (res.ok) setVerificationRequests(await res.json());
    } catch (err) { console.error('Verification requests error:', err); }
  }, [verificationFilter]);

  const handleReviewVerification = async (requestId: number, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/verification-requests/${requestId}/review`, {
        method: 'PATCH', headers, body: JSON.stringify({ action, adminNotes: reviewNotes[requestId] || '' }),
      });
      if (res.ok) {
        await Promise.all([fetchVerificationRequests(), fetchPendingVerifications(), fetchStats()]);
        setReviewNotes(prev => { const n = { ...prev }; delete n[requestId]; return n; });
      }
    } catch (err) { console.error('Review verification error:', err); }
  };

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (userSearch) params.set('search', userSearch);
      if (userTypeFilter !== 'all') params.set('type', userTypeFilter);
      if (userVerifiedFilter !== 'all') params.set('verified', userVerifiedFilter);
      params.set('limit', '50');
      const res = await fetch(`http://localhost:5000/api/admin/users?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setUsersTotal(data.total);
      }
    } catch (err) { console.error('Users error:', err); }
  }, [userSearch, userTypeFilter, userVerifiedFilter]);

  const fetchListings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (listingSearch) params.set('search', listingSearch);
      if (listingStatusFilter !== 'all') params.set('status', listingStatusFilter);
      params.set('limit', '50');
      const res = await fetch(`http://localhost:5000/api/admin/listings?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setListings(Array.isArray(data) ? data : data.listings || []);
      }
    } catch (err) { console.error('Listings error:', err); }
  }, [listingSearch, listingStatusFilter]);

  const fetchClaims = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (claimStatusFilter !== 'all') params.set('status', claimStatusFilter);
      params.set('limit', '50');
      const res = await fetch(`http://localhost:5000/api/admin/claims?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setClaims(Array.isArray(data) ? data : data.claims || []);
      }
    } catch (err) { console.error('Claims error:', err); }
  }, [claimStatusFilter]);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/admin/reviews', { headers });
      if (res.ok) {
        const data = await res.json();
        setReviews(Array.isArray(data) ? data : data.reviews || []);
      }
    } catch (err) { console.error('Reviews error:', err); }
  }, []);

  const fetchContactMessages = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/admin/contact-messages', { headers });
      if (res.ok) {
        const data = await res.json();
        setContactMessages(Array.isArray(data) ? data : data.messages || []);
      }
    } catch (err) { console.error('Contact messages error:', err); }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchPendingVerifications()]);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'listings') fetchListings();
    if (activeTab === 'claims') fetchClaims();
    if (activeTab === 'reviews') fetchReviews();
    if (activeTab === 'messages') fetchContactMessages();
    if (activeTab === 'deliveries') fetchDeliveries();
    if (activeTab === 'verifications') fetchVerificationRequests();
  }, [activeTab, userSearch, userTypeFilter, userVerifiedFilter, listingSearch, listingStatusFilter, claimStatusFilter, deliveryFilter, verificationFilter]);

  const fetchDeliveries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (deliveryFilter !== 'all') params.set('status', deliveryFilter);
      const [delRes, statsRes] = await Promise.all([
        fetch(`http://localhost:5000/api/admin/deliveries?${params}`, { headers }),
        fetch('http://localhost:5000/api/admin/delivery-stats', { headers }),
      ]);
      if (delRes.ok) setDeliveries(await delRes.json());
      if (statsRes.ok) setDeliveryStats(await statsRes.json());
    } catch (err) { console.error('Deliveries error:', err); }
  }, [deliveryFilter]);

  const handleUpdateDeliveryStatus = async (claimId: number, status: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/deliveries/${claimId}/status`, {
        method: 'PATCH', headers, body: JSON.stringify({ deliveryStatus: status }),
      });
      if (res.ok) fetchDeliveries();
    } catch (err) { console.error('Delivery status error:', err); }
  };

  const handleReviewDeliveryPayment = async (claimId: number, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/deliveries/${claimId}/payment-review`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action, adminNotes: paymentReviewNotes[claimId] || '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Failed to review payment');
        return;
      }
      setPaymentReviewNotes(prev => {
        const next = { ...prev };
        delete next[claimId];
        return next;
      });
      await fetchDeliveries();
      alert(data.message || 'Payment review updated');
    } catch (err) {
      console.error('Delivery payment review error:', err);
      alert('Failed to review payment');
    }
  };

  // Actions
  const handleVerifyUser = async (userId: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/users/${userId}/verify`, { method: 'PATCH', headers });
      if (res.ok) {
        await Promise.all([fetchPendingVerifications(), fetchStats(), fetchUsers()]);
      }
    } catch (err) { console.error('Verify error:', err); }
  };

  const handleToggleActive = async (userId: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/users/${userId}/activate`, { method: 'PATCH', headers });
      if (res.ok) {
        await Promise.all([fetchUsers(), fetchStats()]);
      }
    } catch (err) { console.error('Activate error:', err); }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/admin/users/${userId}`, { method: 'DELETE', headers });
      if (res.ok) {
        await Promise.all([fetchUsers(), fetchStats()]);
      }
    } catch (err) { console.error('Delete error:', err); }
  };

  const handleDeleteListing = async (listingId: number) => {
    if (!confirm('Remove this listing?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/admin/listings/${listingId}`, { method: 'DELETE', headers });
      if (res.ok) fetchListings();
    } catch (err) { console.error('Delete listing error:', err); }
  };

  const handleDeleteReview = async (reviewId: number) => {
    if (!confirm('Delete this review?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/admin/reviews/${reviewId}`, { method: 'DELETE', headers });
      if (res.ok) fetchReviews();
    } catch (err) { console.error('Delete review error:', err); }
  };

  const handleUpdateContactStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/contact-messages/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ status }) });
      if (res.ok) fetchContactMessages();
    } catch (err) { console.error('Update contact error:', err); }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'badge-green', claimed: 'badge-blue', collected: 'badge-purple',
      expired: 'badge-gray', cancelled: 'badge-red', confirmed: 'badge-blue',
      pending: 'badge-yellow', rejected: 'badge-red', removed: 'badge-red',
      'payment-pending': 'badge-yellow', 'payment-rejected': 'badge-red',
      'pending-verification': 'badge-yellow', verified: 'badge-green',
      new: 'badge-blue', read: 'badge-gray', replied: 'badge-green', resolved: 'badge-green',
    };
    return map[status] || 'badge-gray';
  };

  const navItems: { tab: TabType; icon: React.ReactNode; label: string; badge?: number }[] = [
    { tab: 'overview', icon: <BarChart3 size={18} />, label: 'Overview' },
    { tab: 'verifications', icon: <ShieldCheck size={18} />, label: 'Verifications', badge: pendingVerifications.length },
    { tab: 'users', icon: <Users size={18} />, label: 'Users' },
    { tab: 'listings', icon: <Package size={18} />, label: 'Listings' },
    { tab: 'claims', icon: <ClipboardList size={18} />, label: 'Claims' },
    { tab: 'reviews', icon: <Star size={18} />, label: 'Reviews' },
    { tab: 'messages', icon: <MessageSquare size={18} />, label: 'Messages' },
    { tab: 'deliveries', icon: <Truck size={18} />, label: 'Deliveries' },
  ];

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="admin-loading">
          <div className="spinner" />
          <p>Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <Leaf size={26} className="logo-icon" />
            <span className="logo-text">ReServe</span>
          </div>
          <button className="close-sidebar" onClick={() => setSidebarOpen(false)}>
            <X size={22} />
          </button>
        </div>

        <div className="user-info">
          <div className="user-avatar">
            <Shield size={20} />
          </div>
          <div className="user-details">
            <h3>{userName}</h3>
            <span className="user-badge">Administrator</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.tab}
              className={`nav-item ${activeTab === item.tab ? 'active' : ''}`}
              onClick={() => { setActiveTab(item.tab); setSidebarOpen(false); }}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
            </button>
          ))}
        </nav>

        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <div className="admin-topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <h1 className="page-title">
            {activeTab === 'overview' && 'Dashboard Overview'}
            {activeTab === 'verifications' && 'Verification Requests'}
            {activeTab === 'users' && 'User Management'}
            {activeTab === 'listings' && 'Listings Management'}
            {activeTab === 'claims' && 'Claims Management'}
            {activeTab === 'reviews' && 'Reviews'}
            {activeTab === 'messages' && 'Contact Messages'}
            {activeTab === 'deliveries' && 'Delivery Management'}
          </h1>
          <span className="welcome-text">Welcome, {userName}</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'verifications' && renderVerifications()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'listings' && renderListings()}
            {activeTab === 'claims' && renderClaims()}
            {activeTab === 'reviews' && renderReviews()}
            {activeTab === 'messages' && renderMessages()}
            {activeTab === 'deliveries' && renderDeliveries()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );

  // ==================== OVERVIEW TAB ====================
  function renderOverview() {
    if (!stats) return null;
    return (
      <>
        <div className="admin-stats-grid">
          <motion.div className="admin-stat-card" whileHover={{ y: -2 }}>
            <div className="stat-icon-box green"><Users size={22} /></div>
            <div><div className="stat-value">{stats.totalUsers}</div><div className="stat-label">Total Users</div></div>
          </motion.div>
          <motion.div className="admin-stat-card" whileHover={{ y: -2 }}>
            <div className="stat-icon-box blue"><Package size={22} /></div>
            <div><div className="stat-value">{stats.totalListings}</div><div className="stat-label">Total Listings</div></div>
          </motion.div>
          <motion.div className="admin-stat-card" whileHover={{ y: -2 }}>
            <div className="stat-icon-box orange"><ClipboardList size={22} /></div>
            <div><div className="stat-value">{stats.totalClaims}</div><div className="stat-label">Total Claims</div></div>
          </motion.div>
          <motion.div className="admin-stat-card" whileHover={{ y: -2 }}>
            <div className="stat-icon-box purple"><CheckCircle size={22} /></div>
            <div><div className="stat-value">{stats.collected || 0}</div><div className="stat-label">Collected</div></div>
          </motion.div>
          <motion.div className="admin-stat-card" whileHover={{ y: -2 }}>
            <div className="stat-icon-box teal"><TrendingUp size={22} /></div>
            <div><div className="stat-value">{stats.foodSaved || 0} kg</div><div className="stat-label">Food Saved</div></div>
          </motion.div>
          <motion.div className="admin-stat-card" whileHover={{ y: -2 }}>
            <div className="stat-icon-box yellow"><Activity size={22} /></div>
            <div><div className="stat-value">{stats.successRate || 0}%</div><div className="stat-label">Success Rate</div></div>
          </motion.div>
          <motion.div className="admin-stat-card" whileHover={{ y: -2 }}>
            <div className="stat-icon-box red"><AlertTriangle size={22} /></div>
            <div><div className="stat-value">{stats.pendingVerifications || 0}</div><div className="stat-label">Pending Verifications</div></div>
          </motion.div>
          <motion.div className="admin-stat-card" whileHover={{ y: -2 }}>
            <div className="stat-icon-box indigo"><UserCheck size={22} /></div>
            <div><div className="stat-value">{stats.newUsersMonth || 0}</div><div className="stat-label">New This Month</div></div>
          </motion.div>
        </div>

        {/* Quick Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          <div className="admin-content-card">
            <div className="card-header">
              <h2><Users size={18} /> User Breakdown</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f0fdf4', borderRadius: '8px' }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>Donors</span>
                <span className="badge badge-green">{stats.donors || stats.totalDonors || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#eff6ff', borderRadius: '8px' }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>NGOs</span>
                <span className="badge badge-blue">{stats.ngos || stats.totalNGOs || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fff7ed', borderRadius: '8px' }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>Drivers</span>
                <span className="badge badge-yellow">{stats.drivers || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f5f3ff', borderRadius: '8px' }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>Active Listings</span>
                <span className="badge badge-purple">{stats.activeListings}</span>
              </div>
            </div>
          </div>

          <div className="admin-content-card">
            <div className="card-header">
              <h2><ShieldCheck size={18} /> Pending Verifications</h2>
              {pendingVerifications.length > 0 && <span className="count-badge">{pendingVerifications.length}</span>}
            </div>
            {pendingVerifications.length === 0 ? (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>No pending verifications</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pendingVerifications.slice(0, 5).map((user) => (
                  <div key={user.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fef3c7', borderRadius: '8px' }}>
                    <div>
                      <span style={{ fontWeight: 600, color: '#374151' }}>{user.name}</span>
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: '#9ca3af' }}>{user.organizationName}</span>
                    </div>
                    <button className="btn-action btn-verify" onClick={() => handleVerifyUser(user.id)}>
                      <CheckCircle size={14} /> Approve
                    </button>
                  </div>
                ))}
                {pendingVerifications.length > 5 && (
                  <button
                    style={{ background: 'none', border: 'none', color: '#059669', fontWeight: 600, cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}
                    onClick={() => setActiveTab('verifications')}
                  >
                    View all {pendingVerifications.length} requests <ChevronRight size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="admin-content-card" style={{ marginTop: '16px' }}>
          <div className="card-header">
            <h2><Activity size={18} /> Quick Actions</h2>
          </div>
          <div className="quick-actions-grid">
            <div className="quick-action-card" onClick={() => setActiveTab('verifications')}>
              <div className="qa-icon" style={{ background: '#d1fae5', color: '#059669' }}><ShieldCheck size={20} /></div>
              <div><div className="qa-label">Review Verifications</div><div className="qa-desc">{pendingVerifications.length} pending</div></div>
            </div>
            <div className="quick-action-card" onClick={() => setActiveTab('users')}>
              <div className="qa-icon" style={{ background: '#dbeafe', color: '#2563eb' }}><Users size={20} /></div>
              <div><div className="qa-label">Manage Users</div><div className="qa-desc">{stats.totalUsers} total</div></div>
            </div>
            <div className="quick-action-card" onClick={() => setActiveTab('listings')}>
              <div className="qa-icon" style={{ background: '#ffedd5', color: '#ea580c' }}><Package size={20} /></div>
              <div><div className="qa-label">View Listings</div><div className="qa-desc">{stats.activeListings} active</div></div>
            </div>
            <div className="quick-action-card" onClick={() => setActiveTab('messages')}>
              <div className="qa-icon" style={{ background: '#ede9fe', color: '#7c3aed' }}><MessageSquare size={20} /></div>
              <div><div className="qa-label">Contact Messages</div><div className="qa-desc">View inquiries</div></div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ==================== VERIFICATIONS TAB ====================
  function renderVerifications() {
    return (
      <div className="admin-content-card">
        <div className="card-header">
          <h2><ShieldCheck size={18} /> Verification Requests</h2>
          <div className="admin-filters">
            <select className="filter-select" value={verificationFilter} onChange={(e) => setVerificationFilter(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {/* Unverified users (no request submitted yet) */}
        {verificationFilter === 'pending' && pendingVerifications.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.95rem', color: '#6b7280', marginBottom: '0.75rem' }}>Unverified Users (No Request Submitted)</h3>
            <div className="verification-list">
              {pendingVerifications
                .filter(u => !verificationRequests.some(vr => vr.userId === u.id && vr.status === 'pending'))
                .map((user) => (
                <motion.div key={user.id} className="verification-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} layout>
                  <div className={`v-avatar ${user.userType}`}>{user.name.charAt(0).toUpperCase()}</div>
                  <div className="v-info">
                    <div className="v-name">{user.name}</div>
                    <div className="v-org">{user.organizationName || 'No organization'}</div>
                    <div className="v-meta">
                      <span><Mail size={12} /> {user.email}</span>
                      {user.phone && <span><Phone size={12} /> {user.phone}</span>}
                      {user.city && <span><MapPin size={12} /> {user.city}</span>}
                      <span><Calendar size={12} /> {formatDate(user.createdAt)}</span>
                      <span className={`badge ${user.userType === 'donor' ? 'badge-green' : 'badge-blue'}`}>
                        {user.userType === 'donor' ? 'Donor' : 'NGO'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>No verification request submitted yet</div>
                  </div>
                  <div className="v-actions">
                    <button className="btn-action btn-verify" onClick={() => handleVerifyUser(user.id)}>
                      <CheckCircle size={14} /> Quick Approve
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Submitted verification requests */}
        {verificationRequests.length === 0 && pendingVerifications.filter(u => !verificationRequests.some(vr => vr.userId === u.id)).length === 0 ? (
          <div className="admin-empty">
            <div className="empty-icon"><CheckCircle size={28} /></div>
            <h3>All caught up!</h3>
            <p>No verification requests to review.</p>
          </div>
        ) : verificationRequests.length > 0 && (
          <div>
            <h3 style={{ fontSize: '0.95rem', color: '#6b7280', marginBottom: '0.75rem' }}>Submitted Verification Requests</h3>
            <div className="verification-list">
              {verificationRequests.map((vr) => (
                <motion.div key={vr.id} className="verification-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} layout
                  style={{ flexDirection: 'column', alignItems: 'stretch' }}
                >
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className={`v-avatar ${vr.userType}`}>{vr.name.charAt(0).toUpperCase()}</div>
                    <div className="v-info" style={{ flex: 1 }}>
                      <div className="v-name">{vr.name}</div>
                      <div className="v-org">{vr.organizationName || vr.businessName}</div>
                      <div className="v-meta">
                        <span><Mail size={12} /> {vr.email}</span>
                        {vr.phone && <span><Phone size={12} /> {vr.phone}</span>}
                        {vr.city && <span><MapPin size={12} /> {vr.city}</span>}
                        <span className={`badge ${vr.status === 'pending' ? 'badge-yellow' : vr.status === 'approved' ? 'badge-green' : 'badge-red'}`}>
                          {vr.status.charAt(0).toUpperCase() + vr.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Business Details */}
                  <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '12px 16px', marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: '0.85rem' }}>
                    <div><span style={{ color: '#6b7280' }}>Business Name:</span> <strong>{vr.businessName}</strong></div>
                    <div><span style={{ color: '#6b7280' }}>Business Type:</span> <strong style={{ textTransform: 'capitalize' }}>{vr.businessType}</strong></div>
                    {vr.fssaiNumber && <div><span style={{ color: '#6b7280' }}>FSSAI Number:</span> <strong>{vr.fssaiNumber}</strong></div>}
                    {vr.gstNumber && <div><span style={{ color: '#6b7280' }}>GST Number:</span> <strong>{vr.gstNumber}</strong></div>}
                    <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#6b7280' }}>Submitted:</span> {formatDate(vr.submittedAt)}</div>
                    {vr.description && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#6b7280' }}>Description:</span> {vr.description}</div>}
                    {vr.certificateDetails && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#6b7280' }}>Certificates:</span> {vr.certificateDetails}</div>}
                    {vr.documentUrl && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ color: '#6b7280' }}>Uploaded Document:</span>
                        <div style={{ marginTop: '8px' }}>
                          <a href={`http://localhost:5000${vr.documentUrl}`} target="_blank" rel="noopener noreferrer">
                            <img
                              src={`http://localhost:5000${vr.documentUrl}`}
                              alt="Verification document"
                              style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const link = target.parentElement;
                                if (link) {
                                  const fallback = document.createElement('span');
                                  fallback.textContent = 'View Document';
                                  fallback.style.color = '#2563eb';
                                  fallback.style.textDecoration = 'underline';
                                  link.appendChild(fallback);
                                }
                              }}
                            />
                          </a>
                        </div>
                      </div>
                    )}
                    {vr.adminNotes && <div style={{ gridColumn: '1 / -1', color: '#dc2626' }}><span style={{ color: '#6b7280' }}>Admin Notes:</span> {vr.adminNotes}</div>}
                  </div>

                  {/* Actions for pending requests */}
                  {vr.status === 'pending' && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        className="search-input"
                        placeholder="Admin notes (optional)..."
                        value={reviewNotes[vr.id] || ''}
                        onChange={(e) => setReviewNotes(prev => ({ ...prev, [vr.id]: e.target.value }))}
                        style={{ flex: 1, fontSize: '0.85rem' }}
                      />
                      <button className="btn-action btn-verify" onClick={() => handleReviewVerification(vr.id, 'approve')}>
                        <CheckCircle size={14} /> Approve
                      </button>
                      <button className="btn-action btn-danger" onClick={() => handleReviewVerification(vr.id, 'reject')}>
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== USERS TAB ====================
  function renderUsers() {
    return (
      <div className="admin-content-card">
        <div className="card-header">
          <h2><Users size={18} /> All Users <span className="count-badge">{usersTotal}</span></h2>
          <div className="admin-filters">
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                className="search-input"
                style={{ paddingLeft: '32px' }}
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            <select className="filter-select" value={userTypeFilter} onChange={(e) => setUserTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              <option value="donor">Donors</option>
              <option value="ngo">NGOs</option>
              <option value="driver">Drivers</option>
              <option value="admin">Admins</option>
            </select>
            <select className="filter-select" value={userVerifiedFilter} onChange={(e) => setUserVerifiedFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </select>
          </div>
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Type</th>
                <th>Status</th>
                <th>City</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>No users found</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-name-cell">
                        <span className="name">{user.name}</span>
                        {user.organizationName && <span className="org">{user.organizationName}</span>}
                        <span className="email">{user.email}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${user.userType === 'donor' ? 'badge-green' : user.userType === 'ngo' ? 'badge-blue' : user.userType === 'driver' ? 'badge-yellow' : 'badge-purple'}`}>
                        {user.userType}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span className={`badge ${user.isVerified ? 'badge-green' : 'badge-yellow'}`}>
                          {user.isVerified ? 'Verified' : 'Unverified'}
                        </span>
                        <span className={`badge ${user.isActive ? 'badge-green' : 'badge-red'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td>{user.city || '—'}</td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <div className="btn-actions">
                        {!user.isVerified && user.userType !== 'admin' && (
                          <button className="btn-action btn-verify" onClick={() => handleVerifyUser(user.id)} title="Verify">
                            <UserCheck size={14} />
                          </button>
                        )}
                        {user.isVerified === 1 && user.userType !== 'admin' && (
                          <button className="btn-action btn-warning" onClick={() => handleVerifyUser(user.id)} title="Unverify">
                            <UserX size={14} />
                          </button>
                        )}
                        <button className="btn-action btn-info" onClick={() => handleToggleActive(user.id)} title={user.isActive ? 'Deactivate' : 'Activate'}>
                          {user.isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                        </button>
                        {user.userType !== 'admin' && (
                          <button className="btn-action btn-danger" onClick={() => handleDeleteUser(user.id)} title="Delete">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ==================== LISTINGS TAB ====================
  function renderListings() {
    return (
      <div className="admin-content-card">
        <div className="card-header">
          <h2><Package size={18} /> All Listings</h2>
          <div className="admin-filters">
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                className="search-input"
                style={{ paddingLeft: '32px' }}
                placeholder="Search listings..."
                value={listingSearch}
                onChange={(e) => setListingSearch(e.target.value)}
              />
            </div>
            <select className="filter-select" value={listingStatusFilter} onChange={(e) => setListingStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="claimed">Claimed</option>
              <option value="collected">Collected</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Food Item</th>
                <th>Donor</th>
                <th>Qty</th>
                <th>Status</th>
                <th>Location</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>No listings found</td></tr>
              ) : (
                listings.map((listing) => (
                  <tr key={listing.id}>
                    <td>
                      <div className="user-name-cell">
                        <span className="name">{listing.foodName}</span>
                        <span className="org">{listing.category}</span>
                      </div>
                    </td>
                    <td>
                      <div className="user-name-cell">
                        <span className="name">{listing.donorName}</span>
                        <span className="org">{listing.organizationName}</span>
                      </div>
                    </td>
                    <td>{listing.quantity} {listing.unit}</td>
                    <td><span className={`badge ${getStatusBadge(listing.status)}`}>{listing.status}</span></td>
                    <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.pickupLocation}</td>
                    <td>{formatDate(listing.createdAt)}</td>
                    <td>
                      <div className="btn-actions">
                        <button className="btn-action btn-danger" onClick={() => handleDeleteListing(listing.id)} title="Remove">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ==================== CLAIMS TAB ====================
  function renderClaims() {
    return (
      <div className="admin-content-card">
        <div className="card-header">
          <h2><ClipboardList size={18} /> All Claims</h2>
          <div className="admin-filters">
            <select className="filter-select" value={claimStatusFilter} onChange={(e) => setClaimStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="collected">Collected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Food Item</th>
                <th>NGO</th>
                <th>Donor</th>
                <th>Status</th>
                <th>Claimed</th>
              </tr>
            </thead>
            <tbody>
              {claims.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>No claims found</td></tr>
              ) : (
                claims.map((claim) => (
                  <tr key={claim.id}>
                    <td><span style={{ fontWeight: 600 }}>{claim.foodName}</span></td>
                    <td>
                      <div className="user-name-cell">
                        <span className="name">{claim.ngoName}</span>
                        <span className="org">{claim.ngoOrg}</span>
                      </div>
                    </td>
                    <td>
                      <div className="user-name-cell">
                        <span className="name">{claim.donorName}</span>
                        <span className="org">{claim.organizationName}</span>
                      </div>
                    </td>
                    <td><span className={`badge ${getStatusBadge(claim.status)}`}>{claim.status}</span></td>
                    <td>{formatDate(claim.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ==================== REVIEWS TAB ====================
  function renderReviews() {
    return (
      <div className="admin-content-card">
        <div className="card-header">
          <h2><Star size={18} /> All Reviews <span className="count-badge">{reviews.length}</span></h2>
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reviewer</th>
                <th>Food</th>
                <th>Quality</th>
                <th>Communication</th>
                <th>Timeliness</th>
                <th>Overall</th>
                <th>Comment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>No reviews yet</td></tr>
              ) : (
                reviews.map((review) => (
                  <tr key={review.id}>
                    <td><span style={{ fontWeight: 600 }}>{review.reviewerName}</span></td>
                    <td>{review.foodName}</td>
                    <td>{'⭐'.repeat(review.foodQuality)}</td>
                    <td>{'⭐'.repeat(review.communication)}</td>
                    <td>{'⭐'.repeat(review.timeliness)}</td>
                    <td><span className="badge badge-green">{review.overall}/5</span></td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{review.comment || '—'}</td>
                    <td>
                      <button className="btn-action btn-danger" onClick={() => handleDeleteReview(review.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ==================== MESSAGES TAB ====================
  function renderMessages() {
    return (
      <div className="admin-content-card">
        <div className="card-header">
          <h2><MessageSquare size={18} /> Contact Messages <span className="count-badge">{contactMessages.length}</span></h2>
        </div>

        {contactMessages.length === 0 ? (
          <div className="admin-empty">
            <div className="empty-icon"><Inbox size={28} /></div>
            <h3>No messages</h3>
            <p>No contact messages received yet.</p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>Subject</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contactMessages.map((msg) => (
                  <tr key={msg.id}>
                    <td>
                      <div className="user-name-cell">
                        <span className="name">{msg.name}</span>
                        <span className="email">{msg.email}</span>
                        {msg.organization && <span className="org">{msg.organization}</span>}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{msg.subject || '—'}</td>
                    <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.message}</td>
                    <td><span className={`badge ${getStatusBadge(msg.status)}`}>{msg.status}</span></td>
                    <td>{formatDate(msg.createdAt)}</td>
                    <td>
                      <div className="btn-actions">
                        {msg.status === 'new' && (
                          <button className="btn-action btn-info" onClick={() => handleUpdateContactStatus(msg.id, 'read')} title="Mark Read">
                            <Eye size={14} />
                          </button>
                        )}
                        {msg.status !== 'resolved' && (
                          <button className="btn-action btn-verify" onClick={() => handleUpdateContactStatus(msg.id, 'resolved')} title="Resolve">
                            <CheckCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
  function renderDeliveries() {
    return (
      <div className="admin-content-card">
        {/* Delivery Stats */}
        {deliveryStats && (
          <div className="delivery-stats-grid">
            <div className="delivery-stat-card">
              <Truck size={20} />
              <div>
                <div className="stat-value">{deliveryStats.total}</div>
                <div className="stat-label">Total Deliveries</div>
              </div>
            </div>
            <div className="delivery-stat-card pending">
              <Clock size={20} />
              <div>
                <div className="stat-value">{deliveryStats.pending}</div>
                <div className="stat-label">Pending</div>
              </div>
            </div>
            <div className="delivery-stat-card pending">
              <ShieldCheck size={20} />
              <div>
                <div className="stat-value">{deliveryStats.paymentPendingVerification || 0}</div>
                <div className="stat-label">Payment Verify</div>
              </div>
            </div>
            <div className="delivery-stat-card transit">
              <Navigation size={20} />
              <div>
                <div className="stat-value">{deliveryStats.inTransit}</div>
                <div className="stat-label">In Transit</div>
              </div>
            </div>
            <div className="delivery-stat-card delivered">
              <CheckCircle size={20} />
              <div>
                <div className="stat-value">{deliveryStats.delivered}</div>
                <div className="stat-label">Delivered</div>
              </div>
            </div>
            <div className="delivery-stat-card revenue">
              <DollarSign size={20} />
              <div>
                <div className="stat-value">₹{deliveryStats.totalRevenue}</div>
                <div className="stat-label">Revenue</div>
              </div>
            </div>
            <div className="delivery-stat-card distance">
              <MapPin size={20} />
              <div>
                <div className="stat-value">{deliveryStats.avgDistance} km</div>
                <div className="stat-label">Avg Distance</div>
              </div>
            </div>
          </div>
        )}

        <div className="card-header">
          <h2><Truck size={18} /> Platform Deliveries <span className="count-badge">{deliveries.length}</span></h2>
          <div className="admin-filters">
            <button className="btn-action btn-info" onClick={() => navigate('/admin/delivery-map')}>
              <MapPin size={14} /> Live Map
            </button>
            <select
              className="filter-select"
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="payment-pending">Payment Pending</option>
              <option value="payment-rejected">Payment Rejected</option>
              <option value="assigned">Assigned</option>
              <option value="in-transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {deliveries.length === 0 ? (
          <div className="admin-empty">
            <div className="empty-icon"><Truck size={28} /></div>
            <h3>No deliveries</h3>
            <p>No platform delivery requests yet.</p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Food</th>
                  <th>From (Donor)</th>
                  <th>To (NGO)</th>
                  <th>Distance</th>
                  <th>Fee</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td>#{d.id}</td>
                    <td>
                      <div className="user-name-cell">
                        <span className="name">{d.foodName}</span>
                        <span className="email">{d.quantity} {d.unit} — {d.category}</span>
                      </div>
                    </td>
                    <td>
                      <div className="user-name-cell">
                        <span className="name">{d.donorOrg || d.donorName}</span>
                        <span className="email">{d.pickupLocation}</span>
                        {d.donorPhone && <span className="org">{d.donorPhone}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="user-name-cell">
                        <span className="name">{d.ngoOrg || d.ngoName}</span>
                        {d.ngoPhone && <span className="email">{d.ngoPhone}</span>}
                      </div>
                    </td>
                    <td>{d.deliveryDistance && d.deliveryDistance > 0 ? `${d.deliveryDistance} km` : 'N/A'}</td>
                    <td style={{ fontWeight: 600, color: '#059669' }}>₹{d.deliveryFee}</td>
                    <td>
                      <div className="user-name-cell">
                        <span className={`badge ${getStatusBadge(d.paymentStatus || 'not-required')}`}>
                          {(d.paymentStatus || 'not-required').replace('-', ' ')}
                        </span>
                        {d.paymentTransactionId && <span className="email">Txn: {d.paymentTransactionId}</span>}
                        {d.paymentScreenshotUrl && (
                          <a
                            href={`http://localhost:5000${d.paymentScreenshotUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600 }}
                          >
                            View screenshot
                          </a>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(d.deliveryStatus || 'pending')}`}>
                        {d.deliveryStatus || 'pending'}
                      </span>
                    </td>
                    <td>
                      <div className="btn-actions">
                        {d.paymentStatus === 'pending-verification' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <input
                              className="search-input"
                              placeholder="Notes (optional)"
                              value={paymentReviewNotes[d.id] || ''}
                              onChange={(e) => setPaymentReviewNotes(prev => ({ ...prev, [d.id]: e.target.value }))}
                              style={{ width: '100%', minWidth: '120px', fontSize: '12px', padding: '6px 8px' }}
                            />
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                className="btn-action btn-verify"
                                onClick={() => handleReviewDeliveryPayment(d.id, 'approve')}
                                title="Approve payment"
                                style={{ flex: 1, justifyContent: 'center' }}
                              >
                                <CheckCircle size={14} />
                              </button>
                              <button
                                className="btn-action btn-danger"
                                onClick={() => handleReviewDeliveryPayment(d.id, 'reject')}
                                title="Reject payment"
                                style={{ flex: 1, justifyContent: 'center' }}
                              >
                                <XCircle size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                        {(d.paymentStatus === 'verified' || !d.paymentStatus || d.paymentStatus === 'not-required') && (!d.deliveryStatus || d.deliveryStatus === 'pending') && (
                          <button
                            className="btn-action btn-info"
                            onClick={() => navigate('/admin/delivery-map')}
                            title="Open Live Map dispatch"
                          >
                            <MapPin size={14} />
                          </button>
                        )}
                        {d.deliveryStatus === 'assigned' && (
                          <span className="delivery-waiting-claim" title="Driver must claim this delivery from driver dashboard">
                            <Clock size={14} />
                            Waiting claim
                          </span>
                        )}
                        {d.deliveryStatus === 'in-transit' && (
                          <button
                            className="btn-action btn-verify"
                            onClick={() => handleUpdateDeliveryStatus(d.id, 'delivered')}
                            title="Mark Delivered"
                          >
                            <CheckCircle size={14} />
                          </button>
                        )}
                        {(d.paymentStatus === 'verified' || !d.paymentStatus || d.paymentStatus === 'not-required') &&
                          d.deliveryStatus !== 'delivered' && d.deliveryStatus !== 'failed' && (
                          <button
                            className="btn-action btn-delete"
                            onClick={() => handleUpdateDeliveryStatus(d.id, 'failed')}
                            title="Mark Failed"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
};

export default AdminDashboard;

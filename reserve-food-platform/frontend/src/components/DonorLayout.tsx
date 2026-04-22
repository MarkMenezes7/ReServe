import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Leaf,
  Package,
  TrendingUp,
  Calendar,
  Plus,
  LogOut,
  MessageCircle,
  BarChart3,
  User,
  Clock,
  Truck,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import './DonorLayout.css';

interface DonorLayoutProps {
  children: ReactNode;
  socket?: { on: (event: string, cb: (data: unknown) => void) => void; off: (event: string, cb: (data: unknown) => void) => void } | null;
}

export default function DonorLayout({ children, socket }: DonorLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const userName = localStorage.getItem('userName') || 'User';
  const userId = parseInt(localStorage.getItem('userId') || '0');

  function handleLogout() {
    localStorage.clear();
    navigate('/login');
  }

  const navItems = [
    { path: '/donor/dashboard', icon: <TrendingUp className="dl-nav-icon" />, label: 'Overview' },
    { path: '/donor/dashboard', icon: <Package className="dl-nav-icon" />, label: 'My Listings', matchExact: false },
    { path: '/donor/add', icon: <Plus className="dl-nav-icon" />, label: 'Add Listing' },
    { path: '/donor/dashboard', icon: <Calendar className="dl-nav-icon" />, label: 'Claims', matchExact: false },
    { path: '/chat', icon: <MessageCircle className="dl-nav-icon" />, label: 'Chat' },
    { path: '/donor/delivery-map', icon: <Truck className="dl-nav-icon" />, label: 'Delivery Map' },
    { path: '/donor/analytics', icon: <BarChart3 className="dl-nav-icon" />, label: 'Analytics' },
    { path: '/donor/history', icon: <Clock className="dl-nav-icon" />, label: 'History' },
    { path: '/donor/profile', icon: <User className="dl-nav-icon" />, label: 'Profile' },
  ];

  function isActive(item: typeof navItems[0]) {
    // For items that share the dashboard path, only highlight "Overview" on the dashboard
    if (item.path === '/donor/dashboard' && item.label !== 'Overview') return false;
    return location.pathname === item.path;
  }

  return (
    <div className="dl-wrapper">
      <aside className="dl-sidebar">
        <div className="dl-sidebar-header">
          <div className="dl-logo-section" onClick={() => navigate('/')}>
            <Leaf className="dl-logo-icon" />
            <span className="dl-logo-text">ReServe</span>
          </div>
        </div>

        <div className="dl-user-info">
          <div className="dl-user-avatar">
            <Package className="dl-avatar-icon" />
          </div>
          <div className="dl-user-details">
            <h3>{userName}</h3>
            <span className="dl-user-badge">Donor</span>
          </div>
        </div>

        <nav className="dl-sidebar-nav">
          {navItems.map((item, i) => (
            <button
              key={`${item.label}-${i}`}
              className={`dl-nav-item ${isActive(item) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button className="dl-logout-btn" onClick={handleLogout}>
          <LogOut className="dl-logout-icon" />
          <span>Logout</span>
        </button>
      </aside>

      <main className="dl-main">
        <div className="dl-topbar">
          <h1 className="dl-page-title">
            {navItems.find(item => location.pathname === item.path)?.label || 'Dashboard'}
          </h1>
          <div className="dl-topbar-right">
            {userId > 0 && <NotificationBell userId={userId} socket={socket} />}
            <div className="dl-topbar-user">
              <div className="dl-topbar-avatar">{userName[0]?.toUpperCase()}</div>
              <span className="dl-topbar-name">{userName}</span>
            </div>
          </div>
        </div>

        <div className="dl-content">
          {children}
        </div>
      </main>
    </div>
  );
}

import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Leaf,
  LayoutDashboard,
  TrendingUp,
  LogOut,
  MessageCircle,
  MapPin,
  Sparkles,
  Clock,
  Heart,
  User,
  Truck,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import './NGOLayout.css';

interface NGOLayoutProps {
  children: ReactNode;
  socket?: { on: (event: string, cb: (data: unknown) => void) => void; off: (event: string, cb: (data: unknown) => void) => void } | null;
}

export default function NGOLayout({ children, socket }: NGOLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const userName = localStorage.getItem('userName') || 'User';
  const userId = parseInt(localStorage.getItem('userId') || '0');

  function handleLogout() {
    localStorage.clear();
    navigate('/login');
  }

  const navItems = [
    { path: '/ngo/dashboard', icon: <LayoutDashboard className="nl-nav-icon" />, label: 'Dashboard' },
    { path: '/ngo/forecast', icon: <Sparkles className="nl-nav-icon" />, label: 'ML Forecast' },
    { path: '/ngo/impact', icon: <TrendingUp className="nl-nav-icon" />, label: 'Impact' },
    { path: '/ngo/history', icon: <Clock className="nl-nav-icon" />, label: 'History' },
    { path: '/ngo/map', icon: <MapPin className="nl-nav-icon" />, label: 'Map View' },
    { path: '/ngo/delivery-map', icon: <Truck className="nl-nav-icon" />, label: 'Delivery Map' },
    { path: '/chat', icon: <MessageCircle className="nl-nav-icon" />, label: 'Chat' },
    { path: '/ngo/profile', icon: <User className="nl-nav-icon" />, label: 'Profile' },
  ];

  function isActive(item: typeof navItems[0]) {
    return location.pathname === item.path;
  }

  return (
    <div className="nl-wrapper">
      <aside className="nl-sidebar">
        <div className="nl-sidebar-header">
          <div className="nl-logo-section" onClick={() => navigate('/')}>
            <Leaf className="nl-logo-icon" />
            <span className="nl-logo-text">ReServe</span>
          </div>
        </div>

        <div className="nl-user-info">
          <div className="nl-user-avatar">
            <Heart className="nl-avatar-icon" />
          </div>
          <div className="nl-user-details">
            <h3>{userName}</h3>
            <span className="nl-user-badge">NGO</span>
          </div>
        </div>

        <nav className="nl-sidebar-nav">
          {navItems.map((item, i) => (
            <button
              key={`${item.label}-${i}`}
              className={`nl-nav-item ${isActive(item) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button className="nl-logout-btn" onClick={handleLogout}>
          <LogOut className="nl-logout-icon" />
          <span>Logout</span>
        </button>
      </aside>

      <main className="nl-main">
        <div className="nl-topbar">
          <h1 className="nl-page-title">
            {navItems.find(item => location.pathname === item.path)?.label || 'Dashboard'}
          </h1>
          <div className="nl-topbar-right">
            {userId > 0 && <NotificationBell userId={userId} socket={socket} />}
            <div className="nl-topbar-user">
              <div className="nl-topbar-avatar">{userName[0]?.toUpperCase()}</div>
              <span className="nl-topbar-name">{userName}</span>
            </div>
          </div>
        </div>

        <div className="nl-content">
          {children}
        </div>
      </main>
    </div>
  );
}

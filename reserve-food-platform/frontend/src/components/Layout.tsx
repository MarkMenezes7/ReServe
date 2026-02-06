import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, PlusCircle, MessageCircle, BarChart3, Clock, User, Map, TrendingUp, Award, LogOut, Users, Heart } from 'lucide-react';
import NotificationBell from './NotificationBell';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
  socket?: { on: (event: string, cb: (data: unknown) => void) => void; off: (event: string, cb: (data: unknown) => void) => void } | null;
}

export default function Layout({ children, socket }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const userType = localStorage.getItem('userType');
  const userName = localStorage.getItem('userName') || 'User';
  const userId = parseInt(localStorage.getItem('userId') || '0');

  function handleLogout() {
    localStorage.clear();
    navigate('/login');
  }

  const donorLinks = [
    { path: '/donor/dashboard', icon: <Home size={18} />, label: 'Dashboard' },
    { path: '/donor/add', icon: <PlusCircle size={18} />, label: 'Add Listing' },
    { path: '/donor/analytics', icon: <BarChart3 size={18} />, label: 'Analytics' },
    { path: '/donor/history', icon: <Clock size={18} />, label: 'History' },
    { path: '/donor/profile', icon: <User size={18} />, label: 'Profile' },
    { path: '/chat', icon: <MessageCircle size={18} />, label: 'Chat' },
  ];

  const ngoLinks = [
    { path: '/ngo/dashboard', icon: <Home size={18} />, label: 'Dashboard' },
    { path: '/ngo/map', icon: <Map size={18} />, label: 'Map View' },
    { path: '/ngo/forecast', icon: <TrendingUp size={18} />, label: 'Forecasts' },
    { path: '/ngo/history', icon: <Clock size={18} />, label: 'History' },
    { path: '/ngo/impact', icon: <Award size={18} />, label: 'Impact' },
    { path: '/chat', icon: <MessageCircle size={18} />, label: 'Chat' },
  ];

  const adminLinks = [
    { path: '/admin/dashboard', icon: <Home size={18} />, label: 'Dashboard' },
    { path: '/admin/dashboard?tab=users', icon: <Users size={18} />, label: 'Users' },
    { path: '/admin/dashboard?tab=listings', icon: <PlusCircle size={18} />, label: 'Listings' },
    { path: '/admin/dashboard?tab=reviews', icon: <Award size={18} />, label: 'Reviews' },
    { path: '/admin/dashboard?tab=reports', icon: <BarChart3 size={18} />, label: 'Reports' },
    { path: '/admin/dashboard?tab=contact', icon: <MessageCircle size={18} />, label: 'Contact' },
  ];

  const links = userType === 'admin' ? adminLinks : userType === 'ngo' ? ngoLinks : donorLinks;

  return (
    <div className="layout">
      <aside className="layout-sidebar">
        <div className="layout-sidebar-logo" onClick={() => navigate('/')}>
          <Heart size={22} className="layout-logo-icon" />
          <span>ReServe</span>
        </div>

        <nav className="layout-nav">
          {links.map(link => (
            <button
              key={link.path}
              className={`layout-nav-item ${location.pathname + location.search === link.path || (location.pathname === link.path.split('?')[0] && !link.path.includes('?')) ? 'active' : ''}`}
              onClick={() => navigate(link.path)}
            >
              {link.icon}
              <span>{link.label}</span>
            </button>
          ))}
        </nav>

        <div className="layout-sidebar-footer">
          <button className="layout-nav-item" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="layout-main">
        <header className="layout-topbar">
          <div className="layout-topbar-left">
            <h2 className="layout-page-title">
              {links.find(l => l.path.split('?')[0] === location.pathname)?.label || 'Dashboard'}
            </h2>
          </div>
          <div className="layout-topbar-right">
            {userId > 0 && <NotificationBell userId={userId} socket={socket} />}
            <div className="layout-user-info">
              <div className="layout-user-avatar">{userName[0].toUpperCase()}</div>
              <span className="layout-user-name">{userName}</span>
            </div>
          </div>
        </header>

        <div className="layout-content">
          {children}
        </div>
      </main>
    </div>
  );
}

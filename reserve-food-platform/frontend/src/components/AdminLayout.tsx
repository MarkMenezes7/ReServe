import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Leaf,
  BarChart3,
  Truck,
  Shield,
  LogOut,
} from 'lucide-react';
import './AdminLayout.css';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const userName = localStorage.getItem('userName') || 'Admin';

  const navItems = [
    { path: '/admin/dashboard', icon: <BarChart3 size={18} />, label: 'Dashboard' },
    { path: '/admin/delivery-map', icon: <Truck size={18} />, label: 'Delivery Map' },
  ];

  const currentLabel = navItems.find((item) => location.pathname === item.path)?.label || 'Admin';

  function handleLogout() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <div className="al-wrapper">
      <aside className="al-sidebar">
        <div className="al-sidebar-header">
          <div className="al-logo-section" onClick={() => navigate('/')}>
            <Leaf className="al-logo-icon" />
            <span className="al-logo-text">ReServe</span>
          </div>
        </div>

        <div className="al-user-info">
          <div className="al-user-avatar">
            <Shield className="al-avatar-icon" />
          </div>
          <div className="al-user-details">
            <h3>{userName}</h3>
            <span className="al-user-badge">Administrator</span>
          </div>
        </div>

        <nav className="al-sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.path}
              className={`al-nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button className="al-logout-btn" onClick={handleLogout}>
          <LogOut className="al-logout-icon" />
          <span>Logout</span>
        </button>
      </aside>

      <main className="al-main">
        <div className="al-topbar">
          <h1 className="al-page-title">{currentLabel}</h1>
          <div className="al-topbar-user">
            <div className="al-topbar-avatar">{userName[0]?.toUpperCase()}</div>
            <span className="al-topbar-name">{userName}</span>
          </div>
        </div>

        <div className="al-content">{children}</div>
      </main>
    </div>
  );
}
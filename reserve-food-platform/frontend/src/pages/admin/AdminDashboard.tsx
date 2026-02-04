import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LogOut } from 'lucide-react';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem('userName') || 'Admin';

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-title">
          <ShieldCheck size={24} />
          <h1>Admin Dashboard</h1>
        </div>
        <button className="admin-logout" onClick={handleLogout}>
          <LogOut size={18} />
          Logout
        </button>
      </header>

      <main className="admin-content">
        <div className="admin-card">
          <h2>Welcome, {userName}</h2>
          <p>This is the admin panel placeholder for the MVP.</p>
          <p>Upcoming: user management, listings moderation, and analytics.</p>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;

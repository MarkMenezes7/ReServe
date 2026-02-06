import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import NGODashboard from './pages/ngo/NGODashboard';
import NGOMapPage from './pages/ngo/NGOMapPage';
import NGOForecastPage from './pages/ngo/NGOForecastPage';
import NGOCollectionHistory from './pages/ngo/NGOCollectionHistory';
import NGOImpactDashboard from './pages/ngo/NGOImpactDashboard';
import DonorDashboard from './pages/donor/DonorDashboard';
import AddListingPage from './pages/donor/AddListingPage';
import EditListingPage from './pages/donor/EditListingPage';
import DonorAnalyticsPage from './pages/donor/DonorAnalyticsPage';
import DonorHistoryPage from './pages/donor/DonorHistoryPage';
import DonorProfilePage from './pages/donor/DonorProfilePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import ChatPage from './pages/chat/ChatPage';
import ReviewPage from './pages/review/ReviewPage';
import SupportUsPage from './pages/support/SupportUsPage';
import NotFound from './pages/common/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import SimplePage from './pages/common/SimplePage';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/support" element={<SupportUsPage />} />
        <Route path="/forgot-password" element={<SimplePage title="Forgot Password" subtitle="Password reset flow will be added in a later phase." />} />
        <Route path="/terms" element={<SimplePage title="Terms of Service" subtitle="Terms content will be added before launch." />} />
        <Route path="/privacy" element={<SimplePage title="Privacy Policy" subtitle="Privacy policy content will be added before launch." />} />

        {/* NGO routes */}
        <Route path="/ngo/dashboard" element={<ProtectedRoute allowed={['ngo']}><NGODashboard /></ProtectedRoute>} />
        <Route path="/ngo/map" element={<ProtectedRoute allowed={['ngo']}><NGOMapPage /></ProtectedRoute>} />
        <Route path="/ngo/forecast" element={<ProtectedRoute allowed={['ngo']}><NGOForecastPage /></ProtectedRoute>} />
        <Route path="/ngo/history" element={<ProtectedRoute allowed={['ngo']}><NGOCollectionHistory /></ProtectedRoute>} />
        <Route path="/ngo/impact" element={<ProtectedRoute allowed={['ngo']}><NGOImpactDashboard /></ProtectedRoute>} />

        {/* Donor routes */}
        <Route path="/donor/dashboard" element={<ProtectedRoute allowed={['donor']}><DonorDashboard /></ProtectedRoute>} />
        <Route path="/donor/add" element={<ProtectedRoute allowed={['donor']}><AddListingPage /></ProtectedRoute>} />
        <Route path="/donor/edit/:id" element={<ProtectedRoute allowed={['donor']}><EditListingPage /></ProtectedRoute>} />
        <Route path="/donor/analytics" element={<ProtectedRoute allowed={['donor']}><DonorAnalyticsPage /></ProtectedRoute>} />
        <Route path="/donor/history" element={<ProtectedRoute allowed={['donor']}><DonorHistoryPage /></ProtectedRoute>} />
        <Route path="/donor/profile" element={<ProtectedRoute allowed={['donor']}><DonorProfilePage /></ProtectedRoute>} />

        {/* Admin routes */}
        <Route path="/admin/dashboard" element={<ProtectedRoute allowed={['admin']}><AdminDashboard /></ProtectedRoute>} />

        {/* Shared routes */}
        <Route path="/chat" element={<ProtectedRoute allowed={['donor', 'ngo']}><ChatPage /></ProtectedRoute>} />
        <Route path="/review/:claimId" element={<ProtectedRoute allowed={['donor', 'ngo']}><ReviewPage /></ProtectedRoute>} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;

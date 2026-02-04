import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import NGODashboard from './pages/ngo/NGODashboard';
import DonorDashboard from './pages/donor/DonorDashboard';
import AddListingPage from './pages/donor/AddListingPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import NotFound from './pages/common/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import SimplePage from './pages/common/SimplePage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<SimplePage title="Forgot Password" subtitle="Password reset flow will be added in a later phase." />} />
        <Route path="/terms" element={<SimplePage title="Terms of Service" subtitle="Terms content will be added before launch." />} />
        <Route path="/privacy" element={<SimplePage title="Privacy Policy" subtitle="Privacy policy content will be added before launch." />} />
        <Route
          path="/ngo/dashboard"
          element={
            <ProtectedRoute allowed={['ngo']}>
              <NGODashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/donor/dashboard"
          element={
            <ProtectedRoute allowed={['donor']}>
              <DonorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/donor/add"
          element={
            <ProtectedRoute allowed={['donor']}>
              <AddListingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowed={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;

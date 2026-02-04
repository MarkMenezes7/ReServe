import { motion } from 'framer-motion';
import { useState, FormEvent, ChangeEvent } from 'react';
import { Leaf, Mail, Lock, Eye, EyeOff, User, Building2, Heart, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import './Signup.css';

type UserType = 'donor' | 'ngo';

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  organizationName: string;
}

const Signup = () => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [userType, setUserType] = useState<UserType>('donor');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords don't match!");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          userType: userType,
          organizationName: formData.organizationName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Store user data
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userType', data.user.userType);
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('userName', data.user.name);
      localStorage.setItem('userEmail', data.user.email);
      localStorage.setItem('token', data.token);

      console.log('Registration successful:', data.user);

      // Show success message
      alert('Account created successfully! Redirecting to dashboard...');

      // Redirect based on user type
      setTimeout(() => {
        if (data.user.userType === 'donor') {
          navigate('/donor/dashboard');
        } else if (data.user.userType === 'ngo') {
          navigate('/ngo/dashboard');
        }
      }, 500);

    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear error when user starts typing
    if (error) setError('');
  };

  return (
    <div className="auth-container">
      {/* Animated Background */}
      <div className="auth-background">
        <motion.div
          className="auth-orb auth-orb-1"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="auth-orb auth-orb-2"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -30, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Logo */}
      <motion.div
        className="auth-logo"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Link to="/" className="auth-logo-link">
          <Leaf className="auth-logo-icon" />
          <span className="auth-logo-text">ReServe</span>
        </Link>
      </motion.div>

      {/* Signup Card */}
      <motion.div
        className="auth-card auth-card-signup"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="auth-card-content">
          {/* Header */}
          <div className="auth-header">
            <h1 className="auth-title">Create Account</h1>
            <p className="auth-subtitle">Join us in the fight against food waste</p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              className="error-message"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.div>
          )}

          {/* User Type Selection - Only Donor and NGO */}
          <div className="user-type-selection user-type-selection-two">
            <motion.button
              type="button"
              className={`user-type-btn ${userType === 'donor' ? 'active' : ''}`}
              onClick={() => setUserType('donor')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={loading}
            >
              <Building2 className="user-type-icon" />
              <span>Donor</span>
            </motion.button>

            <motion.button
              type="button"
              className={`user-type-btn ${userType === 'ngo' ? 'active' : ''}`}
              onClick={() => setUserType('ngo')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={loading}
            >
              <Heart className="user-type-icon" />
              <span>NGO</span>
            </motion.button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="auth-form">
            {/* Name Input */}
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="input-wrapper">
                <User className="input-icon" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="form-input"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Organization Name */}
            <div className="form-group">
              <label className="form-label">
                {userType === 'donor' ? 'Restaurant/Business Name' : 'NGO Name'}
              </label>
              <div className="input-wrapper">
                <Building2 className="input-icon" />
                <input
                  type="text"
                  name="organizationName"
                  value={formData.organizationName}
                  onChange={handleChange}
                  placeholder={userType === 'donor' ? 'Your Restaurant' : 'Your NGO'}
                  className="form-input"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <Mail className="input-icon" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="form-input"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a strong password"
                  className="form-input"
                  required
                  minLength={6}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="toggle-icon" /> : <Eye className="toggle-icon" />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  className="form-input"
                  required
                  minLength={6}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="password-toggle"
                  disabled={loading}
                >
                  {showConfirmPassword ? <EyeOff className="toggle-icon" /> : <Eye className="toggle-icon" />}
                </button>
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="form-group">
              <label className="checkbox-label checkbox-label-block">
                <input type="checkbox" className="checkbox-input" required disabled={loading} />
                <span>
                  I agree to the{' '}
                  <Link to="/terms" className="inline-link">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="inline-link">Privacy Policy</Link>
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              className="btn-submit"
              whileHover={!loading ? { scale: 1.02, y: -2 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner-small"></div>
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="btn-submit-icon" />
                </>
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="auth-divider">
            <span className="divider-line"></span>
            <span className="divider-text">or continue with</span>
            <span className="divider-line"></span>
          </div>

          {/* Social Signup */}
          <div className="social-buttons">
            <motion.button
              className="btn-social"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={loading}
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="social-icon" />
              <span>Google</span>
            </motion.button>
          </div>

          {/* Login Link */}
          <p className="auth-footer-text">
            Already have an account?{' '}
            <Link to="/login" className="auth-footer-link">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;
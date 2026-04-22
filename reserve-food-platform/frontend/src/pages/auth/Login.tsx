import { motion, AnimatePresence } from 'framer-motion';
import { useState, FormEvent, ChangeEvent } from 'react';
import { Leaf, Mail, Lock, Eye, EyeOff, ArrowRight, Utensils, Heart, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import './Login.css';

interface FormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
}

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<FormData>({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const navigate = useNavigate();

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    return undefined;
  };

  const validatePassword = (password: string): string | undefined => {
    if (!password) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {
      email: validateEmail(formData.email),
      password: validatePassword(formData.password),
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some(Boolean);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userType', data.user.userType);
      localStorage.setItem('userId', data.user.id.toString());
      localStorage.setItem('userName', data.user.name);
      localStorage.setItem('userEmail', data.user.email);
      localStorage.setItem('token', data.token);
      localStorage.setItem('isVerified', data.user.isVerified?.toString() || '0');
      if (data.user.organizationName) {
        localStorage.setItem('organizationName', data.user.organizationName);
      }

      setTimeout(() => {
        if (data.user.userType === 'donor') navigate('/donor/dashboard');
        else if (data.user.userType === 'ngo') navigate('/ngo/dashboard');
        else if (data.user.userType === 'admin') navigate('/admin/dashboard');
        else if (data.user.userType === 'driver') navigate('/driver/dashboard');
      }, 300);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (error) setError('');
    if (errors[name as keyof FormErrors]) {
      setErrors({ ...errors, [name]: undefined });
    }
  };

  const features = [
    { icon: <Utensils />, text: 'Connect surplus food with those in need' },
    { icon: <Heart />, text: 'Reduce waste, feed communities' },
    { icon: <ShieldCheck />, text: 'Trusted by 500+ organizations' },
  ];

  return (
    <div className="login-page">
      {/* Left Panel - Branding */}
      <motion.div
        className="login-brand-panel"
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        <div className="login-brand-bg">
          <div className="login-blob login-blob-1" />
          <div className="login-blob login-blob-2" />
          <div className="login-blob login-blob-3" />
        </div>

        <div className="login-brand-content">
          <Link to="/" className="login-brand-logo">
            <Leaf className="login-brand-logo-icon" />
            <span className="login-brand-logo-text">
              <span className="login-brand-re">Re</span>
              <span className="login-brand-serve">Serve</span>
            </span>
          </Link>

          <div className="login-brand-hero">
            <motion.h1
              className="login-brand-title"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              Every meal saved<br />is a life touched.
            </motion.h1>
            <motion.p
              className="login-brand-desc"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              Join the movement to end food waste and hunger in your community.
            </motion.p>
          </div>

          <div className="login-brand-features">
            {features.map((f, i) => (
              <motion.div
                key={i}
                className="login-brand-feature"
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.15, duration: 0.5 }}
              >
                <div className="login-feature-icon">{f.icon}</div>
                <span>{f.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Right Panel - Form */}
      <motion.div
        className="login-form-panel"
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        {/* Mobile logo */}
        <div className="login-mobile-logo">
          <Link to="/" className="login-brand-logo">
            <Leaf className="login-brand-logo-icon login-brand-logo-icon--dark" />
            <span className="login-brand-logo-text">
              <span className="login-brand-re">Re</span>
              <span className="login-brand-serve">Serve</span>
            </span>
          </Link>
        </div>

        <div className="login-form-wrapper">
          <div className="login-form-header">
            <motion.h2
              className="login-form-title"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Welcome back
            </motion.h2>
            <motion.p
              className="login-form-subtitle"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Sign in to your account to continue
            </motion.p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                className="login-error"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="login-error-inner">{error}</div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.form
            onSubmit={handleSubmit}
            className="login-form"
            noValidate
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.45 }}
          >
            {/* Email */}
            <div className="login-field">
              <label className="login-label">Email Address</label>
              <div className={`login-input-box ${focused === 'email' ? 'focused' : ''} ${errors.email ? 'has-error' : ''}`}>
                <Mail className="login-input-icon" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  placeholder="you@example.com"
                  className="login-input"
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <motion.span className="login-field-error" initial={{ y: -5, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                  {errors.email}
                </motion.span>
              )}
            </div>

            {/* Password */}
            <div className="login-field">
              <label className="login-label">Password</label>
              <div className={`login-input-box ${focused === 'password' ? 'focused' : ''} ${errors.password ? 'has-error' : ''}`}>
                <Lock className="login-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  placeholder="Enter your password"
                  className="login-input"
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-eye-btn"
                  disabled={loading}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {errors.password && (
                <motion.span className="login-field-error" initial={{ y: -5, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                  {errors.password}
                </motion.span>
              )}
            </div>

            {/* Options row */}
            <div className="login-options">
              <label className="login-remember">
                <input type="checkbox" disabled={loading} />
                <span className="login-check-box" />
                <span>Remember me</span>
              </label>
              <Link to="/forgot-password" className="login-forgot">Forgot password?</Link>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              className="login-submit"
              whileHover={!loading ? { scale: 1.015 } : {}}
              whileTap={!loading ? { scale: 0.985 } : {}}
              disabled={loading}
            >
              {loading ? (
                <span className="login-submit-loading">
                  <span className="login-spinner" />
                  Signing in...
                </span>
              ) : (
                <span className="login-submit-content">
                  Sign In
                  <ArrowRight className="login-submit-arrow" />
                </span>
              )}
            </motion.button>
          </motion.form>

          <p className="login-footer">
            Don't have an account?{' '}
            <Link to="/signup" className="login-footer-link">Create one</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;

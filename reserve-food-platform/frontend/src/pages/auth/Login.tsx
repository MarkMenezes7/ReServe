import { motion } from 'framer-motion';
import { useState, FormEvent, ChangeEvent } from 'react';
import { Leaf, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
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

  return (
    <div className="auth-container">
      <div className="auth-background">
        <motion.div className="auth-orb auth-orb-1"
          animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div className="auth-orb auth-orb-2"
          animate={{ scale: [1, 1.3, 1], x: [0, -30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div className="auth-logo"
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
      >
        <Link to="/" className="auth-logo-link">
          <Leaf className="auth-logo-icon" />
          <span className="auth-logo-text">
            <span className="auth-logo-re">Re</span>
            <span className="auth-logo-serve">Serve</span>
          </span>
        </Link>
      </motion.div>

      <motion.div className="auth-card"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="auth-card-content">
          <div className="auth-header">
            <h1 className="auth-title">Welcome Back</h1>
            <p className="auth-subtitle">Sign in to continue saving food and feeding communities</p>
          </div>

          {error && (
            <motion.div className="error-message" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <Mail className="input-icon" />
                <input
                  type="email" name="email" value={formData.email} onChange={handleChange}
                  placeholder="you@example.com"
                  className={`form-input ${errors.email ? 'input-error' : ''}`}
                  disabled={loading}
                />
              </div>
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'} name="password"
                  value={formData.password} onChange={handleChange}
                  placeholder="Enter your password"
                  className={`form-input ${errors.password ? 'input-error' : ''}`}
                  disabled={loading}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle" disabled={loading}>
                  {showPassword ? <EyeOff className="toggle-icon" /> : <Eye className="toggle-icon" />}
                </button>
              </div>
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <div className="admin-hint">
              <small>Admin: <code>admin@reserve.org</code> / <code>admin123</code></small>
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" className="checkbox-input" disabled={loading} />
                <span>Remember me</span>
              </label>
              <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
            </div>

            <motion.button type="submit" className="btn-submit"
              whileHover={!loading ? { scale: 1.02, y: -2 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
              disabled={loading}
            >
              {loading ? (
                <><div className="spinner-small"></div><span>Signing in...</span></>
              ) : (
                <><span>Sign In</span><ArrowRight className="btn-submit-icon" /></>
              )}
            </motion.button>
          </form>

          <div className="auth-divider">
            <span className="divider-line"></span>
            <span className="divider-text">or continue with</span>
            <span className="divider-line"></span>
          </div>

          <div className="social-buttons">
            <motion.button className="btn-social" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={loading}>
              <img src="https://www.google.com/favicon.ico" alt="Google" className="social-icon" />
              <span>Google</span>
            </motion.button>
          </div>

          <p className="auth-footer-text">
            Don't have an account?{' '}
            <Link to="/signup" className="auth-footer-link">Sign up</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;

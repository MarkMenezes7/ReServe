import { motion } from 'framer-motion';
import { useState, FormEvent, ChangeEvent } from 'react';
import { Leaf, Mail, Lock, Eye, EyeOff, User, Building2, Heart, ArrowRight, Phone, MapPin } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import './Signup.css';

type UserType = 'donor' | 'ngo';

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  organizationName: string;
  phone: string;
  address: string;
  city: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  organizationName?: string;
  phone?: string;
  city?: string;
}

const Signup = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [userType, setUserType] = useState<UserType>('donor');
  const [formData, setFormData] = useState<FormData>({
    name: '', email: '', password: '', confirmPassword: '',
    organizationName: '', phone: '', address: '', city: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const getPasswordStrength = (password: string): { level: number; label: string; className: string } => {
    if (!password) return { level: 0, label: '', className: '' };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { level: 1, label: 'Weak', className: 'weak' };
    if (score <= 2) return { level: 2, label: 'Fair', className: 'fair' };
    if (score <= 3) return { level: 3, label: 'Good', className: 'good' };
    return { level: 4, label: 'Strong', className: 'strong' };
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Full name is required';
    else if (formData.name.trim().length < 2) newErrors.name = 'Name must be at least 2 characters';

    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Please enter a valid email';

    if (!formData.organizationName.trim()) {
      newErrors.organizationName = userType === 'donor' ? 'Restaurant/business name is required' : 'NGO name is required';
    }

    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';

    if (!formData.confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords don't match";

    if (formData.phone && !/^[+]?[\d\s()-]{7,15}$/.test(formData.phone)) newErrors.phone = 'Please enter a valid phone number';

    if (!formData.city.trim()) newErrors.city = 'City is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name, email: formData.email, password: formData.password,
          userType, organizationName: formData.organizationName,
          phone: formData.phone, address: formData.address, city: formData.city,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');

      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userType', data.user.userType);
      localStorage.setItem('userId', data.user.id.toString());
      localStorage.setItem('userName', data.user.name);
      localStorage.setItem('userEmail', data.user.email);
      localStorage.setItem('token', data.token);
      localStorage.setItem('isVerified', '0');
      if (data.user.organizationName) localStorage.setItem('organizationName', data.user.organizationName);

      setTimeout(() => {
        if (data.user.userType === 'donor') navigate('/donor/dashboard');
        else if (data.user.userType === 'ngo') navigate('/ngo/dashboard');
      }, 300);
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (error) setError('');
    if (errors[name as keyof FormErrors]) setErrors({ ...errors, [name]: undefined });
  };

  const strength = getPasswordStrength(formData.password);

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

      <motion.div className="auth-card auth-card-signup"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="auth-card-content">
          <div className="auth-header">
            <h1 className="auth-title">Create Account</h1>
            <p className="auth-subtitle">Join us in the fight against food waste</p>
          </div>

          {error && (
            <motion.div className="error-message" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              {error}
            </motion.div>
          )}

          <div className="user-type-selection user-type-selection-two">
            <motion.button type="button" className={`user-type-btn ${userType === 'donor' ? 'active' : ''}`}
              onClick={() => setUserType('donor')} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={loading}>
              <Building2 className="user-type-icon" /><span>Restaurant / Donor</span>
            </motion.button>
            <motion.button type="button" className={`user-type-btn ${userType === 'ngo' ? 'active' : ''}`}
              onClick={() => setUserType('ngo')} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={loading}>
              <Heart className="user-type-icon" /><span>NGO</span>
            </motion.button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <div className="input-wrapper">
                <User className="input-icon" />
                <input type="text" name="name" value={formData.name} onChange={handleChange}
                  placeholder="John Doe" className={`form-input ${errors.name ? 'input-error' : ''}`} disabled={loading} />
              </div>
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">{userType === 'donor' ? 'Restaurant/Business Name *' : 'NGO Name *'}</label>
              <div className="input-wrapper">
                <Building2 className="input-icon" />
                <input type="text" name="organizationName" value={formData.organizationName} onChange={handleChange}
                  placeholder={userType === 'donor' ? 'Your Restaurant' : 'Your NGO'}
                  className={`form-input ${errors.organizationName ? 'input-error' : ''}`} disabled={loading} />
              </div>
              {errors.organizationName && <span className="field-error">{errors.organizationName}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <div className="input-wrapper">
                <Mail className="input-icon" />
                <input type="email" name="email" value={formData.email} onChange={handleChange}
                  placeholder="you@example.com" className={`form-input ${errors.email ? 'input-error' : ''}`} disabled={loading} />
              </div>
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <div className="input-wrapper">
                <Phone className="input-icon" />
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                  placeholder="+91 98765 43210" className={`form-input ${errors.phone ? 'input-error' : ''}`} disabled={loading} />
              </div>
              {errors.phone && <span className="field-error">{errors.phone}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">City *</label>
              <div className="input-wrapper">
                <MapPin className="input-icon" />
                <input type="text" name="city" value={formData.city} onChange={handleChange}
                  placeholder="Mumbai" className={`form-input ${errors.city ? 'input-error' : ''}`} disabled={loading} />
              </div>
              {errors.city && <span className="field-error">{errors.city}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <div className="input-wrapper">
                <MapPin className="input-icon" />
                <input type="text" name="address" value={formData.address} onChange={handleChange}
                  placeholder="123 Street, Area" className="form-input" disabled={loading} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password *</label>
              <div className="input-wrapper">
                <Lock className="input-icon" />
                <input type={showPassword ? 'text' : 'password'} name="password"
                  value={formData.password} onChange={handleChange}
                  placeholder="Create a strong password"
                  className={`form-input ${errors.password ? 'input-error' : ''}`} disabled={loading} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle" disabled={loading}>
                  {showPassword ? <EyeOff className="toggle-icon" /> : <Eye className="toggle-icon" />}
                </button>
              </div>
              {errors.password && <span className="field-error">{errors.password}</span>}
              {formData.password && (
                <div className="password-strength">
                  <div className="strength-bar-container">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className={`strength-bar-segment ${i <= strength.level ? `active ${strength.className}` : ''}`} />
                    ))}
                  </div>
                  <span className={`strength-text ${strength.className}`}>{strength.label}</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password *</label>
              <div className="input-wrapper">
                <Lock className="input-icon" />
                <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword"
                  value={formData.confirmPassword} onChange={handleChange}
                  placeholder="Confirm your password"
                  className={`form-input ${errors.confirmPassword ? 'input-error' : ''}`} disabled={loading} />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="password-toggle" disabled={loading}>
                  {showConfirmPassword ? <EyeOff className="toggle-icon" /> : <Eye className="toggle-icon" />}
                </button>
              </div>
              {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
            </div>

            <div className="form-group">
              <label className="checkbox-label checkbox-label-block">
                <input type="checkbox" className="checkbox-input" required disabled={loading} />
                <span>
                  I agree to the <Link to="/terms" className="inline-link">Terms of Service</Link>
                  {' '}and <Link to="/privacy" className="inline-link">Privacy Policy</Link>
                </span>
              </label>
            </div>

            <motion.button type="submit" className="btn-submit"
              whileHover={!loading ? { scale: 1.02, y: -2 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
              disabled={loading}
            >
              {loading ? (
                <><div className="spinner-small"></div><span>Creating Account...</span></>
              ) : (
                <><span>Create Account</span><ArrowRight className="btn-submit-icon" /></>
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
            Already have an account?{' '}
            <Link to="/login" className="auth-footer-link">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;

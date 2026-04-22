import { motion, AnimatePresence } from 'framer-motion';
import { useState, FormEvent, ChangeEvent } from 'react';
import {
  Leaf, Mail, Lock, Eye, EyeOff, User, Building2, Heart,
  ArrowRight, Phone, MapPin, Utensils, ShieldCheck, Truck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import './Signup.css';

type UserType = 'donor' | 'ngo' | 'driver';

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
  const [focused, setFocused] = useState<string | null>(null);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const navigate = useNavigate();

  const getPasswordStrength = (password: string): { level: number; label: string; cls: string } => {
    if (!password) return { level: 0, label: '', cls: '' };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { level: 1, label: 'Weak', cls: 'weak' };
    if (score <= 2) return { level: 2, label: 'Fair', cls: 'fair' };
    if (score <= 3) return { level: 3, label: 'Good', cls: 'good' };
    return { level: 4, label: 'Strong', cls: 'strong' };
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Full name is required';
    else if (formData.name.trim().length < 2) newErrors.name = 'Name must be at least 2 characters';

    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Please enter a valid email';

    if (userType !== 'driver' && !formData.organizationName.trim()) {
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
        else if (data.user.userType === 'driver') navigate('/driver/dashboard');
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

  const features = [
    { icon: <Utensils />, text: 'List surplus food in seconds' },
    { icon: <Heart />, text: 'Matched with nearby NGOs instantly' },
    { icon: <ShieldCheck />, text: 'Verified, safe, and transparent' },
  ];

  /* reusable field builder */
  const renderField = (
    name: keyof FormData,
    label: string,
    icon: React.ReactNode,
    placeholder: string,
    type = 'text',
    required = false,
  ) => (
    <div className="signup-field" key={name}>
      <label className="signup-label">{label}{required && ' *'}</label>
      <div className={`signup-input-box ${focused === name ? 'focused' : ''} ${errors[name as keyof FormErrors] ? 'has-error' : ''}`}>
        <span className="signup-input-icon">{icon}</span>
        <input
          type={type}
          name={name}
          value={formData[name]}
          onChange={handleChange}
          onFocus={() => setFocused(name)}
          onBlur={() => setFocused(null)}
          placeholder={placeholder}
          className="signup-input"
          disabled={loading}
        />
      </div>
      {errors[name as keyof FormErrors] && (
        <motion.span className="signup-field-error" initial={{ y: -5, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          {errors[name as keyof FormErrors]}
        </motion.span>
      )}
    </div>
  );

  const renderPasswordField = (
    name: 'password' | 'confirmPassword',
    label: string,
    placeholder: string,
    show: boolean,
    toggle: () => void,
  ) => (
    <div className="signup-field" key={name}>
      <label className="signup-label">{label} *</label>
      <div className={`signup-input-box ${focused === name ? 'focused' : ''} ${errors[name] ? 'has-error' : ''}`}>
        <span className="signup-input-icon"><Lock /></span>
        <input
          type={show ? 'text' : 'password'}
          name={name}
          value={formData[name]}
          onChange={handleChange}
          onFocus={() => setFocused(name)}
          onBlur={() => setFocused(null)}
          placeholder={placeholder}
          className="signup-input"
          disabled={loading}
        />
        <button type="button" onClick={toggle} className="signup-eye-btn" disabled={loading} tabIndex={-1}>
          {show ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {errors[name] && (
        <motion.span className="signup-field-error" initial={{ y: -5, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          {errors[name]}
        </motion.span>
      )}
      {name === 'password' && formData.password && (
        <div className="signup-strength">
          <div className="signup-strength-bars">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`signup-strength-seg ${i <= strength.level ? `active ${strength.cls}` : ''}`} />
            ))}
          </div>
          <span className={`signup-strength-label ${strength.cls}`}>{strength.label}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="signup-page">
      {/* Left panel */}
      <motion.div
        className="signup-brand-panel"
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        <div className="signup-brand-bg">
          <div className="signup-blob signup-blob-1" />
          <div className="signup-blob signup-blob-2" />
          <div className="signup-blob signup-blob-3" />
        </div>

        <div className="signup-brand-content">
          <Link to="/" className="signup-brand-logo">
            <Leaf className="signup-brand-logo-icon" />
            <span className="signup-brand-logo-text">
              <span className="signup-brand-re">Re</span>
              <span className="signup-brand-serve">Serve</span>
            </span>
          </Link>

          <div className="signup-brand-hero">
            <motion.h1
              className="signup-brand-title"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              Start making a<br />difference today.
            </motion.h1>
            <motion.p
              className="signup-brand-desc"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              Create your free account and join hundreds of restaurants & NGOs reducing food waste together.
            </motion.p>
          </div>

          <div className="signup-brand-features">
            {features.map((f, i) => (
              <motion.div
                key={i}
                className="signup-brand-feature"
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.15, duration: 0.5 }}
              >
                <div className="signup-feature-icon">{f.icon}</div>
                <span>{f.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Right panel */}
      <motion.div
        className="signup-form-panel"
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        {/* Mobile logo */}
        <div className="signup-mobile-logo">
          <Link to="/" className="signup-brand-logo">
            <Leaf className="signup-brand-logo-icon signup-brand-logo-icon--dark" />
            <span className="signup-brand-logo-text">
              <span className="signup-brand-re" style={{ color: '#10b981' }}>Re</span>
              <span className="signup-brand-serve" style={{ color: '#1f2937' }}>Serve</span>
            </span>
          </Link>
        </div>

        <div className="signup-form-wrapper">
          <div className="signup-form-header">
            <motion.h2
              className="signup-form-title"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Create your account
            </motion.h2>
            <motion.p
              className="signup-form-subtitle"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Join the fight against food waste
            </motion.p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                className="signup-error"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="signup-error-inner">{error}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* User Type Toggle */}
          <motion.div
            className="signup-type-toggle"
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.42 }}
          >
            <button
              type="button"
              className={`signup-type-btn ${userType === 'donor' ? 'active' : ''}`}
              onClick={() => setUserType('donor')}
              disabled={loading}
            >
              <Building2 className="signup-type-icon" />
              Restaurant / Donor
            </button>
            <button
              type="button"
              className={`signup-type-btn ${userType === 'ngo' ? 'active' : ''}`}
              onClick={() => setUserType('ngo')}
              disabled={loading}
            >
              <Heart className="signup-type-icon" />
              NGO
            </button>
            <button
              type="button"
              className={`signup-type-btn ${userType === 'driver' ? 'active' : ''}`}
              onClick={() => setUserType('driver')}
              disabled={loading}
            >
              <Truck className="signup-type-icon" />
              Driver
            </button>
          </motion.div>

          <motion.form
            onSubmit={handleSubmit}
            className="signup-form"
            noValidate
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.48 }}
          >
            <div className="signup-form-grid">
              {renderField('name', 'Full Name', <User />, 'John Doe', 'text', true)}
              {renderField(
                'organizationName',
                userType === 'donor' ? 'Business Name' : userType === 'ngo' ? 'NGO Name' : 'Vehicle / Fleet Name',
                userType === 'driver' ? <Truck /> : <Building2 />,
                userType === 'donor' ? 'Your Restaurant' : userType === 'ngo' ? 'Your NGO' : 'Optional',
                'text',
                userType !== 'driver',
              )}
              {renderField('email', 'Email Address', <Mail />, 'you@example.com', 'email', true)}
              {renderField('phone', 'Phone Number', <Phone />, '+91 98765 43210', 'tel')}
              {renderField('city', 'City', <MapPin />, 'Mumbai', 'text', true)}
              {renderField('address', 'Address', <MapPin />, '123 Street, Area')}
            </div>

            <div className="signup-pw-row">
              {renderPasswordField('password', 'Password', 'Create a strong password', showPassword, () => setShowPassword(!showPassword))}
              {renderPasswordField('confirmPassword', 'Confirm Password', 'Re-enter password', showConfirmPassword, () => setShowConfirmPassword(!showConfirmPassword))}
            </div>

            {/* Terms */}
            <label className="signup-terms">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={() => setAgreedTerms(!agreedTerms)}
                disabled={loading}
              />
              <span className="signup-terms-box" />
              <span className="signup-terms-text">
                I agree to the <Link to="/terms" className="signup-inline-link">Terms of Service</Link>
                {' '}and <Link to="/privacy" className="signup-inline-link">Privacy Policy</Link>
              </span>
            </label>

            {/* Submit */}
            <motion.button
              type="submit"
              className="signup-submit"
              whileHover={!loading ? { scale: 1.015 } : {}}
              whileTap={!loading ? { scale: 0.985 } : {}}
              disabled={loading}
            >
              {loading ? (
                <span className="signup-submit-loading">
                  <span className="signup-spinner" />
                  Creating Account...
                </span>
              ) : (
                <span className="signup-submit-content">
                  Create Account
                  <ArrowRight className="signup-submit-arrow" />
                </span>
              )}
            </motion.button>
          </motion.form>

          <p className="signup-footer">
            Already have an account?{' '}
            <Link to="/login" className="signup-footer-link">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;

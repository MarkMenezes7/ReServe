import { motion } from 'framer-motion';
import { ShieldAlert, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import './VerificationBanner.css';

interface VerificationBannerProps {
  userType: string;
}

const VerificationBanner = ({ userType }: VerificationBannerProps) => {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  useEffect(() => {
    const checkVerification = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const response = await fetch('http://localhost:5000/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const user = await response.json();
          setIsVerified(!!user.isVerified);
          localStorage.setItem('isVerified', user.isVerified ? '1' : '0');
        }
      } catch (err) {
        console.error('Verification check error:', err);
      }
    };
    checkVerification();
  }, []);

  if (isVerified === null || isVerified) return null;

  return (
    <motion.div
      className="verification-banner"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="verification-banner-content">
        <div className="verification-banner-icon">
          <ShieldAlert size={28} />
        </div>
        <div className="verification-banner-text">
          <h3>Account Verification Pending</h3>
          <p>
            Your {userType === 'donor' ? 'restaurant/business' : 'NGO'} account is awaiting admin verification. 
            You can browse the platform but cannot {userType === 'donor' ? 'create food listings' : 'claim food'} until approved.
          </p>
        </div>
        <div className="verification-banner-status">
          <Clock size={18} />
          <span>Under Review</span>
        </div>
      </div>
      <div className="verification-steps">
        <div className="verification-step completed">
          <CheckCircle size={18} />
          <span>Account Created</span>
        </div>
        <div className="verification-step-line"></div>
        <div className="verification-step active">
          <Clock size={18} />
          <span>Admin Review</span>
        </div>
        <div className="verification-step-line"></div>
        <div className="verification-step pending">
          <AlertTriangle size={18} />
          <span>Verified</span>
        </div>
      </div>
    </motion.div>
  );
};

export default VerificationBanner;

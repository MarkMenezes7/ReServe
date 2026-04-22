import { motion } from 'framer-motion';
import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  FileText,
  Edit3,
  Save,
  X,
  RefreshCw,
  Star,
  MessageCircle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle,
  AlertTriangle,
  Send,
  Upload,
} from 'lucide-react';
import NGOLayout from '../../components/NGOLayout';
import { useToast } from '../../components/ToastProvider';
import { ngoApi, reviewsApi } from '../../services/api';
import type { User as UserType, Review, ReviewStats } from '../../types';
import ReviewCard from '../../components/ReviewCard';
import StarRating from '../../components/StarRating';
import './NGOProfilePage.css';

interface ProfileForm {
  name: string;
  organizationName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  bio: string;
}

export default function NGOProfilePage() {
  const userId = parseInt(localStorage.getItem('userId') || '0');
  const { showToast } = useToast();

  const [profile, setProfile] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [form, setForm] = useState<ProfileForm>({
    name: '',
    organizationName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    bio: '',
  });

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  // Verification state
  const [verificationStatus, setVerificationStatus] = useState<{
    request: { id: number; status: string; businessName: string; businessType: string; fssaiNumber: string; gstNumber: string; description: string; certificateDetails: string; adminNotes: string; submittedAt: string; reviewedAt: string } | null;
    isVerified: boolean;
  } | null>(null);
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [verificationForm, setVerificationForm] = useState({
    businessName: '',
    businessType: 'ngo',
    fssaiNumber: '',
    gstNumber: '',
    description: '',
    certificateDetails: '',
  });
  const [verificationDocument, setVerificationDocument] = useState<File | null>(null);

  useEffect(() => {
    fetchProfile();
    fetchReviews();
    fetchVerificationStatus();
  }, []);

  async function fetchProfile() {
    try {
      setLoading(true);
      const data = await ngoApi.getProfile(userId);
      setProfile(data);
      setForm({
        name: data.name || '',
        organizationName: data.organizationName || '',
        phone: data.phone || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        pincode: data.pincode || '',
        bio: data.bio || '',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load profile';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchReviews() {
    try {
      setReviewsLoading(true);
      const [reviewsData, statsData] = await Promise.all([
        reviewsApi.getByUser(userId),
        reviewsApi.getStats(userId),
      ]);
      setReviews(reviewsData);
      setReviewStats(statsData);
    } catch {
      // Reviews are supplementary
    } finally {
      setReviewsLoading(false);
    }
  }

  async function fetchVerificationStatus() {
    try {
      const data = await ngoApi.getVerificationStatus();
      setVerificationStatus(data);
    } catch {
      // Non-critical
    }
  }

  async function handleSubmitVerification(e: FormEvent) {
    e.preventDefault();
    if (!verificationForm.businessName.trim() || !verificationForm.businessType) {
      showToast('Organization name and type are required', 'warning');
      return;
    }
    try {
      setVerificationSubmitting(true);
      await ngoApi.submitVerification({ ...verificationForm, document: verificationDocument });
      showToast('Verification request submitted successfully!', 'success');
      setShowVerificationForm(false);
      setVerificationDocument(null);
      fetchVerificationStatus();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit verification';
      showToast(message, 'error');
    } finally {
      setVerificationSubmitting(false);
    }
  }

  function handleVerificationInputChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setVerificationForm(prev => ({ ...prev, [name]: value }));
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('Name is required', 'warning');
      return;
    }

    try {
      setSaving(true);
      await ngoApi.updateProfile(userId, { ...form } as Record<string, unknown>);
      showToast('Profile updated successfully', 'success');
      setEditMode(false);
      setProfile(prev => (prev ? { ...prev, ...form } : prev));
      if (form.name !== localStorage.getItem('userName')) {
        localStorage.setItem('userName', form.name);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    if (profile) {
      setForm({
        name: profile.name || '',
        organizationName: profile.organizationName || '',
        phone: profile.phone || '',
        address: profile.address || '',
        city: profile.city || '',
        state: profile.state || '',
        pincode: profile.pincode || '',
        bio: profile.bio || '',
      });
    }
    setEditMode(false);
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(w => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  if (loading) {
    return (
      <NGOLayout>
        <div className="profile-loading">
          <RefreshCw className="profile-spinner" size={32} />
          <p>Loading profile...</p>
        </div>
      </NGOLayout>
    );
  }

  if (!profile) {
    return (
      <NGOLayout>
        <div className="profile-empty">
          <User size={64} />
          <h3>Profile not found</h3>
          <p>Unable to load your profile data.</p>
        </div>
      </NGOLayout>
    );
  }

  return (
    <NGOLayout>
      <div className="donor-profile">
        <div className="profile-grid">
          {/* Left Column: Profile Info */}
          <div className="profile-left">
            <motion.div
              className="profile-card profile-identity-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="profile-avatar-large">
                {getInitials(profile.name || 'U')}
              </div>
              <h2 className="profile-name">{profile.name}</h2>
              {profile.organizationName && (
                <p className="profile-org">{profile.organizationName}</p>
              )}
              <span className="profile-badge">NGO</span>
              {profile.createdAt && (
                <p className="profile-joined">
                  Joined {new Date(profile.createdAt).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'long',
                  })}
                </p>
              )}

              {!editMode && (
                <button
                  className="profile-edit-btn"
                  onClick={() => setEditMode(true)}
                >
                  <Edit3 size={16} />
                  Edit Profile
                </button>
              )}
            </motion.div>

            {/* Contact Details Card (view mode) */}
            {!editMode && (
              <motion.div
                className="profile-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h3 className="profile-card-title">Contact Details</h3>
                <div className="profile-detail-list">
                  <div className="profile-detail-item">
                    <Mail size={16} className="profile-detail-icon" />
                    <div>
                      <div className="profile-detail-label">Email</div>
                      <div className="profile-detail-value">{profile.email}</div>
                    </div>
                  </div>
                  <div className="profile-detail-item">
                    <Phone size={16} className="profile-detail-icon" />
                    <div>
                      <div className="profile-detail-label">Phone</div>
                      <div className="profile-detail-value">
                        {profile.phone || 'Not provided'}
                      </div>
                    </div>
                  </div>
                  <div className="profile-detail-item">
                    <Building2 size={16} className="profile-detail-icon" />
                    <div>
                      <div className="profile-detail-label">Organization</div>
                      <div className="profile-detail-value">
                        {profile.organizationName || 'Not provided'}
                      </div>
                    </div>
                  </div>
                  <div className="profile-detail-item">
                    <MapPin size={16} className="profile-detail-icon" />
                    <div>
                      <div className="profile-detail-label">Address</div>
                      <div className="profile-detail-value">
                        {[profile.address, profile.city, profile.state, profile.pincode]
                          .filter(Boolean)
                          .join(', ') || 'Not provided'}
                      </div>
                    </div>
                  </div>
                  {profile.bio && (
                    <div className="profile-detail-item">
                      <FileText size={16} className="profile-detail-icon" />
                      <div>
                        <div className="profile-detail-label">Bio</div>
                        <div className="profile-detail-value">{profile.bio}</div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Edit Form */}
            {editMode && (
              <motion.div
                className="profile-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <div className="profile-card-header-row">
                  <h3 className="profile-card-title">Edit Profile</h3>
                  <button
                    className="profile-cancel-btn"
                    type="button"
                    onClick={handleCancelEdit}
                  >
                    <X size={16} />
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleSave} className="profile-edit-form">
                  <div className="profile-form-group">
                    <label className="profile-form-label">
                      <User size={14} />
                      Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleInputChange}
                      className="profile-form-input"
                      required
                    />
                  </div>

                  <div className="profile-form-group">
                    <label className="profile-form-label">
                      <Building2 size={14} />
                      Organization Name
                    </label>
                    <input
                      type="text"
                      name="organizationName"
                      value={form.organizationName}
                      onChange={handleInputChange}
                      className="profile-form-input"
                      placeholder="Your organization name"
                    />
                  </div>

                  <div className="profile-form-group">
                    <label className="profile-form-label">
                      <Phone size={14} />
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleInputChange}
                      className="profile-form-input"
                      placeholder="Your phone number"
                    />
                  </div>

                  <div className="profile-form-group">
                    <label className="profile-form-label">
                      <MapPin size={14} />
                      Address
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={form.address}
                      onChange={handleInputChange}
                      className="profile-form-input"
                      placeholder="Street address"
                    />
                  </div>

                  <div className="profile-form-row">
                    <div className="profile-form-group">
                      <label className="profile-form-label">City</label>
                      <input
                        type="text"
                        name="city"
                        value={form.city}
                        onChange={handleInputChange}
                        className="profile-form-input"
                        placeholder="City"
                      />
                    </div>
                    <div className="profile-form-group">
                      <label className="profile-form-label">State</label>
                      <input
                        type="text"
                        name="state"
                        value={form.state}
                        onChange={handleInputChange}
                        className="profile-form-input"
                        placeholder="State"
                      />
                    </div>
                    <div className="profile-form-group">
                      <label className="profile-form-label">Pincode</label>
                      <input
                        type="text"
                        name="pincode"
                        value={form.pincode}
                        onChange={handleInputChange}
                        className="profile-form-input"
                        placeholder="Pincode"
                        maxLength={6}
                      />
                    </div>
                  </div>

                  <div className="profile-form-group">
                    <label className="profile-form-label">
                      <FileText size={14} />
                      Bio
                    </label>
                    <textarea
                      name="bio"
                      value={form.bio}
                      onChange={handleInputChange}
                      className="profile-form-textarea"
                      rows={4}
                      placeholder="Tell us about your NGO and the communities you serve..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="profile-save-btn"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <RefreshCw size={16} className="profile-btn-spinner" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Changes
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </div>

          {/* Right Column: Verification + Reviews */}
          <div className="profile-right">
            {/* Verification Section */}
            {!(verificationStatus?.isVerified || !!profile.isVerified) && (
              <motion.div
                className="profile-card verification-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <h3 className="profile-card-title">
                  <ShieldAlert size={18} className="profile-title-icon" />
                  Account Verification
                </h3>

                {!verificationStatus?.request && !showVerificationForm && (
                  <div className="verification-prompt">
                    <div className="verification-prompt-icon">
                      <ShieldAlert size={40} />
                    </div>
                    <p>Your account is not yet verified. Submit your organization details to get verified and start claiming food donations.</p>
                    <button
                      className="profile-edit-btn"
                      onClick={() => setShowVerificationForm(true)}
                    >
                      <Send size={16} />
                      Submit Verification
                    </button>
                  </div>
                )}

                {verificationStatus?.request?.status === 'pending' && (
                  <div className="verification-status-box pending">
                    <Clock size={24} />
                    <div>
                      <h4>Verification Under Review</h4>
                      <p>Your verification request was submitted on {new Date(verificationStatus.request.submittedAt).toLocaleDateString()}. Our admin team is reviewing your details.</p>
                    </div>
                  </div>
                )}

                {verificationStatus?.request?.status === 'rejected' && (
                  <div className="verification-status-box rejected">
                    <AlertTriangle size={24} />
                    <div>
                      <h4>Verification Not Approved</h4>
                      <p>{verificationStatus.request.adminNotes || 'Your request was not approved. Please update your details and try again.'}</p>
                      {!showVerificationForm && (
                        <button
                          className="profile-edit-btn"
                          style={{ marginTop: '0.75rem' }}
                          onClick={() => {
                            setVerificationForm({
                              businessName: verificationStatus.request?.businessName || '',
                              businessType: verificationStatus.request?.businessType || 'ngo',
                              fssaiNumber: verificationStatus.request?.fssaiNumber || '',
                              gstNumber: verificationStatus.request?.gstNumber || '',
                              description: verificationStatus.request?.description || '',
                              certificateDetails: verificationStatus.request?.certificateDetails || '',
                            });
                            setShowVerificationForm(true);
                          }}
                        >
                          <Send size={16} />
                          Resubmit
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Verification Form */}
                {showVerificationForm && (
                  <form onSubmit={handleSubmitVerification} className="verification-form">
                    <div className="profile-form-group">
                      <label className="profile-form-label">
                        <Building2 size={14} />
                        Organization / NGO Name *
                      </label>
                      <input
                        type="text"
                        name="businessName"
                        value={verificationForm.businessName}
                        onChange={handleVerificationInputChange}
                        className="profile-form-input"
                        placeholder="e.g., Helping Hands Foundation"
                        required
                      />
                    </div>

                    <div className="profile-form-group">
                      <label className="profile-form-label">
                        <FileText size={14} />
                        Organization Type *
                      </label>
                      <select
                        name="businessType"
                        value={verificationForm.businessType}
                        onChange={handleVerificationInputChange}
                        className="profile-form-input"
                        required
                      >
                        <option value="ngo">NGO</option>
                        <option value="trust">Trust</option>
                        <option value="foundation">Foundation</option>
                        <option value="community-kitchen">Community Kitchen</option>
                        <option value="shelter">Shelter Home</option>
                        <option value="orphanage">Orphanage</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="verification-form-row">
                      <div className="profile-form-group">
                        <label className="profile-form-label">Registration Number</label>
                        <input
                          type="text"
                          name="fssaiNumber"
                          value={verificationForm.fssaiNumber}
                          onChange={handleVerificationInputChange}
                          className="profile-form-input"
                          placeholder="NGO registration number"
                        />
                      </div>
                      <div className="profile-form-group">
                        <label className="profile-form-label">PAN / Tax ID</label>
                        <input
                          type="text"
                          name="gstNumber"
                          value={verificationForm.gstNumber}
                          onChange={handleVerificationInputChange}
                          className="profile-form-input"
                          placeholder="PAN or tax exemption number"
                          maxLength={15}
                        />
                      </div>
                    </div>

                    <div className="profile-form-group">
                      <label className="profile-form-label">
                        <FileText size={14} />
                        Organization Description
                      </label>
                      <textarea
                        name="description"
                        value={verificationForm.description}
                        onChange={handleVerificationInputChange}
                        className="profile-form-textarea"
                        rows={3}
                        placeholder="Describe your organization and daily food needs..."
                      />
                    </div>

                    <div className="profile-form-group">
                      <label className="profile-form-label">
                        <ShieldCheck size={14} />
                        Certificate / Compliance Details
                      </label>
                      <textarea
                        name="certificateDetails"
                        value={verificationForm.certificateDetails}
                        onChange={handleVerificationInputChange}
                        className="profile-form-textarea"
                        rows={3}
                        placeholder="List any 80G certificate, FCRA registration, or relevant permits..."
                      />
                    </div>

                    <div className="profile-form-group">
                      <label className="profile-form-label">
                        <Upload size={14} />
                        Upload Document (Certificate / Registration Proof)
                      </label>
                      <div
                        className="verification-upload-area"
                        onClick={() => document.getElementById('verification-doc-input')?.click()}
                      >
                        <input
                          id="verification-doc-input"
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.pdf"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            if (file && file.size > 5 * 1024 * 1024) {
                              showToast('File size must be under 5 MB', 'warning');
                              return;
                            }
                            setVerificationDocument(file);
                          }}
                        />
                        {verificationDocument ? (
                          <div className="verification-upload-selected">
                            <FileText size={20} />
                            <span>{verificationDocument.name}</span>
                            <button
                              type="button"
                              className="verification-upload-remove"
                              onClick={(e) => { e.stopPropagation(); setVerificationDocument(null); }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="verification-upload-placeholder">
                            <Upload size={24} />
                            <p>Click to upload JPG, PNG, or PDF (max 5 MB)</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="verification-form-actions">
                      <button
                        type="button"
                        className="profile-cancel-btn"
                        onClick={() => setShowVerificationForm(false)}
                      >
                        <X size={16} />
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="profile-save-btn"
                        disabled={verificationSubmitting}
                      >
                        {verificationSubmitting ? (
                          <>
                            <RefreshCw size={16} className="profile-btn-spinner" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send size={16} />
                            Submit for Verification
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            )}

            {/* Verified badge */}
            {(verificationStatus?.isVerified || !!profile.isVerified) && (
              <motion.div
                className="profile-card verification-card verified"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <div className="verification-status-box approved">
                  <CheckCircle size={24} />
                  <div>
                    <h4>Verified Account</h4>
                    <p>Your organization is verified. You can claim food donations from donors.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Review Stats */}
            <motion.div
              className="profile-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="profile-card-title">
                <Star size={18} className="profile-title-icon" />
                Rating Overview
              </h3>

              {reviewsLoading ? (
                <div className="profile-reviews-loading">Loading ratings...</div>
              ) : reviewStats && reviewStats.totalReviews > 0 ? (
                <div className="profile-rating-overview">
                  <div className="profile-rating-big">
                    <div className="profile-rating-number">
                      {reviewStats.averageOverall.toFixed(1)}
                    </div>
                    <StarRating value={Math.round(reviewStats.averageOverall)} readonly size="md" />
                    <div className="profile-rating-count">
                      {reviewStats.totalReviews} review{reviewStats.totalReviews !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div className="profile-rating-breakdown">
                    <div className="profile-rating-row">
                      <span>Food Quality</span>
                      <StarRating value={Math.round(reviewStats.averageFoodQuality)} readonly size="sm" />
                      <span className="profile-rating-val">
                        {reviewStats.averageFoodQuality.toFixed(1)}
                      </span>
                    </div>
                    <div className="profile-rating-row">
                      <span>Communication</span>
                      <StarRating value={Math.round(reviewStats.averageCommunication)} readonly size="sm" />
                      <span className="profile-rating-val">
                        {reviewStats.averageCommunication.toFixed(1)}
                      </span>
                    </div>
                    <div className="profile-rating-row">
                      <span>Timeliness</span>
                      <StarRating value={Math.round(reviewStats.averageTimeliness)} readonly size="sm" />
                      <span className="profile-rating-val">
                        {reviewStats.averageTimeliness.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {reviewStats.distribution && reviewStats.distribution.length > 0 && (
                    <div className="profile-rating-distribution">
                      {[5, 4, 3, 2, 1].map(stars => {
                        const entry = reviewStats.distribution.find(d => d.stars === stars);
                        const count = entry ? entry.count : 0;
                        const pct = reviewStats.totalReviews > 0
                          ? (count / reviewStats.totalReviews) * 100
                          : 0;
                        return (
                          <div className="profile-dist-row" key={stars}>
                            <span className="profile-dist-label">{stars}</span>
                            <Star size={12} className="profile-dist-star" />
                            <div className="profile-dist-track">
                              <div
                                className="profile-dist-fill"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="profile-dist-count">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="profile-no-reviews">
                  <MessageCircle size={32} />
                  <p>No reviews received yet</p>
                </div>
              )}
            </motion.div>

            {/* Review Cards */}
            <motion.div
              className="profile-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="profile-card-title">
                <MessageCircle size={18} className="profile-title-icon" />
                Reviews Received
              </h3>

              {reviewsLoading ? (
                <div className="profile-reviews-loading">Loading reviews...</div>
              ) : reviews.length > 0 ? (
                <div className="profile-reviews-list">
                  {reviews.map(review => (
                    <ReviewCard key={review.id} review={review} showFoodName />
                  ))}
                </div>
              ) : (
                <div className="profile-no-reviews">
                  <MessageCircle size={32} />
                  <p>No reviews yet. Reviews will appear here after food collections.</p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </NGOLayout>
  );
}

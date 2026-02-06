import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  Star,
  MessageSquare,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { reviewsApi, apiRequest } from '../../services/api';
import StarRating from '../../components/StarRating';
import { useToast } from '../../components/ToastProvider';
import { Review, Claim } from '../../types';
import './ReviewPage.css';

interface ClaimDetail {
  id: number;
  claimId?: number;
  foodName: string;
  counterpartName: string;
  counterpartOrg?: string;
  revieweeId: number;
  quantity?: number;
  unit?: string;
  collectedAt?: string;
}

const ReviewPage = () => {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const userId = Number(localStorage.getItem('userId'));
  const userType = localStorage.getItem('userType') || '';

  const [claimDetail, setClaimDetail] = useState<ClaimDetail | null>(null);
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [overall, setOverall] = useState(0);
  const [foodQuality, setFoodQuality] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [timeliness, setTimeliness] = useState(0);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    if (!userId || !claimId) {
      navigate('/login');
      return;
    }
    loadData();
  }, [claimId, userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const numericClaimId = Number(claimId);

      // Check if review already exists for this claim by the current user
      const reviews = await reviewsApi.getByClaim(numericClaimId);
      const myReview = reviews.find((r) => r.reviewerId === userId);

      if (myReview) {
        setExistingReview(myReview);
        setOverall(myReview.overall);
        setFoodQuality(myReview.foodQuality);
        setCommunication(myReview.communication);
        setTimeliness(myReview.timeliness);
        setComment(myReview.comment || '');
        setIsAnonymous(!!myReview.isAnonymous);
      }

      // Load claim details from pending reviews or from claims endpoint
      try {
        const pending = await reviewsApi.getPending(userId) as unknown as ClaimDetail[];
        const match = pending.find((p) => Number(p.claimId ?? p.id) === numericClaimId);
        if (match) {
          setClaimDetail({
            id: numericClaimId,
            foodName: match.foodName,
            counterpartName: match.counterpartName,
            counterpartOrg: match.counterpartOrg,
            revieweeId: match.revieweeId,
            quantity: match.quantity,
            unit: match.unit,
            collectedAt: match.collectedAt,
          });
        }
      } catch {
        // Fallback: fetch claims from donor/ngo endpoint
      }

      // If we still don't have claim details, try donor/ngo claims endpoint
      if (!claimDetail) {
        try {
          const endpoint =
            userType === 'donor'
              ? `/api/donor/claims/${userId}`
              : `/api/ngo/claims/${userId}`;
          const claims = await apiRequest<Claim[]>(endpoint);
          const match = claims.find((c) => c.id === numericClaimId);
          if (match) {
            const counterpartName =
              userType === 'donor'
                ? match.ngoName || match.organizationName || 'NGO'
                : match.donorName || match.organizationName || 'Donor';
            const revieweeId =
              userType === 'donor' ? match.ngoId! : match.donorId!;
            setClaimDetail({
              id: numericClaimId,
              foodName: match.foodName || 'Food Item',
              counterpartName,
              revieweeId,
              quantity: match.quantity,
              unit: match.unit,
              collectedAt: match.collectedAt,
            });
          }
        } catch {
          // Could not load claim details
        }
      }
    } catch (error) {
      console.error('Error loading review data:', error);
      showToast('Failed to load review data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!claimDetail) {
      showToast('Claim details not available', 'error');
      return;
    }

    if (overall === 0) {
      showToast('Please provide an overall rating', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      await reviewsApi.create({
        claimId: Number(claimId),
        reviewerId: userId,
        revieweeId: claimDetail.revieweeId,
        overall,
        foodQuality: foodQuality || overall,
        communication: communication || overall,
        timeliness: timeliness || overall,
        comment: comment.trim() || undefined,
        isAnonymous,
      });

      showToast('Review submitted successfully!', 'success');

      const dashboardPath =
        userType === 'donor' ? '/donor/dashboard' : '/ngo/dashboard';
      navigate(dashboardPath);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to submit review';
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoBack = () => {
    const dashboardPath =
      userType === 'donor' ? '/donor/dashboard' : '/ngo/dashboard';
    navigate(dashboardPath);
  };

  if (loading) {
    return (
      <div className="review-page">
        <div className="review-loading">
          <Loader2 className="spinner-icon" size={48} />
          <p>Loading review details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="review-page">
      <div className="review-container">
        {/* Header */}
        <motion.div
          className="review-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <button className="back-button" onClick={handleGoBack}>
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>
          <h1 className="review-title">
            <Star className="title-icon" size={28} />
            {existingReview ? 'Your Review' : 'Leave a Review'}
          </h1>
          <p className="review-subtitle">
            {existingReview
              ? 'You have already submitted a review for this transaction.'
              : 'Share your experience to help the community.'}
          </p>
        </motion.div>

        {/* Claim Info Card */}
        {claimDetail && (
          <motion.div
            className="claim-info-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="claim-info-header">
              <CheckCircle size={20} className="claim-info-icon" />
              <span>Completed Transaction</span>
            </div>
            <div className="claim-info-body">
              <div className="claim-info-row">
                <span className="claim-info-label">Food Item</span>
                <span className="claim-info-value">{claimDetail.foodName}</span>
              </div>
              {claimDetail.quantity && (
                <div className="claim-info-row">
                  <span className="claim-info-label">Quantity</span>
                  <span className="claim-info-value">
                    {claimDetail.quantity} {claimDetail.unit || ''}
                  </span>
                </div>
              )}
              <div className="claim-info-row">
                <span className="claim-info-label">
                  {userType === 'donor' ? 'Collected By' : 'Donated By'}
                </span>
                <span className="claim-info-value">
                  {claimDetail.counterpartName}
                  {claimDetail.counterpartOrg && (
                    <span className="org-tag"> ({claimDetail.counterpartOrg})</span>
                  )}
                </span>
              </div>
              {claimDetail.collectedAt && (
                <div className="claim-info-row">
                  <span className="claim-info-label">Collected On</span>
                  <span className="claim-info-value">
                    {new Date(claimDetail.collectedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {!claimDetail && !existingReview && (
          <motion.div
            className="review-error-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <AlertCircle size={48} />
            <h3>Claim Not Found</h3>
            <p>
              This claim could not be loaded. It may not exist or you may not
              have permission to review it.
            </p>
            <button className="btn-back-dashboard" onClick={handleGoBack}>
              Back to Dashboard
            </button>
          </motion.div>
        )}

        {/* Rating Form or Existing Review */}
        {(claimDetail || existingReview) && (
          <motion.div
            className="review-form-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {/* Rating Categories */}
            <div className="rating-section">
              <h2 className="section-heading">Ratings</h2>

              <div className="rating-categories">
                <div className="rating-category">
                  <div className="rating-category-label">
                    <Star size={18} />
                    <span>Overall</span>
                  </div>
                  <StarRating
                    value={overall}
                    onChange={existingReview ? undefined : setOverall}
                    size="lg"
                    readonly={!!existingReview}
                    showValue
                  />
                </div>

                <div className="rating-category">
                  <div className="rating-category-label">
                    <CheckCircle size={18} />
                    <span>Food Quality</span>
                  </div>
                  <StarRating
                    value={foodQuality}
                    onChange={existingReview ? undefined : setFoodQuality}
                    size="md"
                    readonly={!!existingReview}
                    showValue
                  />
                </div>

                <div className="rating-category">
                  <div className="rating-category-label">
                    <MessageSquare size={18} />
                    <span>Communication</span>
                  </div>
                  <StarRating
                    value={communication}
                    onChange={existingReview ? undefined : setCommunication}
                    size="md"
                    readonly={!!existingReview}
                    showValue
                  />
                </div>

                <div className="rating-category">
                  <div className="rating-category-label">
                    <Loader2 size={18} />
                    <span>Timeliness</span>
                  </div>
                  <StarRating
                    value={timeliness}
                    onChange={existingReview ? undefined : setTimeliness}
                    size="md"
                    readonly={!!existingReview}
                    showValue
                  />
                </div>
              </div>
            </div>

            {/* Comment Section */}
            <div className="comment-section">
              <h2 className="section-heading">
                <MessageSquare size={20} />
                Comments
              </h2>
              {existingReview ? (
                <div className="existing-comment">
                  {comment || <span className="no-comment">No comment provided.</span>}
                </div>
              ) : (
                <textarea
                  className="comment-textarea"
                  placeholder="Share details about your experience (optional)..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  maxLength={500}
                />
              )}
              {!existingReview && (
                <span className="char-count">{comment.length}/500</span>
              )}
            </div>

            {/* Anonymous Toggle */}
            <div className="anonymous-section">
              {existingReview ? (
                isAnonymous && (
                  <div className="anonymous-badge">
                    <EyeOff size={16} />
                    <span>This review was submitted anonymously</span>
                  </div>
                )
              ) : (
                <label className="anonymous-toggle">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                  />
                  <EyeOff size={16} />
                  <span>Submit as anonymous review</span>
                </label>
              )}
            </div>

            {/* Submit Button */}
            {!existingReview && (
              <div className="submit-section">
                <button
                  className="btn-submit-review"
                  onClick={handleSubmit}
                  disabled={submitting || overall === 0}
                >
                  {submitting ? (
                    <>
                      <div className="spinner-small" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Submit Review
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Already Reviewed Notice */}
            {existingReview && (
              <div className="reviewed-notice">
                <CheckCircle size={18} />
                <span>
                  Submitted on{' '}
                  {new Date(existingReview.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ReviewPage;

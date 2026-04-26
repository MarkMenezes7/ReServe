import StarRating from './StarRating';
import type { Review } from '../types';
import './ReviewCard.css';

interface ReviewCardProps {
  review: Review;
  showFoodName?: boolean;
}

export default function ReviewCard({ review, showFoodName = false }: ReviewCardProps) {
  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <div className="review-card">
      <div className="review-card-header">
        <div className="review-card-author">
          <div className="review-card-avatar">
            {(review.reviewerName || 'A')[0].toUpperCase()}
          </div>
          <div>
            <div className="review-card-name">
              {review.reviewerName || 'User'}
            </div>
            {review.reviewerOrg && (
              <div className="review-card-org">{review.reviewerOrg}</div>
            )}
          </div>
        </div>
        <div className="review-card-date">{formatDate(review.createdAt)}</div>
      </div>

      {showFoodName && review.foodName && (
        <div className="review-card-food">For: {review.foodName}</div>
      )}

      <div className="review-card-ratings">
        <div className="review-card-rating-row">
          <span>Overall</span>
          <StarRating value={review.overall} readonly size="sm" />
        </div>
        <div className="review-card-rating-row">
          <span>Food Quality</span>
          <StarRating value={review.foodQuality} readonly size="sm" />
        </div>
        <div className="review-card-rating-row">
          <span>Communication</span>
          <StarRating value={review.communication} readonly size="sm" />
        </div>
        <div className="review-card-rating-row">
          <span>Timeliness</span>
          <StarRating value={review.timeliness} readonly size="sm" />
        </div>
      </div>

      {review.comment && (
        <p className="review-card-comment">{review.comment}</p>
      )}
    </div>
  );
}

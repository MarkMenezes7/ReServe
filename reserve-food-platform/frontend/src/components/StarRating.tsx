import { useState } from 'react';
import './StarRating.css';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
  showValue?: boolean;
}

export default function StarRating({ value, onChange, size = 'md', readonly = false, showValue = false }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className={`star-rating star-rating-${size} ${readonly ? 'star-rating-readonly' : ''}`}>
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          className={`star ${star <= (hovered || value) ? 'star-filled' : 'star-empty'}`}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
        >
          ★
        </span>
      ))}
      {showValue && <span className="star-rating-value">{value.toFixed(1)}</span>}
    </div>
  );
}

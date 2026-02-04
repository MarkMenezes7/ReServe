import { Link } from 'react-router-dom';
import './NotFound.css';

const NotFound = () => {
  return (
    <div className="not-found">
      <div className="not-found-card">
        <h1>404</h1>
        <p>We couldn't find that page.</p>
        <Link to="/" className="not-found-link">
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;

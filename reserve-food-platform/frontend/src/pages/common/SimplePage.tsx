import { Link } from 'react-router-dom';
import './SimplePage.css';

interface SimplePageProps {
  title: string;
  subtitle: string;
}

const SimplePage = ({ title, subtitle }: SimplePageProps) => {
  return (
    <div className="simple-page">
      <div className="simple-card">
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <Link to="/" className="simple-link">
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default SimplePage;

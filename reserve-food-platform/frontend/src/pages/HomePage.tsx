import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Leaf, 
  Users, 
  TrendingUp, 
  MapPin, 
  Sparkles,
  Heart,
  ChevronDown,
  Store,
  Building2,
  CircleDot,
} from 'lucide-react';
import './HomePage.css';

import { LucideIcon } from 'lucide-react';

interface Stat {
  value: string;
  label: string;
  icon: LucideIcon;
}

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

interface WorkStep {
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  image: string;
}

interface ImpactStat {
  value: string;
  label: string;
}

const HomePage = () => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 60 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" as const }
    }
  };

  const stagger = {
    visible: {
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const stats: Stat[] = [
    { value: '50K+', label: 'Meals Saved', icon: Leaf },
    { value: '200+', label: 'Active Donors', icon: Store },
    { value: '85%', label: 'Success Rate', icon: TrendingUp }
  ];

  const features: Feature[] = [
    { icon: Sparkles, title: 'ML Forecasting', desc: 'Predict food availability 24 hours ahead' },
    { icon: MapPin, title: 'Live Heatmaps', desc: 'See food availability patterns in real-time' },
    { icon: Users, title: 'Real-Time Chat', desc: 'Coordinate pickups instantly' },
    { icon: CircleDot, title: 'Smart Matching', desc: 'AI matches food with nearby NGOs' },
    { icon: TrendingUp, title: 'Impact Tracking', desc: 'Track meals saved and CO2 reduced' },
    { icon: Building2, title: 'Admin Dashboard', desc: 'Complete platform oversight & analytics' }
  ];

  const workSteps: WorkStep[] = [
    {
      step: '01',
      title: 'Donors List Food',
      description: 'Restaurants and businesses post surplus food with photos, quantity, and pickup details.',
      icon: Store,
      color: 'from-green-500 to-emerald-600',
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80'
    },
    {
      step: '02',
      title: 'AI Matches & Predicts',
      description: 'Our ML system predicts availability patterns and matches food with nearby NGOs instantly.',
      icon: Sparkles,
      color: 'from-emerald-500 to-teal-600',
      image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&q=80'
    },
    {
      step: '03',
      title: 'NGOs Collect & Feed',
      description: 'NGOs claim food, coordinate pickup via chat, and redistribute to communities in need.',
      icon: Heart,
      color: 'from-teal-500 to-cyan-600',
      image: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&q=80'
    }
  ];

  const impactStats: ImpactStat[] = [
    { value: '2.5M kg', label: 'Food Saved' },
    { value: '125K', label: 'People Fed' },
    { value: '4.8M kg', label: 'CO₂ Reduced' },
    { value: '15+', label: 'Cities' }
  ];

  return (
    <div className="homepage-container">
      {/* Animated Background Gradient Orbs */}
      <div className="background-orbs">
        <motion.div
          className="orb orb-1"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" as const }}
        />
        <motion.div
          className="orb orb-2"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -30, 0],
            y: [0, 50, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" as const }}
        />
        <motion.div
          className="orb orb-3"
          animate={{
            scale: [1, 1.1, 1],
            x: [0, 40, 0],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" as const }}
        />
      </div>

      {/* Floating Particles */}
      <div className="floating-particles">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      <motion.nav 
        className="navbar"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" as const }}
      >
        <div className="navbar-container">
          <motion.div 
            className="logo-section"
            whileHover={{ scale: 1.05 }}
          >
            <div className="logo-icon-wrapper">
              <div className="logo-glow"></div>
              <Leaf className="logo-icon" strokeWidth={2.5} />
            </div>
            <span className="logo-text">ReServe</span>
          </motion.div>

          <div className="nav-links">
            <motion.a href="#features" className="nav-link" whileHover={{ y: -2 }}>
              Features
            </motion.a>
            <motion.a href="#impact" className="nav-link" whileHover={{ y: -2 }}>
              Impact
            </motion.a>
            <motion.a href="#how-it-works" className="nav-link" whileHover={{ y: -2 }}>
              How It Works
            </motion.a>
          </div>

          <div className="nav-actions">
            <Link to="/login">
              <motion.button
                className="btn-login"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Login
              </motion.button>
            </Link>
            <Link to="/signup">
              <motion.button
                className="btn-get-started"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                Get Started
              </motion.button>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <motion.div
            className="hero-content"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            {/* Badge */}
            <motion.div variants={fadeInUp} className="hero-badge-wrapper">
              <motion.div className="hero-badge" whileHover={{ scale: 1.05 }}>
                <Sparkles className="badge-icon" />
                <span className="badge-text">AI-Powered Food Redistribution</span>
              </motion.div>
            </motion.div>

            {/* Main Heading */}
            <motion.h1 variants={fadeInUp} className="hero-heading">
              <span className="heading-line-1">Turn Surplus Into</span>
              <span className="heading-line-2">Second Chances</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p variants={fadeInUp} className="hero-subtitle">
              Connect food businesses with NGOs using ML-powered predictions. 
              <span className="subtitle-highlight"> Reduce waste. Feed communities. </span>
              Save the planet.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div variants={fadeInUp} className="cta-buttons">
              <Link to="/signup">
                <motion.button
                  className="btn-primary"
                  whileHover={{ scale: 1.05, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span>Start Donating</span>
                  <ArrowRight className="btn-icon" />
                </motion.button>
              </Link>

              <Link to="/signup">
                <motion.button
                  className="btn-secondary"
                  whileHover={{ scale: 1.05, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span>I'm an NGO</span>
                  <Heart className="btn-icon" />
                </motion.button>
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div variants={fadeInUp} className="hero-stats">
              {stats.map((stat, i) => (
                <motion.div
                  key={i}
                  className="stat-card"
                  whileHover={{ scale: 1.1, y: -5 }}
                >
                  <stat.icon className="stat-icon" />
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Hero Image Section */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="hero-image-wrapper"
          >
            <div className="hero-image-container">
              <img 
                src="https://images.unsplash.com/photo-1593113598332-cd288d649433?w=1200&q=80" 
                alt="Food donation volunteers"
                className="hero-image"
              />
              <div className="hero-image-overlay"></div>
              <div className="hero-image-text">
                <p>Together, we can end food waste and feed communities</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          className="scroll-indicator"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronDown className="scroll-icon" />
        </motion.div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="works-section">
        <div className="works-container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="section-header"
          >
            <motion.h2 variants={fadeInUp} className="section-title">
              How ReServe Works
            </motion.h2>
            <motion.p variants={fadeInUp} className="section-subtitle">
              Simple, smart, and effective food redistribution
            </motion.p>
          </motion.div>

          <div className="works-grid">
            {workSteps.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2, duration: 0.6 }}
                whileHover={{ y: -10 }}
                className="work-card"
              >
                <div className="work-card-image">
                  <img src={item.image} alt={item.title} />
                  <div className="work-card-overlay"></div>
                  <div className={`work-card-icon bg-gradient-to-br ${item.color}`}>
                    <item.icon className="icon" />
                  </div>
                  <div className="work-card-step">{item.step}</div>
                </div>
                <div className="work-card-content">
                  <h3 className="work-card-title">{item.title}</h3>
                  <p className="work-card-description">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="features-section">
        <div className="features-container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="section-header"
          >
            <motion.h2 variants={fadeInUp} className="section-title">
              Powerful Features
            </motion.h2>
            <motion.p variants={fadeInUp} className="section-subtitle">
              Everything you need to make a real impact
            </motion.p>
          </motion.div>

          <div className="features-grid">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="feature-card"
              >
                <feature.icon className="feature-icon" />
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section id="impact" className="impact-section">
        <div className="impact-container">
          <div className="impact-grid">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="impact-content"
            >
              <h2 className="impact-title">Making Real Impact, Together</h2>
              <p className="impact-subtitle">
                Every meal saved is a step towards a sustainable future
              </p>

              <div className="impact-stats-grid">
                {impactStats.map((stat, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ scale: 1.1 }}
                    className="impact-stat-card"
                  >
                    <div className="impact-stat-value">{stat.value}</div>
                    <div className="impact-stat-label">{stat.label}</div>
                  </motion.div>
                ))}
              </div>

              <Link to="/signup">
                <motion.button
                  className="btn-join"
                  whileHover={{ scale: 1.05, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Join the Movement
                </motion.button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="impact-image-wrapper"
            >
              <div className="impact-image-container">
                <img 
                  src="https://images.unsplash.com/photo-1593113646773-028c64a8f1b8?w=800&q=80" 
                  alt="Community feeding"
                  className="impact-image"
                />
                <div className="impact-image-overlay"></div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-logo">
            <Leaf className="footer-logo-icon" />
            <span className="footer-logo-text">ReServe</span>
          </div>
          <p className="footer-tagline">Turning surplus into second chances</p>
          <div className="footer-links">
            <a href="#" className="footer-link">About</a>
            <a href="#" className="footer-link">Privacy</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Support</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
          <p className="footer-copyright">© 2026 ReServe. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
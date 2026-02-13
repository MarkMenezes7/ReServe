import { motion, useInView } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Brain,
  Zap,
  Heart,
  ChevronDown,
  Store,
  MapPin,
  Sparkles,
  Activity,
  Target,
  BarChart3,
  Clock,
  Waves,
  Apple,
  Pizza,
  Cookie,
  Soup,
  Coffee,
  IceCream,
  Cake,
  Salad,
  Star,
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import FoodRescueLogo from '../components/Logo/Logo';
import './HomePage.css';

interface Stat {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
  color: string;
}

interface MLFeature {
  icon: LucideIcon;
  title: string;
  description: string;
  accuracy: string;
  color: string;
  gradient: string;
}

interface WorkStep {
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  image: string;
}

interface ProblemStat {
  number: number;
  suffix: string;
  label: string;
  color: string;
}

interface Testimonial {
  name: string;
  role: string;
  quote: string;
  rating: number;
}

interface FAQ {
  q: string;
  a: string;
}

// Animated counter component
const CountUpNumber = ({ value, suffix }: { value: number; suffix: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const duration = 2000;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, value]);

  return <span ref={ref}>{count}{suffix}</span>;
};

// SVG wave section divider
const SectionDivider = ({ flip = false }: { flip?: boolean }) => (
  <div className="section-divider" style={{ transform: flip ? 'scaleY(-1)' : undefined }}>
    <svg viewBox="0 0 1440 60" fill="none" preserveAspectRatio="none">
      <path d="M0,30 C360,60 720,0 1080,30 C1260,45 1380,15 1440,30 L1440,60 L0,60 Z" fill="rgba(16,185,129,0.05)" />
    </svg>
  </div>
);

const HomePage = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [currentStat, setCurrentStat] = useState(0);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100
      });
    };

    window.addEventListener('mousemove', handleMouseMove);

    const statInterval = setInterval(() => {
      setCurrentStat((prev) => (prev + 1) % 3);
    }, 3000);

    const testimonialInterval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % 3);
    }, 4500);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(statInterval);
      clearInterval(testimonialInterval);
    };
  }, []);

  const handleLogoClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setAnimationKey(prev => prev + 1);
  };

  const stats: Stat[] = [
    { value: '50K+', label: 'Meals Predicted', icon: Brain, color: '#047857' },
    { value: '98%', label: 'Match Accuracy', icon: Target, color: '#059669' },
    { value: '2.5M kg', label: 'CO\u2082 Saved', icon: Activity, color: '#047857' }
  ];

  const problemStats: ProblemStat[] = [
    { number: 40, suffix: '%', label: 'of food produced is wasted', color: '#047857' },
    { number: 190, suffix: 'M', label: 'Indians go hungry daily', color: '#059669' },
    { number: 68, suffix: 'M', label: 'tonnes wasted annually', color: '#047857' },
    { number: 3, suffix: 'x', label: 'enough to feed all hungry', color: '#059669' }
  ];

  const features: Feature[] = [
    {
      icon: Brain,
      title: 'AI Prediction Engine',
      desc: 'Machine learning predicts food availability 48 hours ahead with 98% accuracy',
      color: '#047857'
    },
    {
      icon: Zap,
      title: 'Instant Smart Matching',
      desc: 'Real-time AI matches surplus food with NGOs in under 2 seconds',
      color: '#059669'
    },
    {
      icon: MapPin,
      title: 'Live Heat Maps',
      desc: 'Interactive maps show food availability patterns across your city',
      color: '#047857'
    },
    {
      icon: Activity,
      title: 'Demand Forecasting',
      desc: 'Predict where food is needed most based on historical data',
      color: '#059669'
    },
    {
      icon: BarChart3,
      title: 'Impact Analytics',
      desc: 'Track meals saved, CO\u2082 reduced, and communities fed in real-time',
      color: '#047857'
    },
    {
      icon: Clock,
      title: 'Optimal Timing',
      desc: 'AI suggests the best pickup times to maximize freshness',
      color: '#059669'
    }
  ];

  const mlFeatures: MLFeature[] = [
    {
      icon: Brain,
      title: 'Neural Network Prediction',
      description: 'Deep learning models analyze patterns from 100,000+ donations to predict availability',
      accuracy: '98.3%',
      color: '#047857',
      gradient: 'from-green-700 to-emerald-700'
    },
    {
      icon: Target,
      title: 'Smart Matching Algorithm',
      description: 'Collaborative filtering matches donors with NGOs based on 15+ parameters',
      accuracy: '96.7%',
      color: '#059669',
      gradient: 'from-emerald-700 to-teal-700'
    },
    {
      icon: Activity,
      title: 'Demand Forecasting',
      description: 'Time-series analysis predicts food demand across different neighborhoods',
      accuracy: '94.2%',
      color: '#047857',
      gradient: 'from-teal-700 to-cyan-700'
    },
    {
      icon: Waves,
      title: 'Route Optimization',
      description: 'Genetic algorithms optimize pickup routes saving 30% travel time',
      accuracy: '99.1%',
      color: '#059669',
      gradient: 'from-green-800 to-emerald-800'
    }
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

  const testimonials: Testimonial[] = [
    {
      name: 'Priya Sharma',
      role: 'Restaurant Owner, Mumbai',
      quote: 'ReServe helped us redirect 200kg of surplus food weekly. The AI predictions are incredibly accurate.',
      rating: 5
    },
    {
      name: 'Rajesh Kumar',
      role: 'NGO Director, Delhi',
      quote: 'The smart matching saves us hours of coordination. We can now serve 3x more communities.',
      rating: 5
    },
    {
      name: 'Anita Patel',
      role: 'Hotel Chain Manager, Bangalore',
      quote: 'Our food waste dropped by 60% in just 3 months. The analytics dashboard shows real impact.',
      rating: 5
    }
  ];

  const faqs: FAQ[] = [
    {
      q: 'How does AI predict food availability?',
      a: 'Our ML models analyze historical patterns from thousands of donations, factoring in day of week, time, season, and local events to predict when and where surplus food will be available with up to 98% accuracy.'
    },
    {
      q: 'Is ReServe free for NGOs?',
      a: 'Yes! ReServe is completely free for registered NGOs. We believe technology should bridge the gap between food surplus and hunger without any barriers.'
    },
    {
      q: 'How quickly can food be matched?',
      a: 'Our smart matching algorithm connects surplus food with nearby NGOs in under 2 seconds, considering proximity, capacity, dietary requirements, and real-time demand.'
    },
    {
      q: 'What types of food can be donated?',
      a: 'Any safe, edible surplus food including cooked meals, raw ingredients, packaged goods, and baked items. Our platform tracks storage requirements and best-before dates automatically.'
    },
    {
      q: 'How do you ensure food safety?',
      a: 'We enforce strict listing requirements including photos, storage conditions, and time-stamps. Our rating system and AI monitoring flag any concerns automatically.'
    }
  ];

  return (
    <div className="homepage-modern" ref={containerRef}>
      {/* Dynamic Gradient Background */}
      <div
        className="dynamic-gradient"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%,
            rgba(16, 185, 129, 0.15) 0%,
            rgba(52, 211, 153, 0.1) 40%,
            transparent 70%)`
        }}
      />

      {/* Animated Mesh Background */}
      <div className="mesh-background">
        <div className="mesh-gradient"></div>
      </div>

      {/* Floating Elements */}
      <div className="floating-elements">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="floating-orb"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 300 + 100}px`,
              height: `${Math.random() * 300 + 100}px`,
              background: `radial-gradient(circle, ${
                ['rgba(16, 185, 129, 0.1)', 'rgba(52, 211, 153, 0.1)', 'rgba(110, 231, 183, 0.1)'][i % 3]
              }, transparent)`,
            }}
            animate={{
              y: [0, Math.random() * 100 - 50, 0],
              x: [0, Math.random() * 100 - 50, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      <motion.nav
        className="navbar-modern"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
      >
        <div className="nav-container">
          <div onClick={handleLogoClick} style={{ cursor: 'pointer', textDecoration: 'none' }}>
            <motion.div
              className="logo-modern"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FoodRescueLogo size={50} animated={true} />
              <span className="logo-text-modern">
                <span className="logo-re">Re</span>
                <span className="logo-serve">Serve</span>
              </span>
            </motion.div>
          </div>

          <div className="nav-links-modern">
            <a href="#problem">The Problem</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#ml-features">ML Features</a>
            <a href="#impact">Impact</a>
            <a href="#faq">FAQ</a>
          </div>

          <div className="nav-actions-modern">
            <Link to="/login">
              <motion.button
                className="btn-nav-login"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Login
              </motion.button>
            </Link>
            <Link to="/signup">
              <motion.button
                className="btn-nav-signup"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Get Started
              </motion.button>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="hero-modern" ref={heroRef}>
        <div className="hero-content-modern">
          {/* Animated Badge */}
          <motion.div
            key={`badge-${animationKey}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="hero-badge-modern"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Brain className="badge-icon-modern" />
            </motion.div>
            <span>Powered by Machine Learning</span>
          </motion.div>

          {/* Main Heading with Letter Animation */}
          <motion.h1
            className="hero-title-modern"
            key={`title-${animationKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <motion.div className="title-line">
              {"AI-Powered".split("").map((char, i) => (
                <motion.span
                  key={`${animationKey}-char1-${i}`}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  className="char-animate"
                >
                  {char}
                </motion.span>
              ))}
            </motion.div>
            <motion.div className="title-line gradient-text">
              {"Food Rescue".split("").map((char, i) => (
                <motion.span
                  key={`${animationKey}-char2-${i}`}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 + i * 0.05 }}
                  className="char-animate"
                >
                  {char === " " ? "\u00A0" : char}
                </motion.span>
              ))}
            </motion.div>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="hero-subtitle-modern"
            key={`subtitle-${animationKey}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
          >
            Machine learning predicts surplus food availability, intelligently matches donors with NGOs,
            and optimizes distribution routes to <span className="highlight-text">end food waste</span> forever.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="hero-ctas-modern"
            key={`ctas-${animationKey}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.7 }}
          >
            <Link to="/signup">
              <motion.button
                className="btn-primary-modern"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span>Start Donating</span>
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight size={20} />
                </motion.div>
              </motion.button>
            </Link>
            <Link to="/signup">
              <motion.button
                className="btn-secondary-modern"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Heart size={20} />
                <span>Join as NGO</span>
              </motion.button>
            </Link>
          </motion.div>

          {/* Animated Stats */}
          <motion.div
            className="hero-stats-modern"
            key={`stats-${animationKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
          >
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                className={`stat-card-modern ${i === currentStat ? 'active' : ''}`}
                whileHover={{ scale: 1.1, y: -10 }}
                style={{ borderColor: stat.color }}
              >
                <motion.div
                  animate={i === currentStat ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.5 }}
                >
                  <stat.icon className="stat-icon-modern" style={{ color: stat.color }} />
                </motion.div>
                <div className="stat-value-modern" style={{ color: stat.color }}>{stat.value}</div>
                <div className="stat-label-modern">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* 3D Floating Dashboard Preview */}
        <motion.div
          className="hero-visual-modern"
          key={`visual-${animationKey}`}
          initial={{ opacity: 0, scale: 0.8, rotateY: -30 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ delay: 2.2, duration: 1 }}
        >
          <motion.div
            className="dashboard-preview"
            animate={{
              y: [0, -20, 0],
              rotateX: [0, 5, 0],
              rotateY: [0, -5, 0]
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="dashboard-header">
              <div className="dash-dot red"></div>
              <div className="dash-dot yellow"></div>
              <div className="dash-dot green"></div>
            </div>
            <div className="dashboard-content">
              <div className="dash-chart">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={`${animationKey}-bar-${i}`}
                    className="chart-bar"
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.random() * 80 + 20}%` }}
                    transition={{ delay: 2.5 + i * 0.1, duration: 0.5 }}
                  />
                ))}
              </div>
              <div className="dash-stats">
                <div className="dash-stat">
                  <Activity size={24} color="#10b981" />
                  <span>Live Feed</span>
                </div>
                <div className="dash-stat">
                  <Brain size={24} color="#34d399" />
                  <span>AI Active</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          className="scroll-indicator-modern"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <ChevronDown size={32} />
        </motion.div>
      </section>

      <SectionDivider />

      {/* Problem Statement Section */}
      <section id="problem" className="problem-section">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="section-header-modern"
          >
            <h2 className="section-title-modern">
              The <span className="gradient-text">Problem</span> We Solve
            </h2>
            <p className="section-subtitle-modern">
              India wastes enough food to feed millions while hunger persists
            </p>
          </motion.div>

          <div className="problem-grid">
            {problemStats.map((stat, i) => (
              <motion.div
                className="problem-card"
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                whileHover={{ y: -5 }}
              >
                <div className="problem-value" style={{ color: stat.color }}>
                  <CountUpNumber value={stat.number} suffix={stat.suffix} />
                </div>
                <div className="problem-label">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider flip />

      {/* How ReServe Works Section */}
      <section id="how-it-works" className="works-section-modern">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="section-header-modern"
          >
            <h2 className="section-title-modern">
              How <span className="gradient-text">ReServe</span> Works
            </h2>
            <p className="section-subtitle-modern">
              Simple, smart, and effective food redistribution
            </p>
          </motion.div>

          <div className="works-grid-modern">
            {workSteps.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2, duration: 0.6 }}
                whileHover={{ y: -10 }}
                className="work-card-modern"
              >
                <div className="work-card-image-modern">
                  <img src={item.image} alt={item.title} />
                  <div className="work-card-overlay-modern"></div>
                  <div className={`work-card-icon-modern bg-gradient-to-br ${item.color}`}>
                    <item.icon size={24} color="white" />
                  </div>
                  <div className="work-card-step-modern">{item.step}</div>
                </div>
                <div className="work-card-content-modern">
                  <h3 className="work-card-title-modern">{item.title}</h3>
                  <p className="work-card-desc-modern">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ML Features Section */}
      <section id="ml-features" className="ml-section">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="section-header-modern"
          >
            <h2 className="section-title-modern">
              Machine Learning <span className="gradient-text">at the Core</span>
            </h2>
            <p className="section-subtitle-modern">
              Advanced AI algorithms working 24/7 to eliminate food waste
            </p>
          </motion.div>

          <div className="ml-grid">
            {mlFeatures.map((feature, i) => (
              <motion.div
                key={i}
                className="ml-card"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2, duration: 0.6 }}
                whileHover={{ scale: 1.05, y: -10 }}
              >
                <div className={`ml-card-gradient bg-gradient-to-br ${feature.gradient}`}></div>
                <motion.div
                  className="ml-icon"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                >
                  <feature.icon size={40} color={feature.color} />
                </motion.div>
                <h3 className="ml-title">{feature.title}</h3>
                <p className="ml-description">{feature.description}</p>
                <div className="ml-accuracy">
                  <div className="accuracy-label">Accuracy</div>
                  <div className="accuracy-bar">
                    <motion.div
                      className="accuracy-fill"
                      initial={{ width: 0 }}
                      whileInView={{ width: feature.accuracy }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.2 + 0.5, duration: 1 }}
                      style={{ background: feature.color }}
                    />
                  </div>
                  <div className="accuracy-value" style={{ color: feature.color }}>
                    {feature.accuracy}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features-section-modern">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-header-modern"
          >
            <h2 className="section-title-modern">
              Smart Features for <span className="gradient-text">Maximum Impact</span>
            </h2>
          </motion.div>

          <div className="features-grid-modern">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                className="feature-card-modern"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -15, scale: 1.05 }}
              >
                <motion.div
                  className="feature-icon-wrapper"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  style={{ background: `${feature.color}20` }}
                >
                  <feature.icon size={32} style={{ color: feature.color }} />
                </motion.div>
                <h3 className="feature-title-modern">{feature.title}</h3>
                <p className="feature-desc-modern">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="section-header-modern"
          >
            <h2 className="section-title-modern">
              What Our <span className="gradient-text">Community</span> Says
            </h2>
          </motion.div>

          <div className="testimonials-grid">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                className={`testimonial-card ${i === currentTestimonial ? 'active' : ''}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
              >
                <div className="testimonial-quote">&ldquo;{t.quote}&rdquo;</div>
                <div className="testimonial-stars">
                  {[...Array(t.rating)].map((_, j) => (
                    <Star key={j} size={16} fill="#f59e0b" color="#f59e0b" />
                  ))}
                </div>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">{t.name.charAt(0)}</div>
                  <div>
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-role">{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section id="impact" className="impact-section-modern">
        <div className="impact-container-modern">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="impact-content-modern"
          >
            <h2 className="impact-title-modern">
              Real Impact, <span className="gradient-text">Real Results</span>
            </h2>
            <p className="impact-text-modern">
              Our AI-powered platform has connected thousands of donors with NGOs,
              saving millions of meals and reducing carbon emissions.
            </p>

            <div className="impact-metrics">
              <motion.div
                className="metric"
                whileHover={{ scale: 1.1 }}
              >
                <div className="metric-value" style={{ color: '#10b981' }}>2.5M kg</div>
                <div className="metric-label">Food Saved</div>
              </motion.div>
              <motion.div
                className="metric"
                whileHover={{ scale: 1.1 }}
              >
                <div className="metric-value" style={{ color: '#34d399' }}>125K</div>
                <div className="metric-label">People Fed</div>
              </motion.div>
              <motion.div
                className="metric"
                whileHover={{ scale: 1.1 }}
              >
                <div className="metric-value" style={{ color: '#6ee7b7' }}>4.8M kg</div>
                <div className="metric-label">CO&#8322; Reduced</div>
              </motion.div>
            </div>

            <Link to="/signup">
              <motion.button
                className="btn-impact"
                whileHover={{ scale: 1.05 }}
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
            className="impact-visual"
          >
            <motion.div
              className="impact-circle"
              animate={{ rotate: 360 }}
              transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            >
              <div className="circle-segment segment-1">
                <Apple size={32} color="#047857" />
              </div>
              <div className="circle-segment segment-2">
                <Pizza size={32} color="#059669" />
              </div>
              <div className="circle-segment segment-3">
                <Cookie size={32} color="#047857" />
              </div>
              <div className="circle-segment segment-4">
                <Soup size={32} color="#059669" />
              </div>
              <div className="circle-segment segment-5">
                <Coffee size={32} color="#047857" />
              </div>
              <div className="circle-segment segment-6">
                <IceCream size={32} color="#059669" />
              </div>
              <div className="circle-segment segment-7">
                <Cake size={32} color="#047857" />
              </div>
              <div className="circle-segment segment-8">
                <Salad size={32} color="#059669" />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="faq-section">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="section-header-modern"
          >
            <h2 className="section-title-modern">
              Frequently Asked <span className="gradient-text">Questions</span>
            </h2>
          </motion.div>

          <div className="faq-list">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                className="faq-item"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <button
                  className={`faq-question ${openFaq === i ? 'open' : ''}`}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    size={20}
                    className={`faq-chevron ${openFaq === i ? 'rotated' : ''}`}
                  />
                </button>
                <motion.div
                  className="faq-answer"
                  initial={false}
                  animate={{
                    height: openFaq === i ? 'auto' : 0,
                    opacity: openFaq === i ? 1 : 0
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <p>{faq.a}</p>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* Footer */}
      <footer className="footer-modern">
        <div className="footer-content">
          <div className="footer-logo-section">
            <div className="logo-modern" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
              <FoodRescueLogo size={45} animated={false} />
              <span className="logo-text-modern">
                <span className="logo-re">Re</span>
                <span className="logo-serve">Serve</span>
              </span>
            </div>
            <p className="footer-tagline">AI-Powered Food Rescue Platform</p>
          </div>
          <div className="footer-links-section">
            <a href="#" className="footer-link">About</a>
            <a href="#" className="footer-link">Privacy</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 ReServe. Powered by Machine Learning.</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;

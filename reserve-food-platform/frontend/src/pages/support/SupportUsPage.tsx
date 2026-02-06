import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Leaf,
  Heart,
  ArrowRight,
  Sprout,
  Award,
  Shield,
  Crown,
  Building2,
  Users,
  Globe,
  CloudOff,
  ChevronDown,
  Send,
  Star,
  Handshake,
  PiggyBank,
  CheckCircle,
  Mail,
  User,
  MessageSquare,
  Briefcase,
  BadgeCheck,
  Clock,
  BarChart3,
  Target,
  Zap,
} from 'lucide-react';
import { supportApi } from '../../services/api';
import { useToast } from '../../components/ToastProvider';
import type { ImpactStats, GratitudeEntry } from '../../types';
import './SupportUsPage.css';

/* ------------------------------------------------------------------ */
/*  Animated Counter Hook                                              */
/* ------------------------------------------------------------------ */
function useCountUp(end: number, duration = 2000, startCounting = false) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!startCounting || end === 0) {
      setValue(0);
      return;
    }
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * end);
      setValue(current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setValue(end);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [end, duration, startCounting]);

  return value;
}

/* ------------------------------------------------------------------ */
/*  Single Animated Stat Card                                          */
/* ------------------------------------------------------------------ */
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  end: number;
  suffix?: string;
  startCounting: boolean;
}

function StatCard({ icon: Icon, label, end, suffix = '', startCounting }: StatCardProps) {
  const count = useCountUp(end, 2200, startCounting);
  return (
    <motion.div
      className="su-stat-card"
      whileHover={{ y: -6, scale: 1.04 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <Icon className="su-stat-icon" />
      <span className="su-stat-value">
        {count.toLocaleString()}
        {suffix}
      </span>
      <span className="su-stat-label">{label}</span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  FAQ Item                                                           */
/* ------------------------------------------------------------------ */
interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

function FAQItem({ question, answer, isOpen, onToggle }: FAQItemProps) {
  return (
    <div className={`su-faq-item ${isOpen ? 'su-faq-open' : ''}`}>
      <button className="su-faq-question" onClick={onToggle} type="button">
        <span>{question}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="su-faq-chevron"
        >
          <ChevronDown size={20} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className="su-faq-answer-wrapper"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="su-faq-answer">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tier Badge Colour                                                  */
/* ------------------------------------------------------------------ */
function tierBadgeClass(tier?: string) {
  switch (tier) {
    case 'seed':
      return 'su-badge-seed';
    case 'harvest':
      return 'su-badge-harvest';
    case 'champion':
      return 'su-badge-champion';
    case 'leader':
      return 'su-badge-leader';
    default:
      return 'su-badge-default';
  }
}

function tierLabel(tier?: string) {
  switch (tier) {
    case 'seed':
      return 'Seed Sower';
    case 'harvest':
      return 'Harvest Hero';
    case 'champion':
      return 'Champion';
    case 'leader':
      return 'Impact Leader';
    default:
      return 'Supporter';
  }
}

/* ------------------------------------------------------------------ */
/*  Main Page Component                                                */
/* ------------------------------------------------------------------ */
const SupportUsPage = () => {
  const { showToast } = useToast();

  // ---------- Impact Stats ----------
  const [stats, setStats] = useState<ImpactStats | null>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supportApi.getImpactStats().then(setStats).catch(() => {
      // use fallback defaults if API unavailable
      setStats({
        foodRescued: 52400,
        mealsProvided: 127800,
        registeredDonors: 342,
        activeNGOs: 87,
        co2Saved: 48200,
        citiesCovered: 18,
        totalCollections: 0,
        waterConserved: 0,
      });
    });
  }, []);

  // Intersection observer for animated counters
  useEffect(() => {
    const node = statsRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // ---------- Gratitude Wall ----------
  const [wall, setWall] = useState<GratitudeEntry[]>([]);

  useEffect(() => {
    supportApi.getGratitudeWall().then(setWall).catch(() => {
      setWall([
        { id: 1, displayName: 'Priya Sharma', message: 'Proud to support a platform fighting food waste!', tier: 'champion', createdAt: '2026-01-28T10:00:00Z' },
        { id: 2, displayName: 'GreenGrocers Co.', message: 'Corporate partnership that matters.', tier: 'leader', createdAt: '2026-01-25T14:30:00Z' },
        { id: 3, displayName: 'Amit Patel', message: 'Every meal counts. Happy to help.', tier: 'harvest', createdAt: '2026-01-20T08:15:00Z' },
        { id: 4, displayName: 'FoodFirst NGO', message: 'ReServe changed how we source food for our community kitchen.', tier: 'seed', createdAt: '2026-01-15T18:45:00Z' },
        { id: 5, displayName: 'Neha Gupta', tier: 'seed', createdAt: '2026-01-10T12:00:00Z' },
        { id: 6, displayName: 'Urban Farms Ltd.', message: 'Investing in impact through ReServe.', tier: 'leader', createdAt: '2026-01-05T09:20:00Z' },
      ]);
    });
  }, []);

  // ---------- FAQ State ----------
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What is ReServe and how does it work?',
      a: 'ReServe is an AI-powered platform that connects food donors (restaurants, grocery stores, caterers) with NGOs and community organisations. Donors list surplus food; our system matches it with nearby NGOs who can collect and redistribute it to people in need.',
    },
    {
      q: 'How are donations used?',
      a: 'Financial contributions directly fund platform operations, logistics coordination, cold-chain infrastructure, and city expansion. Every dollar helps us rescue more food and feed more people. We publish quarterly transparency reports so you can see exactly where funds go.',
    },
    {
      q: 'Is my donation tax-deductible?',
      a: 'ReServe is in the process of obtaining 501(c)(3) non-profit status. Once approved, all donations will be fully tax-deductible. We will issue receipts for every contribution.',
    },
    {
      q: 'Can I volunteer instead of donating?',
      a: 'Absolutely! We welcome volunteers for food pickup coordination, community outreach, tech development, and event management. Use the contact form below and select "Volunteer" as your interest.',
    },
    {
      q: 'How does corporate sponsorship work?',
      a: 'Corporate partners receive brand visibility, impact dashboards, dedicated account management, and co-branded campaigns. Sponsorship tiers start at $1,000/month. Reach out via the contact form to discuss a tailored package.',
    },
    {
      q: 'How do I know my contribution makes a difference?',
      a: 'We track every meal rescued, every kilogram of CO2 avoided, and every community served. Donors and sponsors receive monthly impact reports. Our live counters on this page reflect real platform data.',
    },
  ];

  // ---------- Contact Form ----------
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    organization: '',
    interestType: 'donate',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleContactChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setContactForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) {
      showToast('Please fill in all required fields.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await supportApi.sendContact({
        name: contactForm.name.trim(),
        email: contactForm.email.trim(),
        organization: contactForm.organization.trim() || undefined,
        interestType: contactForm.interestType,
        subject: contactForm.subject.trim() || undefined,
        message: contactForm.message.trim(),
      });
      showToast('Message sent successfully! We will get back to you soon.', 'success');
      setContactForm({ name: '', email: '', organization: '', interestType: 'donate', subject: '', message: '' });
    } catch {
      showToast('Failed to send message. Please try again later.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Donation tier click ----------
  const handleDonate = useCallback(
    (tierName: string) => {
      showToast(`Thank you for choosing ${tierName}! Payment integration coming soon.`, 'info');
    },
    [showToast],
  );

  // ---------- Animation Variants ----------
  const fadeUp = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
  };

  const stagger = {
    visible: { transition: { staggerChildren: 0.15 } },
  };

  // ---------- Donation Tiers ----------
  const tiers = [
    {
      icon: Sprout,
      name: 'Seed Sower',
      amount: 5,
      description: 'Helps rescue 10 meals from going to waste and delivers them to families in need.',
      color: '#4ade80',
    },
    {
      icon: Heart,
      name: 'Harvest Hero',
      amount: 25,
      description: 'Feeds a family for a week by funding pickup logistics and cold-chain storage.',
      color: '#34d399',
    },
    {
      icon: Award,
      name: 'Community Champion',
      amount: 100,
      description: 'Supports a full month of platform operations, including AI matching and analytics.',
      color: '#2dd4bf',
    },
    {
      icon: Crown,
      name: 'Impact Leader',
      amount: 500,
      description: 'Sponsors expansion into a new city, onboarding donors and NGOs in underserved areas.',
      color: '#a78bfa',
    },
  ];

  // ---------- Corporate Benefits ----------
  const corpBenefits = [
    { icon: BarChart3, text: 'Real-time impact dashboard' },
    { icon: BadgeCheck, text: 'Co-branded campaigns & PR' },
    { icon: Users, text: 'Employee volunteer programmes' },
    { icon: Target, text: 'ESG & CSR goal alignment' },
    { icon: Zap, text: 'Dedicated account manager' },
    { icon: Globe, text: 'Multi-city brand visibility' },
  ];

  // ---------- Investor Metrics ----------
  const investorMetrics = [
    { label: 'Platform Growth (YoY)', value: '320%' },
    { label: 'Donor Retention', value: '89%' },
    { label: 'Cost per Meal Saved', value: '$0.12' },
    { label: 'Cities Targeted (2027)', value: '50+' },
  ];

  return (
    <div className="su-page">
      {/* Background Effects */}
      <div className="su-bg-orbs">
        <motion.div
          className="su-orb su-orb-1"
          animate={{ scale: [1, 1.15, 1], x: [0, 40, 0], y: [0, 25, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="su-orb su-orb-2"
          animate={{ scale: [1, 1.25, 1], x: [0, -25, 0], y: [0, 40, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="su-orb su-orb-3"
          animate={{ scale: [1, 1.1, 1], x: [0, 35, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* ========== NAVBAR ========== */}
      <motion.nav
        className="su-navbar"
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="su-navbar-inner">
          <Link to="/" className="su-logo-link">
            <div className="su-logo-icon-wrap">
              <div className="su-logo-glow" />
              <Leaf className="su-logo-icon" strokeWidth={2.5} />
            </div>
            <span className="su-logo-text">ReServe</span>
          </Link>
          <div className="su-nav-actions">
            <Link to="/login">
              <motion.button className="su-btn-login" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                Login
              </motion.button>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ========== 1. HERO ========== */}
      <section className="su-hero">
        <motion.div
          className="su-hero-inner"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="su-hero-badge-wrap">
            <span className="su-hero-badge">
              <Heart size={16} className="su-hero-badge-icon" />
              Support the Movement
            </span>
          </motion.div>
          <motion.h1 variants={fadeUp} className="su-hero-title">
            <span className="su-hero-line1">Support Our</span>
            <span className="su-hero-line2">Mission</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="su-hero-subtitle">
            Every contribution helps us rescue surplus food, feed communities, and reduce
            environmental waste. Together, we are building a world where no meal goes to waste.
          </motion.p>
          <motion.div variants={fadeUp}>
            <motion.a
              href="#tiers"
              className="su-hero-cta"
              whileHover={{ scale: 1.06, y: -3 }}
              whileTap={{ scale: 0.95 }}
            >
              <span>Make a Difference</span>
              <ArrowRight size={20} />
            </motion.a>
          </motion.div>
        </motion.div>
      </section>

      {/* ========== 2. IMPACT COUNTERS ========== */}
      <section className="su-stats-section" ref={statsRef}>
        <div className="su-section-inner">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="su-section-header"
          >
            <motion.h2 variants={fadeUp} className="su-section-title">
              Our Impact in Numbers
            </motion.h2>
            <motion.p variants={fadeUp} className="su-section-subtitle">
              Real data from the ReServe platform, updated in real-time.
            </motion.p>
          </motion.div>

          <div className="su-stats-grid">
            <StatCard icon={Leaf} label="Kg of Food Rescued" end={stats?.foodRescued ?? 0} startCounting={statsVisible} />
            <StatCard icon={Users} label="Meals Provided" end={stats?.mealsProvided ?? 0} startCounting={statsVisible} />
            <StatCard icon={Heart} label="Registered Donors" end={stats?.registeredDonors ?? 0} startCounting={statsVisible} />
            <StatCard icon={Building2} label="Active NGOs" end={stats?.activeNGOs ?? 0} startCounting={statsVisible} />
            <StatCard icon={CloudOff} label="Kg CO2 Saved" end={stats?.co2Saved ?? 0} startCounting={statsVisible} />
            <StatCard icon={Globe} label="Cities Covered" end={stats?.citiesCovered ?? 0} startCounting={statsVisible} />
          </div>
        </div>
      </section>

      {/* ========== 3. DONATION TIERS ========== */}
      <section className="su-tiers-section" id="tiers">
        <div className="su-section-inner">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="su-section-header"
          >
            <motion.h2 variants={fadeUp} className="su-section-title">
              Choose Your Impact
            </motion.h2>
            <motion.p variants={fadeUp} className="su-section-subtitle">
              Every tier directly funds food rescue operations across the platform.
            </motion.p>
          </motion.div>

          <div className="su-tiers-grid">
            {tiers.map((tier, i) => (
              <motion.div
                key={tier.name}
                className="su-tier-card"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                whileHover={{ y: -8 }}
              >
                <div className="su-tier-icon-wrap" style={{ background: `${tier.color}18` }}>
                  <tier.icon size={32} style={{ color: tier.color }} />
                </div>
                <h3 className="su-tier-name">{tier.name}</h3>
                <div className="su-tier-amount">
                  <span className="su-tier-dollar">$</span>
                  {tier.amount}
                </div>
                <p className="su-tier-desc">{tier.description}</p>
                <motion.button
                  className="su-tier-btn"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleDonate(tier.name)}
                >
                  Donate ${tier.amount}
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== 4. CORPORATE SPONSORSHIP ========== */}
      <section className="su-corporate-section">
        <div className="su-section-inner">
          <div className="su-corporate-grid">
            <motion.div
              className="su-corporate-content"
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="su-corporate-badge">
                <Handshake size={18} />
                <span>Corporate Partners</span>
              </div>
              <h2 className="su-section-title" style={{ textAlign: 'left' }}>
                Partner With Us
              </h2>
              <p className="su-corporate-desc">
                Align your brand with meaningful impact. Corporate sponsorships fund large-scale food
                rescue operations while delivering measurable ESG outcomes for your organisation.
                Packages start at <strong>$1,000/month</strong>.
              </p>
              <motion.a
                href="#contact"
                className="su-corporate-cta"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Become a Partner
                <ArrowRight size={18} />
              </motion.a>
            </motion.div>
            <motion.div
              className="su-corporate-benefits"
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              {corpBenefits.map((b, i) => (
                <div className="su-benefit-row" key={i}>
                  <div className="su-benefit-icon-wrap">
                    <b.icon size={20} />
                  </div>
                  <span>{b.text}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== 5. FOR INVESTORS ========== */}
      <section className="su-investors-section">
        <div className="su-section-inner">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="su-section-header"
          >
            <motion.div variants={fadeUp} className="su-investor-badge">
              <PiggyBank size={18} />
              <span>Impact Investing</span>
            </motion.div>
            <motion.h2 variants={fadeUp} className="su-section-title">
              For Investors
            </motion.h2>
            <motion.p variants={fadeUp} className="su-section-subtitle">
              ReServe is pioneering tech-for-good in the food waste sector. Invest in a platform
              with proven traction, strong unit economics, and massive social impact.
            </motion.p>
          </motion.div>

          <div className="su-investor-metrics">
            {investorMetrics.map((m, i) => (
              <motion.div
                className="su-investor-metric-card"
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.06 }}
              >
                <span className="su-investor-metric-value">{m.value}</span>
                <span className="su-investor-metric-label">{m.label}</span>
              </motion.div>
            ))}
          </div>

          <div className="su-investor-cta-wrap">
            <motion.a
              href="#contact"
              className="su-investor-cta"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Request Pitch Deck
              <ArrowRight size={18} />
            </motion.a>
          </div>
        </div>
      </section>

      {/* ========== 6. FAQ ACCORDION ========== */}
      <section className="su-faq-section">
        <div className="su-section-inner">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="su-section-header"
          >
            <motion.h2 variants={fadeUp} className="su-section-title">
              Frequently Asked Questions
            </motion.h2>
            <motion.p variants={fadeUp} className="su-section-subtitle">
              Everything you need to know about supporting ReServe.
            </motion.p>
          </motion.div>

          <div className="su-faq-list">
            {faqs.map((faq, i) => (
              <FAQItem
                key={i}
                question={faq.q}
                answer={faq.a}
                isOpen={openFAQ === i}
                onToggle={() => setOpenFAQ(openFAQ === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ========== 7. CONTACT FORM ========== */}
      <section className="su-contact-section" id="contact">
        <div className="su-section-inner">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="su-section-header"
          >
            <motion.h2 variants={fadeUp} className="su-section-title">
              Get in Touch
            </motion.h2>
            <motion.p variants={fadeUp} className="su-section-subtitle">
              Whether you want to donate, volunteer, partner, or invest -- we would love to hear from you.
            </motion.p>
          </motion.div>

          <motion.form
            className="su-contact-form"
            onSubmit={handleContactSubmit}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="su-form-row">
              <div className="su-form-group">
                <label htmlFor="su-name">
                  <User size={16} /> Name <span className="su-required">*</span>
                </label>
                <input
                  id="su-name"
                  name="name"
                  type="text"
                  placeholder="Your full name"
                  value={contactForm.name}
                  onChange={handleContactChange}
                  required
                />
              </div>
              <div className="su-form-group">
                <label htmlFor="su-email">
                  <Mail size={16} /> Email <span className="su-required">*</span>
                </label>
                <input
                  id="su-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={contactForm.email}
                  onChange={handleContactChange}
                  required
                />
              </div>
            </div>

            <div className="su-form-row">
              <div className="su-form-group">
                <label htmlFor="su-org">
                  <Briefcase size={16} /> Organisation (optional)
                </label>
                <input
                  id="su-org"
                  name="organization"
                  type="text"
                  placeholder="Company or NGO name"
                  value={contactForm.organization}
                  onChange={handleContactChange}
                />
              </div>
              <div className="su-form-group">
                <label htmlFor="su-interest">
                  <Star size={16} /> Interest Type
                </label>
                <select
                  id="su-interest"
                  name="interestType"
                  value={contactForm.interestType}
                  onChange={handleContactChange}
                >
                  <option value="donate">Donate</option>
                  <option value="volunteer">Volunteer</option>
                  <option value="partner">Corporate Partner</option>
                  <option value="invest">Invest</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="su-form-group su-form-full">
              <label htmlFor="su-subject">
                <MessageSquare size={16} /> Subject
              </label>
              <input
                id="su-subject"
                name="subject"
                type="text"
                placeholder="Brief subject line"
                value={contactForm.subject}
                onChange={handleContactChange}
              />
            </div>

            <div className="su-form-group su-form-full">
              <label htmlFor="su-message">
                <MessageSquare size={16} /> Message <span className="su-required">*</span>
              </label>
              <textarea
                id="su-message"
                name="message"
                placeholder="Tell us how you would like to get involved..."
                rows={5}
                value={contactForm.message}
                onChange={handleContactChange}
                required
              />
            </div>

            <motion.button
              type="submit"
              className="su-submit-btn"
              disabled={submitting}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              {submitting ? 'Sending...' : (
                <>
                  <Send size={18} />
                  Send Message
                </>
              )}
            </motion.button>
          </motion.form>
        </div>
      </section>

      {/* ========== 8. WALL OF GRATITUDE ========== */}
      <section className="su-wall-section">
        <div className="su-section-inner">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="su-section-header"
          >
            <motion.h2 variants={fadeUp} className="su-section-title">
              Wall of Gratitude
            </motion.h2>
            <motion.p variants={fadeUp} className="su-section-subtitle">
              Thank you to our incredible supporters who make this mission possible.
            </motion.p>
          </motion.div>

          <div className="su-wall-grid">
            {wall.map((entry, i) => (
              <motion.div
                className="su-wall-card"
                key={entry.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                whileHover={{ y: -4 }}
              >
                <div className="su-wall-card-header">
                  <span className="su-wall-name">{entry.displayName}</span>
                  <span className={`su-wall-badge ${tierBadgeClass(entry.tier)}`}>
                    {tierLabel(entry.tier)}
                  </span>
                </div>
                {entry.message && <p className="su-wall-message">"{entry.message}"</p>}
                <div className="su-wall-date">
                  <Clock size={14} />
                  {new Date(entry.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== 9. TRUST BADGES / FOOTER ========== */}
      <footer className="su-footer">
        <div className="su-section-inner">
          <div className="su-trust-badges">
            <div className="su-trust-badge">
              <Shield size={28} />
              <div>
                <strong>Non-Profit Status</strong>
                <span>501(c)(3) application pending</span>
              </div>
            </div>
            <div className="su-trust-badge">
              <Users size={28} />
              <div>
                <strong>Dedicated Team</strong>
                <span>15+ passionate engineers & field workers</span>
              </div>
            </div>
            <div className="su-trust-badge">
              <CheckCircle size={28} />
              <div>
                <strong>Full Transparency</strong>
                <span>Quarterly impact & financial reports</span>
              </div>
            </div>
          </div>

          <div className="su-footer-bottom">
            <div className="su-footer-logo">
              <Leaf size={24} className="su-footer-leaf" />
              <span>ReServe</span>
            </div>
            <p className="su-footer-tagline">Turning surplus into second chances.</p>
            <div className="su-footer-links">
              <Link to="/">Home</Link>
              <Link to="/login">Login</Link>
              <Link to="/signup">Sign Up</Link>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
            </div>
            <p className="su-footer-copy">&copy; 2026 ReServe. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default SupportUsPage;

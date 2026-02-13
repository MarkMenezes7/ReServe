import { motion } from 'framer-motion';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart3, Package, TrendingUp, CheckCircle, Leaf, Droplets,
  Utensils, Clock, RefreshCw, Sparkles, TreePine, Car, Award,
  Flame, Target, Zap, Calendar, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import Layout from '../../components/Layout';
import { useToast } from '../../components/ToastProvider';
import { donorApi, mlApi } from '../../services/api';
import type { AIInsight } from '../../types';
import './DonorAnalyticsPage.css';

interface MonthlyData {
  month: string;
  count: number;
  quantity: number;
}

interface CategoryBreakdown {
  category: string;
  count: number;
  quantity: number;
}

interface HourBreakdown {
  hour: number;
  count: number;
}

interface AnalyticsData {
  monthly: MonthlyData[];
  categories: CategoryBreakdown[];
  hourly: HourBreakdown[];
  totalDonations: number;
  totalQuantity: number;
  avgPerDonation: number;
  collectionRate: number;
}

const CO2_FACTOR = 2.5;
const MEALS_FACTOR = 1.8;
const WATER_FACTOR = 320;

function AnimatedNumber({ value, suffix = '', decimals = 0, duration = 1400 }: { value: number; suffix?: string; decimals?: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const start = ref.current;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setDisplay(current);
      ref.current = current;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);

  return <>{decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}{suffix}</>;
}

function RingProgress({ percent, size = 90, stroke = 7, color = '#4ade80' }: { percent: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="da-ring-svg">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <motion.circle
        cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
      />
    </svg>
  );
}

export default function DonorAnalyticsPage() {
  const userId = parseInt(localStorage.getItem('userId') || '0');
  const { showToast } = useToast();

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAnalytics(); }, []);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      const [data, ins] = await Promise.all([
        donorApi.getAnalytics(userId) as unknown as Promise<AnalyticsData>,
        mlApi.getDonorInsights(userId).catch(() => ({ insights: [], count: 0 })),
      ]);
      setAnalytics(data);
      setInsights(ins.insights || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load analytics';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const maxMonthlyQty = useMemo(() => {
    if (!analytics?.monthly?.length) return 1;
    return Math.max(...analytics.monthly.map(m => m.quantity), 1);
  }, [analytics]);

  const maxCategoryCount = useMemo(() => {
    if (!analytics?.categories?.length) return 1;
    return Math.max(...analytics.categories.map(c => c.count), 1);
  }, [analytics]);

  const maxHourlyCount = useMemo(() => {
    if (!analytics?.hourly?.length) return 1;
    return Math.max(...analytics.hourly.map(h => h.count), 1);
  }, [analytics]);

  const impact = useMemo(() => {
    const qty = analytics?.totalQuantity || 0;
    const co2 = Math.round(qty * CO2_FACTOR);
    const meals = Math.round(qty * MEALS_FACTOR);
    const water = Math.round(qty * WATER_FACTOR);
    return {
      co2, meals, water,
      trees: Math.round(co2 / 22),
      carDays: Math.round(co2 / 4600 * 365),
      pools: (water / 50000).toFixed(1),
    };
  }, [analytics]);

  const highlights = useMemo(() => {
    if (!analytics) return null;
    const bestMonth = analytics.monthly.length > 0
      ? [...analytics.monthly].sort((a, b) => b.quantity - a.quantity)[0]
      : null;
    const topCategory = analytics.categories.length > 0
      ? [...analytics.categories].sort((a, b) => b.count - a.count)[0]
      : null;
    const peakHour = analytics.hourly.length > 0
      ? [...analytics.hourly].sort((a, b) => b.count - a.count)[0]
      : null;
    const monthlyTrend = analytics.monthly.length >= 2
      ? analytics.monthly[analytics.monthly.length - 1].count - analytics.monthly[analytics.monthly.length - 2].count
      : 0;
    return { bestMonth, topCategory, peakHour, monthlyTrend };
  }, [analytics]);

  function formatHour(hour: number): string {
    if (hour === 0) return '12a';
    if (hour === 12) return '12p';
    return hour < 12 ? `${hour}a` : `${hour - 12}p`;
  }

  function formatCategoryLabel(cat: string): string {
    return cat.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  function getBarHeat(value: number, max: number): string {
    const pct = value / max;
    if (pct >= 0.8) return 'da-bar-hot';
    if (pct >= 0.5) return 'da-bar-warm';
    return 'da-bar-cool';
  }

  if (loading) {
    return (
      <Layout>
        <div className="da-loading">
          <div className="da-loading-icon"><BarChart3 size={40} /></div>
          <p>Crunching your donation data...</p>
          <div className="da-loading-dots"><span /><span /><span /></div>
        </div>
      </Layout>
    );
  }

  if (!analytics) {
    return (
      <Layout>
        <div className="da-empty">
          <Package size={56} />
          <h3>No analytics data yet</h3>
          <p>Start donating food to unlock your personalized analytics dashboard.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="da-page">
        {/* Header */}
        <div className="da-header">
          <div className="da-header-left">
            <div className="da-header-icon"><BarChart3 size={28} /></div>
            <div>
              <h1>Donation Analytics</h1>
              <p>Your impact in numbers - ML-powered insights and trends</p>
            </div>
          </div>
          <button className="da-refresh-btn" onClick={fetchAnalytics}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {/* Hero Stat */}
        <motion.div className="da-hero" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <div className="da-hero-number"><AnimatedNumber value={analytics.totalQuantity} decimals={1} suffix=" kg" /></div>
          <div className="da-hero-label">Total Food Donated</div>
          <div className="da-hero-sub">{analytics.totalDonations} donations providing ~{impact.meals.toLocaleString()} meals</div>
        </motion.div>

        {/* Stat Cards */}
        <div className="da-stats-grid">
          <motion.div className="da-stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="da-stat-icon green"><Package size={22} /></div>
            <div className="da-stat-value"><AnimatedNumber value={analytics.totalDonations} /></div>
            <div className="da-stat-label">Donations</div>
          </motion.div>
          <motion.div className="da-stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="da-stat-icon blue"><TrendingUp size={22} /></div>
            <div className="da-stat-value"><AnimatedNumber value={analytics.avgPerDonation} decimals={1} suffix=" kg" /></div>
            <div className="da-stat-label">Avg per Donation</div>
          </motion.div>
          <motion.div className="da-stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="da-stat-ring">
              <RingProgress percent={analytics.collectionRate} size={64} stroke={5} color="#4ade80" />
              <div className="da-stat-ring-pct">{analytics.collectionRate.toFixed(0)}%</div>
            </div>
            <div className="da-stat-label">Collection Rate</div>
          </motion.div>
          <motion.div className="da-stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="da-stat-icon purple"><Flame size={22} /></div>
            <div className="da-stat-value">
              {highlights?.monthlyTrend !== undefined && highlights.monthlyTrend !== 0 ? (
                <span className={`da-trend ${highlights.monthlyTrend > 0 ? 'up' : 'down'}`}>
                  {highlights.monthlyTrend > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  {Math.abs(highlights.monthlyTrend)}
                </span>
              ) : (
                <span className="da-trend neutral"><Minus size={16} /> 0</span>
              )}
            </div>
            <div className="da-stat-label">Monthly Trend</div>
          </motion.div>
        </div>

        {/* Quick Highlights */}
        {highlights && (
          <motion.div className="da-highlights" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <h2><Zap size={18} /> Quick Highlights</h2>
            <div className="da-highlights-grid">
              {highlights.bestMonth && (
                <div className="da-highlight-card">
                  <div className="da-highlight-icon gold"><Award size={20} /></div>
                  <div className="da-highlight-info">
                    <span className="da-highlight-value">{highlights.bestMonth.month}</span>
                    <span className="da-highlight-desc">Best month ({highlights.bestMonth.quantity} kg)</span>
                  </div>
                </div>
              )}
              {highlights.topCategory && (
                <div className="da-highlight-card">
                  <div className="da-highlight-icon green"><Target size={20} /></div>
                  <div className="da-highlight-info">
                    <span className="da-highlight-value">{formatCategoryLabel(highlights.topCategory.category)}</span>
                    <span className="da-highlight-desc">Top category ({highlights.topCategory.count} donations)</span>
                  </div>
                </div>
              )}
              {highlights.peakHour && (
                <div className="da-highlight-card">
                  <div className="da-highlight-icon blue"><Clock size={20} /></div>
                  <div className="da-highlight-info">
                    <span className="da-highlight-value">{highlights.peakHour.hour}:00</span>
                    <span className="da-highlight-desc">Peak hours ({highlights.peakHour.count} donations)</span>
                  </div>
                </div>
              )}
              <div className="da-highlight-card">
                <div className="da-highlight-icon emerald"><CheckCircle size={20} /></div>
                <div className="da-highlight-info">
                  <span className="da-highlight-value">{analytics.collectionRate.toFixed(0)}%</span>
                  <span className="da-highlight-desc">Of your donations were collected</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Charts Row */}
        <div className="da-charts-row">
          {/* Monthly Trend Chart */}
          <motion.div className="da-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="da-card-header">
              <h2><Calendar size={18} /> Monthly Donations</h2>
              {analytics.monthly.length > 0 && (
                <span className="da-card-badge">{analytics.monthly.length} months</span>
              )}
            </div>
            <div className="da-monthly-chart">
              {analytics.monthly.length > 0 ? (
                analytics.monthly.map((month, i) => (
                  <div className="da-monthly-item" key={i}>
                    <span className="da-monthly-label">{month.month}</span>
                    <div className="da-monthly-bar-area">
                      <div className="da-monthly-track">
                        <motion.div
                          className={`da-monthly-fill ${getBarHeat(month.quantity, maxMonthlyQty)}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${(month.quantity / maxMonthlyQty) * 100}%` }}
                          transition={{ delay: 0.5 + i * 0.05, duration: 0.5 }}
                        />
                      </div>
                    </div>
                    <div className="da-monthly-stats">
                      <span className="da-monthly-qty">{month.quantity} kg</span>
                      <span className="da-monthly-count">{month.count} items</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="da-chart-empty">No monthly data available</p>
              )}
            </div>
          </motion.div>

          {/* Category Breakdown */}
          <motion.div className="da-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div className="da-card-header">
              <h2><Package size={18} /> Category Breakdown</h2>
            </div>
            <div className="da-category-list">
              {analytics.categories.length > 0 ? (
                analytics.categories.map((cat, i) => {
                  const pct = analytics.totalDonations > 0 ? ((cat.count / analytics.totalDonations) * 100).toFixed(0) : '0';
                  return (
                    <motion.div className="da-category-item" key={i}
                      initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55 + i * 0.04 }}>
                      <div className="da-category-top">
                        <span className="da-category-name">{formatCategoryLabel(cat.category)}</span>
                        <span className="da-category-pct">{pct}%</span>
                      </div>
                      <div className="da-category-track">
                        <motion.div className="da-category-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${(cat.count / maxCategoryCount) * 100}%` }}
                          transition={{ delay: 0.6 + i * 0.04, duration: 0.5 }}
                        />
                      </div>
                      <div className="da-category-meta">
                        <span>{cat.count} donations</span>
                        <span>{cat.quantity} kg</span>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <p className="da-chart-empty">No category data available</p>
              )}
            </div>
          </motion.div>
        </div>

        {/* Environmental Impact */}
        <motion.div className="da-impact" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <h2><Leaf size={18} /> Environmental Impact</h2>
          <div className="da-impact-grid">
            <div className="da-impact-card">
              <div className="da-impact-icon green"><Leaf size={28} /></div>
              <div className="da-impact-value"><AnimatedNumber value={impact.co2} suffix=" kg" /></div>
              <div className="da-impact-label">CO2 Prevented</div>
            </div>
            <div className="da-impact-card">
              <div className="da-impact-icon orange"><Utensils size={28} /></div>
              <div className="da-impact-value"><AnimatedNumber value={impact.meals} /></div>
              <div className="da-impact-label">Meals Provided</div>
            </div>
            <div className="da-impact-card">
              <div className="da-impact-icon blue"><Droplets size={28} /></div>
              <div className="da-impact-value"><AnimatedNumber value={impact.water} suffix=" L" /></div>
              <div className="da-impact-label">Water Conserved</div>
            </div>
          </div>
        </motion.div>

        {/* What That Means */}
        <motion.div className="da-equiv" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
          <h2><Sparkles size={18} /> What That Means</h2>
          <div className="da-equiv-grid">
            <div className="da-equiv-card">
              <TreePine size={32} className="da-equiv-icon green" />
              <div className="da-equiv-value">{impact.trees}</div>
              <div className="da-equiv-label">Trees' annual CO2 absorption</div>
            </div>
            <div className="da-equiv-card">
              <Car size={32} className="da-equiv-icon blue" />
              <div className="da-equiv-value">{impact.carDays}</div>
              <div className="da-equiv-label">Days of car emissions offset</div>
            </div>
            <div className="da-equiv-card">
              <Droplets size={32} className="da-equiv-icon cyan" />
              <div className="da-equiv-value">{impact.pools}</div>
              <div className="da-equiv-label">Olympic pools of water saved</div>
            </div>
          </div>
        </motion.div>

        {/* Hourly Activity */}
        <motion.div className="da-card da-hourly-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <div className="da-card-header">
            <h2><Clock size={18} /> Your Donation Rhythm</h2>
            {highlights?.peakHour && (
              <span className="da-peak-badge"><Zap size={12} /> Peak: {highlights.peakHour.hour}:00</span>
            )}
          </div>
          <div className="da-hourly-chart">
            {analytics.hourly.length > 0 ? (
              analytics.hourly.map((h, i) => (
                <motion.div className="da-hourly-bar-wrap" key={i}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 + i * 0.02 }}>
                  <div className="da-hourly-count">{h.count > 0 ? h.count : ''}</div>
                  <div className="da-hourly-bar-container">
                    <motion.div
                      className={`da-hourly-bar ${getBarHeat(h.count, maxHourlyCount)}`}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max((h.count / maxHourlyCount) * 100, h.count > 0 ? 8 : 0)}%` }}
                      transition={{ delay: 0.8 + i * 0.02, duration: 0.4 }}
                    />
                  </div>
                  <span className="da-hourly-label">{formatHour(h.hour)}</span>
                </motion.div>
              ))
            ) : (
              <p className="da-chart-empty">No hourly data available</p>
            )}
          </div>
        </motion.div>

        {/* AI Insights */}
        {insights.length > 0 && (
          <motion.div className="da-insights" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }}>
            <h2><Sparkles size={18} /> AI Insights</h2>
            <div className="da-insights-grid">
              {insights.map((ins, i) => (
                <motion.div key={i} className={`da-insight-card da-insight-${ins.color}`}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 + i * 0.07 }} whileHover={{ y: -3 }}>
                  <div className="da-insight-title">{ins.title}</div>
                  <div className="da-insight-desc">{ins.description}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}

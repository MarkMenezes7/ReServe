import { motion } from 'framer-motion';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart3, Package, TrendingUp, CheckCircle, Leaf, Droplets,
  Utensils, Clock, RefreshCw, Sparkles, TreePine, Car, Award,
  Flame, Target, Zap, Calendar, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import DonorLayout from '../../components/DonorLayout';
import { useToast } from '../../components/ToastProvider';
import { donorApi, mlApi } from '../../services/api';
import type { AIInsight } from '../../types';
import './DonorAnalyticsPage.css';

interface MonthlyData    { month: string; count: number; quantity: number; }
interface CategoryBreakdown { category: string; count: number; quantity: number; }
interface HourBreakdown  { hour: number; count: number; }
interface AnalyticsData  {
  monthly: MonthlyData[]; categories: CategoryBreakdown[]; hourly: HourBreakdown[];
  totalDonations: number; totalQuantity: number; avgPerDonation: number; collectionRate: number;
}

const CO2_FACTOR   = 2.5;
const MEALS_FACTOR = 1.8;
const WATER_FACTOR = 320;

/* ── Animated counter ── */
function AnimatedNumber({ value, suffix = '', decimals = 0, duration = 1400 }: {
  value: number; suffix?: string; decimals?: number; duration?: number;
}) {
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

/* ── SVG Ring ── */
function RingProgress({ percent, size = 64, stroke = 5, color = '#4ade80' }: {
  percent: number; size?: number; stroke?: number; color?: string;
}) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="da-ring-svg">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
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
  const [insights, setInsights]   = useState<AIInsight[]>([]);
  const [loading, setLoading]     = useState(true);

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
      showToast(err instanceof Error ? err.message : 'Failed to load analytics', 'error');
    } finally {
      setLoading(false);
    }
  }

  const maxMonthlyQty    = useMemo(() => Math.max(...(analytics?.monthly.map(m => m.quantity) || [1]), 1), [analytics]);
  const maxCategoryCount = useMemo(() => Math.max(...(analytics?.categories.map(c => c.count) || [1]), 1), [analytics]);
  const maxHourlyCount   = useMemo(() => Math.max(...(analytics?.hourly.map(h => h.count) || [1]), 1), [analytics]);

  const impact = useMemo(() => {
    const qty  = analytics?.totalQuantity || 0;
    const co2  = Math.round(qty * CO2_FACTOR);
    const meals= Math.round(qty * MEALS_FACTOR);
    const water= Math.round(qty * WATER_FACTOR);
    return { co2, meals, water, trees: Math.round(co2 / 22), carDays: Math.round(co2 / 4600 * 365), pools: (water / 50000).toFixed(1) };
  }, [analytics]);

  const highlights = useMemo(() => {
    if (!analytics) return null;
    const bestMonth   = analytics.monthly.length > 0   ? [...analytics.monthly].sort((a,b)   => b.quantity - a.quantity)[0]  : null;
    const topCategory = analytics.categories.length > 0? [...analytics.categories].sort((a,b) => b.count - a.count)[0]        : null;
    const peakHour    = analytics.hourly.length > 0    ? [...analytics.hourly].sort((a,b)     => b.count - a.count)[0]        : null;
    const monthlyTrend= analytics.monthly.length >= 2
      ? analytics.monthly[analytics.monthly.length-1].count - analytics.monthly[analytics.monthly.length-2].count : 0;
    return { bestMonth, topCategory, peakHour, monthlyTrend };
  }, [analytics]);

  const fmtHour     = (h: number) => h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h-12}p`;
  const fmtCategory = (c: string) => c.replace(/-/g,' ').replace(/\b\w/g, l => l.toUpperCase());
  const barHeat     = (v: number, max: number) => { const p = v/max; return p >= .8 ? 'da-bar-hot' : p >= .5 ? 'da-bar-warm' : 'da-bar-cool'; };

  if (loading) return (
    <DonorLayout>
      <div className="da-loading">
        <div className="da-loading-icon"><BarChart3 size={40} /></div>
        <p>Crunching your donation data…</p>
        <div className="da-loading-dots"><span /><span /><span /></div>
      </div>
    </DonorLayout>
  );

  if (!analytics) return (
    <DonorLayout>
      <div className="da-empty">
        <Package size={56} />
        <h3>No analytics data yet</h3>
        <p>Start donating food to unlock your personalized analytics dashboard.</p>
      </div>
    </DonorLayout>
  );

  return (
    <DonorLayout>
      <div className="da-page">

        {/* ── Header ── */}
        <div className="da-header">
          <div className="da-header-left">
            <div className="da-header-icon"><BarChart3 size={26} /></div>
            <div>
              <h1>Donation Analytics</h1>
              <p>ML-powered insights and trends from your giving history</p>
            </div>
          </div>
          <button className="da-refresh-btn" onClick={fetchAnalytics}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* ── Hero Banner ── */}
        <motion.div className="da-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="da-hero-left">
            <div className="da-hero-eyebrow"><Leaf size={11} /> Total Impact</div>
            <div className="da-hero-number">
              <AnimatedNumber value={analytics.totalQuantity} decimals={1} />
              <span className="da-hero-unit">kg</span>
            </div>
            <div className="da-hero-label">Food Donated</div>
          </div>
          <div className="da-hero-right">
            <div className="da-hero-pill">
              <div>
                <div className="da-hero-pill-val">{(analytics.collectionRate || 0).toFixed(0)}%</div>
                <div className="da-hero-pill-lbl">Collection Rate</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Stat Cards ── */}
        <div className="da-stats-grid">
          {[
            { icon: <Package size={20}/>,   color: 'green',  val: <AnimatedNumber value={analytics.totalDonations} />,                 label: 'Donations' },
            { icon: <TrendingUp size={20}/>, color: 'blue',   val: <AnimatedNumber value={analytics.avgPerDonation} decimals={1} suffix=" kg"/>, label: 'Avg per Donation' },
            { icon: null,                    color: '',       val: null,                                                                label: 'Collection Rate', isRing: true },
            { icon: <Flame size={20}/>,      color: 'amber',  val: highlights?.monthlyTrend !== undefined ? (
                highlights.monthlyTrend !== 0
                  ? <span className={`da-trend ${highlights.monthlyTrend > 0 ? 'up' : 'down'}`}>
                      {highlights.monthlyTrend > 0 ? <ArrowUpRight size={15}/> : <ArrowDownRight size={15}/>}
                      {Math.abs(highlights.monthlyTrend)}
                    </span>
                  : <span className="da-trend neutral"><Minus size={15}/> 0</span>
              ) : null,                                                                                                                 label: 'Monthly Trend' },
          ].map((s, i) => (
            <motion.div key={i} className="da-stat-card"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }}>
              {s.isRing ? (
                <div className="da-stat-ring">
                  <RingProgress percent={analytics.collectionRate} size={64} stroke={5} color="#22c55e" />
                  <div className="da-stat-ring-pct">{(analytics.collectionRate || 0).toFixed(0)}%</div>
                </div>
              ) : (
                <>
                  <div className={`da-stat-icon ${s.color}`}>{s.icon}</div>
                  <div className="da-stat-value">{s.val}</div>
                </>
              )}
              <div className="da-stat-label">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* ── Quick Highlights ── */}
        {highlights && (
          <motion.div className="da-highlights" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <div className="da-section-title"><Zap size={14} /> Quick Highlights</div>
            <div className="da-highlights-grid">
              {highlights.bestMonth && (
                <div className="da-highlight-card">
                  <div className="da-highlight-icon gold"><Award size={18} /></div>
                  <div className="da-highlight-info">
                    <span className="da-highlight-value">{highlights.bestMonth.month}</span>
                    <span className="da-highlight-desc">Best month · {highlights.bestMonth.quantity} kg</span>
                  </div>
                </div>
              )}
              {highlights.topCategory && (
                <div className="da-highlight-card">
                  <div className="da-highlight-icon green"><Target size={18} /></div>
                  <div className="da-highlight-info">
                    <span className="da-highlight-value">{fmtCategory(highlights.topCategory.category)}</span>
                    <span className="da-highlight-desc">Top category · {highlights.topCategory.count} donations</span>
                  </div>
                </div>
              )}
              {highlights.peakHour && (
                <div className="da-highlight-card">
                  <div className="da-highlight-icon blue"><Clock size={18} /></div>
                  <div className="da-highlight-info">
                    <span className="da-highlight-value">{highlights.peakHour.hour}:00</span>
                    <span className="da-highlight-desc">Peak hour · {highlights.peakHour.count} donations</span>
                  </div>
                </div>
              )}
              <div className="da-highlight-card">
                <div className="da-highlight-icon emerald"><CheckCircle size={18} /></div>
                <div className="da-highlight-info">
                  <span className="da-highlight-value">{(analytics.collectionRate || 0).toFixed(0)}%</span>
                  <span className="da-highlight-desc">Of donations were collected</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Charts Row ── */}
        <div className="da-charts-row">
          {/* Monthly */}
          <motion.div className="da-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="da-card-header">
              <h2><Calendar size={16} /> Monthly Donations</h2>
              {analytics.monthly.length > 0 && <span className="da-card-badge">{analytics.monthly.length} months</span>}
            </div>
            <div className="da-monthly-chart">
              {analytics.monthly.length > 0 ? analytics.monthly.map((m, i) => (
                <div className="da-monthly-item" key={i}>
                  <span className="da-monthly-label">{m.month}</span>
                  <div className="da-monthly-bar-area">
                    <div className="da-monthly-track">
                      <motion.div
                        className={`da-monthly-fill ${barHeat(m.quantity, maxMonthlyQty)}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${(m.quantity / maxMonthlyQty) * 100}%` }}
                        transition={{ delay: 0.5 + i * 0.05, duration: 0.5 }}
                      />
                    </div>
                  </div>
                  <div className="da-monthly-stats">
                    <span className="da-monthly-qty">{m.quantity} kg</span>
                    <span className="da-monthly-count">{m.count} items</span>
                  </div>
                </div>
              )) : <p className="da-chart-empty">No monthly data available</p>}
            </div>
          </motion.div>

          {/* Categories */}
          <motion.div className="da-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div className="da-card-header">
              <h2><Package size={16} /> Category Breakdown</h2>
            </div>
            <div className="da-category-list">
              {analytics.categories.length > 0 ? analytics.categories.map((cat, i) => {
                const pct = analytics.totalDonations > 0 ? ((cat.count / analytics.totalDonations) * 100).toFixed(0) : '0';
                return (
                  <motion.div className="da-category-item" key={i}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55 + i * 0.04 }}>
                    <div className="da-category-top">
                      <span className="da-category-name">{fmtCategory(cat.category)}</span>
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
              }) : <p className="da-chart-empty">No category data available</p>}
            </div>
          </motion.div>
        </div>

        {/* ── Environmental Impact ── */}
        <motion.div className="da-impact" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <div className="da-section-title"><Leaf size={14} /> Environmental Impact</div>
          <div className="da-impact-grid">
            {[
              { icon: <Leaf size={26}/>,    color: 'green',  val: impact.co2,   suffix: ' kg', label: 'CO₂ Prevented' },
              { icon: <Utensils size={26}/>, color: 'orange', val: impact.meals, suffix: '',    label: 'Meals Provided' },
              { icon: <Droplets size={26}/>, color: 'blue',   val: impact.water, suffix: ' L',  label: 'Water Conserved' },
            ].map((s, i) => (
              <div className="da-impact-card" key={i}>
                <div className={`da-impact-icon ${s.color}`}>{s.icon}</div>
                <div className="da-impact-value"><AnimatedNumber value={s.val} suffix={s.suffix} /></div>
                <div className="da-impact-label">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── What That Means ── */}
        <motion.div className="da-equiv" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
          <div className="da-section-title"><Sparkles size={14} /> What That Means</div>
          <div className="da-equiv-grid">
            <div className="da-equiv-card">
              <TreePine size={30} style={{ color: '#16a34a', display: 'block', margin: '0 auto 10px' }} />
              <div className="da-equiv-value">{impact.trees}</div>
              <div className="da-equiv-label">Trees' annual CO₂ absorption</div>
            </div>
            <div className="da-equiv-card">
              <Car size={30} style={{ color: '#2563eb', display: 'block', margin: '0 auto 10px' }} />
              <div className="da-equiv-value">{impact.carDays}</div>
              <div className="da-equiv-label">Days of car emissions offset</div>
            </div>
            <div className="da-equiv-card">
              <Droplets size={30} style={{ color: '#0891b2', display: 'block', margin: '0 auto 10px' }} />
              <div className="da-equiv-value">{impact.pools}</div>
              <div className="da-equiv-label">Olympic pools of water saved</div>
            </div>
          </div>
        </motion.div>

        {/* ── Hourly Activity ── */}
        <motion.div className="da-card da-hourly-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <div className="da-card-header">
            <h2><Clock size={16} /> Your Donation Rhythm</h2>
            {highlights?.peakHour && (
              <span className="da-peak-badge"><Zap size={11} /> Peak: {highlights.peakHour.hour}:00</span>
            )}
          </div>
          <div className="da-hourly-chart">
            {analytics.hourly.length > 0 ? analytics.hourly.map((h, i) => (
              <motion.div className="da-hourly-bar-wrap" key={i}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 + i * 0.02 }}>
                <div className="da-hourly-count">{h.count > 0 ? h.count : ''}</div>
                <div className="da-hourly-bar-container">
                  <motion.div
                    className={`da-hourly-bar ${barHeat(h.count, maxHourlyCount)}`}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max((h.count / maxHourlyCount) * 100, h.count > 0 ? 8 : 0)}%` }}
                    transition={{ delay: 0.8 + i * 0.02, duration: 0.4 }}
                  />
                </div>
                <span className="da-hourly-label">{fmtHour(h.hour)}</span>
              </motion.div>
            )) : <p className="da-chart-empty">No hourly data available</p>}
          </div>
        </motion.div>

        {/* ── AI Insights ── */}
        {insights.length > 0 && (
          <motion.div className="da-insights" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }}>
            <div className="da-section-title"><Sparkles size={14} /> AI Insights</div>
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
    </DonorLayout>
  );
}
import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Package,
  TrendingUp,
  Percent,
  CheckCircle,
  Leaf,
  Droplets,
  Utensils,
  Clock,
  RefreshCw,
} from 'lucide-react';
import Layout from '../../components/Layout';
import { useToast } from '../../components/ToastProvider';
import { donorApi } from '../../services/api';
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

export default function DonorAnalyticsPage() {
  const userId = parseInt(localStorage.getItem('userId') || '0');
  const { showToast } = useToast();

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      const data = await donorApi.getAnalytics(userId) as unknown as AnalyticsData;
      setAnalytics(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load analytics';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const maxMonthlyCount = useMemo(() => {
    if (!analytics?.monthly?.length) return 1;
    return Math.max(...analytics.monthly.map(m => m.count), 1);
  }, [analytics]);

  const maxCategoryCount = useMemo(() => {
    if (!analytics?.categories?.length) return 1;
    return Math.max(...analytics.categories.map(c => c.count), 1);
  }, [analytics]);

  const maxHourlyCount = useMemo(() => {
    if (!analytics?.hourly?.length) return 1;
    return Math.max(...analytics.hourly.map(h => h.count), 1);
  }, [analytics]);

  const impactMetrics = useMemo(() => {
    const qty = analytics?.totalQuantity || 0;
    return {
      co2Saved: (qty * CO2_FACTOR).toFixed(1),
      mealsProvided: Math.round(qty * MEALS_FACTOR),
      waterConserved: Math.round(qty * WATER_FACTOR),
    };
  }, [analytics]);

  function formatHour(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
  }

  function formatCategoryLabel(cat: string): string {
    return cat
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  if (loading) {
    return (
      <Layout>
        <div className="analytics-loading">
          <RefreshCw className="analytics-spinner" size={32} />
          <p>Loading analytics...</p>
        </div>
      </Layout>
    );
  }

  if (!analytics) {
    return (
      <Layout>
        <div className="analytics-empty">
          <BarChart3 size={64} />
          <h3>No analytics data available</h3>
          <p>Start donating food to see your analytics here.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="donor-analytics">
        {/* Page Header */}
        <div className="analytics-header">
          <div>
            <h1 className="analytics-title">Donation Analytics</h1>
            <p className="analytics-subtitle">
              Track your donation trends and environmental impact
            </p>
          </div>
          <button className="analytics-refresh-btn" onClick={fetchAnalytics}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Stat Cards */}
        <div className="analytics-stats-grid">
          <motion.div
            className="analytics-stat-card"
            whileHover={{ scale: 1.02, y: -4 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="analytics-stat-icon bg-green">
              <Package size={22} />
            </div>
            <div className="analytics-stat-content">
              <div className="analytics-stat-value">{analytics.totalDonations}</div>
              <div className="analytics-stat-label">Total Donations</div>
            </div>
          </motion.div>

          <motion.div
            className="analytics-stat-card"
            whileHover={{ scale: 1.02, y: -4 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="analytics-stat-icon bg-blue">
              <TrendingUp size={22} />
            </div>
            <div className="analytics-stat-content">
              <div className="analytics-stat-value">{analytics.totalQuantity.toFixed(1)} kg</div>
              <div className="analytics-stat-label">Total Quantity</div>
            </div>
          </motion.div>

          <motion.div
            className="analytics-stat-card"
            whileHover={{ scale: 1.02, y: -4 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="analytics-stat-icon bg-orange">
              <Percent size={22} />
            </div>
            <div className="analytics-stat-content">
              <div className="analytics-stat-value">{analytics.avgPerDonation.toFixed(1)} kg</div>
              <div className="analytics-stat-label">Avg per Donation</div>
            </div>
          </motion.div>

          <motion.div
            className="analytics-stat-card"
            whileHover={{ scale: 1.02, y: -4 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="analytics-stat-icon bg-purple">
              <CheckCircle size={22} />
            </div>
            <div className="analytics-stat-content">
              <div className="analytics-stat-value">{analytics.collectionRate.toFixed(0)}%</div>
              <div className="analytics-stat-label">Collection Rate</div>
            </div>
          </motion.div>
        </div>

        {/* Charts Row */}
        <div className="analytics-charts-row">
          {/* Monthly Donations Chart */}
          <motion.div
            className="analytics-chart-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h3 className="analytics-chart-title">
              <BarChart3 size={18} />
              Monthly Donations
            </h3>
            <div className="analytics-bar-chart">
              {analytics.monthly.length > 0 ? (
                analytics.monthly.map((month, index) => (
                  <div className="analytics-bar-row" key={index}>
                    <span className="analytics-bar-label">{month.month}</span>
                    <div className="analytics-bar-track">
                      <motion.div
                        className="analytics-bar-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${(month.count / maxMonthlyCount) * 100}%` }}
                        transition={{ delay: 0.6 + index * 0.05, duration: 0.5 }}
                      />
                    </div>
                    <span className="analytics-bar-value">{month.count}</span>
                  </div>
                ))
              ) : (
                <p className="analytics-chart-empty">No monthly data available</p>
              )}
            </div>
          </motion.div>

          {/* Category Breakdown */}
          <motion.div
            className="analytics-chart-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h3 className="analytics-chart-title">
              <Package size={18} />
              Category Breakdown
            </h3>
            <div className="analytics-bar-chart">
              {analytics.categories.length > 0 ? (
                analytics.categories.map((cat, index) => (
                  <div className="analytics-bar-row" key={index}>
                    <span className="analytics-bar-label">
                      {formatCategoryLabel(cat.category)}
                    </span>
                    <div className="analytics-bar-track">
                      <motion.div
                        className="analytics-bar-fill category-bar"
                        initial={{ width: 0 }}
                        animate={{ width: `${(cat.count / maxCategoryCount) * 100}%` }}
                        transition={{ delay: 0.7 + index * 0.05, duration: 0.5 }}
                      />
                    </div>
                    <span className="analytics-bar-value">{cat.count}</span>
                  </div>
                ))
              ) : (
                <p className="analytics-chart-empty">No category data available</p>
              )}
            </div>
          </motion.div>
        </div>

        {/* Impact Metrics */}
        <motion.div
          className="analytics-impact-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <h3 className="analytics-chart-title">
            <Leaf size={18} />
            Environmental Impact
          </h3>
          <div className="analytics-impact-grid">
            <div className="analytics-impact-card">
              <div className="analytics-impact-icon green">
                <Leaf size={28} />
              </div>
              <div className="analytics-impact-value">{impactMetrics.co2Saved} kg</div>
              <div className="analytics-impact-label">CO2 Saved</div>
              <div className="analytics-impact-hint">
                ~{analytics.totalQuantity.toFixed(0)} kg x {CO2_FACTOR} factor
              </div>
            </div>

            <div className="analytics-impact-card">
              <div className="analytics-impact-icon orange">
                <Utensils size={28} />
              </div>
              <div className="analytics-impact-value">{impactMetrics.mealsProvided.toLocaleString()}</div>
              <div className="analytics-impact-label">Meals Provided</div>
              <div className="analytics-impact-hint">
                ~{analytics.totalQuantity.toFixed(0)} kg x {MEALS_FACTOR} factor
              </div>
            </div>

            <div className="analytics-impact-card">
              <div className="analytics-impact-icon blue">
                <Droplets size={28} />
              </div>
              <div className="analytics-impact-value">{impactMetrics.waterConserved.toLocaleString()} L</div>
              <div className="analytics-impact-label">Water Conserved</div>
              <div className="analytics-impact-hint">
                ~{analytics.totalQuantity.toFixed(0)} kg x {WATER_FACTOR} factor
              </div>
            </div>
          </div>
        </motion.div>

        {/* Time of Day Breakdown */}
        <motion.div
          className="analytics-chart-card analytics-full-width"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <h3 className="analytics-chart-title">
            <Clock size={18} />
            Time of Day Breakdown
          </h3>
          <div className="analytics-hourly-chart">
            {analytics.hourly.length > 0 ? (
              analytics.hourly.map((h, index) => (
                <div className="analytics-hourly-bar-wrapper" key={index}>
                  <div className="analytics-hourly-bar-container">
                    <motion.div
                      className="analytics-hourly-bar"
                      initial={{ height: 0 }}
                      animate={{ height: `${(h.count / maxHourlyCount) * 100}%` }}
                      transition={{ delay: 0.9 + index * 0.03, duration: 0.4 }}
                    />
                  </div>
                  <span className="analytics-hourly-label">{formatHour(h.hour)}</span>
                  <span className="analytics-hourly-count">{h.count}</span>
                </div>
              ))
            ) : (
              <p className="analytics-chart-empty">No hourly data available</p>
            )}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}

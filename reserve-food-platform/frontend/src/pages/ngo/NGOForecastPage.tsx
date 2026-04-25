import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Brain, Activity, Clock, BarChart2, TrendingUp, Zap, Layers,
  ChevronUp, ChevronDown, Minus, Sparkles, Radio, Calendar, MapPin,
} from 'lucide-react';
import NGOLayout from '../../components/NGOLayout';
import { useToast } from '../../components/ToastProvider';
import { mlApi, ngoApi } from '../../services/api';
import { subscribeNgoSync } from '../../utils/ngoSync';
import type {
  AIInsight,
  AreaForecast,
  CategoryDistribution,
  Claim,
  ForecastSummary,
  Listing,
  MLForecastDay,
  MLForecastHour,
} from '../../types';
import './NGOForecastPage.css';

const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => {
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour < 12 ? 'AM' : 'PM';
  return `${normalizedHour} ${period}`;
});

function getHeatColor(probability: number): string {
  if (probability >= 80) return 'var(--heat-hot)';
  if (probability >= 60) return 'var(--heat-warm)';
  if (probability >= 40) return 'var(--heat-medium)';
  if (probability >= 20) return 'var(--heat-cool)';
  return 'var(--heat-cold)';
}

function getHeatClass(probability: number): string {
  if (probability >= 80) return 'heat-hot';
  if (probability >= 60) return 'heat-warm';
  if (probability >= 40) return 'heat-medium';
  if (probability >= 20) return 'heat-cool';
  return 'heat-cold';
}

export default function NGOForecastPage() {
  const [hourlyForecast, setHourlyForecast] = useState<MLForecastHour[]>([]);
  const [weeklyForecast, setWeeklyForecast] = useState<MLForecastDay[]>([]);
  const [peakHours, setPeakHours] = useState<{ hour: number; count: number }[]>([]);
  const [summary, setSummary] = useState<ForecastSummary | null>(null);
  const [categories, setCategories] = useState<CategoryDistribution[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [areaForecasts, setAreaForecasts] = useState<AreaForecast[]>([]);
  const [mlHealth, setMlHealth] = useState<{ status: string; backend?: string } | null>(null);
  const [hourlySource, setHourlySource] = useState('');
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [hoverHour, setHoverHour] = useState<number | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(new Date().getHours());
  const [isHourPopupOpen, setIsHourPopupOpen] = useState(false);
  const [rejectedListingIds, setRejectedListingIds] = useState<number[]>([]);
  const [claimingListingId, setClaimingListingId] = useState<number | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const userId = parseInt(localStorage.getItem('userId') || '0');

  useEffect(() => { void loadData(); }, [userId]);

  useEffect(() => {
    const unsubscribe = subscribeNgoSync(() => {
      void loadData();
    });

    return unsubscribe;
  }, [userId]);

  async function loadData() {
    setLoading(true);
    try {
      const [h, w, p, s, c, health, ins, areas, liveListings, liveClaims] = await Promise.all([
        mlApi.getForecast24h().catch(() => ({ forecast: [], source: 'fallback' })),
        mlApi.getForecastWeekly().catch(() => ({ forecast: [], source: 'fallback' })),
        mlApi.getPeakHours().catch(() => ({ hours: [], source: 'fallback' })),
        mlApi.getForecastSummary().catch(() => ({ activeListings: 0, todayListings: 0, weeklyListings: 0, avgDailyListings: 0, peakHour: null, categoryVelocity: [], demandScore: 0, source: 'fallback' })),
        mlApi.getCategoryDistribution().catch(() => ({ distribution: [], source: 'fallback' })),
        mlApi.getHealth().catch(() => ({ status: 'offline' })),
        mlApi.getNgoInsights(userId).catch(() => ({ insights: [], count: 0 })),
        mlApi.getAreaForecast().catch(() => ({ areas: [], source: 'fallback' })),
        ngoApi.getListings().catch(() => []),
        userId ? ngoApi.getClaims(userId).catch(() => []) : Promise.resolve([]),
      ]);
      setHourlyForecast(h.forecast || []);
      setHourlySource(h.source);
      setWeeklyForecast(w.forecast || []);
      setPeakHours(p.hours || []);
      setSummary(s);
      setCategories(c.distribution || []);
      setMlHealth(health);
      setInsights(ins.insights || []);
      setAreaForecasts(areas.areas || []);
      setListings(Array.isArray(liveListings) ? liveListings : []);
      setClaims(Array.isArray(liveClaims) ? liveClaims : []);
    } catch {
      showToast('Failed to load forecast data', 'error');
    } finally {
      setLoading(false);
    }
  }

  const maxPeakCount = Math.max(...peakHours.map(p => p.count), 1);

  const topHours = useMemo(() => {
    return [...hourlyForecast].sort((a, b) => b.probability - a.probability).slice(0, 3);
  }, [hourlyForecast]);

  const bestDay = useMemo(() => {
    if (!weeklyForecast.length) return null;
    return [...weeklyForecast].sort((a, b) => b.probability - a.probability)[0];
  }, [weeklyForecast]);

  const totalExpectedQty = useMemo(() => {
    return weeklyForecast.reduce((sum, d) => sum + d.expectedQuantity, 0);
  }, [weeklyForecast]);

  const getHourFromDateTime = (value?: string): number | null => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.getHours();
  };

  const formatHourRange = (hour: number): string => {
    const next = (hour + 1) % 24;
    const format12Hour = (value: number) => {
      const normalizedHour = value % 12 === 0 ? 12 : value % 12;
      const period = value < 12 ? 'AM' : 'PM';
      return `${normalizedHour}:00 ${period}`;
    };

    return `${format12Hour(hour)} - ${format12Hour(next)}`;
  };

  const liveClaims = useMemo(
    () => claims.filter((claim) => ['pending', 'confirmed'].includes((claim.status || '').toLowerCase())),
    [claims]
  );

  const liveClaimListingIds = useMemo(
    () => new Set(liveClaims.map((claim) => claim.listingId)),
    [liveClaims]
  );

  const listingsByHour = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => [] as Listing[]);
    listings.forEach((listing) => {
      const hour = getHourFromDateTime(listing.availableFrom || listing.createdAt || listing.bestBefore);
      if (hour === null) return;
      buckets[hour].push(listing);
    });
    return buckets;
  }, [listings]);

  const claimsByHour = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => [] as Claim[]);
    liveClaims.forEach((claim) => {
      const hour = getHourFromDateTime(claim.scheduledTime || claim.createdAt);
      if (hour === null) return;
      buckets[hour].push(claim);
    });
    return buckets;
  }, [liveClaims]);

  const selectedHourListings = selectedHour === null ? [] : listingsByHour[selectedHour] || [];
  const selectedHourClaims = selectedHour === null ? [] : claimsByHour[selectedHour] || [];
  const rejectedListingIdSet = useMemo(() => new Set(rejectedListingIds), [rejectedListingIds]);
  const selectedHourActiveListings = useMemo(() => {
    return selectedHourListings.filter((listing) => {
      const isActive = (listing.status || '').toLowerCase() === 'active';
      return isActive && !rejectedListingIdSet.has(listing.id);
    });
  }, [rejectedListingIdSet, selectedHourListings]);

  function openHourPopup(hour: number) {
    setSelectedHour(hour);
    setRejectedListingIds([]);
    setIsHourPopupOpen(true);
  }

  function closeHourPopup() {
    setIsHourPopupOpen(false);
  }

  function handleRejectRestaurant(listingId: number) {
    setRejectedListingIds((current) => (current.includes(listingId) ? current : [...current, listingId]));
    showToast('Removed from this hour popup', 'success');
  }

  async function handleQuickClaim(listing: Listing) {
    if (!userId) {
      showToast('Please login again to claim food', 'error');
      return;
    }

    if (liveClaimListingIds.has(listing.id)) {
      showToast('You already have a live claim for this listing', 'error');
      return;
    }

    try {
      setClaimingListingId(listing.id);
      await ngoApi.claimListing({
        listingId: listing.id,
        ngoId: userId,
        scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        deliveryMethod: 'self-pickup',
      });
      showToast(`Claimed ${listing.foodName} successfully`, 'success');
      await loadData();
      setIsHourPopupOpen(false);

      const listingHour = getHourFromDateTime(listing.availableFrom || listing.createdAt || listing.bestBefore);
      if (listingHour !== null) {
        setSelectedHour(listingHour);
      }
    } catch {
      showToast('Failed to claim listing', 'error');
    } finally {
      setClaimingListingId(null);
    }
  }

  if (loading) {
    return (
      <NGOLayout>
        <div className="fc-loading">
          <div className="fc-loading-brain">
            <Brain size={40} />
          </div>
          <p>AI is analyzing patterns...</p>
          <div className="fc-loading-dots">
            <span /><span /><span />
          </div>
        </div>
      </NGOLayout>
    );
  }

  return (
    <NGOLayout>
      <div className="fc-page">
        {/* Header */}
        <div className="fc-header">
          <div className="fc-header-left">
            <div className="fc-header-icon">
              <Brain size={28} />
            </div>
            <div>
              <h1>AI Forecast Center</h1>
              <p>ML-powered demand predictions to optimize your collection schedule</p>
            </div>
          </div>
          <div className="fc-header-right">
            <div className={`fc-ml-status ${mlHealth?.status === 'ml_service_offline' ? 'offline' : 'online'}`}>
              <Radio size={14} />
              <span>{mlHealth?.status === 'ml_service_offline' ? 'ML Offline' : 'ML Active'}</span>
            </div>
            <div className={`fc-source-badge source-${hourlySource}`}>
              {hourlySource === 'fallback' ? 'Statistical Model' : 'ML Engine'}
            </div>
          </div>
        </div>

        {/* Summary Cards Row */}
        <div className="fc-summary-row">
          <motion.div className="fc-summary-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="fc-summary-icon green"><Activity size={20} /></div>
            <div className="fc-summary-value">{summary?.activeListings ?? 0}</div>
            <div className="fc-summary-label">Active Listings</div>
          </motion.div>
          <motion.div className="fc-summary-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="fc-summary-icon blue"><Calendar size={20} /></div>
            <div className="fc-summary-value">{summary?.weeklyListings ?? 0}</div>
            <div className="fc-summary-label">This Week</div>
          </motion.div>
          <motion.div className="fc-summary-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="fc-summary-icon purple"><TrendingUp size={20} /></div>
            <div className="fc-summary-value">{summary?.avgDailyListings ?? 0}</div>
            <div className="fc-summary-label">Avg Daily</div>
          </motion.div>
          <motion.div className="fc-summary-card fc-demand-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="fc-demand-gauge">
              <svg viewBox="0 0 120 70" className="fc-gauge-svg">
                <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
                <path
                  d="M 10 65 A 50 50 0 0 1 110 65"
                  fill="none"
                  stroke="url(#gaugeGrad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(summary?.demandScore ?? 0) * 1.57} 157`}
                />
                <defs>
                  <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="50%" stopColor="#eab308" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="fc-demand-score">{summary?.demandScore ?? 0}</div>
            </div>
            <div className="fc-summary-label">Demand Score</div>
          </motion.div>
        </div>

        {/* Main Grid */}
        <div className="fc-grid">
          {/* 24h Heatmap */}
          <motion.div className="fc-card fc-heatmap-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="fc-card-header">
              <h2><Clock size={18} /> 24-Hour Demand Heatmap</h2>
              <div className="fc-heat-legend">
                <span className="fc-heat-legend-item"><span className="fc-heat-dot heat-cold" /> Low</span>
                <span className="fc-heat-legend-item"><span className="fc-heat-dot heat-medium" /> Medium</span>
                <span className="fc-heat-legend-item"><span className="fc-heat-dot heat-hot" /> High</span>
              </div>
            </div>
            <div className="fc-heatmap-grid">
              {hourlyForecast.map((h, i) => {
                const hourListings = listingsByHour[h.hour] || [];
                const hourClaims = claimsByHour[h.hour] || [];
                return (
                  <motion.button
                    key={h.hour}
                    type="button"
                    className={`fc-heatmap-cell fc-heatmap-cell-btn ${selectedHour === h.hour ? 'selected' : ''} ${getHeatClass(h.probability)}`}
                    style={{ '--heat-bg': getHeatColor(h.probability) } as React.CSSProperties}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.02 }}
                    title={`${h.hour}:00 - ${h.probability}% probability, ~${h.expectedQuantity}kg | ${hourListings.length} restaurants | ${hourClaims.length} live claims`}
                    onMouseEnter={() => setHoverHour(h.hour)}
                    onMouseLeave={() => setHoverHour(prev => (prev === h.hour ? null : prev))}
                    onClick={() => openHourPopup(h.hour)}
                  >
                    <span className="fc-heatmap-hour">{HOUR_LABELS[h.hour]}</span>
                    <span className="fc-heatmap-prob">{h.probability}%</span>
                    <span className="fc-heatmap-qty">{h.expectedQuantity}kg</span>
                    <span className="fc-heatmap-meta">{hourListings.length} spots • {hourClaims.length} claims</span>
                  </motion.button>
                );
              })}
            </div>

            {hoverHour !== null && (
              <div className="fc-hour-hover-card">
                <div className="fc-hour-hover-title">{formatHourRange(hoverHour)}</div>
                <div className="fc-hour-hover-stats">
                  <span>{(listingsByHour[hoverHour] || []).length} restaurants</span>
                  <span>{(claimsByHour[hoverHour] || []).length} live claims</span>
                </div>
                {(listingsByHour[hoverHour] || []).length > 0 && (
                  <div className="fc-hour-hover-list">
                    {(listingsByHour[hoverHour] || []).slice(0, 3).map((listing) => (
                      <span key={`hover-${hoverHour}-${listing.id}`}>{listing.organizationName || listing.donorName || listing.foodName}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {topHours.length > 0 && (
              <div className="fc-hot-times">
                <Zap size={14} />
                <span>Hottest windows: </span>
                {topHours.map((h, i) => (
                  <span key={h.hour} className="fc-hot-time-badge">
                    {h.hour}:00{h.hour < 23 ? `-${h.hour + 1}:00` : ''} ({h.probability}%)
                    {i < topHours.length - 1 && ', '}
                  </span>
                ))}
              </div>
            )}

            {selectedHour !== null && (
              <div className="fc-hour-detail-panel">
                <div className="fc-hour-detail-header">
                  <div>
                    <h3>{formatHourRange(selectedHour)}</h3>
                    <p>Restaurants and live claims in this time window.</p>
                  </div>
                  <button type="button" className="fc-open-map-btn" onClick={() => navigate('/ngo/map')}>
                    Open Map View
                  </button>
                </div>

                <div className="fc-hour-detail-grid">
                  <div className="fc-hour-detail-column">
                    <h4>Restaurants ({selectedHourActiveListings.length})</h4>
                    {selectedHourActiveListings.length === 0 ? (
                      <div className="fc-hour-empty">No active listings for this hour.</div>
                    ) : (
                      <div className="fc-hour-list">
                        {selectedHourActiveListings.map((listing) => {
                          const alreadyClaimed = liveClaimListingIds.has(listing.id);
                          const isClaiming = claimingListingId === listing.id;
                          return (
                            <div className="fc-hour-item" key={`listing-${listing.id}`}>
                              <div className="fc-hour-item-top">
                                <strong>{listing.foodName}</strong>
                                <span>{listing.quantity} {listing.unit}</span>
                              </div>
                              <small>{listing.organizationName || listing.donorName || 'Donor'} • {listing.pickupLocation}</small>
                              <button
                                type="button"
                                className="fc-hour-claim-btn"
                                disabled={alreadyClaimed || isClaiming}
                                onClick={() => void handleQuickClaim(listing)}
                              >
                                {alreadyClaimed ? 'Already Claimed' : isClaiming ? 'Claiming...' : 'Claim Food'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="fc-hour-detail-column">
                    <h4>Live Claims ({selectedHourClaims.length})</h4>
                    {selectedHourClaims.length === 0 ? (
                      <div className="fc-hour-empty">No live claims for this hour.</div>
                    ) : (
                      <div className="fc-hour-list">
                        {selectedHourClaims.map((claim) => (
                          <div className="fc-hour-item claim" key={`claim-${claim.id}`}>
                            <div className="fc-hour-item-top">
                              <strong>{claim.foodName || 'Claimed Listing'}</strong>
                              <span>{claim.status}</span>
                            </div>
                            <small>{claim.organizationName || claim.donorName || 'Donor'} • {claim.pickupLocation || 'Pickup location shared in claim'}</small>
                            <span className="fc-hour-claim-state">{claim.deliveryMethod || 'self-pickup'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isHourPopupOpen && selectedHour !== null && (
              <motion.div
                className="fc-hour-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeHourPopup}
              >
                <motion.div
                  className="fc-hour-modal"
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.18 }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="fc-hour-modal-header">
                    <div>
                      <h3>{formatHourRange(selectedHour)}</h3>
                      <p>Active restaurants ready for claim</p>
                    </div>
                    <button type="button" className="fc-hour-modal-close" onClick={closeHourPopup}>
                      Close
                    </button>
                  </div>

                  <div className="fc-hour-modal-list">
                    {selectedHourActiveListings.length === 0 ? (
                      <div className="fc-hour-empty">No active restaurants available in this time window.</div>
                    ) : (
                      selectedHourActiveListings.map((listing) => {
                        const alreadyClaimed = liveClaimListingIds.has(listing.id);
                        const isClaiming = claimingListingId === listing.id;
                        const isRejected = rejectedListingIdSet.has(listing.id);

                        return (
                          <div className={`fc-hour-modal-item ${isRejected ? 'rejected' : ''}`} key={`modal-listing-${listing.id}`}>
                            <div className="fc-hour-modal-item-top">
                              <div>
                                <strong>{listing.foodName}</strong>
                                <span>{listing.organizationName || listing.donorName || 'Restaurant'}</span>
                              </div>
                              <span className="fc-hour-modal-status">{listing.status}</span>
                            </div>
                            <p>{listing.quantity} {listing.unit} • {listing.pickupLocation}</p>
                            <div className="fc-hour-modal-actions">
                              <button
                                type="button"
                                className="fc-hour-modal-claim"
                                disabled={alreadyClaimed || isClaiming || isRejected}
                                onClick={() => void handleQuickClaim(listing)}
                              >
                                {alreadyClaimed ? 'Already Claimed' : isClaiming ? 'Claiming...' : 'Claim'}
                              </button>
                              <button
                                type="button"
                                className="fc-hour-modal-reject"
                                disabled={isRejected}
                                onClick={() => handleRejectRestaurant(listing.id)}
                              >
                                {isRejected ? 'Rejected' : 'Reject'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </motion.div>

          {/* Weekly Forecast */}
          <motion.div className="fc-card fc-weekly-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="fc-card-header">
              <h2><BarChart2 size={18} /> Weekly Forecast</h2>
              {bestDay && (
                <span className="fc-best-day-badge">
                  Best: {bestDay.day}
                </span>
              )}
            </div>
            <div className="fc-weekly-list">
              {weeklyForecast.map((d, i) => {
                const maxProb = Math.max(...weeklyForecast.map(dd => dd.probability), 1);
                const isBest = bestDay?.dayIndex === d.dayIndex;
                return (
                  <motion.div
                    key={d.dayIndex}
                    className={`fc-weekly-item ${isBest ? 'fc-weekly-best' : ''}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                  >
                    <div className="fc-weekly-day">
                      <span className="fc-weekly-day-name">{d.day.slice(0, 3)}</span>
                      {isBest && <Sparkles size={12} className="fc-best-star" />}
                    </div>
                    <div className="fc-weekly-bar-area">
                      <div className="fc-weekly-track">
                        <motion.div
                          className="fc-weekly-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${(d.probability / maxProb) * 100}%` }}
                          transition={{ delay: 0.5 + i * 0.05, duration: 0.6 }}
                        />
                      </div>
                    </div>
                    <div className="fc-weekly-stats">
                      <span className="fc-weekly-prob">{d.probability}%</span>
                      <span className="fc-weekly-qty">~{d.expectedQuantity}kg</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <div className="fc-weekly-summary">
              <span>Total expected this week: <strong>~{totalExpectedQty} kg</strong></span>
            </div>
          </motion.div>

          {/* Category Predictions */}
          <motion.div className="fc-card fc-category-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div className="fc-card-header">
              <h2><Layers size={18} /> Category Intelligence</h2>
            </div>
            <div className="fc-category-list">
              {categories.map((cat, i) => (
                <motion.div
                  key={cat.category}
                  className="fc-category-item"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.04 }}
                >
                  <div className="fc-category-header">
                    <span className="fc-category-name">
                      {cat.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    <span className={`fc-trend-badge fc-trend-${cat.trend}`}>
                      {cat.trend === 'rising' ? <ChevronUp size={12} /> : cat.trend === 'declining' ? <ChevronDown size={12} /> : <Minus size={12} />}
                      {cat.trend}
                    </span>
                  </div>
                  <div className="fc-category-bar-track">
                    <motion.div
                      className="fc-category-bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.percentage}%` }}
                      transition={{ delay: 0.6 + i * 0.04, duration: 0.5 }}
                    />
                  </div>
                  <div className="fc-category-meta">
                    <span>{cat.percentage}% of donations</span>
                    <span>{cat.totalQuantity} kg total</span>
                    <span>{cat.activeCount} active</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Peak Hours */}
          <motion.div className="fc-card fc-peak-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
            <div className="fc-card-header">
              <h2><Zap size={18} /> Peak Donation Hours</h2>
              {summary?.peakHour && (
                <span className="fc-peak-badge">Top: {summary.peakHour.hour}:00</span>
              )}
            </div>
            <div className="fc-peak-chart">
              {peakHours.map((p, i) => (
                <motion.div
                  key={p.hour}
                  className="fc-peak-bar-wrapper"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 + i * 0.02 }}
                >
                  <div className="fc-peak-bar-container">
                    <motion.div
                      className="fc-peak-bar"
                      initial={{ height: 0 }}
                      animate={{ height: `${(p.count / maxPeakCount) * 100}%` }}
                      transition={{ delay: 0.7 + i * 0.02, duration: 0.4 }}
                    />
                  </div>
                  <span className="fc-peak-label">{p.hour}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Area Intelligence */}
        {areaForecasts.length > 0 && (
          <motion.div className="fc-area-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <div className="fc-card-header">
              <h2><MapPin size={18} /> Area Intelligence</h2>
              <span className="fc-area-count">{areaForecasts.length} areas tracked</span>
            </div>
            <div className="fc-area-grid">
              {areaForecasts.map((area, i) => (
                <motion.div
                  key={area.area}
                  className="fc-area-card"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65 + i * 0.05 }}
                >
                  <div className="fc-area-top">
                    <div className="fc-area-name">{area.area}</div>
                    {area.activeNow > 0 && (
                      <span className="fc-area-active-badge">{area.activeNow} active</span>
                    )}
                  </div>
                  <div className="fc-area-stats">
                    <div className="fc-area-stat">
                      <span className="fc-area-stat-value">{area.totalListings}</span>
                      <span className="fc-area-stat-label">Total</span>
                    </div>
                    <div className="fc-area-stat">
                      <span className="fc-area-stat-value">{area.successRate}%</span>
                      <span className="fc-area-stat-label">Success</span>
                    </div>
                    <div className="fc-area-stat">
                      <span className="fc-area-stat-value">{area.avgQuantity}</span>
                      <span className="fc-area-stat-label">Avg kg</span>
                    </div>
                  </div>
                  <div className="fc-area-timing">
                    {area.peakHour !== null && (
                      <span className="fc-area-timing-badge">
                        <Clock size={11} /> Peak: {area.peakHour}:00
                      </span>
                    )}
                    {area.peakDay && (
                      <span className="fc-area-timing-badge">
                        <Calendar size={11} /> Best: {area.peakDay}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* AI Insights */}
        {insights.length > 0 && (
          <motion.div className="fc-insights-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
            <div className="fc-card-header">
              <h2><Sparkles size={18} /> AI Insights</h2>
            </div>
            <div className="fc-insights-grid">
              {insights.map((insight, i) => (
                <motion.div
                  key={i}
                  className={`fc-insight-card fc-insight-${insight.color}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.75 + i * 0.08 }}
                  whileHover={{ y: -3 }}
                >
                  <div className="fc-insight-title">{insight.title}</div>
                  <div className="fc-insight-desc">{insight.description}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </NGOLayout>
  );
}

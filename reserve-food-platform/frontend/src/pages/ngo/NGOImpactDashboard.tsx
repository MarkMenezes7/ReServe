import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Award, Leaf, Droplets, Users, TrendingUp, TreePine, Car,
  UtensilsCrossed, Sparkles, Target, Trophy, Heart,
} from 'lucide-react';
import NGOLayout from '../../components/NGOLayout';
import { useToast } from '../../components/ToastProvider';
import { ngoApi, supportApi, mlApi } from '../../services/api';
import type { ImpactStats, AIInsight } from '../../types';
import './NGOImpactDashboard.css';

function AnimatedNumber({ value, suffix = '', duration = 1500 }: { value: number; suffix?: string; duration?: number }) {
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
      const current = Math.round(start + diff * eased);
      setDisplay(current);
      ref.current = current;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);

  return <>{display.toLocaleString()}{suffix}</>;
}

function CircleProgress({ percent, size = 80, stroke = 6, color = '#4ade80' }: { percent: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="ip-circle-svg">
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

export default function NGOImpactDashboard() {
  const [personalImpact, setPersonalImpact] = useState<Record<string, number>>({});
  const [platformStats, setPlatformStats] = useState<ImpactStats | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const userId = parseInt(localStorage.getItem('userId') || '0');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [personal, platform, ins] = await Promise.all([
        ngoApi.getImpact(userId) as Promise<Record<string, number>>,
        supportApi.getImpactStats(),
        mlApi.getNgoInsights(userId).catch(() => ({ insights: [], count: 0 })),
      ]);
      setPersonalImpact(personal || {});
      setPlatformStats(platform);
      setInsights(ins.insights || []);
    } catch {
      showToast('Failed to load impact data', 'error');
    } finally {
      setLoading(false);
    }
  }

  const foodCollected = personalImpact.foodCollected || 0;
  // ~1.2 meals per kg of rescued food (conservative; avg meal ~0.4-0.5 kg cooked weight + some loss)
  const mealsProvided = Math.floor(foodCollected * 1.2);
  // WRAP/FAO: ~2.5 kg CO2e per kg of food waste avoided (production + transport + landfill methane)
  const co2Saved = Math.floor(foodCollected * 2.5);
  // UNESCO/GRACE: avg ~1000 L of embedded water per kg of food, but ~200 L is a practical rescue credit
  const waterSaved = Math.floor(foodCollected * 200);

  // Avg mature tree absorbs ~22 kg CO2/year (US Forest Service)
  const treesEquiv = Math.round(co2Saved / 22);
  // Avg car emits ~4.6 tonnes CO2/year, so per day = 4600/365 ≈ 12.6 kg
  const carsEquiv = Math.round(co2Saved / 12.6);
  // Olympic pool = 2,500,000 L
  const poolsEquiv = (waterSaved / 2500000).toFixed(2);

  const foodPct = platformStats && platformStats.foodRescued > 0 ? Math.min(100, (foodCollected / platformStats.foodRescued) * 100) : 0;
  const mealsPct = platformStats && platformStats.mealsProvided > 0 ? Math.min(100, (mealsProvided / platformStats.mealsProvided) * 100) : 0;
  const co2Pct = platformStats && platformStats.co2Saved > 0 ? Math.min(100, (co2Saved / platformStats.co2Saved) * 100) : 0;

  const milestones = [
    { label: 'First Collection', target: 1, current: foodCollected, icon: Heart },
    { label: '100 kg Collected', target: 100, current: foodCollected, icon: Target },
    { label: '500 kg Collected', target: 500, current: foodCollected, icon: Trophy },
    { label: '1000 Meals', target: 1000, current: mealsProvided, icon: UtensilsCrossed },
    { label: '1 Tonne Collected', target: 1000, current: foodCollected, icon: Award },
  ];

  if (loading) {
    return (
      <NGOLayout>
        <div className="ip-loading">
          <div className="ip-loading-icon"><Award size={40} /></div>
          <p>Calculating your impact...</p>
        </div>
      </NGOLayout>
    );
  }

  return (
    <NGOLayout>
      <div className="ip-page">
        <div className="ip-header">
          <div className="ip-header-icon"><Award size={28} /></div>
          <div>
            <h1>Your Impact Story</h1>
            <p>Every collection makes a difference. Here's the impact you've created.</p>
          </div>
        </div>

        <motion.div className="ip-hero" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <div className="ip-hero-number"><AnimatedNumber value={foodCollected} suffix=" kg" /></div>
          <div className="ip-hero-label">Total Food Rescued</div>
          <div className="ip-hero-sub">That's {mealsProvided.toLocaleString()} meals for people in need</div>
        </motion.div>

        <div className="ip-stats-grid">
          <motion.div className="ip-stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="ip-stat-icon green"><Leaf size={24} /></div>
            <div className="ip-stat-value"><AnimatedNumber value={co2Saved} suffix=" kg" /></div>
            <div className="ip-stat-label">CO2 Emissions Prevented</div>
          </motion.div>
          <motion.div className="ip-stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="ip-stat-icon blue"><Droplets size={24} /></div>
            <div className="ip-stat-value"><AnimatedNumber value={waterSaved} suffix=" L" /></div>
            <div className="ip-stat-label">Water Conserved</div>
          </motion.div>
          <motion.div className="ip-stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="ip-stat-icon orange"><UtensilsCrossed size={24} /></div>
            <div className="ip-stat-value"><AnimatedNumber value={mealsProvided} /></div>
            <div className="ip-stat-label">Meals Provided</div>
          </motion.div>
        </div>

        <motion.div className="ip-equiv-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <h2><Sparkles size={18} /> What That Means</h2>
          <div className="ip-equiv-grid">
            <div className="ip-equiv-card">
              <TreePine size={32} className="ip-equiv-icon green" />
              <div className="ip-equiv-value">{treesEquiv}</div>
              <div className="ip-equiv-label">Trees' worth of CO2 absorbed in a year</div>
            </div>
            <div className="ip-equiv-card">
              <Car size={32} className="ip-equiv-icon blue" />
              <div className="ip-equiv-value">{carsEquiv}</div>
              <div className="ip-equiv-label">Days of car emissions offset</div>
            </div>
            <div className="ip-equiv-card">
              <Droplets size={32} className="ip-equiv-icon cyan" />
              <div className="ip-equiv-value">{poolsEquiv}</div>
              <div className="ip-equiv-label">Olympic pools of water saved</div>
            </div>
          </div>
        </motion.div>

        {platformStats && (
          <motion.div className="ip-comparison" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <h2><TrendingUp size={18} /> Your Contribution vs Platform</h2>
            <div className="ip-compare-grid">
              <div className="ip-compare-item">
                <div className="ip-compare-ring">
                  <CircleProgress percent={foodPct} color="#4ade80" />
                  <div className="ip-compare-pct">{foodPct.toFixed(1)}%</div>
                </div>
                <div className="ip-compare-info">
                  <span className="ip-compare-label">Food Rescued</span>
                  <span className="ip-compare-values">{foodCollected} / {platformStats.foodRescued} kg</span>
                </div>
              </div>
              <div className="ip-compare-item">
                <div className="ip-compare-ring">
                  <CircleProgress percent={mealsPct} color="#60a5fa" />
                  <div className="ip-compare-pct">{mealsPct.toFixed(1)}%</div>
                </div>
                <div className="ip-compare-info">
                  <span className="ip-compare-label">Meals Provided</span>
                  <span className="ip-compare-values">{mealsProvided} / {platformStats.mealsProvided}</span>
                </div>
              </div>
              <div className="ip-compare-item">
                <div className="ip-compare-ring">
                  <CircleProgress percent={co2Pct} color="#34d399" />
                  <div className="ip-compare-pct">{co2Pct.toFixed(1)}%</div>
                </div>
                <div className="ip-compare-info">
                  <span className="ip-compare-label">CO2 Saved</span>
                  <span className="ip-compare-values">{co2Saved} / {platformStats.co2Saved} kg</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div className="ip-milestones" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <h2><Trophy size={18} /> Milestones</h2>
          <div className="ip-milestone-grid">
            {milestones.map((m, i) => {
              const achieved = m.current >= m.target;
              const progress = Math.min(100, (m.current / m.target) * 100);
              const Icon = m.icon;
              return (
                <motion.div key={i} className={`ip-milestone-card ${achieved ? 'ip-milestone-achieved' : ''}`}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.75 + i * 0.08 }}>
                  <div className="ip-milestone-icon-wrap"><Icon size={20} /></div>
                  <div className="ip-milestone-label">{m.label}</div>
                  <div className="ip-milestone-bar">
                    <motion.div className="ip-milestone-fill" initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }} transition={{ delay: 0.8 + i * 0.08, duration: 0.6 }} />
                  </div>
                  <div className="ip-milestone-status">{achieved ? 'Achieved!' : `${Math.round(progress)}%`}</div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {insights.length > 0 && (
          <motion.div className="ip-insights" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
            <h2><Sparkles size={18} /> AI Insights</h2>
            <div className="ip-insights-grid">
              {insights.map((ins, i) => (
                <div key={i} className={`ip-insight-card ip-insight-${ins.color}`}>
                  <div className="ip-insight-title">{ins.title}</div>
                  <div className="ip-insight-desc">{ins.description}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div className="ip-facts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}>
          <h2><Users size={18} /> Global Food Waste Facts</h2>
          <div className="ip-facts-grid">
            <div className="ip-fact-card"><div className="ip-fact-number">1/3</div><div className="ip-fact-text">of all food produced globally is wasted each year</div></div>
            <div className="ip-fact-card"><div className="ip-fact-number">1.3B</div><div className="ip-fact-text">tonnes of food wasted per year worldwide</div></div>
            <div className="ip-fact-card"><div className="ip-fact-number">8-10%</div><div className="ip-fact-text">of global greenhouse gas emissions from food waste</div></div>
            <div className="ip-fact-card"><div className="ip-fact-number">828M</div><div className="ip-fact-text">people go hungry while we waste enough to feed them all</div></div>
          </div>
        </motion.div>
      </div>
    </NGOLayout>
  );
}

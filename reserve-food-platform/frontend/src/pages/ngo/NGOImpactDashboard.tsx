import { useState, useEffect } from 'react';
import { Award, Leaf, Droplets, Users, TrendingUp } from 'lucide-react';
import Layout from '../../components/Layout';
import { useToast } from '../../components/ToastProvider';
import { ngoApi, supportApi } from '../../services/api';
import type { ImpactStats } from '../../types';
import './NGOImpactDashboard.css';

export default function NGOImpactDashboard() {
  const [personalImpact, setPersonalImpact] = useState<Record<string, number>>({});
  const [platformStats, setPlatformStats] = useState<ImpactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const userId = parseInt(localStorage.getItem('userId') || '0');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [personal, platform] = await Promise.all([
        ngoApi.getImpact(userId) as Promise<Record<string, number>>,
        supportApi.getImpactStats(),
      ]);
      setPersonalImpact(personal || {});
      setPlatformStats(platform);
    } catch {
      showToast('Failed to load impact data', 'error');
    } finally {
      setLoading(false);
    }
  }

  const foodCollected = personalImpact.foodCollected || 0;
  const mealsProvided = Math.floor(foodCollected * 2.5);
  const co2Saved = Math.floor(foodCollected * 2.5);
  const waterSaved = Math.floor(foodCollected * 100);

  if (loading) {
    return <Layout><div className="impact-loading">Loading impact data...</div></Layout>;
  }

  return (
    <Layout>
      <div className="impact-page">
        <div className="impact-header">
          <h1><Award size={24} /> Your Impact</h1>
          <p>See the difference you're making in reducing food waste</p>
        </div>

        <div className="impact-stats-grid">
          <div className="impact-stat-card impact-stat-green">
            <Leaf size={28} />
            <div className="impact-stat-value">{foodCollected} kg</div>
            <div className="impact-stat-label">Food Collected</div>
          </div>
          <div className="impact-stat-card impact-stat-blue">
            <Users size={28} />
            <div className="impact-stat-value">{mealsProvided}</div>
            <div className="impact-stat-label">Meals Provided</div>
          </div>
          <div className="impact-stat-card impact-stat-emerald">
            <TrendingUp size={28} />
            <div className="impact-stat-value">{co2Saved} kg</div>
            <div className="impact-stat-label">CO2 Saved</div>
          </div>
          <div className="impact-stat-card impact-stat-cyan">
            <Droplets size={28} />
            <div className="impact-stat-value">{waterSaved} L</div>
            <div className="impact-stat-label">Water Conserved</div>
          </div>
        </div>

        {platformStats && (
          <div className="impact-comparison">
            <h2>Your Contribution vs Platform Total</h2>
            <div className="impact-compare-grid">
              <CompareBar label="Food Rescued" personal={foodCollected} total={platformStats.foodRescued} unit="kg" />
              <CompareBar label="Meals Provided" personal={mealsProvided} total={platformStats.mealsProvided} unit="" />
              <CompareBar label="CO2 Saved" personal={co2Saved} total={platformStats.co2Saved} unit="kg" />
            </div>
          </div>
        )}

        <div className="impact-facts">
          <h2>Did You Know?</h2>
          <div className="impact-facts-grid">
            <div className="impact-fact-card">
              <strong>1/3</strong>
              <span>of all food produced globally is wasted</span>
            </div>
            <div className="impact-fact-card">
              <strong>1.3B</strong>
              <span>tonnes of food wasted per year worldwide</span>
            </div>
            <div className="impact-fact-card">
              <strong>8-10%</strong>
              <span>of global greenhouse emissions from food waste</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function CompareBar({ label, personal, total, unit }: { label: string; personal: number; total: number; unit: string }) {
  const pct = total > 0 ? Math.min(100, (personal / total) * 100) : 0;
  return (
    <div className="compare-bar-item">
      <div className="compare-bar-info">
        <span className="compare-bar-label">{label}</span>
        <span className="compare-bar-values">{personal}{unit && ` ${unit}`} / {total}{unit && ` ${unit}`} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="compare-bar-track">
        <div className="compare-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Clock, Zap } from 'lucide-react';
import Layout from '../../components/Layout';
import { useToast } from '../../components/ToastProvider';
import { mlApi } from '../../services/api';
import type { MLForecastHour, MLForecastDay } from '../../types';
import './NGOForecastPage.css';

export default function NGOForecastPage() {
  const [hourlyForecast, setHourlyForecast] = useState<MLForecastHour[]>([]);
  const [weeklyForecast, setWeeklyForecast] = useState<MLForecastDay[]>([]);
  const [peakHours, setPeakHours] = useState<{ hour: number; count: number }[]>([]);
  const [hourlySource, setHourlySource] = useState('');
  const [weeklySource, setWeeklySource] = useState('');
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [h, w, p] = await Promise.all([
        mlApi.getForecast24h(),
        mlApi.getForecastWeekly(),
        mlApi.getPeakHours(),
      ]);
      setHourlyForecast(h.forecast || []);
      setHourlySource(h.source);
      setWeeklyForecast(w.forecast || []);
      setWeeklySource(w.source);
      setPeakHours(p.hours || []);
    } catch {
      showToast('Failed to load forecast data', 'error');
    } finally {
      setLoading(false);
    }
  }

  const maxHourlyProb = Math.max(...hourlyForecast.map(h => h.probability), 1);
  const maxWeeklyProb = Math.max(...weeklyForecast.map(d => d.probability), 1);
  const maxPeakCount = Math.max(...peakHours.map(p => p.count), 1);

  if (loading) {
    return (
      <Layout>
        <div className="forecast-loading">Loading forecast data...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="forecast-page">
        <div className="forecast-header">
          <h1><TrendingUp size={24} /> Demand Forecasting</h1>
          <p>ML-powered predictions to optimize your collection schedule</p>
        </div>

        <div className="forecast-section">
          <div className="forecast-section-header">
            <h2><Clock size={18} /> 24-Hour Forecast</h2>
            <span className={`source-badge source-${hourlySource}`}>{hourlySource}</span>
          </div>
          <div className="forecast-chart">
            {hourlyForecast.map(h => (
              <div key={h.hour} className="forecast-bar-item">
                <div className="forecast-bar-container">
                  <div
                    className={`forecast-bar confidence-${h.confidence}`}
                    style={{ height: `${(h.probability / maxHourlyProb) * 100}%` }}
                  >
                    <span className="forecast-bar-value">{h.probability}%</span>
                  </div>
                </div>
                <span className="forecast-bar-label">{h.hour}:00</span>
              </div>
            ))}
          </div>
        </div>

        <div className="forecast-section">
          <div className="forecast-section-header">
            <h2><BarChart2 size={18} /> Weekly Forecast</h2>
            <span className={`source-badge source-${weeklySource}`}>{weeklySource}</span>
          </div>
          <div className="forecast-weekly-chart">
            {weeklyForecast.map(d => (
              <div key={d.dayIndex} className="weekly-bar-item">
                <div className="weekly-bar-info">
                  <span className="weekly-day">{d.day}</span>
                  <span className="weekly-prob">{d.probability}% chance</span>
                  <span className="weekly-qty">~{d.expectedQuantity} kg expected</span>
                </div>
                <div className="weekly-bar-track">
                  <div className="weekly-bar-fill" style={{ width: `${(d.probability / maxWeeklyProb) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="forecast-section">
          <div className="forecast-section-header">
            <h2><Zap size={18} /> Peak Donation Hours</h2>
          </div>
          <div className="peak-hours-chart">
            {peakHours.map(p => (
              <div key={p.hour} className="peak-hour-item">
                <span className="peak-hour-label">{p.hour}:00</span>
                <div className="peak-hour-track">
                  <div className="peak-hour-fill" style={{ width: `${(p.count / maxPeakCount) * 100}%` }} />
                </div>
                <span className="peak-hour-count">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

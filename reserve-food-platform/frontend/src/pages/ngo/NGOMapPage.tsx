import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { useNavigate } from 'react-router-dom';
import { MapPin, ArrowLeft, Layers, Clock, TrendingUp, Activity, BarChart2 } from 'lucide-react';
import { Listing } from '../../types';
import { ngoApi, mlApi } from '../../services/api';
import './NGOMapPage.css';

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];

type HeatmapMode = 'none' | 'density' | 'historical' | 'supply-demand' | 'temporal';

const NGOMapPage = () => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('none');
  const [temporalHour, setTemporalHour] = useState(12);
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const supplyLayerRef = useRef<L.Layer | null>(null);
  const demandLayerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const data = await ngoApi.getListings();
        setListings(data || []);
      } catch (error) {
        console.error('Error fetching listings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMapReady(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    if (!leafletMapRef.current) {
      try {
        if ((mapRef.current as any)._leaflet_id) {
          delete (mapRef.current as any)._leaflet_id;
        }
        const mapInstance = L.map(mapRef.current).setView(DEFAULT_CENTER, 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(mapInstance);

        markersRef.current = L.layerGroup().addTo(mapInstance);
        leafletMapRef.current = mapInstance;
        setTimeout(() => mapInstance.invalidateSize(), 0);
      } catch (error: any) {
        console.error('Leaflet init error:', error);
        setMapError('Map failed to initialize. Please refresh.');
      }
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [mapReady]);

  useEffect(() => {
    if (!leafletMapRef.current || !markersRef.current) return;
    markersRef.current.clearLayers();

    listings
      .filter(l => l.latitude && l.longitude)
      .forEach(listing => {
        const marker = L.circleMarker([listing.latitude!, listing.longitude!], {
          radius: 8,
          color: '#22c55e',
          fillColor: '#22c55e',
          fillOpacity: 0.6,
          weight: 2,
        });
        marker.bindPopup(
          `<strong>${listing.foodName}</strong><div>${listing.quantity} ${listing.unit}</div><div>${listing.pickupLocation}</div>`
        );
        marker.addTo(markersRef.current!);
      });
  }, [listings]);

  function clearHeatLayers() {
    const map = leafletMapRef.current;
    if (!map) return;
    if (heatLayerRef.current) { map.removeLayer(heatLayerRef.current); heatLayerRef.current = null; }
    if (supplyLayerRef.current) { map.removeLayer(supplyLayerRef.current); supplyLayerRef.current = null; }
    if (demandLayerRef.current) { map.removeLayer(demandLayerRef.current); demandLayerRef.current = null; }
  }

  async function loadHeatmap(mode: HeatmapMode) {
    if (!leafletMapRef.current) return;
    clearHeatLayers();

    if (mode === 'none') {
      setHeatmapMode('none');
      return;
    }

    setLoadingHeatmap(true);
    setHeatmapMode(mode);

    try {
      const map = leafletMapRef.current;

      if (mode === 'density') {
        const data = await mlApi.getHeatmapDensity();
        if (data.length > 0) {
          heatLayerRef.current = (L as any).heatLayer(data, {
            radius: 25, blur: 15, maxZoom: 17,
            gradient: { 0.2: '#22c55e', 0.4: '#84cc16', 0.6: '#eab308', 0.8: '#f97316', 1: '#ef4444' }
          }).addTo(map);
        }
      } else if (mode === 'historical') {
        const data = await mlApi.getHeatmapHistorical();
        if (data.length > 0) {
          heatLayerRef.current = (L as any).heatLayer(data, {
            radius: 30, blur: 20, maxZoom: 17,
            gradient: { 0.2: '#6366f1', 0.4: '#8b5cf6', 0.6: '#a855f7', 0.8: '#d946ef', 1: '#ec4899' }
          }).addTo(map);
        }
      } else if (mode === 'supply-demand') {
        const { supply, demand } = await mlApi.getHeatmapSupplyDemand();
        const supplyPoints = supply.map((s: any) => [s.lat, s.lng, s.count] as [number, number, number]);
        const demandPoints = demand.map((d: any) => [d.lat, d.lng, d.count] as [number, number, number]);

        if (supplyPoints.length > 0) {
          supplyLayerRef.current = (L as any).heatLayer(supplyPoints, {
            radius: 25, blur: 15, maxZoom: 17,
            gradient: { 0.4: '#22c55e', 0.65: '#16a34a', 1: '#15803d' }
          }).addTo(map);
        }
        if (demandPoints.length > 0) {
          demandLayerRef.current = (L as any).heatLayer(demandPoints, {
            radius: 25, blur: 15, maxZoom: 17,
            gradient: { 0.4: '#ef4444', 0.65: '#dc2626', 1: '#b91c1c' }
          }).addTo(map);
        }
      } else if (mode === 'temporal') {
        const data = await mlApi.getHeatmapTemporal(temporalHour);
        if (data.length > 0) {
          heatLayerRef.current = (L as any).heatLayer(data, {
            radius: 25, blur: 15, maxZoom: 17,
            gradient: { 0.2: '#06b6d4', 0.4: '#0ea5e9', 0.6: '#3b82f6', 0.8: '#6366f1', 1: '#8b5cf6' }
          }).addTo(map);
        }
      }
    } catch (error) {
      console.error('Heatmap load error:', error);
    } finally {
      setLoadingHeatmap(false);
    }
  }

  useEffect(() => {
    if (heatmapMode === 'temporal' && leafletMapRef.current) {
      loadHeatmap('temporal');
    }
  }, [temporalHour]);

  const heatmapOptions: { mode: HeatmapMode; icon: React.ReactNode; label: string; color: string }[] = [
    { mode: 'none', icon: <Layers size={16} />, label: 'Markers Only', color: '#6b7280' },
    { mode: 'density', icon: <Activity size={16} />, label: 'Real-Time Density', color: '#22c55e' },
    { mode: 'historical', icon: <BarChart2 size={16} />, label: 'Historical', color: '#8b5cf6' },
    { mode: 'supply-demand', icon: <TrendingUp size={16} />, label: 'Supply vs Demand', color: '#f97316' },
    { mode: 'temporal', icon: <Clock size={16} />, label: 'By Hour', color: '#3b82f6' },
  ];

  return (
    <div className="ngo-map-page">
      <header className="map-header">
        <button className="map-back" onClick={() => navigate('/ngo/dashboard')}>
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>
        <div>
          <h1>Food Availability Map</h1>
          <p>Browse listings and view heatmap overlays.</p>
        </div>
      </header>

      <div className="map-toolbar">
        {heatmapOptions.map(opt => (
          <button
            key={opt.mode}
            className={`toolbar-btn ${heatmapMode === opt.mode ? 'toolbar-btn-active' : ''}`}
            onClick={() => loadHeatmap(opt.mode)}
            style={heatmapMode === opt.mode ? { borderColor: opt.color, color: opt.color } : {}}
            disabled={loadingHeatmap}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        ))}
        {loadingHeatmap && <span className="toolbar-loading">Loading...</span>}
      </div>

      {heatmapMode === 'temporal' && (
        <div className="temporal-slider">
          <label>Hour: {temporalHour}:00</label>
          <input
            type="range"
            min={0}
            max={23}
            value={temporalHour}
            onChange={e => setTemporalHour(parseInt(e.target.value))}
            className="slider-input"
          />
          <div className="slider-labels">
            <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span>
          </div>
        </div>
      )}

      {heatmapMode === 'supply-demand' && (
        <div className="legend-panel">
          <div className="legend-item"><span className="legend-dot" style={{ background: '#22c55e' }}></span> Supply (Active Listings)</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: '#ef4444' }}></span> Demand (NGO Locations)</div>
        </div>
      )}

      <div className="map-content">
        <aside className="map-sidebar">
          <h2>Active Listings ({listings.length})</h2>
          {loading ? (
            <div className="map-empty">Loading listings...</div>
          ) : listings.length === 0 ? (
            <div className="map-empty">No active listings yet.</div>
          ) : (
            <div className="map-list">
              {listings.map(listing => (
                <div key={listing.id} className="map-card">
                  <div className="map-card-title">
                    <MapPin size={16} />
                    {listing.foodName}
                  </div>
                  <p>{listing.quantity} {listing.unit}</p>
                  <small>{listing.pickupLocation}</small>
                </div>
              ))}
            </div>
          )}
        </aside>

        <section className="map-panel">
          {mapReady ? (
            <div ref={mapRef} className="leaflet-map">
              {mapError && <div className="map-fallback">{mapError}</div>}
            </div>
          ) : (
            <div className="map-fallback">Loading map...</div>
          )}
        </section>
      </div>
    </div>
  );
};

export default NGOMapPage;

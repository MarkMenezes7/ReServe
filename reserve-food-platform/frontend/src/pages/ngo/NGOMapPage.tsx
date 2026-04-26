import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { useNavigate } from 'react-router-dom';
import { MapPin, ArrowLeft, Layers, Clock, TrendingUp, Activity, BarChart2 } from 'lucide-react';
import NGOLayout from '../../components/NGOLayout';
import { Claim, Listing } from '../../types';
import { ngoApi, mlApi } from '../../services/api';
import { useToast } from '../../components/ToastProvider';
import { subscribeNgoSync } from '../../utils/ngoSync';
import NgoDeliveryClaimModal from '../../components/common/NgoDeliveryClaimModal';
import './NGOMapPage.css';

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];

type HeatmapMode = 'none' | 'density' | 'historical' | 'supply-demand' | 'temporal';

const NGOMapPage = () => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('none');
  const [temporalHour, setTemporalHour] = useState(12);
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<number | null>(null);
  const [selectedHeatAnchor, setSelectedHeatAnchor] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [popupAnchorLatLng, setPopupAnchorLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [dismissedListingIds, setDismissedListingIds] = useState<number[]>([]);
  const [claimModalListing, setClaimModalListing] = useState<Listing | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const userId = Number(localStorage.getItem('userId') || '0');
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const supplyLayerRef = useRef<L.Layer | null>(null);
  const demandLayerRef = useRef<L.Layer | null>(null);
  const heatPointsRef = useRef<L.LayerGroup | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [listingData, claimData] = await Promise.all([
        ngoApi.getListings(true),
        userId ? ngoApi.getClaims(userId) : Promise.resolve([] as Claim[]),
      ]);

      setListings(listingData || []);
      setClaims(claimData || []);
    } catch (error) {
      console.error('Error fetching NGO map data:', error);
      showToast('Failed to load live map data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, userId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const liveClaims = useMemo(
    () => claims.filter((claim) => ['pending', 'confirmed'].includes((claim.status || '').toLowerCase())),
    [claims]
  );

  const claimedListingIds = useMemo(
    () => new Set(liveClaims.map((claim) => claim.listingId)),
    [liveClaims]
  );

  const dismissedListingIdSet = useMemo(() => new Set(dismissedListingIds), [dismissedListingIds]);

  const isListingActive = useCallback((listing: Listing) => {
    const status = (listing.status || '').toLowerCase();
    const bestBefore = new Date(listing.bestBefore).getTime();
    return status === 'active' && Number.isFinite(bestBefore) && bestBefore > Date.now();
  }, []);

  const activeListings = useMemo(
    () => listings.filter((listing) => isListingActive(listing)),
    [isListingActive, listings]
  );

  const selectedListing = useMemo(
    () => listings.find((listing) => listing.id === selectedListingId) || null,
    [listings, selectedListingId]
  );

  const distanceKm = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
    const earthRadiusKm = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  const selectedPopupListings = useMemo(() => {
    if (selectedHeatAnchor) {
      return listings.filter((listing) => {
        if (!listing.latitude || !listing.longitude) return false;
        if (dismissedListingIdSet.has(listing.id)) return false;
        return distanceKm(selectedHeatAnchor.lat, selectedHeatAnchor.lng, listing.latitude, listing.longitude) <= 4;
      });
    }

    if (selectedListing && !dismissedListingIdSet.has(selectedListing.id)) {
      return [selectedListing];
    }

    return [];
  }, [distanceKm, dismissedListingIdSet, listings, selectedHeatAnchor, selectedListing]);

  const selectedPopupActiveListings = useMemo(
    () => selectedPopupListings.filter((listing) => isListingActive(listing)),
    [isListingActive, selectedPopupListings]
  );

  const selectedPopupInactiveListings = useMemo(
    () => selectedPopupListings.filter((listing) => !isListingActive(listing)),
    [isListingActive, selectedPopupListings]
  );

  const openListingPopup = useCallback((listing: Listing) => {
    setSelectedHeatAnchor(null);
    setSelectedListingId(listing.id);
    if (listing.latitude && listing.longitude) {
      setPopupAnchorLatLng({ lat: listing.latitude, lng: listing.longitude });
    }
  }, []);

  const openHeatPopupAt = useCallback((lat: number, lng: number, label = 'Heatmap area') => {
    setSelectedListingId(null);
    setSelectedHeatAnchor({ lat, lng, label });
    setPopupAnchorLatLng({ lat, lng });
  }, []);

  const openHeatPopup = useCallback((listing: Listing) => {
    if (!listing.latitude || !listing.longitude) return;
    openHeatPopupAt(listing.latitude, listing.longitude, listing.foodName);
  }, [openHeatPopupAt]);

  const bindHeatLayerClick = useCallback((layer: L.Layer | null, label: string) => {
    if (!layer || !(layer as any).on) return;
    (layer as any).on('click', (event: any) => {
      const latlng = event?.latlng;
      if (!latlng) return;
      openHeatPopupAt(latlng.lat, latlng.lng, label);
    });
  }, [openHeatPopupAt]);

  const closePopup = useCallback(() => {
    setSelectedListingId(null);
    setSelectedHeatAnchor(null);
    setPopupAnchorLatLng(null);
  }, []);

  const popupStyle = useMemo(() => {
    if (!popupAnchorLatLng || !leafletMapRef.current || !mapRef.current) {
      return undefined;
    }

    const map = leafletMapRef.current;
    const mapElement = mapRef.current;
    const point = map.latLngToContainerPoint([popupAnchorLatLng.lat, popupAnchorLatLng.lng]);

    const popupWidth = Math.min(420, Math.max(320, mapElement.clientWidth - 24));
    const popupEstimatedHeight = Math.min(470, Math.max(300, mapElement.clientHeight - 24));
    const padding = 12;

    const minLeft = padding;
    const maxLeft = Math.max(padding, mapElement.clientWidth - popupWidth - padding);
    const minTop = padding;
    const maxTop = Math.max(padding, mapElement.clientHeight - popupEstimatedHeight - padding);

    const rightSpace = mapElement.clientWidth - point.x;
    const leftSpace = point.x;
    const enoughRoomOnRight = rightSpace >= popupWidth + 24;
    const enoughRoomOnLeft = leftSpace >= popupWidth + 24;

    let clampedLeft: number;
    if (enoughRoomOnRight) {
      clampedLeft = Math.min(maxLeft, point.x + 16);
    } else if (enoughRoomOnLeft) {
      clampedLeft = Math.max(minLeft, point.x - popupWidth - 16);
    } else {
      clampedLeft = Math.max(minLeft, Math.min(maxLeft, (mapElement.clientWidth - popupWidth) / 2));
    }

    let clampedTop: number;
    const enoughRoomAbove = point.y >= popupEstimatedHeight / 2 + 24;
    const enoughRoomBelow = mapElement.clientHeight - point.y >= popupEstimatedHeight / 2 + 24;

    if (enoughRoomAbove && enoughRoomBelow) {
      clampedTop = Math.max(minTop, Math.min(maxTop, point.y - popupEstimatedHeight / 2));
    } else {
      clampedTop = Math.max(minTop, Math.min(maxTop, (mapElement.clientHeight - popupEstimatedHeight) / 2));
    }

    return {
      left: `${clampedLeft}px`,
      top: `${clampedTop}px`,
      width: `${popupWidth}px`,
    } as React.CSSProperties;
  }, [popupAnchorLatLng]);

  const handleRejectListing = useCallback((listingId: number) => {
    setDismissedListingIds((current) => (current.includes(listingId) ? current : [...current, listingId]));
    if (selectedListingId === listingId) {
      setSelectedListingId(null);
    }
    showToast('Removed from popup view', 'success');
  }, [selectedListingId, showToast]);

  const handleClaim = useCallback((listing: Listing) => {
    if (!userId) {
      showToast('Please login again to claim food', 'error');
      return;
    }

    if (claimedListingIds.has(listing.id)) {
      showToast('You already have a live claim for this listing', 'error');
      return;
    }

    setClaimModalListing(listing);
  }, [claimedListingIds, showToast, userId]);

  useEffect(() => {
    const unsubscribe = subscribeNgoSync(() => {
      void fetchData();
    });

    return unsubscribe;
  }, [fetchData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchData();
    }, 20000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchData]);

  const focusListing = useCallback((listing: Listing) => {
    if (!leafletMapRef.current || !listing.latitude || !listing.longitude) return;
    leafletMapRef.current.flyTo([listing.latitude, listing.longitude], 14, { duration: 0.6 });
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
        const active = isListingActive(listing);

        const marker = L.circleMarker([listing.latitude!, listing.longitude!], {
          radius: 8,
          color: active ? '#22c55e' : '#94a3b8',
          fillColor: active ? '#22c55e' : '#94a3b8',
          fillOpacity: 0.72,
          weight: 2,
        });

        marker.on('click', () => {
          focusListing(listing);
          openListingPopup(listing);
        });

        marker.addTo(markersRef.current!);
      });
  }, [focusListing, isListingActive, listings, openListingPopup]);

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (heatPointsRef.current) {
      map.removeLayer(heatPointsRef.current);
      heatPointsRef.current = null;
    }

    if (heatmapMode === 'none') return;

    const layer = L.layerGroup().addTo(map);
    listings
      .filter((listing) => listing.latitude && listing.longitude)
      .forEach((listing) => {
        const active = isListingActive(listing);
        const circle = L.circleMarker([listing.latitude!, listing.longitude!], {
          radius: 6,
          color: active ? '#22c55e' : '#94a3b8',
          fillColor: active ? '#22c55e' : '#94a3b8',
          fillOpacity: 0.28,
          weight: 2,
        });

        circle.on('click', () => {
          focusListing(listing);
          openHeatPopup(listing);
        });

        circle.addTo(layer);
      });

    heatPointsRef.current = layer;
  }, [focusListing, heatmapMode, isListingActive, listings, openHeatPopup]);

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || heatmapMode === 'none') return;

    const onMapClick = (event: L.LeafletMouseEvent) => {
      const { lat, lng } = event.latlng;
      openHeatPopupAt(lat, lng, 'Heatmap area');
    };

    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
    };
  }, [heatmapMode, openHeatPopupAt]);

  function clearHeatLayers() {
    const map = leafletMapRef.current;
    if (!map) return;
    if (heatLayerRef.current) { map.removeLayer(heatLayerRef.current); heatLayerRef.current = null; }
    if (supplyLayerRef.current) { map.removeLayer(supplyLayerRef.current); supplyLayerRef.current = null; }
    if (demandLayerRef.current) { map.removeLayer(demandLayerRef.current); demandLayerRef.current = null; }
    if (heatPointsRef.current) { map.removeLayer(heatPointsRef.current); heatPointsRef.current = null; }
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
          bindHeatLayerClick(heatLayerRef.current, 'Real-Time Density');
        }
      } else if (mode === 'historical') {
        const data = await mlApi.getHeatmapHistorical();
        if (data.length > 0) {
          heatLayerRef.current = (L as any).heatLayer(data, {
            radius: 30, blur: 20, maxZoom: 17,
            gradient: { 0.2: '#6366f1', 0.4: '#8b5cf6', 0.6: '#a855f7', 0.8: '#d946ef', 1: '#ec4899' }
          }).addTo(map);
          bindHeatLayerClick(heatLayerRef.current, 'Historical Heat');
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
          bindHeatLayerClick(supplyLayerRef.current, 'Supply Area');
        }
        if (demandPoints.length > 0) {
          demandLayerRef.current = (L as any).heatLayer(demandPoints, {
            radius: 25, blur: 15, maxZoom: 17,
            gradient: { 0.4: '#ef4444', 0.65: '#dc2626', 1: '#b91c1c' }
          }).addTo(map);
          bindHeatLayerClick(demandLayerRef.current, 'Demand Area');
        }
      } else if (mode === 'temporal') {
        const data = await mlApi.getHeatmapTemporal(temporalHour);
        if (data.length > 0) {
          heatLayerRef.current = (L as any).heatLayer(data, {
            radius: 25, blur: 15, maxZoom: 17,
            gradient: { 0.2: '#06b6d4', 0.4: '#0ea5e9', 0.6: '#3b82f6', 0.8: '#6366f1', 1: '#8b5cf6' }
          }).addTo(map);
          bindHeatLayerClick(heatLayerRef.current, `Hour ${temporalHour}:00`);
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
    <NGOLayout>
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
          <h2>Available Food ({activeListings.length})</h2>
          {loading ? (
            <div className="map-empty">Loading listings...</div>
          ) : activeListings.length === 0 ? (
            <div className="map-empty">No active listings yet.</div>
          ) : (
            <div className="map-list">
              {activeListings.map(listing => {
                const alreadyClaimed = claimedListingIds.has(listing.id);

                return (
                  <div key={listing.id} className={`map-card ${alreadyClaimed ? 'claimed' : ''}`} onClick={() => { focusListing(listing); openListingPopup(listing); }}>
                    <div className="map-card-title">
                      <MapPin size={16} />
                      {listing.foodName}
                    </div>
                    <p>{listing.quantity} {listing.unit}</p>
                    <small>{listing.pickupLocation}</small>
                    <small className="map-card-org">{listing.organizationName || listing.donorName || 'Donor'}</small>

                    <div className="map-card-actions">
                      <button
                        type="button"
                        className="map-claim-btn"
                        disabled={alreadyClaimed}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleClaim(listing);
                        }}
                      >
                        {alreadyClaimed ? 'Already Claimed' : 'Claim Food'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="map-live-claims">
            <h3>Live Claims ({liveClaims.length})</h3>
            {liveClaims.length === 0 ? (
              <div className="map-empty map-empty-small">No live claims yet.</div>
            ) : (
              <div className="map-live-claim-list">
                {liveClaims.slice(0, 8).map((claim) => (
                  <div key={claim.id} className="map-live-claim-card">
                    <strong>{claim.foodName || 'Claimed Listing'}</strong>
                    <small>{claim.organizationName || claim.donorName || 'Donor'}</small>
                    <span className="map-live-claim-status">{claim.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="map-panel">
          {mapReady ? (
            <div ref={mapRef} className="leaflet-map">
              {mapError && <div className="map-fallback">{mapError}</div>}
            </div>
          ) : (
            <div className="map-fallback">Loading map...</div>
          )}

          {(selectedListingId !== null || selectedHeatAnchor !== null) && (
            <div className="map-popup-overlay" onClick={closePopup}>
              <div className="map-popup" style={popupStyle} onClick={(event) => event.stopPropagation()}>
                <div className="map-popup-header">
                  <div>
                    <h3>{selectedListing?.foodName || selectedHeatAnchor?.label || 'Restaurant details'}</h3>
                    <p>
                      {selectedListing?.pickupLocation || (selectedHeatAnchor ? `${selectedHeatAnchor.lat.toFixed(4)}, ${selectedHeatAnchor.lng.toFixed(4)}` : 'Location details')}
                    </p>
                  </div>
                  <button type="button" className="map-popup-close" onClick={closePopup}>Close</button>
                </div>

                <div className="map-popup-body">
                  <div className="map-popup-section">
                    <h4>Active Restaurants ({selectedPopupActiveListings.length})</h4>
                    {selectedPopupActiveListings.length === 0 ? (
                      <div className="map-popup-empty">No active restaurants in this selection.</div>
                    ) : selectedPopupActiveListings.map((listing) => {
                      const alreadyClaimed = claimedListingIds.has(listing.id);

                      return (
                        <div className="map-popup-card" key={`active-${listing.id}`}>
                          <div className="map-popup-card-top">
                            <strong>{listing.foodName}</strong>
                            <span className="map-popup-badge active">Active</span>
                          </div>
                          <small>{listing.organizationName || listing.donorName || 'Donor'} • {listing.quantity} {listing.unit}</small>
                          <small>{listing.pickupLocation}</small>
                          <div className="map-popup-actions">
                            <button
                              type="button"
                              className="map-popup-accept"
                              disabled={alreadyClaimed}
                              onClick={() => handleClaim(listing)}
                            >
                              {alreadyClaimed ? 'Already Claimed' : 'Accept'}
                            </button>
                            <button
                              type="button"
                              className="map-popup-reject"
                              onClick={() => handleRejectListing(listing.id)}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="map-popup-section">
                    <h4>Inactive Restaurants ({selectedPopupInactiveListings.length})</h4>
                    {selectedPopupInactiveListings.length === 0 ? (
                      <div className="map-popup-empty">No inactive restaurants in this selection.</div>
                    ) : selectedPopupInactiveListings.map((listing) => (
                      <div className="map-popup-card inactive" key={`inactive-${listing.id}`}>
                        <div className="map-popup-card-top">
                          <strong>{listing.foodName}</strong>
                          <span className="map-popup-badge inactive">{listing.status || 'inactive'}</span>
                        </div>
                        <small>{listing.organizationName || listing.donorName || 'Donor'} • {listing.quantity} {listing.unit}</small>
                        <small>{listing.pickupLocation}</small>
                        <div className="map-popup-actions">
                          <button type="button" className="map-popup-accept" disabled>
                            Accept
                          </button>
                          <button
                            type="button"
                            className="map-popup-reject"
                            onClick={() => handleRejectListing(listing.id)}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <NgoDeliveryClaimModal
        listing={claimModalListing}
        onClose={() => setClaimModalListing(null)}
        onClaimed={() => {
          void fetchData();
          closePopup();
        }}
      />
      </div>
    </NGOLayout>
  );
};

export default NGOMapPage;

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  MapPin,
  Navigation,
  Truck,
  Users,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { adminApi, donorApi, ngoApi } from '../../services/api';
import type { Claim, User, UserType } from '../../types';
import DonorLayout from '../../components/DonorLayout';
import NGOLayout from '../../components/NGOLayout';
import AdminLayout from '../../components/AdminLayout';
import driverTrackerIcon from '../../assets/icons/driver-tracker.svg';
import './DeliveryTrackingMapPage.css';

type DriverUser = User & {
  inTransitCount?: number;
  assignedCount?: number;
  deliveredCount?: number;
};

type DeliveryStatusFilter = 'all' | 'pending' | 'assigned' | 'in-transit' | 'delivered' | 'failed';

interface DeliveryLocationUpdatePayload {
  claimId: number;
  driverCurrentLat?: number;
  driverCurrentLng?: number;
  driverRouteProgress?: number;
  driverRouteStage?: Claim['driverRouteStage'];
  deliveryStatus?: string;
}

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
const RESERVE_CENTER = { lat: 19.1197, lng: 72.8468 }; // Andheri base
const LAST_KNOWN_LOCATION_KEY = 'reserve:last-known-location';

function getStoredLocation(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(LAST_KNOWN_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: unknown; lng?: unknown; timestamp?: unknown };
    const lat = Number(parsed?.lat);
    const lng = Number(parsed?.lng);
    const timestamp = Number(parsed?.timestamp);
    const withinSevenDays = Number.isFinite(timestamp) && (Date.now() - timestamp) <= (7 * 24 * 60 * 60 * 1000);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !withinSevenDays) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function setStoredLocation(lat: number, lng: number): void {
  try {
    localStorage.setItem(
      LAST_KNOWN_LOCATION_KEY,
      JSON.stringify({ lat, lng, timestamp: Date.now() })
    );
  } catch {
    // Ignore storage failures and continue with in-memory location.
  }
}

function toNum(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function hasCoords(lat?: number, lng?: number): lat is number {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat as number) <= 90 &&
    Math.abs(lng as number) <= 180
  );
}

function normalizeDelivery(delivery: Claim): Claim {
  return {
    ...delivery,
    pickupLat: toNum(delivery.pickupLat),
    pickupLng: toNum(delivery.pickupLng),
    dropLat: toNum(delivery.dropLat),
    dropLng: toNum(delivery.dropLng),
    driverCurrentLat: toNum(delivery.driverCurrentLat),
    driverCurrentLng: toNum(delivery.driverCurrentLng),
    driverRouteProgress: toNum(delivery.driverRouteProgress),
    deliveryFee: toNum(delivery.deliveryFee),
    deliveryDistance: toNum(delivery.deliveryDistance),
  };
}

function getStatusClass(status?: string): string {
  if (status === 'in-transit') return 'dt-status-transit';
  if (status === 'delivered') return 'dt-status-delivered';
  if (status === 'assigned') return 'dt-status-assigned';
  if (status === 'failed') return 'dt-status-failed';
  return 'dt-status-pending';
}

function createDriverMarkerElement(): HTMLDivElement {
  const markerEl = document.createElement('div');
  markerEl.className = 'dt-driver-marker';

  const imgEl = document.createElement('img');
  imgEl.src = driverTrackerIcon;
  imgEl.alt = 'Driver';
  imgEl.className = 'dt-driver-marker-img';

  markerEl.appendChild(imgEl);
  return markerEl;
}

const DeliveryTrackingMapPage = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRefs = useRef<mapboxgl.Marker[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const userId = Number(localStorage.getItem('userId') || '0');
  const userType = (localStorage.getItem('userType') as UserType | null) || null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [deliveries, setDeliveries] = useState<Claim[]>([]);
  const [drivers, setDrivers] = useState<DriverUser[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatusFilter>('all');
  const [dispatchSelection, setDispatchSelection] = useState<Record<number, number>>({});
  const [dispatchingClaimId, setDispatchingClaimId] = useState<number | null>(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number>(0);
  const [routeDurationMin, setRouteDurationMin] = useState<number>(0);
  const [viewerLocation, setViewerLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stored = getStoredLocation();
    if (stored) {
      setViewerLocation(stored);
    }

    if (!navigator.geolocation) {
      return () => {
        cancelled = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setViewerLocation(loc);
        setStoredLocation(loc.lat, loc.lng);
      },
      () => {
        // Keep stored location fallback if permission is denied.
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!userType || !userId) return;

    try {
      setError('');
      if (userType === 'admin') {
        const [deliveryData, driverData] = await Promise.all([
          adminApi.getDeliveryTracking(),
          adminApi.getDrivers() as Promise<DriverUser[]>,
        ]);
        setDeliveries((deliveryData || []).map(normalizeDelivery));
        setDrivers(driverData || []);
      } else if (userType === 'donor') {
        const deliveryData = await donorApi.getDeliveryTracking(userId);
        setDeliveries((deliveryData || []).map(normalizeDelivery));
        setDrivers([]);
      } else if (userType === 'ngo') {
        const deliveryData = await ngoApi.getDeliveryTracking(userId);
        setDeliveries((deliveryData || []).map(normalizeDelivery));
        setDrivers([]);
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to load delivery tracking data');
    } finally {
      setLoading(false);
    }
  }, [userId, userType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchData();
    }, 15000);

    return () => clearInterval(timer);
  }, [fetchData]);

  const filteredDeliveries = useMemo(() => {
    if (statusFilter === 'all') return deliveries;
    return deliveries.filter((delivery) => (delivery.deliveryStatus || 'pending') === statusFilter);
  }, [deliveries, statusFilter]);

  const selectedDelivery = useMemo(
    () => filteredDeliveries.find((delivery) => delivery.id === selectedDeliveryId) || filteredDeliveries[0] || null,
    [filteredDeliveries, selectedDeliveryId]
  );

  useEffect(() => {
    if (!selectedDelivery && filteredDeliveries.length > 0) {
      setSelectedDeliveryId(filteredDeliveries[0].id);
    }
  }, [filteredDeliveries, selectedDelivery]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [72.8777, 19.076],
      zoom: 10,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');
    mapRef.current = map;

    return () => {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const renderMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    const points: Array<{ lng: number; lat: number; label: string; color: string; markerType?: 'driver' | 'viewer' }> = [];

    if ((userType === 'donor' || userType === 'ngo') && hasCoords(viewerLocation?.lat, viewerLocation?.lng)) {
      points.push({
        lng: viewerLocation.lng,
        lat: viewerLocation.lat,
        label: 'You are here',
        color: '#0ea5e9',
        markerType: 'viewer',
      });
    }

    if (!selectedDelivery) {
      if (points.length === 1) {
        map.flyTo({ center: [points[0].lng, points[0].lat], zoom: 12, essential: true });
      }
      points.forEach((point) => {
        const marker = new mapboxgl.Marker({ color: point.color })
          .setLngLat([point.lng, point.lat])
          .setPopup(new mapboxgl.Popup({ offset: 16 }).setText(point.label))
          .addTo(map);
        markerRefs.current.push(marker);
      });
      return;
    }

    if (hasCoords(selectedDelivery.pickupLat, selectedDelivery.pickupLng)) {
      points.push({
        lng: selectedDelivery.pickupLng as number,
        lat: selectedDelivery.pickupLat as number,
        label: 'Pickup',
        color: '#16a34a',
      });
    }

    if (hasCoords(selectedDelivery.dropLat, selectedDelivery.dropLng)) {
      points.push({
        lng: selectedDelivery.dropLng as number,
        lat: selectedDelivery.dropLat as number,
        label: 'Drop',
        color: '#2563eb',
      });
    }

    points.push({
      lng: RESERVE_CENTER.lng,
      lat: RESERVE_CENTER.lat,
      label: 'ReServe Center (Andheri)',
      color: '#2563eb',
    });

    const routeStage = selectedDelivery.driverRouteStage || (selectedDelivery.deliveryStatus === 'in-transit' ? 'to-donor' : undefined);

    if (hasCoords(selectedDelivery.driverCurrentLat, selectedDelivery.driverCurrentLng)) {
      points.push({
        lng: selectedDelivery.driverCurrentLng as number,
        lat: selectedDelivery.driverCurrentLat as number,
        label: selectedDelivery.driverName
          ? `Driver: ${selectedDelivery.driverName} (${(routeStage || 'ready-at-center').replace(/-/g, ' ')})`
          : 'Driver',
        color: '#f97316',
        markerType: 'driver',
      });
    }

    points.forEach((point) => {
      const marker = new mapboxgl.Marker(
        point.markerType === 'driver'
          ? { element: createDriverMarkerElement(), anchor: 'center' }
          : { color: point.color }
      )
        .setLngLat([point.lng, point.lat])
        .setPopup(new mapboxgl.Popup({ offset: 16 }).setText(point.label))
        .addTo(map);
      markerRefs.current.push(marker);
    });

    if (points.length === 1) {
      map.flyTo({ center: [points[0].lng, points[0].lat], zoom: 14, essential: true });
    } else if (points.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach((point) => bounds.extend([point.lng, point.lat]));
      map.fitBounds(bounds, { padding: 70, maxZoom: 14 });
    }
  }, [selectedDelivery, userType, viewerLocation]);

  const drawRoute = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !selectedDelivery || !MAPBOX_TOKEN) return;

    const startLat = selectedDelivery.driverCurrentLat ?? selectedDelivery.pickupLat;
    const startLng = selectedDelivery.driverCurrentLng ?? selectedDelivery.pickupLng;

    const routeStage = selectedDelivery.driverRouteStage || (selectedDelivery.deliveryStatus === 'in-transit' ? 'to-donor' : undefined);
    const nextTarget =
      routeStage === 'to-donor'
        ? { lat: selectedDelivery.pickupLat, lng: selectedDelivery.pickupLng }
        : routeStage === 'to-ngo'
          ? { lat: selectedDelivery.dropLat, lng: selectedDelivery.dropLng }
          : routeStage === 'returning-to-center'
            ? { lat: RESERVE_CENTER.lat, lng: RESERVE_CENTER.lng }
            : routeStage === 'completed'
              ? { lat: RESERVE_CENTER.lat, lng: RESERVE_CENTER.lng }
            : { lat: selectedDelivery.dropLat, lng: selectedDelivery.dropLng };

    const endLat = nextTarget.lat;
    const endLng = nextTarget.lng;

    const routeLayerId = 'delivery-route-layer';
    const routeSourceId = 'delivery-route-source';

    if (map.getLayer(routeLayerId)) map.removeLayer(routeLayerId);
    if (map.getSource(routeSourceId)) map.removeSource(routeSourceId);

    if (!hasCoords(startLat, startLng) || !hasCoords(endLat, endLng)) {
      setRouteDistanceKm(0);
      setRouteDurationMin(0);
      return;
    }

    if (Math.abs((startLat as number) - (endLat as number)) < 0.000001 && Math.abs((startLng as number) - (endLng as number)) < 0.000001) {
      setRouteDistanceKm(0);
      setRouteDurationMin(0);
      return;
    }

    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${startLng},${startLat};${endLng},${endLat}?geometries=geojson&overview=full&alternatives=false&access_token=${MAPBOX_TOKEN}`;
      const response = await fetch(url);
      const data = await response.json();
      const route = data?.routes?.[0];
      if (!route?.geometry) return;

      setRouteDistanceKm(Number((route.distance / 1000).toFixed(1)));
      setRouteDurationMin(Math.round(route.duration / 60));

      map.addSource(routeSourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: route.geometry,
        },
      });

      map.addLayer({
        id: routeLayerId,
        type: 'line',
        source: routeSourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#f97316',
          'line-width': 5,
          'line-opacity': 0.85,
        },
      });
    } catch {
      setRouteDistanceKm(0);
      setRouteDurationMin(0);
    }
  }, [selectedDelivery]);

  useEffect(() => {
    renderMarkers();
    drawRoute();
  }, [renderMarkers, drawRoute]);

  useEffect(() => {
    if (!userId) return;

    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    socket.emit('joinUserRoom', { userId, userType });

    const handleLocationUpdate = (payload: DeliveryLocationUpdatePayload) => {
      setDeliveries((prev) =>
        prev.map((delivery) => {
          if (delivery.id !== payload.claimId) return delivery;
          return {
            ...delivery,
            driverCurrentLat: toNum(payload.driverCurrentLat) ?? delivery.driverCurrentLat,
            driverCurrentLng: toNum(payload.driverCurrentLng) ?? delivery.driverCurrentLng,
            driverRouteProgress: toNum(payload.driverRouteProgress) ?? delivery.driverRouteProgress,
            driverRouteStage: payload.driverRouteStage || delivery.driverRouteStage,
            deliveryStatus: payload.deliveryStatus || delivery.deliveryStatus,
          };
        })
      );
    };

    const handleStatusUpdate = (payload: DeliveryLocationUpdatePayload) => {
      setDeliveries((prev) =>
        prev.map((delivery) => (delivery.id === payload.claimId
          ? {
            ...delivery,
            deliveryStatus: payload.deliveryStatus || delivery.deliveryStatus,
            driverRouteStage: payload.driverRouteStage || delivery.driverRouteStage,
          }
          : delivery))
      );
    };

    socket.on('deliveryLocationUpdate', handleLocationUpdate);
    socket.on('deliveryStatusUpdate', handleStatusUpdate);

    return () => {
      socket.off('deliveryLocationUpdate', handleLocationUpdate);
      socket.off('deliveryStatusUpdate', handleStatusUpdate);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, userType]);

  const handleDispatch = async (claimId: number) => {
    const chosenDriverId = dispatchSelection[claimId];
    if (!chosenDriverId) {
      setError('Select a driver before dispatching.');
      return;
    }

    try {
      setDispatchingClaimId(claimId);
      setError('');
      await adminApi.dispatchDriver(claimId, chosenDriverId);
      await fetchData();
    } catch (err) {
      setError((err as Error).message || 'Failed to dispatch driver');
    } finally {
      setDispatchingClaimId(null);
    }
  };

  if (!userId || !userType || !['admin', 'donor', 'ngo'].includes(userType)) {
    return (
      <div className="delivery-tracking-page dt-standalone">
        <div className="dt-empty">Access denied. Please login with admin, donor, or NGO account.</div>
      </div>
    );
  }

  const pageContent = (
    <div className="delivery-tracking-page">
      <header className="dt-header">
        <div>
          <h1>Live Delivery Tracking</h1>
          <p>
            {userType === 'admin'
              ? 'Track all platform deliveries and dispatch drivers.'
              : 'Track platform-delivery orders in real time.'}
          </p>
        </div>
      </header>

      {error && <div className="dt-error">{error}</div>}

      {!MAPBOX_TOKEN && (
        <div className="dt-error">
          Add VITE_MAPBOX_ACCESS_TOKEN in frontend env to enable Mapbox map rendering.
        </div>
      )}

      <div className="dt-toolbar">
        <div className="dt-filter-row">
          <label htmlFor="dt-status-filter">Status</label>
          <select
            id="dt-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DeliveryStatusFilter)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in-transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="dt-summary-row">
          <span><Truck size={15} /> {filteredDeliveries.length} deliveries</span>
          <span><Navigation size={15} /> {routeDistanceKm} km route</span>
          <span><Clock size={15} /> {routeDurationMin} min ETA</span>
        </div>
      </div>

      <div className="dt-content">
        <section className="dt-map-panel">
          <div ref={mapContainerRef} className="dt-map" />
        </section>

        <aside className="dt-sidebar">
          {loading ? (
            <div className="dt-empty">Loading deliveries...</div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="dt-empty">No platform deliveries found for this filter.</div>
          ) : (
            <div className="dt-list">
              {filteredDeliveries.map((delivery) => {
                const isSelected = selectedDelivery?.id === delivery.id;
                const assignedDriver = delivery.driverName || 'Unassigned';
                const progressPct = Math.round((delivery.driverRouteProgress || 0) * 100);

                return (
                  <article
                    key={delivery.id}
                    className={`dt-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedDeliveryId(delivery.id)}
                  >
                    <div className="dt-card-top">
                      <h3>{delivery.foodName}</h3>
                      <span className={`dt-status-chip ${getStatusClass(delivery.deliveryStatus)}`}>
                        {delivery.deliveryStatus || 'pending'}
                      </span>
                    </div>

                    <div className="dt-card-row"><MapPin size={14} /> Pickup: {delivery.pickupLocation || 'Unknown'}</div>
                    <div className="dt-card-row"><Users size={14} /> Driver: {assignedDriver}</div>
                    <div className="dt-card-row"><Navigation size={14} /> Stage: {(delivery.driverRouteStage || 'ready-at-center').replace(/-/g, ' ')}</div>
                    <div className="dt-card-row"><Truck size={14} /> Fee: Rs {delivery.deliveryFee || 0}</div>
                    <div className="dt-progress-row">
                      <div className="dt-progress-track">
                        <div className="dt-progress-fill" style={{ width: `${progressPct}%` }} />
                      </div>
                      <span>{progressPct}%</span>
                    </div>

                    {userType === 'admin' && (
                      <div className="dt-dispatch-row" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={dispatchSelection[delivery.id] || delivery.driverId || ''}
                          onChange={(e) =>
                            setDispatchSelection((prev) => ({
                              ...prev,
                              [delivery.id]: Number(e.target.value),
                            }))
                          }
                        >
                          <option value="">Select driver</option>
                          {drivers
                            .filter((driver) => driver.isActive)
                            .map((driver) => (
                              <option key={driver.id} value={driver.id}>
                                {driver.name} ({driver.inTransitCount || 0} active)
                              </option>
                            ))}
                        </select>
                        <button
                          className="dt-dispatch-btn"
                          onClick={() => handleDispatch(delivery.id)}
                          disabled={dispatchingClaimId === delivery.id}
                        >
                          {dispatchingClaimId === delivery.id ? 'Assigning...' : 'Assign Driver'}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {userType === 'admin' && (
            <div className="dt-drivers-panel">
              <h3>All Drivers</h3>
              {drivers.length === 0 ? (
                <p>No drivers found. Drivers can register from signup.</p>
              ) : (
                <ul>
                  {drivers.map((driver) => (
                    <li key={driver.id}>
                      <span>{driver.name}</span>
                      <span>{driver.inTransitCount || 0} active</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {selectedDelivery && (
            <div className="dt-route-note">
              <CheckCircle2 size={15} />
              Mapbox route uses traffic-aware profile (driving-traffic).
            </div>
          )}
        </aside>
      </div>
    </div>
  );

  if (userType === 'donor') {
    return <DonorLayout>{pageContent}</DonorLayout>;
  }

  if (userType === 'ngo') {
    return <NGOLayout>{pageContent}</NGOLayout>;
  }

  if (userType === 'admin') {
    return <AdminLayout>{pageContent}</AdminLayout>;
  }

  return pageContent;
};

export default DeliveryTrackingMapPage;

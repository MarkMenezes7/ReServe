import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  Truck,
  Navigation,
  Clock,
  CheckCircle2,
  MapPin,
  Route,
} from 'lucide-react';
import { driverApi } from '../../services/api';
import type { Claim } from '../../types';
import driverTrackerIcon from '../../assets/icons/driver-tracker.svg';
import './DriverDashboard.css';

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
const DEFAULT_MUMBAI_CENTER: [number, number] = [72.8777, 19.0760];
const RESERVE_CENTER = { lat: 19.1197, lng: 72.8468 }; // Andheri base

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

function createDriverMarkerElement(bearing = 0): HTMLDivElement {
  const markerEl = document.createElement('div');
  markerEl.className = 'driver-map-marker';

  const imgEl = document.createElement('img');
  imgEl.src = driverTrackerIcon;
  imgEl.alt = 'Driver';
  imgEl.className = 'driver-map-marker-img';
  imgEl.style.transform = `rotate(${bearing}deg)`;

  markerEl.appendChild(imgEl);
  return markerEl;
}

function calculateBearing(fromLng: number, fromLat: number, toLng: number, toLat: number): number {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const toDeg = (rad: number) => rad * 180 / Math.PI;

  const dLng = toRad(toLng - fromLng);
  const y = Math.sin(dLng) * Math.cos(toRad(toLat));
  const x =
    Math.cos(toRad(fromLat)) * Math.sin(toRad(toLat)) -
    Math.sin(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.cos(dLng);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

function bearingDeltaDeg(a: number, b: number): number {
  const delta = Math.abs((a - b) % 360);
  return delta > 180 ? 360 - delta : delta;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function interpolateTripPosition(
  progress: number,
  center: { lat: number; lng: number },
  pickup: { lat: number; lng: number },
  drop: { lat: number; lng: number }
): { lat: number; lng: number; stage: NonNullable<Claim['driverRouteStage']> } {
  const d1 = Math.max(0.1, haversineKm(center.lat, center.lng, pickup.lat, pickup.lng));
  const d2 = Math.max(0.1, haversineKm(pickup.lat, pickup.lng, drop.lat, drop.lng));
  const d3 = Math.max(0.1, haversineKm(drop.lat, drop.lng, center.lat, center.lng));
  const total = d1 + d2 + d3;

  const b1 = d1 / total;
  const b2 = (d1 + d2) / total;

  if (progress <= b1) {
    const local = b1 <= 0 ? 1 : progress / b1;
    return {
      stage: 'to-donor',
      lat: Number(lerp(center.lat, pickup.lat, local).toFixed(6)),
      lng: Number(lerp(center.lng, pickup.lng, local).toFixed(6)),
    };
  }

  if (progress <= b2) {
    const span = b2 - b1;
    const local = span <= 0 ? 1 : (progress - b1) / span;
    return {
      stage: 'to-ngo',
      lat: Number(lerp(pickup.lat, drop.lat, local).toFixed(6)),
      lng: Number(lerp(pickup.lng, drop.lng, local).toFixed(6)),
    };
  }

  const span = 1 - b2;
  const local = span <= 0 ? 1 : (progress - b2) / span;
  return {
    stage: 'returning-to-center',
    lat: Number(lerp(drop.lat, center.lat, local).toFixed(6)),
    lng: Number(lerp(drop.lng, center.lng, local).toFixed(6)),
  };
}

function resolveTripStage(
  progress: number,
  center: { lat: number; lng: number },
  pickup: { lat: number; lng: number },
  drop: { lat: number; lng: number }
): {
  stage: NonNullable<Claim['driverRouteStage']>;
  localProgress: number;
  segmentStart: { lat: number; lng: number };
  segmentEnd: { lat: number; lng: number };
} {
  const d1 = Math.max(0.1, haversineKm(center.lat, center.lng, pickup.lat, pickup.lng));
  const d2 = Math.max(0.1, haversineKm(pickup.lat, pickup.lng, drop.lat, drop.lng));
  const d3 = Math.max(0.1, haversineKm(drop.lat, drop.lng, center.lat, center.lng));
  const total = d1 + d2 + d3;

  const clamped = Math.max(0, Math.min(1, progress));
  const b1 = d1 / total;
  const b2 = (d1 + d2) / total;

  if (clamped <= b1) {
    const local = b1 <= 0 ? 1 : clamped / b1;
    return {
      stage: 'to-donor',
      localProgress: Math.max(0, Math.min(1, local)),
      segmentStart: center,
      segmentEnd: pickup,
    };
  }

  if (clamped <= b2) {
    const span = b2 - b1;
    const local = span <= 0 ? 1 : (clamped - b1) / span;
    return {
      stage: 'to-ngo',
      localProgress: Math.max(0, Math.min(1, local)),
      segmentStart: pickup,
      segmentEnd: drop,
    };
  }

  const span = 1 - b2;
  const local = span <= 0 ? 1 : (clamped - b2) / span;
  return {
    stage: 'returning-to-center',
    localProgress: Math.max(0, Math.min(1, local)),
    segmentStart: drop,
    segmentEnd: center,
  };
}

function buildRouteDistanceProfile(coordinates: Array<[number, number]>): { cumulativeKm: number[]; totalKm: number } {
  if (!coordinates.length) {
    return { cumulativeKm: [], totalKm: 0 };
  }

  const cumulativeKm: number[] = [0];
  let totalKm = 0;

  for (let i = 1; i < coordinates.length; i += 1) {
    const prev = coordinates[i - 1];
    const next = coordinates[i];
    totalKm += haversineKm(prev[1], prev[0], next[1], next[0]);
    cumulativeKm.push(totalKm);
  }

  return { cumulativeKm, totalKm };
}

function sampleRoutePoint(
  coordinates: Array<[number, number]>,
  cumulativeKm: number[],
  totalKm: number,
  progress: number
): { lat: number; lng: number } | null {
  if (!coordinates.length || !cumulativeKm.length) return null;
  if (coordinates.length === 1 || totalKm <= 0) {
    const only = coordinates[coordinates.length - 1];
    return { lat: only[1], lng: only[0] };
  }

  const clamped = Math.max(0, Math.min(1, progress));
  const targetKm = clamped * totalKm;

  let index = 1;
  while (index < cumulativeKm.length && cumulativeKm[index] < targetKm) {
    index += 1;
  }

  if (index >= coordinates.length) {
    const last = coordinates[coordinates.length - 1];
    return { lat: last[1], lng: last[0] };
  }

  const prevKm = cumulativeKm[index - 1];
  const nextKm = cumulativeKm[index];
  const span = Math.max(0.000001, nextKm - prevKm);
  const local = Math.max(0, Math.min(1, (targetKm - prevKm) / span));

  const prev = coordinates[index - 1];
  const next = coordinates[index];
  return {
    lat: lerp(prev[1], next[1], local),
    lng: lerp(prev[0], next[0], local),
  };
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
  };
}

function statusClass(status?: string): string {
  if (status === 'in-transit') return 'driver-status-transit';
  if (status === 'delivered') return 'driver-status-delivered';
  if (status === 'assigned') return 'driver-status-assigned';
  if (status === 'failed') return 'driver-status-failed';
  return 'driver-status-pending';
}

function clearMarker(markerRef: { current: mapboxgl.Marker | null }) {
  if (markerRef.current) {
    markerRef.current.remove();
    markerRef.current = null;
  }
}

const DriverDashboard = () => {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const targetMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const centerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const lastDriverPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const activeDeliveryRef = useRef<number | null>(null);
  const followCameraRef = useRef(false);
  const followCameraTargetRef = useRef<{ lat: number; lng: number; bearing: number } | null>(null);
  const interactionLockRef = useRef(false);
  const lastCameraPoseRef = useRef<{ lat: number; lng: number; bearing: number; at: number } | null>(null);
  const routeFetchInFlightRef = useRef(false);
  const progressMotionRef = useRef<{
    deliveryId: number | null;
    from: number;
    to: number;
    startedAt: number;
    durationMs: number;
  }>({
    deliveryId: null,
    from: 0,
    to: 0,
    startedAt: 0,
    durationMs: 6000,
  });
  const routeGeometryRef = useRef<{
    deliveryId: number | null;
    stage: string | null;
    coordinates: Array<[number, number]>;
    cumulativeKm: number[];
    totalKm: number;
  }>({
    deliveryId: null,
    stage: null,
    coordinates: [],
    cumulativeKm: [],
    totalKm: 0,
  });
  const lastRouteFetchRef = useRef<{
    deliveryId: number | null;
    stage: string | null;
    startLat: number | null;
    startLng: number | null;
    endLat: number | null;
    endLng: number | null;
    at: number;
  }>({
    deliveryId: null,
    stage: null,
    startLat: null,
    startLng: null,
    endLat: null,
    endLng: null,
    at: 0,
  });

  const userId = Number(localStorage.getItem('userId') || '0');
  const userName = localStorage.getItem('userName') || 'Driver';
  const userType = localStorage.getItem('userType');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [deliveries, setDeliveries] = useState<Claim[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState(0);
  const [routeDurationMin, setRouteDurationMin] = useState(0);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const getAnimatedProgress = useCallback((deliveryId: number, rawProgress: number, isInTransit: boolean): number => {
    const now = Date.now();
    const safe = Math.max(0, Math.min(1, rawProgress));
    const motion = progressMotionRef.current;

    if (!isInTransit) {
      progressMotionRef.current = {
        deliveryId,
        from: safe,
        to: safe,
        startedAt: now,
        durationMs: 6000,
      };
      return safe;
    }

    if (motion.deliveryId !== deliveryId) {
      progressMotionRef.current = {
        deliveryId,
        from: safe,
        to: safe,
        startedAt: now,
        durationMs: 6000,
      };
      return safe;
    }

    const elapsed = Math.max(0, now - motion.startedAt);
    const duration = Math.max(200, motion.durationMs);
    const t = Math.max(0, Math.min(1, elapsed / duration));
    const easedT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const current = motion.from + (motion.to - motion.from) * easedT;

    if (safe + 0.001 < current) {
      return current;
    }

    if (safe > motion.to + 0.0005) {
      const delta = Math.max(0, safe - current);
      const estimatedMs = delta > 0 ? (delta / 0.025) * 6000 : 6000;
      progressMotionRef.current = {
        deliveryId,
        from: current,
        to: safe,
        startedAt: now,
        durationMs: Math.max(450, Math.min(9000, estimatedMs)),
      };
      return current;
    }

    if (t >= 1 && safe >= motion.to) {
      progressMotionRef.current = {
        ...motion,
        from: motion.to,
        startedAt: now,
      };
      return motion.to;
    }

    return current;
  }, []);

  const setNavigationLock = useCallback((lock: boolean) => {
    const map = mapRef.current;
    if (!map || interactionLockRef.current === lock) return;

    if (lock) {
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.boxZoom.disable();
      map.dragRotate.disable();
      map.keyboard.disable();
      map.doubleClickZoom.disable();
      map.touchZoomRotate.disable();
    } else {
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.boxZoom.enable();
      map.dragRotate.enable();
      map.keyboard.enable();
      map.doubleClickZoom.enable();
      map.touchZoomRotate.enable();
    }

    interactionLockRef.current = lock;
  }, []);

  const fetchDeliveries = useCallback(async () => {
    try {
      setError('');
      const data = await driverApi.getMyDeliveries();
      const normalized = (data || []).map(normalizeDelivery);
      setDeliveries((prev) => {
        const prevById = new Map(prev.map((delivery) => [delivery.id, delivery]));

        return normalized.map((nextDelivery) => {
          const previous = prevById.get(nextDelivery.id);
          if (!previous) return nextDelivery;

          const nextProgress = toNum(nextDelivery.driverRouteProgress);
          const previousProgress = toNum(previous.driverRouteProgress);
          const nextStatus = nextDelivery.deliveryStatus || previous.deliveryStatus;

          const isRegressiveSnapshot =
            nextStatus === 'in-transit' &&
            nextProgress !== undefined &&
            previousProgress !== undefined &&
            nextProgress + 0.001 < previousProgress;

          if (!isRegressiveSnapshot) {
            return nextDelivery;
          }

          return {
            ...nextDelivery,
            driverCurrentLat: previous.driverCurrentLat ?? nextDelivery.driverCurrentLat,
            driverCurrentLng: previous.driverCurrentLng ?? nextDelivery.driverCurrentLng,
            driverRouteProgress: previousProgress,
            driverRouteStage: previous.driverRouteStage || nextDelivery.driverRouteStage,
          };
        });
      });
    } catch (err) {
      setError((err as Error).message || 'Failed to load driver deliveries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchDeliveries();
    }, 15000);
    return () => clearInterval(timer);
  }, [fetchDeliveries]);

  const sortedDeliveries = useMemo(() => {
    return [...deliveries].sort((a, b) => {
      const aRank = a.deliveryStatus === 'in-transit' ? 0 : a.deliveryStatus === 'assigned' ? 1 : 2;
      const bRank = b.deliveryStatus === 'in-transit' ? 0 : b.deliveryStatus === 'assigned' ? 1 : 2;
      if (aRank !== bRank) return aRank - bRank;
      return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
    });
  }, [deliveries]);

  const selectedDelivery = useMemo(
    () => sortedDeliveries.find((delivery) => delivery.id === selectedId) || sortedDeliveries[0] || null,
    [sortedDeliveries, selectedId]
  );

  useEffect(() => {
    if (!selectedDelivery && sortedDeliveries.length > 0) {
      const firstClaimable = sortedDeliveries.find(
        (delivery) => (delivery.deliveryStatus || 'pending') === 'assigned' || (delivery.deliveryStatus || 'pending') === 'pending'
      );
      setSelectedId((firstClaimable || sortedDeliveries[0]).id);
    }
  }, [selectedDelivery, sortedDeliveries]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/navigation-day-v1',
      center: DEFAULT_MUMBAI_CENTER,
      zoom: 10,
    });

    let followResetTimer: ReturnType<typeof setTimeout> | null = null;
    const enforceFollowCamera = () => {
      // Ignore programmatic camera updates while navigation lock is active.
      if (interactionLockRef.current || !followCameraRef.current || !followCameraTargetRef.current) return;

      if (followResetTimer) {
        clearTimeout(followResetTimer);
      }

      followResetTimer = setTimeout(() => {
        if (!followCameraRef.current || !followCameraTargetRef.current) return;
        const target = followCameraTargetRef.current;
        map.easeTo({
          center: [target.lng, target.lat],
          zoom: 16.2,
          pitch: 62,
          bearing: target.bearing,
          duration: 420,
          essential: true,
        });
      }, 90);
    };

    map.on('dragend', enforceFollowCamera);
    map.on('zoomend', enforceFollowCamera);
    map.on('rotateend', enforceFollowCamera);
    map.on('pitchend', enforceFollowCamera);

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
      if (followResetTimer) {
        clearTimeout(followResetTimer);
      }
      map.off('dragend', enforceFollowCamera);
      map.off('zoomend', enforceFollowCamera);
      map.off('rotateend', enforceFollowCamera);
      map.off('pitchend', enforceFollowCamera);

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      clearMarker(pickupMarkerRef);
      clearMarker(targetMarkerRef);
      clearMarker(centerMarkerRef);
      clearMarker(driverMarkerRef);

      if (map.getLayer('driver-route-layer')) map.removeLayer('driver-route-layer');
      if (map.getSource('driver-route-source')) map.removeSource('driver-route-source');

      map.remove();
      mapRef.current = null;
    };
  }, []);

  const drawMapState = useCallback(async () => {
    const map = mapRef.current;
    const delivery = selectedDelivery;
    if (!map || !delivery) return;

    const routeSourceId = 'driver-route-source';
    const routeLayerId = 'driver-route-layer';

    if (activeDeliveryRef.current !== delivery.id) {
      clearMarker(pickupMarkerRef);
      clearMarker(targetMarkerRef);
      clearMarker(centerMarkerRef);
      clearMarker(driverMarkerRef);
      if (map.getLayer(routeLayerId)) map.removeLayer(routeLayerId);
      if (map.getSource(routeSourceId)) map.removeSource(routeSourceId);

      activeDeliveryRef.current = delivery.id;
      lastDriverPosRef.current = null;
      lastCameraPoseRef.current = null;
      progressMotionRef.current.deliveryId = null;
      routeGeometryRef.current = {
        deliveryId: null,
        stage: null,
        coordinates: [],
        cumulativeKm: [],
        totalKm: 0,
      };
      lastRouteFetchRef.current = {
        deliveryId: null,
        stage: null,
        startLat: null,
        startLng: null,
        endLat: null,
        endLng: null,
        at: 0,
      };
    }

    const isInTransit = delivery.deliveryStatus === 'in-transit';
    const waitingForClaim = !isInTransit && ['assigned', 'pending'].includes(delivery.deliveryStatus || 'pending');

    const rawProgress = Math.max(0, Math.min(1, Number(delivery.driverRouteProgress) || 0));
    const progress = getAnimatedProgress(delivery.id, rawProgress, isInTransit);
    const hasPickup = hasCoords(delivery.pickupLat, delivery.pickupLng);
    const hasDrop = hasCoords(delivery.dropLat, delivery.dropLng);
    const tripState = isInTransit && hasPickup && hasDrop
      ? resolveTripStage(
        progress,
        { lat: RESERVE_CENTER.lat, lng: RESERVE_CENTER.lng },
        { lat: delivery.pickupLat as number, lng: delivery.pickupLng as number },
        { lat: delivery.dropLat as number, lng: delivery.dropLng as number }
      )
      : null;
    const derivedPos = isInTransit && hasPickup && hasDrop
      ? interpolateTripPosition(
        progress,
        { lat: RESERVE_CENTER.lat, lng: RESERVE_CENTER.lng },
        { lat: delivery.pickupLat as number, lng: delivery.pickupLng as number },
        { lat: delivery.dropLat as number, lng: delivery.dropLng as number }
      )
      : null;

    const hasLiveCoords = hasCoords(delivery.driverCurrentLat, delivery.driverCurrentLng);

    const routeSnapshot = routeGeometryRef.current;
    const snappedPos = isInTransit && tripState &&
      routeSnapshot.deliveryId === delivery.id
      ? sampleRoutePoint(
        routeSnapshot.coordinates,
        routeSnapshot.cumulativeKm,
        routeSnapshot.totalKm,
        routeSnapshot.stage === tripState.stage ? tripState.localProgress : 1
      )
      : null;

    // Keep one authoritative position source during active trips to avoid visual jumping.
    const startLat = isInTransit
      ? (snappedPos?.lat ?? derivedPos?.lat ?? (hasLiveCoords ? delivery.driverCurrentLat : delivery.pickupLat))
      : (hasLiveCoords ? delivery.driverCurrentLat : delivery.pickupLat);
    const startLng = isInTransit
      ? (snappedPos?.lng ?? derivedPos?.lng ?? (hasLiveCoords ? delivery.driverCurrentLng : delivery.pickupLng))
      : (hasLiveCoords ? delivery.driverCurrentLng : delivery.pickupLng);

    const routeStage = isInTransit
      ? (tripState?.stage || derivedPos?.stage || delivery.driverRouteStage || 'to-donor')
      : (delivery.driverRouteStage || 'ready-at-center');
    const targetByStage =
      routeStage === 'to-donor'
        ? { lat: delivery.pickupLat, lng: delivery.pickupLng, text: 'Next: Donor Pickup' }
        : routeStage === 'to-ngo'
          ? { lat: delivery.dropLat, lng: delivery.dropLng, text: 'Next: NGO Drop' }
          : routeStage === 'returning-to-center'
            ? { lat: RESERVE_CENTER.lat, lng: RESERVE_CENTER.lng, text: 'Next: ReServe Center' }
            : routeStage === 'completed'
              ? { lat: RESERVE_CENTER.lat, lng: RESERVE_CENTER.lng, text: 'Trip Completed at ReServe Center' }
                : { lat: RESERVE_CENTER.lat, lng: RESERVE_CENTER.lng, text: 'Awaiting claim at ReServe Center' };

    const endLat = targetByStage.lat;
    const endLng = targetByStage.lng;

    const pointsForBounds: Array<[number, number]> = [];

    const canTrackBearing = hasCoords(startLat, startLng);
    const previousPos = lastDriverPosRef.current;
    const movingBearing = canTrackBearing && previousPos &&
      (previousPos.lat !== (startLat as number) || previousPos.lng !== (startLng as number))
      ? calculateBearing(previousPos.lng, previousPos.lat, startLng as number, startLat as number)
      : map.getBearing();

    const upsertPointMarker = (
      markerRef: { current: mapboxgl.Marker | null },
      lat: number | undefined,
      lng: number | undefined,
      color: string,
      text: string
    ) => {
      if (!hasCoords(lat, lng)) {
        clearMarker(markerRef);
        return;
      }

      if (!markerRef.current) {
        markerRef.current = new mapboxgl.Marker({ color })
          .setLngLat([lng as number, lat as number])
          .setPopup(new mapboxgl.Popup({ offset: 16 }).setText(text))
          .addTo(map);
      } else {
        markerRef.current.setLngLat([lng as number, lat as number]);
        markerRef.current.getPopup()?.setText(text);
      }

      pointsForBounds.push([lng as number, lat as number]);
    };

    upsertPointMarker(
      pickupMarkerRef,
      delivery.pickupLat,
      delivery.pickupLng,
      '#16a34a',
      `Pickup: ${delivery.pickupLocation || 'Donor'}`
    );

    upsertPointMarker(
      targetMarkerRef,
      endLat,
      endLng,
      '#15803d',
      targetByStage.text
    );

    upsertPointMarker(
      centerMarkerRef,
      RESERVE_CENTER.lat,
      RESERVE_CENTER.lng,
      '#2563eb',
      'ReServe Center (Andheri)'
    );

    if (hasCoords(startLat, startLng)) {
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = new mapboxgl.Marker({
          element: createDriverMarkerElement(movingBearing),
          anchor: 'center',
        })
          .setLngLat([startLng as number, startLat as number])
          .setPopup(new mapboxgl.Popup({ offset: 16 }).setText('Current Vehicle Position'))
          .addTo(map);
      } else {
        driverMarkerRef.current.setLngLat([startLng as number, startLat as number]);
        driverMarkerRef.current.getPopup()?.setText('Current Vehicle Position');
        const icon = driverMarkerRef.current.getElement().querySelector('.driver-map-marker-img') as HTMLImageElement | null;
        if (icon) {
          icon.style.transform = `rotate(${movingBearing}deg)`;
        }
      }
      pointsForBounds.push([startLng as number, startLat as number]);
    } else {
      clearMarker(driverMarkerRef);
    }

    const followMode = isInTransit && hasCoords(startLat, startLng);

    if (waitingForClaim && hasCoords(startLat, startLng)) {
      followCameraRef.current = false;
      followCameraTargetRef.current = null;
      setNavigationLock(false);
      lastCameraPoseRef.current = null;
      map.easeTo({
        center: [startLng as number, startLat as number],
        zoom: 14.2,
        pitch: 0,
        bearing: 0,
        duration: 550,
        essential: true,
      });
      lastDriverPosRef.current = null;
    } else if (followMode) {
      followCameraRef.current = true;
      setNavigationLock(true);
      followCameraTargetRef.current = {
        lat: startLat as number,
        lng: startLng as number,
        bearing: movingBearing,
      };
      const cameraNow = Date.now();
      const lastCameraPose = lastCameraPoseRef.current;
      const cameraDistanceKm = lastCameraPose
        ? haversineKm(lastCameraPose.lat, lastCameraPose.lng, startLat as number, startLng as number)
        : Number.POSITIVE_INFINITY;
      const cameraBearingShift = lastCameraPose
        ? bearingDeltaDeg(lastCameraPose.bearing, movingBearing)
        : Number.POSITIVE_INFINITY;
      const shouldUpdateCamera =
        !lastCameraPose ||
        cameraDistanceKm > 0.003 ||
        cameraBearingShift > 2 ||
        cameraNow - lastCameraPose.at > 220;

      if (shouldUpdateCamera) {
        map.easeTo({
          center: [startLng as number, startLat as number],
          zoom: 16.2,
          pitch: 62,
          bearing: movingBearing,
          duration: 260,
          essential: true,
        });

        lastCameraPoseRef.current = {
          lat: startLat as number,
          lng: startLng as number,
          bearing: movingBearing,
          at: cameraNow,
        };
      }

      lastDriverPosRef.current = { lat: startLat as number, lng: startLng as number };
    } else if (pointsForBounds.length === 1) {
      followCameraRef.current = false;
      followCameraTargetRef.current = null;
      setNavigationLock(false);
      lastCameraPoseRef.current = null;
      map.flyTo({ center: pointsForBounds[0], zoom: 14, essential: true });
      lastDriverPosRef.current = null;
    } else if (pointsForBounds.length > 1) {
      followCameraRef.current = false;
      followCameraTargetRef.current = null;
      setNavigationLock(false);
      lastCameraPoseRef.current = null;
      const bounds = new mapboxgl.LngLatBounds();
      pointsForBounds.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds, { padding: 70, maxZoom: 14 });
      map.easeTo({ pitch: 0, bearing: 0, duration: 450, essential: true });
      lastDriverPosRef.current = null;
    } else {
      setNavigationLock(false);
      lastCameraPoseRef.current = null;
    }

    if (!isInTransit) {
      followCameraRef.current = false;
      followCameraTargetRef.current = null;
      setNavigationLock(false);
      lastCameraPoseRef.current = null;
      routeGeometryRef.current = {
        deliveryId: null,
        stage: null,
        coordinates: [],
        cumulativeKm: [],
        totalKm: 0,
      };

      if (map.getLayer(routeLayerId)) map.removeLayer(routeLayerId);
      if (map.getSource(routeSourceId)) map.removeSource(routeSourceId);

      lastRouteFetchRef.current = {
        deliveryId: null,
        stage: null,
        startLat: null,
        startLng: null,
        endLat: null,
        endLng: null,
        at: 0,
      };

      setRouteDistanceKm(0);
      setRouteDurationMin(0);
      return;
    }

    const routeStartLat = tripState?.segmentStart.lat ?? startLat;
    const routeStartLng = tripState?.segmentStart.lng ?? startLng;
    const routeEndLat = tripState?.segmentEnd.lat ?? endLat;
    const routeEndLng = tripState?.segmentEnd.lng ?? endLng;

    if (!hasCoords(routeStartLat, routeStartLng) || !hasCoords(routeEndLat, routeEndLng) || !MAPBOX_TOKEN) {
      setRouteDistanceKm(0);
      setRouteDurationMin(0);
      return;
    }

    if (Math.abs((routeStartLat as number) - (routeEndLat as number)) < 0.000001 && Math.abs((routeStartLng as number) - (routeEndLng as number)) < 0.000001) {
      setRouteDistanceKm(0);
      setRouteDurationMin(0);
      return;
    }

    const now = Date.now();
    const lastRoute = lastRouteFetchRef.current;
    const startDeltaKm =
      lastRoute.startLat != null && lastRoute.startLng != null
        ? haversineKm(lastRoute.startLat, lastRoute.startLng, routeStartLat as number, routeStartLng as number)
        : Number.POSITIVE_INFINITY;
    const endDeltaKm =
      lastRoute.endLat != null && lastRoute.endLng != null
        ? haversineKm(lastRoute.endLat, lastRoute.endLng, routeEndLat as number, routeEndLng as number)
        : Number.POSITIVE_INFINITY;

    const shouldRefreshRoute =
      lastRoute.deliveryId !== delivery.id ||
      lastRoute.stage !== routeStage ||
      startDeltaKm > 0.25 ||
      endDeltaKm > 0.05 ||
      now - lastRoute.at > 20000 ||
      !map.getSource(routeSourceId) ||
      !map.getLayer(routeLayerId);

    if (!shouldRefreshRoute) {
      return;
    }

    if (routeFetchInFlightRef.current) {
      return;
    }

    try {
      routeFetchInFlightRef.current = true;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${routeStartLng},${routeStartLat};${routeEndLng},${routeEndLat}?geometries=geojson&overview=full&alternatives=false&access_token=${MAPBOX_TOKEN}`;
      const response = await fetch(url);
      const data = await response.json();
      const route = data?.routes?.[0];
      if (!route?.geometry) return;

      setRouteDistanceKm(Number((route.distance / 1000).toFixed(1)));
      setRouteDurationMin(Math.round(route.duration / 60));

      const routeFeature = {
        type: 'Feature' as const,
        properties: {},
        geometry: route.geometry,
      };

      const routeCoordinates = Array.isArray(route.geometry.coordinates)
        ? route.geometry.coordinates
          .filter(
            (point: unknown): point is [number, number] =>
              Array.isArray(point) &&
              point.length >= 2 &&
              Number.isFinite(point[0]) &&
              Number.isFinite(point[1])
          )
          .map((point: [number, number]) => [Number(point[0]), Number(point[1])] as [number, number])
        : [];

      const routeProfile = buildRouteDistanceProfile(routeCoordinates);
      routeGeometryRef.current = {
        deliveryId: delivery.id,
        stage: routeStage || null,
        coordinates: routeCoordinates,
        cumulativeKm: routeProfile.cumulativeKm,
        totalKm: routeProfile.totalKm,
      };

      const existingSource = map.getSource(routeSourceId) as mapboxgl.GeoJSONSource | undefined;

      if (existingSource) {
        existingSource.setData(routeFeature);
      } else {
        map.addSource(routeSourceId, {
          type: 'geojson',
          data: routeFeature,
        });

        map.addLayer({
          id: routeLayerId,
          type: 'line',
          source: routeSourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#16a34a',
            'line-width': 6,
            'line-opacity': 0.9,
          },
        });
      }

      lastRouteFetchRef.current = {
        deliveryId: delivery.id,
        stage: routeStage || null,
        startLat: routeStartLat as number,
        startLng: routeStartLng as number,
        endLat: routeEndLat as number,
        endLng: routeEndLng as number,
        at: now,
      };
    } catch {
      setRouteDistanceKm(0);
      setRouteDurationMin(0);
    } finally {
      routeFetchInFlightRef.current = false;
    }
  }, [getAnimatedProgress, selectedDelivery, setNavigationLock]);

  useEffect(() => {
    drawMapState();
  }, [drawMapState]);

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (!selectedDelivery || selectedDelivery.deliveryStatus !== 'in-transit') {
      return;
    }

    const tick = () => {
      void drawMapState();
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [drawMapState, selectedDelivery?.deliveryStatus, selectedDelivery?.id]);

  useEffect(() => {
    if (!userId) return;

    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    socket.emit('joinUserRoom', { userId, userType: 'driver' });

    const handleLocationUpdate = (payload: DeliveryLocationUpdatePayload) => {
      setDeliveries((prev) =>
        prev.map((delivery) => {
          if (delivery.id !== payload.claimId) return delivery;

          const nextStatus = payload.deliveryStatus || delivery.deliveryStatus;
          const shouldApplyLocation = nextStatus === 'in-transit' || nextStatus === 'delivered' || payload.driverRouteStage === 'completed';
          const incomingProgress = toNum(payload.driverRouteProgress);
          const currentProgress = toNum(delivery.driverRouteProgress);
          const isStaleProgressUpdate =
            nextStatus === 'in-transit' &&
            incomingProgress !== undefined &&
            currentProgress !== undefined &&
            incomingProgress + 0.001 < currentProgress;

          if (!shouldApplyLocation) {
            return {
              ...delivery,
              deliveryStatus: nextStatus,
              driverRouteStage: payload.driverRouteStage || delivery.driverRouteStage,
            };
          }

          if (isStaleProgressUpdate) {
            return {
              ...delivery,
              deliveryStatus: nextStatus,
            };
          }

          return {
            ...delivery,
            driverCurrentLat: toNum(payload.driverCurrentLat) ?? delivery.driverCurrentLat,
            driverCurrentLng: toNum(payload.driverCurrentLng) ?? delivery.driverCurrentLng,
            driverRouteProgress: incomingProgress ?? delivery.driverRouteProgress,
            driverRouteStage: payload.driverRouteStage || delivery.driverRouteStage,
            deliveryStatus: nextStatus,
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
  }, [userId]);

  const claimDelivery = async (claimId: number) => {
    try {
      setClaimingId(claimId);
      setError('');
      await driverApi.updateDeliveryStatus(claimId, 'in-transit');
      await fetchDeliveries();
    } catch (err) {
      setError((err as Error).message || 'Failed to claim delivery');
    } finally {
      setClaimingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (userType !== 'driver') {
    return (
      <div className="driver-dashboard">
        <div className="driver-empty">Driver access only. Please login as driver.</div>
      </div>
    );
  }

  return (
    <div className="driver-dashboard">
      <aside className="driver-sidebar">
        <div className="driver-brand">
          <Truck size={20} />
          <span>Driver Console</span>
        </div>

        <div className="driver-user-card">
          <div className="driver-avatar">{userName.charAt(0).toUpperCase()}</div>
          <div>
            <h3>{userName}</h3>
            <span>Delivery Partner</span>
          </div>
        </div>

        <div className="driver-stats-grid">
          <div>
            <strong>{sortedDeliveries.length}</strong>
            <span>Total Assigned</span>
          </div>
          <div>
            <strong>{sortedDeliveries.filter((delivery) => delivery.deliveryStatus === 'in-transit').length}</strong>
            <span>In Transit</span>
          </div>
        </div>

        <button className="driver-logout-btn" onClick={handleLogout}>
          <LogOut size={16} /> Logout
        </button>
      </aside>

      <main className="driver-main">
        <div className="driver-topbar">
          <div>
            <h1 className="driver-page-title">Driver Dashboard</h1>
            <p className="driver-page-subtitle">Live route tracking and delivery actions</p>
          </div>
          <div className="driver-topbar-right">
            <div className="driver-topbar-user">
              <div className="driver-topbar-avatar">{userName.charAt(0).toUpperCase()}</div>
              <span className="driver-topbar-name">{userName}</span>
            </div>
          </div>
        </div>

        <header className="driver-header">
          <h1>Delivery Navigation</h1>
          <p>Traffic-aware route and live position updates every 6 seconds.</p>
        </header>

        {error && <div className="driver-error">{error}</div>}

        {!MAPBOX_TOKEN && (
          <div className="driver-error">Add VITE_MAPBOX_ACCESS_TOKEN in frontend env to render Mapbox.</div>
        )}

        <div className="driver-toolbar">
          <span><Route size={15} /> {routeDistanceKm} km</span>
          <span><Clock size={15} /> {routeDurationMin} min</span>
          <span><Navigation size={15} /> Best route uses driving-traffic profile</span>
        </div>

        <div className="driver-content">
          <section className="driver-map-panel">
            <div ref={mapContainerRef} className="driver-map" />
          </section>

          <section className="driver-list-panel">
            {loading ? (
              <div className="driver-empty">Loading assigned deliveries...</div>
            ) : sortedDeliveries.length === 0 ? (
              <div className="driver-empty">No deliveries assigned yet.</div>
            ) : (
              <div className="driver-list">
                {sortedDeliveries.map((delivery) => {
                  const selected = selectedDelivery?.id === delivery.id;
                  const progressPct = Math.round((delivery.driverRouteProgress || 0) * 100);
                  const claimable = ['assigned', 'pending'].includes(delivery.deliveryStatus || 'pending');
                  const isClaimingThis = claimingId === delivery.id;

                  return (
                    <article
                      key={delivery.id}
                      className={`driver-card ${selected ? 'selected' : ''}`}
                      onClick={() => setSelectedId(delivery.id)}
                    >
                      <div className="driver-card-head">
                        <h3>{delivery.foodName}</h3>
                        <span className={`driver-status-chip ${statusClass(delivery.deliveryStatus)}`}>
                          {delivery.deliveryStatus || 'pending'}
                        </span>
                      </div>

                      <div className="driver-card-row"><MapPin size={14} /> Pickup: {delivery.pickupLocation || 'Donor'}</div>
                      <div className="driver-card-row"><MapPin size={14} /> Drop: {delivery.dropLocation || 'NGO'}</div>
                      <div className="driver-card-row"><Navigation size={14} /> Stage: {(delivery.driverRouteStage || 'ready-at-center').replace(/-/g, ' ')}</div>
                      <div className="driver-card-row"><Truck size={14} /> Fee: Rs {delivery.deliveryFee || 0}</div>

                      <div className="driver-progress-row">
                        <div className="driver-progress-track">
                          <div className="driver-progress-fill" style={{ width: `${progressPct}%` }} />
                        </div>
                        <span>{progressPct}%</span>
                      </div>

                      {claimable && (
                        <div className="driver-claim-row" onClick={(e) => e.stopPropagation()}>
                          <span className="driver-claim-note">Needs claim before route starts</span>
                          <button
                            className="driver-inline-claim-btn"
                            onClick={() => claimDelivery(delivery.id)}
                            disabled={isClaimingThis}
                          >
                            {isClaimingThis ? 'Claiming...' : 'Claim Delivery'}
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {selectedDelivery && (
              <div className="driver-actions">
                {(selectedDelivery.deliveryStatus === 'assigned' || selectedDelivery.deliveryStatus === 'pending') && (
                  <>
                    <div className="driver-claim-helper">Claim this delivery to confirm you are taking it. Route movement starts only after claim.</div>
                    <button
                      className="driver-action-btn primary"
                      onClick={() => claimDelivery(selectedDelivery.id)}
                      disabled={claimingId === selectedDelivery.id}
                    >
                      {claimingId === selectedDelivery.id ? 'Claiming...' : 'Claim Delivery'}
                    </button>
                  </>
                )}

                {selectedDelivery.deliveryStatus === 'in-transit' && (
                  <button className="driver-action-btn success" disabled>
                    <CheckCircle2 size={15} />
                    Auto route active (Center to Donor to NGO to Center)
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default DriverDashboard;

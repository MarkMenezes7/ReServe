const { dbAll, dbRun } = require('../db/database');
const { createNotification } = require('../utils/notifications');

const SIMULATION_INTERVAL_MS = 5000;
const PROGRESS_STEP = 0.06;
const RESERVE_CENTER = { lat: 19.1197, lng: 72.8468 }; // Andheri, Mumbai

let intervalHandle = null;
let isTickRunning = false;

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function interpolateTripPosition(progress, center, pickup, drop) {
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

async function emitLocation(io, delivery, payload) {
  io.to(`user_${delivery.donorId}`).emit('deliveryLocationUpdate', payload);
  io.to(`user_${delivery.ngoId}`).emit('deliveryLocationUpdate', payload);
  io.to(`user_${delivery.driverId}`).emit('deliveryLocationUpdate', payload);
  io.to('admins').emit('deliveryLocationUpdate', payload);
}

async function markDelivered(io, delivery, lat, lng, progress) {
  await dbRun(
    `UPDATE claims
     SET driverCurrentLat = ?,
         driverCurrentLng = ?,
         driverRouteProgress = ?,
         driverRouteStage = 'completed',
         deliveryStatus = 'delivered',
         deliveredAt = datetime('now'),
         status = 'collected',
         collectedAt = datetime('now')
     WHERE id = ?`,
    [lat, lng, progress, delivery.id]
  );

  await dbRun("UPDATE listings SET status = 'collected' WHERE id = ?", [delivery.listingId]);

  const statusPayload = {
    claimId: delivery.id,
    deliveryStatus: 'delivered',
    driverCurrentLat: lat,
    driverCurrentLng: lng,
    driverRouteProgress: progress,
    driverRouteStage: 'completed',
    updatedAt: new Date().toISOString(),
  };

  io.to(`user_${delivery.donorId}`).emit('deliveryStatusUpdate', statusPayload);
  io.to(`user_${delivery.ngoId}`).emit('deliveryStatusUpdate', statusPayload);
  io.to(`user_${delivery.driverId}`).emit('deliveryStatusUpdate', statusPayload);
  io.to('admins').emit('deliveryStatusUpdate', statusPayload);

  try {
    await createNotification(io, {
      userId: delivery.donorId,
      type: 'delivery_completed',
      title: 'Delivery Completed',
      message: `"${delivery.foodName}" has been delivered successfully`,
      relatedId: delivery.id,
      relatedType: 'claim',
    });

    await createNotification(io, {
      userId: delivery.ngoId,
      type: 'delivery_completed',
      title: 'Delivery Arrived',
      message: `Your delivery for "${delivery.foodName}" has arrived`,
      relatedId: delivery.id,
      relatedType: 'claim',
    });
  } catch (err) {
    // Notification errors are non-blocking for simulation.
  }
}

async function simulationTick(io) {
  if (isTickRunning) return;
  isTickRunning = true;

  try {
    const activeDeliveries = await dbAll(
      `SELECT
         c.id,
         c.listingId,
         c.ngoId,
         c.driverId,
         c.driverRouteProgress,
         l.foodName,
         l.donorId,
         l.latitude as pickupLat,
         l.longitude as pickupLng,
         COALESCE(c.ngoLatitude, ngo.latitude) as dropLat,
         COALESCE(c.ngoLongitude, ngo.longitude) as dropLng
       FROM claims c
       JOIN listings l ON c.listingId = l.id
       JOIN users ngo ON c.ngoId = ngo.id
       WHERE c.deliveryMethod = 'platform-delivery'
         AND c.deliveryStatus = 'in-transit'
         AND c.driverId IS NOT NULL`
    );

    for (const delivery of activeDeliveries) {
      if (
        !isFiniteNumber(delivery.pickupLat) ||
        !isFiniteNumber(delivery.pickupLng) ||
        !isFiniteNumber(delivery.dropLat) ||
        !isFiniteNumber(delivery.dropLng)
      ) {
        continue;
      }

      const startLat = Number(delivery.pickupLat);
      const startLng = Number(delivery.pickupLng);
      const endLat = Number(delivery.dropLat);
      const endLng = Number(delivery.dropLng);

      const currentProgress = Math.max(0, Math.min(1, Number(delivery.driverRouteProgress) || 0));
      const nextProgress = Math.min(1, currentProgress + PROGRESS_STEP);

      const nextPos = interpolateTripPosition(
        nextProgress,
        { lat: RESERVE_CENTER.lat, lng: RESERVE_CENTER.lng },
        { lat: startLat, lng: startLng },
        { lat: endLat, lng: endLng }
      );

      await dbRun(
        `UPDATE claims
         SET driverCurrentLat = ?,
             driverCurrentLng = ?,
             driverRouteProgress = ?,
             driverRouteStage = ?
         WHERE id = ?`,
        [nextPos.lat, nextPos.lng, nextProgress, nextPos.stage, delivery.id]
      );

      const locationPayload = {
        claimId: delivery.id,
        driverId: delivery.driverId,
        deliveryStatus: nextProgress >= 1 ? 'delivered' : 'in-transit',
        driverCurrentLat: nextPos.lat,
        driverCurrentLng: nextPos.lng,
        driverRouteProgress: nextProgress,
        driverRouteStage: nextPos.stage,
        updatedAt: new Date().toISOString(),
      };

      await emitLocation(io, delivery, locationPayload);

      if (nextProgress >= 1) {
        await markDelivered(io, delivery, nextPos.lat, nextPos.lng, nextProgress);
      }
    }
  } catch (error) {
    console.error('Delivery simulation tick failed:', error);
  } finally {
    isTickRunning = false;
  }
}

function startDeliverySimulation(io) {
  if (intervalHandle) return;

  intervalHandle = setInterval(() => {
    simulationTick(io);
  }, SIMULATION_INTERVAL_MS);

  console.log(`Delivery simulation started (${SIMULATION_INTERVAL_MS}ms tick)`);
}

module.exports = { startDeliverySimulation };

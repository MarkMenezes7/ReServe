const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');

const router = express.Router();
const RESERVE_CENTER = { lat: 19.1197, lng: 72.8468 }; // Andheri, Mumbai

router.use(authenticateToken);
router.use(requireRole('driver'));

// GET /api/driver/deliveries/me - deliveries assigned to logged in driver
router.get('/deliveries/me', async (req, res) => {
  try {
    const driverId = req.user.userId;
    const deliveries = await dbAll(
      `SELECT
         c.id,
         c.listingId,
         c.ngoId,
         c.status as claimStatus,
         c.deliveryStatus,
         c.deliveryFee,
         c.deliveryDistance,
         c.driverId,
         c.driverCurrentLat,
         c.driverCurrentLng,
         c.driverRouteProgress,
         c.driverRouteStage,
         c.dispatchedAt,
         c.deliveredAt,
         c.createdAt,
         l.foodName,
         l.quantity,
         l.unit,
         l.pickupLocation,
         l.latitude as pickupLat,
         l.longitude as pickupLng,
         donor.name as donorName,
         donor.organizationName as donorOrg,
         donor.phone as donorPhone,
         ngo.name as ngoName,
         ngo.organizationName as ngoOrg,
         ngo.phone as ngoPhone,
         COALESCE(c.ngoLatitude, ngo.latitude) as dropLat,
         COALESCE(c.ngoLongitude, ngo.longitude) as dropLng,
         COALESCE(ngo.address, ngo.city, 'NGO Location') as dropLocation
       FROM claims c
       JOIN listings l ON c.listingId = l.id
       JOIN users donor ON l.donorId = donor.id
       JOIN users ngo ON c.ngoId = ngo.id
       WHERE c.deliveryMethod = 'platform-delivery' AND c.driverId = ?
       ORDER BY
         CASE c.deliveryStatus
           WHEN 'in-transit' THEN 1
           WHEN 'assigned' THEN 2
           WHEN 'pending' THEN 3
           WHEN 'delivered' THEN 4
           ELSE 5
         END,
         c.createdAt DESC`,
      [driverId]
    );

    res.json(deliveries);
  } catch (error) {
    console.error('Driver deliveries fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch driver deliveries' });
  }
});

// PATCH /api/driver/deliveries/:claimId/status - driver updates delivery status
router.patch('/deliveries/:claimId/status', async (req, res) => {
  try {
    const { claimId } = req.params;
    const { deliveryStatus } = req.body;

    if (!['assigned', 'in-transit', 'delivered', 'failed'].includes(deliveryStatus)) {
      return res.status(400).json({ error: 'Invalid delivery status' });
    }

    if (deliveryStatus === 'delivered') {
      return res.status(400).json({ error: 'Delivery completes automatically after return to ReServe center' });
    }

    const claim = await dbGet(
      `SELECT c.*, l.id as listingId, l.foodName, l.donorId, l.latitude as pickupLat, l.longitude as pickupLng
       FROM claims c
       JOIN listings l ON c.listingId = l.id
       WHERE c.id = ? AND c.driverId = ?`,
      [claimId, req.user.userId]
    );

    if (!claim) {
      return res.status(404).json({ error: 'Delivery not found for this driver' });
    }

    if (deliveryStatus === 'in-transit' && !['assigned', 'pending'].includes(claim.deliveryStatus || 'pending')) {
      return res.status(400).json({ error: 'Delivery cannot be claimed in current status' });
    }

    if (deliveryStatus === 'delivered' && claim.deliveryStatus !== 'in-transit') {
      return res.status(400).json({ error: 'Only in-transit deliveries can be marked delivered' });
    }

    const centerLat = Number(RESERVE_CENTER.lat.toFixed(6));
    const centerLng = Number(RESERVE_CENTER.lng.toFixed(6));

    await dbRun(
      `UPDATE claims
       SET deliveryStatus = ?,
           deliveredAt = CASE WHEN ? = 'delivered' THEN datetime('now') ELSE deliveredAt END,
           dispatchedAt = CASE
             WHEN ? = 'in-transit' AND dispatchedAt IS NULL THEN datetime('now')
             ELSE dispatchedAt
           END,
           driverCurrentLat = CASE
             WHEN ? = 'in-transit' AND driverCurrentLat IS NULL THEN ?
             ELSE driverCurrentLat
           END,
           driverCurrentLng = CASE
             WHEN ? = 'in-transit' AND driverCurrentLng IS NULL THEN ?
             ELSE driverCurrentLng
           END,
           driverRouteProgress = CASE
             WHEN ? = 'in-transit' AND (driverRouteProgress IS NULL OR driverRouteProgress < 0) THEN 0
             WHEN ? = 'delivered' THEN 1
             ELSE driverRouteProgress
           END,
           driverRouteStage = CASE
             WHEN ? = 'in-transit' THEN 'to-donor'
             WHEN ? = 'delivered' THEN 'completed'
             ELSE driverRouteStage
           END
       WHERE id = ?`,
      [
        deliveryStatus,
        deliveryStatus,
        deliveryStatus,
        deliveryStatus,
        centerLat,
        deliveryStatus,
        centerLng,
        deliveryStatus,
        deliveryStatus,
        deliveryStatus,
        deliveryStatus,
        claimId,
      ]
    );

    if (deliveryStatus === 'delivered') {
      await dbRun("UPDATE claims SET status = 'collected', collectedAt = datetime('now') WHERE id = ?", [claimId]);
      await dbRun("UPDATE listings SET status = 'collected' WHERE id = ?", [claim.listingId]);
    }

    const routeStage = deliveryStatus === 'in-transit'
      ? 'to-donor'
      : deliveryStatus === 'delivered'
        ? 'completed'
        : claim.driverRouteStage || null;

    const io = req.app.get('io');
    io.to(`user_${claim.donorId}`).emit('deliveryStatusUpdate', { claimId: Number(claimId), deliveryStatus, driverRouteStage: routeStage });
    io.to(`user_${claim.ngoId}`).emit('deliveryStatusUpdate', { claimId: Number(claimId), deliveryStatus, driverRouteStage: routeStage });
    io.to('admins').emit('deliveryStatusUpdate', { claimId: Number(claimId), deliveryStatus, driverRouteStage: routeStage });

    if (deliveryStatus === 'delivered') {
      try {
        await createNotification(io, {
          userId: claim.donorId,
          type: 'delivery_completed',
          title: 'Delivery Completed',
          message: `"${claim.foodName}" has been delivered to the NGO`,
          relatedId: Number(claimId),
          relatedType: 'claim',
        });
        await createNotification(io, {
          userId: claim.ngoId,
          type: 'delivery_completed',
          title: 'Food Delivered',
          message: `Your delivery for "${claim.foodName}" is completed`,
          relatedId: Number(claimId),
          relatedType: 'claim',
        });
      } catch (err) {
        // Non-critical notification failure
      }
    }

    if (deliveryStatus === 'in-transit') {
      try {
        await createNotification(io, {
          userId: claim.donorId,
          type: 'delivery_update',
          title: 'Delivery Started',
          message: `Driver has claimed and started delivery for "${claim.foodName}"`,
          relatedId: Number(claimId),
          relatedType: 'claim',
        });
        await createNotification(io, {
          userId: claim.ngoId,
          type: 'delivery_update',
          title: 'Delivery In Transit',
          message: `Driver has claimed and started delivery for "${claim.foodName}"`,
          relatedId: Number(claimId),
          relatedType: 'claim',
        });
      } catch (err) {
        // Non-critical notification failure
      }
    }

    res.json({ message: `Delivery status updated to ${deliveryStatus}` });
  } catch (error) {
    console.error('Driver delivery status update error:', error);
    res.status(500).json({ error: 'Failed to update delivery status' });
  }
});

// PATCH /api/driver/deliveries/:claimId/location - optional manual location update
router.patch('/deliveries/:claimId/location', async (req, res) => {
  try {
    const { claimId } = req.params;
    const { lat, lng, progress, routeStage } = req.body;

    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      return res.status(400).json({ error: 'Valid lat and lng are required' });
    }

    const claim = await dbGet(
      'SELECT id, donorId, ngoId FROM claims WHERE id = ? AND driverId = ?',
      [claimId, req.user.userId]
    );

    if (!claim) {
      return res.status(404).json({ error: 'Delivery not found for this driver' });
    }

    const safeProgress = Number.isFinite(Number(progress))
      ? Math.max(0, Math.min(1, Number(progress)))
      : null;

    const allowedStages = ['ready-at-center', 'to-donor', 'to-ngo', 'returning-to-center', 'completed'];
    const safeRouteStage = allowedStages.includes(String(routeStage)) ? String(routeStage) : null;

    await dbRun(
      `UPDATE claims
       SET driverCurrentLat = ?,
           driverCurrentLng = ?,
           driverRouteProgress = COALESCE(?, driverRouteProgress),
           driverRouteStage = COALESCE(?, driverRouteStage)
       WHERE id = ?`,
      [Number(lat), Number(lng), safeProgress, safeRouteStage, claimId]
    );

    const payload = {
      claimId: Number(claimId),
      driverCurrentLat: Number(lat),
      driverCurrentLng: Number(lng),
      driverRouteProgress: safeProgress,
      driverRouteStage: safeRouteStage,
      updatedAt: new Date().toISOString(),
    };

    const io = req.app.get('io');
    io.to(`user_${claim.donorId}`).emit('deliveryLocationUpdate', payload);
    io.to(`user_${claim.ngoId}`).emit('deliveryLocationUpdate', payload);
    io.to(`user_${req.user.userId}`).emit('deliveryLocationUpdate', payload);
    io.to('admins').emit('deliveryLocationUpdate', payload);

    res.json({ message: 'Location updated', location: payload });
  } catch (error) {
    console.error('Driver location update error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

module.exports = router;

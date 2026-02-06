const express = require('express');
const { db, dbRun, dbGet, dbAll } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');

const router = express.Router();

router.use(authenticateToken);

// PATCH /api/claims/:claimId/collect
router.patch('/:claimId/collect', async (req, res) => {
  try {
    const { claimId } = req.params;
    const claim = await dbGet(`
      SELECT c.*, l.donorId, l.foodName, l.id as listingId FROM claims c
      JOIN listings l ON c.listingId = l.id WHERE c.id = ?
    `, [claimId]);

    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.status === 'collected') return res.status(400).json({ error: 'Already collected' });

    await dbRun("UPDATE claims SET status = 'collected', collectedAt = datetime('now') WHERE id = ?", [claimId]);
    await dbRun("UPDATE listings SET status = 'collected' WHERE id = ?", [claim.listingId]);

    // Notify both parties
    const io = req.app.get('io');
    try {
      await createNotification(io, {
        userId: claim.donorId,
        type: 'claim_collected',
        title: 'Food Collected',
        message: `Your listing "${claim.foodName}" has been collected`,
        relatedId: parseInt(claimId),
        relatedType: 'claim',
      });
      await createNotification(io, {
        userId: claim.ngoId,
        type: 'claim_collected',
        title: 'Collection Confirmed',
        message: `You successfully collected "${claim.foodName}"`,
        relatedId: parseInt(claimId),
        relatedType: 'claim',
      });
    } catch (e) { /* non-critical */ }

    res.json({ message: 'Marked as collected' });
  } catch (error) {
    console.error('Collect error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// PATCH /api/claims/:claimId/confirm
router.patch('/:claimId/confirm', async (req, res) => {
  try {
    const { claimId } = req.params;
    const claim = await dbGet(`
      SELECT c.*, l.donorId, l.foodName FROM claims c
      JOIN listings l ON c.listingId = l.id WHERE c.id = ?
    `, [claimId]);

    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.status !== 'pending') return res.status(400).json({ error: 'Can only confirm pending claims' });
    if (claim.donorId !== req.user.userId) return res.status(403).json({ error: 'Only the donor can confirm' });

    await dbRun("UPDATE claims SET status = 'confirmed' WHERE id = ?", [claimId]);

    const io = req.app.get('io');
    try {
      await createNotification(io, {
        userId: claim.ngoId,
        type: 'claim_confirmed',
        title: 'Claim Confirmed',
        message: `Your claim for "${claim.foodName}" has been confirmed by the donor`,
        relatedId: parseInt(claimId),
        relatedType: 'claim',
      });
    } catch (e) { /* non-critical */ }

    res.json({ message: 'Claim confirmed' });
  } catch (error) {
    console.error('Confirm error:', error);
    res.status(500).json({ error: 'Failed to confirm claim' });
  }
});

// PATCH /api/claims/:claimId/reject
router.patch('/:claimId/reject', async (req, res) => {
  try {
    const { claimId } = req.params;
    const claim = await dbGet(`
      SELECT c.*, l.donorId, l.foodName, l.id as listingId FROM claims c
      JOIN listings l ON c.listingId = l.id WHERE c.id = ?
    `, [claimId]);

    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.status !== 'pending') return res.status(400).json({ error: 'Can only reject pending claims' });
    if (claim.donorId !== req.user.userId) return res.status(403).json({ error: 'Only the donor can reject' });

    await dbRun("UPDATE claims SET status = 'rejected' WHERE id = ?", [claimId]);
    await dbRun("UPDATE listings SET status = 'active' WHERE id = ?", [claim.listingId]);

    const io = req.app.get('io');
    try {
      await createNotification(io, {
        userId: claim.ngoId,
        type: 'claim_rejected',
        title: 'Claim Rejected',
        message: `Your claim for "${claim.foodName}" was rejected`,
        relatedId: parseInt(claimId),
        relatedType: 'claim',
      });
    } catch (e) { /* non-critical */ }

    res.json({ message: 'Claim rejected' });
  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({ error: 'Failed to reject claim' });
  }
});

// PATCH /api/claims/:claimId/cancel
router.patch('/:claimId/cancel', async (req, res) => {
  try {
    const { claimId } = req.params;
    const { cancelReason } = req.body;

    const claim = await dbGet(`
      SELECT c.*, l.donorId, l.foodName, l.id as listingId FROM claims c
      JOIN listings l ON c.listingId = l.id WHERE c.id = ?
    `, [claimId]);

    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (!['pending', 'confirmed'].includes(claim.status)) {
      return res.status(400).json({ error: 'Cannot cancel this claim' });
    }
    if (claim.ngoId !== req.user.userId) return res.status(403).json({ error: 'Only the NGO can cancel' });

    await dbRun("UPDATE claims SET status = 'cancelled', cancelReason = ? WHERE id = ?", [cancelReason || null, claimId]);
    await dbRun("UPDATE listings SET status = 'active' WHERE id = ?", [claim.listingId]);

    const io = req.app.get('io');
    try {
      await createNotification(io, {
        userId: claim.donorId,
        type: 'claim_cancelled',
        title: 'Claim Cancelled',
        message: `The claim on "${claim.foodName}" was cancelled`,
        relatedId: parseInt(claimId),
        relatedType: 'claim',
      });
    } catch (e) { /* non-critical */ }

    res.json({ message: 'Claim cancelled' });
  } catch (error) {
    console.error('Cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel claim' });
  }
});

module.exports = router;

const clientPromise = require('../lib/mongodb');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const client = await clientPromise;
    const db = client.db(client.options.dbName && client.options.dbName !== 'test' ? client.options.dbName : 'users');
    const collection = db.collection('users');

    // ── GET: Fetch all time-slot bookings ───────
    if (req.method === 'GET') {
      const docs = await collection.find({ date: { $exists: true } }).sort({ date: 1, startTime: 1 }).toArray();
      const bookings = docs.map(doc => ({
        id: doc.id || (doc._id ? doc._id.toString() : `b_${doc.date}_${doc.name}`),
        date: doc.date,
        startTime: doc.startTime || '00:00',
        endTime: doc.endTime || '23:59',
        name: doc.name || doc.driver || 'Driver',
        token: doc.token || ''
      }));
      return res.status(200).json({ bookings });
    }

    // ── POST: Create, Delete, or Clear Bookings ──
    if (req.method === 'POST') {
      const body = req.body || {};

      // 1. Delete a specific booking by ID (with ownership check)
      if (body.action === 'deleteBooking' || body.action === 'cancel') {
        const { id, name, token } = body;
        if (!id) {
          return res.status(400).json({ message: 'Missing booking ID' });
        }

        const booking = await collection.findOne({
          $or: [{ id: id }, { date: body.date, name: body.name }]
        });

        if (!booking) {
          return res.status(404).json({ message: 'Booking not found' });
        }

        // Ownership verification: must match driver name or booking token
        const reqName = (name || '').trim().toLowerCase();
        const bookName = (booking.name || '').trim().toLowerCase();
        const tokenMatch = token && booking.token && token === booking.token;
        const nameMatch = reqName && bookName && reqName === bookName;

        if (!tokenMatch && !nameMatch) {
          return res.status(403).json({
            message: `Forbidden: You cannot change or cancel this booking because it belongs to ${booking.name}.`
          });
        }

        await collection.deleteOne({ _id: booking._id });
        return res.status(200).json({ message: 'Booking successfully canceled', id: booking.id || id });
      }

      // 2. Clear all bookings for a user
      if (body.action === 'clearUser' && body.name) {
        const cleanName = body.name.trim();
        await collection.deleteMany({
          date: { $exists: true },
          name: { $regex: new RegExp(`^${cleanName}$`, 'i') }
        });
        return res.status(200).json({ message: `All bookings for ${cleanName} cleared` });
      }

      // 3. Create a new time-slot booking
      const { date, startTime, endTime, name, token } = body;

      if (!date || !name || !name.trim()) {
        return res.status(400).json({ message: 'Date and driver name are required' });
      }

      const start = startTime || '08:00';
      const end = endTime || '18:00';

      if (start >= end) {
        return res.status(400).json({ message: 'End time must be later than start time' });
      }

      const cleanDate = date.trim();
      const cleanName = name.trim();

      // Check for time collision / overlap on the same date:
      // Two ranges [A, B] and [C, D] overlap if A < D and B > C
      const existingOnDate = await collection.find({ date: cleanDate }).toArray();
      const conflict = existingOnDate.find(b => {
        const bStart = b.startTime || '00:00';
        const bEnd = b.endTime || '23:59';
        return start < bEnd && end > bStart;
      });

      if (conflict) {
        return res.status(409).json({
          message: `Time conflict: This slot overlaps with ${conflict.name}'s booking (${conflict.startTime || '00:00'} - ${conflict.endTime || '23:59'}). You cannot book overlapping times.`
        });
      }

      const newId = `b_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newBooking = {
        id: newId,
        date: cleanDate,
        startTime: start,
        endTime: end,
        name: cleanName,
        token: token || '',
        createdAt: new Date()
      };

      await collection.insertOne(newBooking);

      return res.status(201).json({
        message: 'Time slot reserved successfully',
        booking: {
          id: newId,
          date: cleanDate,
          startTime: start,
          endTime: end,
          name: cleanName
        }
      });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('API Error in /api/bookings:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

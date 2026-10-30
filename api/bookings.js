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

    // ── GET: Fetch all bookings ─────────────────
    if (req.method === 'GET') {
      const docs = await collection.find({ date: { $exists: true } }).toArray();
      const bookings = {};
      docs.forEach(doc => {
        if (doc.date) {
          bookings[doc.date] = doc.name || doc.driver || 'Driver';
        }
      });
      return res.status(200).json({ bookings });
    }

    // ── POST: Book a day, update, or clear ─────
    if (req.method === 'POST') {
      const body = req.body || {};

      // Clear all bookings
      if (body.action === 'clearAll') {
        await collection.deleteMany({ date: { $exists: true } });
        return res.status(200).json({ message: 'All bookings cleared', bookings: {} });
      }

      // Clear bookings for a specific person
      if (body.action === 'clearUser' && body.name) {
        await collection.deleteMany({ date: { $exists: true }, name: body.name.trim() });
        return res.status(200).json({ message: `Bookings cleared for ${body.name}` });
      }

      // Single day booking or removal: { date: 'YYYY-MM-DD', name: 'Name' }
      if (body.date) {
        const { date, name } = body;
        if (name && name.trim()) {
          await collection.updateOne(
            { date: date.trim() },
            { $set: { date: date.trim(), name: name.trim(), updatedAt: new Date() } },
            { upsert: true }
          );
          return res.status(200).json({ message: 'Day booked successfully', date, name: name.trim() });
        } else {
          // If name is null/empty, remove the booking
          await collection.deleteOne({ date: date.trim() });
          return res.status(200).json({ message: 'Booking removed', date });
        }
      }

      // Batch sync fallback: { bookings: { 'YYYY-MM-DD': 'Name' } }
      if (body.bookings) {
        await collection.deleteMany({ date: { $exists: true } });
        const items = Object.entries(body.bookings)
          .filter(([date, name]) => date && name)
          .map(([date, name]) => ({
            date: date.trim(),
            name: String(name).trim(),
            updatedAt: new Date()
          }));
        if (items.length > 0) {
          await collection.insertMany(items);
        }
        return res.status(200).json({ message: 'Bookings synced', bookings: body.bookings });
      }

      return res.status(400).json({ message: 'Invalid request body' });
    }

    // ── DELETE: Remove a booking ───────────────
    if (req.method === 'DELETE') {
      const date = req.query.date || (req.body && req.body.date);
      if (!date) {
        return res.status(400).json({ message: 'Missing date parameter' });
      }
      await collection.deleteOne({ date: date.trim() });
      return res.status(200).json({ message: 'Booking deleted', date });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('API Error in /api/bookings:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

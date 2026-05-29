const clientPromise = require('../lib/mongodb');

module.exports = async (req, res) => {
  const { email } = req.query; // Identifying user by email for simplicity

  if (!email) {
    return res.status(400).json({ message: 'Missing user email' });
  }

  try {
    const client = await clientPromise;
    const db = client.db(client.options.dbName && client.options.dbName !== 'test' ? client.options.dbName : 'users');
    const users = db.collection('users');
    const reservations = db.collection('reservations');

    // Make sure the user exists first
    const user = await users.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.method === 'GET') {
      const resList = await reservations.find({ email }).toArray();
      const bookings = {};
      resList.forEach(r => {
        bookings[r.date] = r.driver;
      });
      return res.status(200).json({ bookings });
    }

    if (req.method === 'POST') {
      const { bookings } = req.body;
      
      // Delete old reservations
      await reservations.deleteMany({ email });
      
      // Insert new reservations if any
      const insertDocs = Object.entries(bookings || {}).map(([date, driver]) => ({
        email,
        date,
        driver,
        createdAt: new Date()
      }));

      if (insertDocs.length > 0) {
        await reservations.insertMany(insertDocs);
      }

      return res.status(200).json({ message: 'Bookings updated' });
    }

    res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

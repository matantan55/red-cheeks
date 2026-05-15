const clientPromise = require('../lib/mongodb');

module.exports = async (req, res) => {
  const { email } = req.query; // Identifying user by email for simplicity (in a real app use JWT)

  if (!email) {
    return res.status(400).json({ message: 'Missing user email' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('redcheeks');
    const users = db.collection('users');

    if (req.method === 'GET') {
      const user = await users.findOne({ email });
      if (!user) return res.status(404).json({ message: 'User not found' });
      return res.status(200).json({ bookings: user.bookings || {} });
    }

    if (req.method === 'POST') {
      const { bookings } = req.body;
      await users.updateOne({ email }, { $set: { bookings } });
      return res.status(200).json({ message: 'Bookings updated' });
    }

    res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

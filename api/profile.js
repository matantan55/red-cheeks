const clientPromise = require('../lib/mongodb');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, username, partner_name } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Missing email' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('users');
    const users = db.collection('users');

    await users.updateOne(
      { email },
      { $set: { username, partner_name } }
    );

    res.status(200).json({ message: 'Profile updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

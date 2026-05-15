const clientPromise = require('../lib/mongodb');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Missing email' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('redcheeks');
    const users = db.collection('users');

    const user = await users.findOne({ email });

    // For security, always return 200 even if user doesn't exist
    if (user) {
      console.log(`[FORGOT PASSWORD] Reset link requested for: ${email}`);
      // TODO: Integrate with an email service like Resend or SendGrid
    }

    res.status(200).json({ message: 'If that email exists in our system, a reset link has been sent.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

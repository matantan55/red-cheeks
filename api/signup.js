const clientPromise = require('../lib/mongodb');
const bcrypt = require('bcryptjs');


module.exports = async (req, res) => {

  // Enable CORS for all origins (adjust for production as needed)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Verify MongoDB connection string is set
  if (!process.env.MONGODB_URI) {
    console.error('MongoDB URI not configured');
    return res.status(500).json({ message: 'Server configuration error: MongoDB URI missing' });
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { email, username, password, phone, partner, partnerPhone } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const client = await clientPromise;
    const db = client.db('users');
    const users = db.collection('users');

    // Check if user exists
    const existingUser = await users.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = {
      email,
      username,
      password: hashedPassword,
      phone,
      partner_name: partner,
      partner_phone: partnerPhone,
      createdAt: new Date(),
    };

    await users.insertOne(newUser);

    res.status(201).json({ message: 'User created successfully', user: { email, username } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

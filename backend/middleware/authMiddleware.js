const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  if (!(req.headers.authorization && req.headers.authorization.startsWith('Bearer'))) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, 'secret_key_123');
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }
    return next();
  } catch {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

module.exports = { protect };
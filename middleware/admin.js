// التحقق من صلاحية المسؤول
const requireAdmin = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.session.userId);
    
    if (user.role !== 'admin') {
      return res.status(403).send('Access denied');
    }
    
    next();
  } catch (error) {
    res.redirect('/login');
  }
};

module.exports = { requireAdmin };
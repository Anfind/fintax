const User = require('../models/User');
const Company = require('../models/Company');
const { generateToken } = require('../utils/jwt');

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { email, password, fullName, companyName, taxCode } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Email, mật khẩu và họ tên là bắt buộc' });
    }

    // Check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email đã được sử dụng' });
    }

    // Create or find company
    let company = null;
    if (taxCode) {
      company = await Company.findOne({ taxCode });
      if (!company) {
        company = await Company.create({
          companyName: companyName || `Company ${taxCode}`,
          taxCode,
        });
      }
    }

    // Create user (first user is admin)
    const userCount = company ? await User.countDocuments({ company_id: company._id }) : 0;
    const user = await User.create({
      email,
      password,
      fullName,
      role: userCount === 0 ? 'admin' : 'viewer',
      company_id: company?._id || null,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: user.toJSON(),
      company: company || null,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Tài khoản đã bị vô hiệu' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    // Get company info
    let company = null;
    if (user.company_id) {
      company = await Company.findById(user.company_id);
    }

    res.json({
      token,
      user: user.toJSON(),
      company,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    let company = null;
    if (req.user.company_id) {
      company = await Company.findById(req.user.company_id);
    }
    res.json({ user: req.user, company });
  } catch (error) {
    next(error);
  }
};

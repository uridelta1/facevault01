import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

// ==================================================
// Register
// ==================================================

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Name, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    const existing = await User.findOne({
      email: email.toLowerCase()
    });

    if (existing) {
      return res.status(409).json({
        error: 'An account with this email already exists'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      phone: phone || null,
      role: 'organizer'
    });

    const token = signToken({
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name
    });

    res.status(201).json({
      token,
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('[FaceVault] Register Error:', error);
    res.status(500).json({
      error: 'Server error during registration'
    });
  }
});

// ==================================================
// Login
// ==================================================

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase()
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'This account has been deactivated'
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Track last login
    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken({
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name
    });

    res.json({
      token,
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('[FaceVault] Login Error:', error);
    res.status(500).json({
      error: 'Server error during login'
    });
  }
});

// ==================================================
// Get current user profile
// ==================================================

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({ user: user.toSafeObject() });
  } catch (error) {
    console.error('[FaceVault] Get Profile Error:', error);
    res.status(500).json({
      error: 'Failed to fetch profile'
    });
  }
});

// ==================================================
// Update current user profile
// ==================================================

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const { name, phone, avatar } = req.body;

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    res.json({ user: user.toSafeObject() });
  } catch (error) {
    console.error('[FaceVault] Update Profile Error:', error);
    res.status(500).json({
      error: 'Failed to update profile'
    });
  }
});

// ==================================================
// Change password
// ==================================================

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters'
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!valid) {
      return res.status(401).json({
        error: 'Current password is incorrect'
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('[FaceVault] Change Password Error:', error);
    res.status(500).json({
      error: 'Failed to change password'
    });
  }
});

export default router;

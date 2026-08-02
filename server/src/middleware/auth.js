import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'facevault-dev-secret-change-in-production';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authentication token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized for this action' });
    }
    next();
  };
}

// Allows access if the caller is either:
//  - an organizer who owns the event, or
//  - a guest holding a token scoped to this specific eventId
export function requireEventAccess(db) {
  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const eventId = req.params.eventId || req.body.eventId;
    if (!token || !eventId) return res.status(401).json({ error: 'Missing authentication token' });

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.role === 'guest' && payload.eventId === eventId) {
        req.access = { role: 'guest', eventId };
        return next();
      }
      if (payload.role === 'organizer') {
        await db.read();
        const event = db.data.events.find(e => e.id === eventId && e.creatorId === payload.id);
        if (event) {
          req.access = { role: 'organizer', eventId };
          return next();
        }
      }
      return res.status(403).json({ error: 'Not authorized to access this event' });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

export { JWT_SECRET };

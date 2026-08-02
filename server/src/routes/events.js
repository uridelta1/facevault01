import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');

const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadsRoot, 'covers');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${nanoid(10)}${path.extname(file.originalname)}`)
});
const uploadCover = multer({ storage: coverStorage, limits: { fileSize: 8 * 1024 * 1024 } });

const router = Router();

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + '-' + nanoid(5);
}

function publicEvent(e) {
  const { passwordHash, ...rest } = e;
  return { ...rest, hasPassword: !!passwordHash };
}

// Create event
router.post('/', requireAuth, async (req, res) => {
  const { title, expiryDate, password } = req.body;
  if (!title) return res.status(400).json({ error: 'Event title is required' });

  await db.read();
  const event = {
    id: nanoid(10),
    title,
    slug: slugify(title),
    passwordHash: password ? await bcrypt.hash(password, 10) : null,
    creatorId: req.user.id,
    coverImage: null,
    expiryDate: expiryDate || null,
    archived: false,
    createdAt: new Date().toISOString()
  };
  db.data.events.push(event);
  await db.write();
  res.status(201).json(publicEvent(event));
});

// List organizer's own events
router.get('/mine', requireAuth, async (req, res) => {
  await db.read();
  const events = db.data.events
    .filter(e => e.creatorId === req.user.id)
    .map(e => {
      const photoCount = db.data.photos.filter(p => p.eventId === e.id).length;
      return { ...publicEvent(e), photoCount };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(events);
});

// Get single event owned by organizer (for management screen)
router.get('/:id', requireAuth, async (req, res) => {
  await db.read();
  const event = db.data.events.find(e => e.id === req.params.id && e.creatorId === req.user.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const photoCount = db.data.photos.filter(p => p.eventId === event.id).length;
  res.json({ ...publicEvent(event), photoCount });
});

// Update event
router.patch('/:id', requireAuth, async (req, res) => {
  await db.read();
  const event = db.data.events.find(e => e.id === req.params.id && e.creatorId === req.user.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const { title, expiryDate, archived, password } = req.body;
  if (title !== undefined) event.title = title;
  if (expiryDate !== undefined) event.expiryDate = expiryDate;
  if (archived !== undefined) event.archived = archived;
  if (password !== undefined) event.passwordHash = password ? await bcrypt.hash(password, 10) : null;

  await db.write();
  res.json(publicEvent(event));
});

// Delete event (and its photos)
router.delete('/:id', requireAuth, async (req, res) => {
  await db.read();
  const idx = db.data.events.findIndex(e => e.id === req.params.id && e.creatorId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Event not found' });

  const eventDir = path.join(uploadsRoot, 'events', req.params.id);
  fs.rmSync(eventDir, { recursive: true, force: true });

  db.data.photos = db.data.photos.filter(p => p.eventId !== req.params.id);
  db.data.events.splice(idx, 1);
  await db.write();
  res.json({ success: true });
});

// Upload cover image
router.post('/:id/cover', requireAuth, uploadCover.single('cover'), async (req, res) => {
  await db.read();
  const event = db.data.events.find(e => e.id === req.params.id && e.creatorId === req.user.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  event.coverImage = `/uploads/covers/${req.file.filename}`;
  await db.write();
  res.json(publicEvent(event));
});

// Public: look up event by slug (no password revealed)
router.get('/public/:slug', async (req, res) => {
  await db.read();
  const event = db.data.events.find(e => e.slug === req.params.slug);
  if (!event || event.archived) return res.status(404).json({ error: 'Event not found' });
  if (event.expiryDate && new Date(event.expiryDate) < new Date()) {
    return res.status(410).json({ error: 'This event gallery has expired' });
  }
  res.json(publicEvent(event));
});

// Public: verify guest password, returns a short-lived guest token (event-scoped)
router.post('/public/:slug/verify', async (req, res) => {
  await db.read();
  const event = db.data.events.find(e => e.slug === req.params.slug);
  if (!event || event.archived) return res.status(404).json({ error: 'Event not found' });

  if (event.passwordHash) {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required for this event' });
    const valid = await bcrypt.compare(password, event.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Incorrect event password' });
  }
  const guestToken = signToken({ role: 'guest', eventId: event.id });
  res.json({ eventId: event.id, verified: true, guestToken });
});

export default router;

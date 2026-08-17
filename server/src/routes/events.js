import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Event from '../models/Event.js';
import Photo from '../models/Photo.js';
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
  try {
    const { title, expiryDate, password } = req.body;
    if (!title) return res.status(400).json({ error: 'Event title is required' });

    const event = await Event.create({
      title,
      slug: slugify(title),
      passwordHash: password ? await bcrypt.hash(password, 10) : null,
      creatorId: req.user.id,
      coverImage: null,
      expiryDate: expiryDate || null,
      archived: false
    });
    
    res.status(201).json({ ...publicEvent(event.toObject()), id: event._id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// List organizer's own events
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const events = await Event.find({ creatorId: req.user.id }).sort({ createdAt: -1 });
    const eventsWithPhotoCount = await Promise.all(events.map(async (e) => {
      const photoCount = await Photo.countDocuments({ eventId: e._id });
      return { ...publicEvent(e.toObject()), id: e._id, photoCount };
    }));
    res.json(eventsWithPhotoCount);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// Get single event owned by organizer (for management screen)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, creatorId: req.user.id });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const photoCount = await Photo.countDocuments({ eventId: event._id });
    res.json({ ...publicEvent(event.toObject()), id: event._id, photoCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get event' });
  }
});

// Update event
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, creatorId: req.user.id });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const { title, expiryDate, archived, password } = req.body;
    if (title !== undefined) event.title = title;
    if (expiryDate !== undefined) event.expiryDate = expiryDate;
    if (archived !== undefined) event.archived = archived;
    if (password !== undefined) event.passwordHash = password ? await bcrypt.hash(password, 10) : null;

    await event.save();
    res.json({ ...publicEvent(event.toObject()), id: event._id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event (and its photos)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, creatorId: req.user.id });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const eventDir = path.join(uploadsRoot, 'events', req.params.id);
    fs.rmSync(eventDir, { recursive: true, force: true });

    await Photo.deleteMany({ eventId: event._id });
    await event.deleteOne();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Upload cover image
router.post('/:id/cover', requireAuth, uploadCover.single('cover'), async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, creatorId: req.user.id });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    event.coverImage = `/uploads/covers/${req.file.filename}`;
    await event.save();
    
    res.json({ ...publicEvent(event.toObject()), id: event._id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload cover' });
  }
});

// Public: look up event by slug (no password revealed)
router.get('/public/:slug', async (req, res) => {
  try {
    const event = await Event.findOne({ slug: req.params.slug });
    if (!event || event.archived) return res.status(404).json({ error: 'Event not found' });
    if (event.expiryDate && new Date(event.expiryDate) < new Date()) {
      return res.status(410).json({ error: 'This event gallery has expired' });
    }
    res.json({ ...publicEvent(event.toObject()), id: event._id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Public: verify guest password, returns a short-lived guest token (event-scoped)
router.post('/public/:slug/verify', async (req, res) => {
  try {
    const event = await Event.findOne({ slug: req.params.slug });
    if (!event || event.archived) return res.status(404).json({ error: 'Event not found' });

    if (event.passwordHash) {
      const { password } = req.body;
      if (!password) return res.status(400).json({ error: 'Password is required for this event' });
      const valid = await bcrypt.compare(password, event.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Incorrect event password' });
    }
    const guestToken = signToken({ role: 'guest', eventId: event._id });
    res.json({ eventId: event._id, verified: true, guestToken });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify event password' });
  }
});

export default router;

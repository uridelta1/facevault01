import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, 'data', 'db.json');

const defaultData = {
  users: [],     // { id, name, email, passwordHash, role, createdAt }
  events: [],    // { id, title, slug, passwordHash, creatorId, coverImage, expiryDate, archived, createdAt }
  photos: []     // { id, eventId, imageUrl, thumbUrl, faces: [{descriptor:[128 floats], box}], uploadedAt }
};

const db = new Low(new JSONFile(file), defaultData);
await db.read();
db.data ||= defaultData;
await db.write();

export default db;

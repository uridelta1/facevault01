// import { Router } from 'express';
// import db from '../db.js';
// import { requireEventAccess } from '../middleware/auth.js';

// const router = Router();

// /**
//  * Normalize a descriptor vector to unit length.
//  * This ensures consistent euclidean distances regardless of
//  * minor magnitude variations between different detection runs.
//  */
// function normalize(vec) {
//   let mag = 0;
//   for (let i = 0; i < vec.length; i++) mag += vec[i] * vec[i];
//   mag = Math.sqrt(mag);
//   if (mag === 0) return vec;
//   return vec.map(v => v / mag);
// }

// function euclideanDistance(a, b) {
//   let sum = 0;
//   for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
//   return Math.sqrt(sum);
// }

// /**
//  * Convert a euclidean distance to a 0–100% confidence score.
//  *
//  * face-api.js 128-d descriptor distances:
//  *   - Same person:       typically 0.25 – 0.50
//  *   - Different person:  typically 0.65 – 1.2+
//  *   - Threshold sweet spot: ~0.55 – 0.65
//  *
//  * We use a sigmoid-like mapping centred around 0.5 so that:
//  *   distance 0.0  → 100%
//  *   distance 0.35 →  90%
//  *   distance 0.50 →  75%
//  *   distance 0.60 →  55%
//  *   distance 0.65 →  40%
//  */
// function toConfidence(distance) {
//   // Clamp-and-map approach: maps [0, 1.0] → [100, 0] with a curve
//   // that compresses the "definitely same" range toward 90–100%
//   const normalized = Math.min(distance, 1.0);
//   const pct = (1 - Math.pow(normalized / 0.9, 1.8)) * 100;
//   return Math.max(0, Math.min(100, Math.round(pct)));
// }

// // POST /api/search/:eventId  { descriptor: number[128], threshold?: number }
// router.post('/:eventId', requireEventAccess(db), async (req, res) => {
//   const { descriptor, threshold = 0.65 } = req.body;
//   if (!Array.isArray(descriptor) || descriptor.length !== 128) {
//     return res.status(400).json({ error: 'A valid 128-value face descriptor is required. Make sure a face was detected in your selfie.' });
//   }

//   // Normalize the query descriptor for consistent comparisons
//   const queryDesc = normalize(descriptor);

//   await db.read();
//   const photos = db.data.photos.filter(p => p.eventId === req.params.eventId);

//   const matches = [];
//   for (const photo of photos) {
//     if (!photo.faces || photo.faces.length === 0) continue;
//     let best = Infinity;
//     for (const face of photo.faces) {
//       if (!face.descriptor || face.descriptor.length !== 128) continue;
//       const faceDesc = normalize(face.descriptor);
//       const d = euclideanDistance(queryDesc, faceDesc);
//       if (d < best) best = d;
//     }
//     if (best <= threshold) {
//       matches.push({
//         id: photo.id,
//         imageUrl: photo.imageUrl,
//         thumbUrl: photo.thumbUrl,
//         confidence: toConfidence(best),
//         distance: Number(best.toFixed(4))
//       });
//     }
//   }

//   matches.sort((a, b) => a.distance - b.distance);
//   res.json({ totalPhotosScanned: photos.length, matchCount: matches.length, matches });
// });

// export default router;

import { Router } from 'express';
import db from '../db.js';
import { requireEventAccess } from '../middleware/auth.js';

const router = Router();

/**
 * Calculate Euclidean distance between two face-api.js
 * 128-dimensional face descriptors.
 *
 * Lower distance = more similar faces.
 */
function euclideanDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return Infinity;
  }

  if (a.length !== 128 || b.length !== 128) {
    return Infinity;
  }

  let sum = 0;

  for (let i = 0; i < 128; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Convert face distance into a simple confidence score.
 *
 * This is only for displaying a score to the user.
 * The actual match decision is made using the threshold.
 */
function toConfidence(distance) {
  if (!Number.isFinite(distance)) {
    return 0;
  }

  // 0.35 or lower = very strong match
  // 0.55 = reasonable match boundary
  // 0.65+ = increasingly unreliable
  const score = ((0.65 - distance) / 0.30) * 100;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * POST /api/search/:eventId
 *
 * Body:
 * {
 *   "descriptor": [128 numbers]
 * }
 *
 * Optional:
 * {
 *   "descriptor": [128 numbers],
 *   "threshold": 0.55
 * }
 */
router.post('/:eventId', requireEventAccess(db), async (req, res) => {
  try {
    const { descriptor } = req.body;

    // --------------------------------------------------
    // Validate descriptor
    // --------------------------------------------------

    if (!Array.isArray(descriptor)) {
      return res.status(400).json({
        error: 'Face descriptor is required.'
      });
    }

    if (descriptor.length !== 128) {
      return res.status(400).json({
        error: 'Invalid face descriptor. Expected 128 values.'
      });
    }

    // Make sure every value is a valid number
    const queryDescriptor = descriptor.map(Number);

    if (queryDescriptor.some(value => !Number.isFinite(value))) {
      return res.status(400).json({
        error: 'Face descriptor contains invalid values.'
      });
    }

    // --------------------------------------------------
    // Matching threshold
    // --------------------------------------------------

    // Start with 0.55.
    //
    // Lower = stricter
    // Higher = more permissive
    //
    // Recommended:
    // 0.50 = strict
    // 0.55 = balanced
    // 0.60 = permissive
    const threshold = 0.55;

    // --------------------------------------------------
    // Load database
    // --------------------------------------------------

    await db.read();

    const eventId = req.params.eventId;

    const photos = db.data.photos.filter(
      photo => photo.eventId === eventId
    );

    // --------------------------------------------------
    // Compare selfie against every face in every photo
    // --------------------------------------------------

    const matches = [];

    for (const photo of photos) {
      if (!Array.isArray(photo.faces)) {
        continue;
      }

      if (photo.faces.length === 0) {
        continue;
      }

      let bestDistance = Infinity;
      let bestFace = null;

      for (const face of photo.faces) {
        if (!Array.isArray(face.descriptor)) {
          continue;
        }

        if (face.descriptor.length !== 128) {
          continue;
        }

        const faceDescriptor = face.descriptor.map(Number);

        if (
          faceDescriptor.some(
            value => !Number.isFinite(value)
          )
        ) {
          continue;
        }

        const distance = euclideanDistance(
          queryDescriptor,
          faceDescriptor
        );

        // Keep the closest face in this photo
        if (distance < bestDistance) {
          bestDistance = distance;
          bestFace = face;
        }
      }

      // ------------------------------------------------
      // ONLY return this photo if a face matched
      // ------------------------------------------------

      if (
        bestFace &&
        Number.isFinite(bestDistance) &&
        bestDistance <= threshold
      ) {
        matches.push({
          id: photo.id,
          eventId: photo.eventId,
          imageUrl: photo.imageUrl,
          thumbUrl: photo.thumbUrl,
          confidence: toConfidence(bestDistance),
          distance: Number(bestDistance.toFixed(4)),
          matchedFace: bestFace.box || null
        });
      }
    }

    // --------------------------------------------------
    // Best matches first
    // --------------------------------------------------

    matches.sort(
      (a, b) => a.distance - b.distance
    );

    // --------------------------------------------------
    // Response
    // --------------------------------------------------

    return res.json({
      success: true,
      totalPhotosScanned: photos.length,
      matchCount: matches.length,
      threshold,
      matches
    });

  } catch (error) {
    console.error(
      '[FaceVault] Face search error:',
      error
    );

    return res.status(500).json({
      error: 'Failed to search photos.'
    });
  }
});

export default router;
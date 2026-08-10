// // import { Router } from 'express';
// // import multer from 'multer';
// // import path from 'path';
// // import fs from 'fs';
// // import { fileURLToPath } from 'url';
// // import { nanoid } from 'nanoid';
// // import db from '../db.js';
// // import { requireAuth } from '../middleware/auth.js';

// // const __dirname = path.dirname(fileURLToPath(import.meta.url));
// // const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');

// // const storage = multer.diskStorage({
// //   destination: (req, file, cb) => {
// //     const dir = path.join(uploadsRoot, 'events', req.params.eventId);
// //     fs.mkdirSync(dir, { recursive: true });
// //     cb(null, dir);
// //   },
// //   filename: (req, file, cb) => cb(null, `${nanoid(12)}${path.extname(file.originalname) || '.jpg'}`)
// // });
// // const upload = multer({
// //   storage,
// //   limits: { fileSize: 50 * 1024 * 1024 },
// //   fileFilter: (req, file, cb) => {
// //     const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(file.mimetype);
// //     cb(ok ? null : new Error('Unsupported file type'), ok);
// //   }
// // });

// // const router = Router();

// // function ownedEvent(req) {
// //   return db.data.events.find(e => e.id === req.params.eventId && e.creatorId === req.user.id);
// // }

// // // Bulk upload photos. Client extracts face descriptors in-browser (face-api.js)
// // // and sends them as a JSON string in the "descriptors" field, one entry per file,
// // // in the same order as the uploaded files.
// // router.post('/:eventId', requireAuth, upload.array('photos', 200), async (req, res) => {
// //   await db.read();
// //   const event = ownedEvent(req);
// //   if (!event) return res.status(404).json({ error: 'Event not found' });
// //   if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No photos uploaded' });

// //   let descriptorSets = [];
// //   try {
// //     descriptorSets = JSON.parse(req.body.descriptors || '[]');
// //   } catch {
// //     descriptorSets = [];
// //   }

// //   const created = req.files.map((file, i) => {
// //     const faces = (descriptorSets[i] || []).map(f => ({
// //       descriptor: f.descriptor,
// //       box: f.box || null
// //     }));
// //     const photo = {
// //       id: nanoid(12),
// //       eventId: event.id,
// //       imageUrl: `/uploads/events/${event.id}/${file.filename}`,
// //       thumbUrl: `/uploads/events/${event.id}/${file.filename}`,
// //       faces,
// //       uploadedAt: new Date().toISOString()
// //     };
// //     db.data.photos.push(photo);
// //     return photo;
// //   });

// //   await db.write();
// //   res.status(201).json({
// //     uploaded: created.length,
// //     faceDetections: created.reduce((sum, p) => sum + p.faces.length, 0),
// //     photos: created.map(({ faces, ...rest }) => ({ ...rest, faceCount: faces.length }))
// //   });
// // });

// // // Organizer: list all photos for an event (management/gallery view)
// // router.get('/:eventId', requireAuth, async (req, res) => {
// //   await db.read();
// //   const event = ownedEvent(req);
// //   if (!event) return res.status(404).json({ error: 'Event not found' });

// //   const photos = db.data.photos
// //     .filter(p => p.eventId === event.id)
// //     .map(({ faces, ...rest }) => ({ ...rest, faceCount: faces.length }));
// //   res.json(photos);
// // });

// // // Organizer: delete a single photo
// // router.delete('/:eventId/:photoId', requireAuth, async (req, res) => {
// //   await db.read();
// //   const event = ownedEvent(req);
// //   if (!event) return res.status(404).json({ error: 'Event not found' });

// //   const idx = db.data.photos.findIndex(p => p.id === req.params.photoId && p.eventId === event.id);
// //   if (idx === -1) return res.status(404).json({ error: 'Photo not found' });

// //   const photo = db.data.photos[idx];
// //   const filePath = path.join(uploadsRoot, photo.imageUrl.replace('/uploads/', ''));
// //   fs.rm(filePath, { force: true }, () => {});

// //   db.data.photos.splice(idx, 1);
// //   await db.write();
// //   res.json({ success: true });
// // });

// // export default router;


// import { Router } from 'express';
// import multer from 'multer';
// import path from 'path';
// import fs from 'fs';
// import { fileURLToPath } from 'url';
// import { nanoid } from 'nanoid';
// import db from '../db.js';
// import { requireAuth } from '../middleware/auth.js';

// const __dirname = path.dirname(
//   fileURLToPath(import.meta.url)
// );

// const uploadsRoot = path.join(
//   __dirname,
//   '..',
//   '..',
//   'uploads'
// );

// // --------------------------------------------------
// // Multer storage
// // --------------------------------------------------

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const dir = path.join(
//       uploadsRoot,
//       'events',
//       req.params.eventId
//     );

//     fs.mkdirSync(dir, {
//       recursive: true
//     });

//     cb(null, dir);
//   },

//   filename: (req, file, cb) => {
//     const extension =
//       path.extname(file.originalname) || '.jpg';

//     cb(
//       null,
//       `${nanoid(12)}${extension}`
//     );
//   }
// });

// // --------------------------------------------------
// // Upload configuration
// // --------------------------------------------------

// // const upload = multer({
// //   storage,

// //   limits: {
// //     fileSize: 50 * 1024 * 1024
// //   },

// //   fileFilter: (req, file, cb) => {
// //     const allowedTypes = [
// //       'image/jpeg',
// //       'image/png',
// //       'image/webp',
// //       'image/heic'
// //     ];

// //     if (!allowedTypes.includes(file.mimetype)) {
// //       return cb(
// //         new Error('Unsupported file type')
// //       );
// //     }

// //     cb(null, true);
// //   }
// // });

// const upload = multer({
//   storage: multer.memoryStorage(),

//   limits: {
//     fileSize: 50 * 1024 * 1024
//   },

//   fileFilter: (req, file, cb) => {
//     const allowedTypes = [
//       'image/jpeg',
//       'image/png',
//       'image/webp',
//       'image/heic'
//     ];

//     if (!allowedTypes.includes(file.mimetype)) {
//       return cb(
//         new Error('Unsupported file type')
//       );
//     }

//     cb(null, true);
//   }
// });
// const router = Router();

// // --------------------------------------------------
// // Check event ownership
// // --------------------------------------------------

// function ownedEvent(req) {
//   return db.data.events.find(
//     event =>
//       event.id === req.params.eventId &&
//       event.creatorId === req.user.id
//   );
// }

// // --------------------------------------------------
// // Upload event photos
// // --------------------------------------------------

// router.post(
//   '/:eventId',
//   requireAuth,
//   upload.array('photos', 200),
//   async (req, res) => {
//     try {
//       await db.read();

//       const event = ownedEvent(req);

//       if (!event) {
//         return res.status(404).json({
//           error: 'Event not found'
//         });
//       }

//       if (
//         !req.files ||
//         req.files.length === 0
//       ) {
//         return res.status(400).json({
//           error: 'No photos uploaded'
//         });
//       }

//       // ----------------------------------------------
//       // Read face descriptors sent by frontend
//       // ----------------------------------------------

//       let descriptorSets = [];

//       try {
//         descriptorSets = JSON.parse(
//           req.body.descriptors || '[]'
//         );
//       } catch {
//         return res.status(400).json({
//           error: 'Invalid descriptors JSON'
//         });
//       }

//       if (!Array.isArray(descriptorSets)) {
//         descriptorSets = [];
//       }

//       // ----------------------------------------------
//       // Create photo records
//       // ----------------------------------------------

//       const created = req.files.map(
//         (file, index) => {
//           const detectedFaces =
//             Array.isArray(descriptorSets[index])
//               ? descriptorSets[index]
//               : [];

//           const faces = detectedFaces
//             .filter(
//               face =>
//                 Array.isArray(face.descriptor) &&
//                 face.descriptor.length === 128
//             )
//             .map(face => ({
//               descriptor: face.descriptor.map(Number),
//               box: face.box || null
//             }));

//           const photo = {
//             id: nanoid(12),

//             eventId: event.id,

//             imageUrl:
//               `/uploads/events/${event.id}/${file.filename}`,

//             thumbUrl:
//               `/uploads/events/${event.id}/${file.filename}`,

//             faces,

//             uploadedAt:
//               new Date().toISOString()
//           };

//           db.data.photos.push(photo);

//           return photo;
//         }
//       );

//       await db.write();

//       return res.status(201).json({
//         success: true,

//         uploaded: created.length,

//         faceDetections:
//           created.reduce(
//             (total, photo) =>
//               total + photo.faces.length,
//             0
//           ),

//         photos: created.map(
//           ({ faces, ...photo }) => ({
//             ...photo,
//             faceCount: faces.length
//           })
//         )
//       });

//     } catch (error) {
//       console.error(
//         '[FaceVault] Photo upload error:',
//         error
//       );

//       return res.status(500).json({
//         error: 'Failed to upload photos.'
//       });
//     }
//   }
// );

// // --------------------------------------------------
// // List event photos
// // --------------------------------------------------

// router.get(
//   '/:eventId',
//   requireAuth,
//   async (req, res) => {
//     try {
//       await db.read();

//       const event = ownedEvent(req);

//       if (!event) {
//         return res.status(404).json({
//           error: 'Event not found'
//         });
//       }

//       const photos = db.data.photos
//         .filter(
//           photo =>
//             photo.eventId === event.id
//         )
//         .map(({ faces, ...photo }) => ({
//           ...photo,
//           faceCount:
//             Array.isArray(faces)
//               ? faces.length
//               : 0
//         }));

//       return res.json(photos);

//     } catch (error) {
//       console.error(
//         '[FaceVault] Get photos error:',
//         error
//       );

//       return res.status(500).json({
//         error: 'Failed to load photos.'
//       });
//     }
//   }
// );

// // --------------------------------------------------
// // Delete photo
// // --------------------------------------------------

// router.delete(
//   '/:eventId/:photoId',
//   requireAuth,
//   async (req, res) => {
//     try {
//       await db.read();

//       const event = ownedEvent(req);

//       if (!event) {
//         return res.status(404).json({
//           error: 'Event not found'
//         });
//       }

//       const index =
//         db.data.photos.findIndex(
//           photo =>
//             photo.id === req.params.photoId &&
//             photo.eventId === event.id
//         );

//       if (index === -1) {
//         return res.status(404).json({
//           error: 'Photo not found'
//         });
//       }

//       const photo =
//         db.data.photos[index];

//       const relativePath =
//         photo.imageUrl.replace(
//           '/uploads/',
//           ''
//         );

//       const filePath = path.join(
//         uploadsRoot,
//         relativePath
//       );

//       fs.rm(
//         filePath,
//         { force: true },
//         error => {
//           if (error) {
//             console.error(
//               '[FaceVault] Failed to delete file:',
//               error
//             );
//           }
//         }
//       );

//       db.data.photos.splice(index, 1);

//       await db.write();

//       return res.json({
//         success: true
//       });

//     } catch (error) {
//       console.error(
//         '[FaceVault] Delete photo error:',
//         error
//       );

//       return res.status(500).json({
//         error: 'Failed to delete photo.'
//       });
//     }
//   }
// );

// export default router;

import { Router } from 'express';
import multer from 'multer';
import ImageKit from 'imagekit';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ==================================================
// ImageKit configuration
// ==================================================

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

// ==================================================
// Multer configuration
// Keep files in memory before uploading to ImageKit
// ==================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 50 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Unsupported file type'));
    }

    cb(null, true);
  }
});

// ==================================================
// Check event ownership
// ==================================================

function ownedEvent(req) {
  return db.data.events.find(
    (event) =>
      event.id === req.params.eventId &&
      event.creatorId === req.user.id
  );
}

// ==================================================
// Upload event photos
// ==================================================

router.post(
  '/:eventId',
  requireAuth,
  upload.array('photos', 200),

  async (req, res) => {
    try {
      await db.read();

      // ----------------------------------------------
      // Check event
      // ----------------------------------------------

      const event = ownedEvent(req);

      if (!event) {
        return res.status(404).json({
          error: 'Event not found'
        });
      }

      // ----------------------------------------------
      // Check uploaded files
      // ----------------------------------------------

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: 'No photos uploaded'
        });
      }

      // ----------------------------------------------
      // Read face descriptors
      // ----------------------------------------------

      let descriptorSets = [];

      try {
        descriptorSets = JSON.parse(
          req.body.descriptors || '[]'
        );
      } catch (error) {
        return res.status(400).json({
          error: 'Invalid descriptors JSON'
        });
      }

      if (!Array.isArray(descriptorSets)) {
        descriptorSets = [];
      }

      // ----------------------------------------------
      // Upload photos to ImageKit
      // ----------------------------------------------

      const created = [];

      for (let index = 0; index < req.files.length; index++) {
        const file = req.files[index];

        console.log(
          `[FaceVault] Uploading ${index + 1}/${req.files.length}:`,
          file.originalname
        );

        // --------------------------------------------
        // Upload image to ImageKit
        // --------------------------------------------

        const imagekitFile = await imagekit.upload({
          file: file.buffer,

          fileName: `${nanoid(12)}-${file.originalname}`,

          folder: `/facevault/events/${event.id}`,

          useUniqueFileName: true
        });

        console.log(
          '[FaceVault] ImageKit upload successful:',
          imagekitFile.url
        );

        // --------------------------------------------
        // Get face descriptors for this image
        // --------------------------------------------

        const detectedFaces =
          Array.isArray(descriptorSets[index])
            ? descriptorSets[index]
            : [];

        const faces = detectedFaces
          .filter(
            (face) =>
              Array.isArray(face.descriptor) &&
              face.descriptor.length === 128
          )
          .map((face) => ({
            descriptor: face.descriptor.map(Number),
            box: face.box || null
          }));

        // --------------------------------------------
        // Create database record
        // --------------------------------------------

        const photo = {
          id: nanoid(12),

          eventId: event.id,

          // ImageKit URL
          imageUrl: imagekitFile.url,

          // ImageKit thumbnail URL
          thumbUrl:
            imagekitFile.thumbnailUrl ||
            imagekitFile.url,

          // IMPORTANT:
          // Used later to delete the actual ImageKit file
          imagekitFileId: imagekitFile.fileId,

          // Face recognition data
          faces,

          uploadedAt: new Date().toISOString()
        };

        db.data.photos.push(photo);

        created.push(photo);
      }

      // ----------------------------------------------
      // Save database
      // ----------------------------------------------

      await db.write();

      console.log(
        `[FaceVault] Successfully uploaded ${created.length} photos`
      );

      return res.status(201).json({
        success: true,

        uploaded: created.length,

        faceDetections: created.reduce(
          (total, photo) =>
            total + photo.faces.length,
          0
        ),

        photos: created.map(
          ({ faces, ...photo }) => ({
            ...photo,
            faceCount: faces.length
          })
        )
      });

    } catch (error) {
      console.error(
        '[FaceVault] Photo upload error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to upload photos.',
        details: error.message
      });
    }
  }
);

// ==================================================
// List event photos
// ==================================================

router.get(
  '/:eventId',
  requireAuth,

  async (req, res) => {
    try {
      await db.read();

      const event = ownedEvent(req);

      if (!event) {
        return res.status(404).json({
          error: 'Event not found'
        });
      }

      const photos = db.data.photos
        .filter(
          (photo) =>
            photo.eventId === event.id
        )
        .map(
          ({ faces, ...photo }) => ({
            ...photo,

            faceCount:
              Array.isArray(faces)
                ? faces.length
                : 0
          })
        );

      return res.json(photos);

    } catch (error) {
      console.error(
        '[FaceVault] Get photos error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to load photos.'
      });
    }
  }
);

// ==================================================
// Delete photo
// ==================================================

router.delete(
  '/:eventId/:photoId',
  requireAuth,

  async (req, res) => {
    try {
      await db.read();

      const event = ownedEvent(req);

      if (!event) {
        return res.status(404).json({
          error: 'Event not found'
        });
      }

      // ----------------------------------------------
      // Find photo
      // ----------------------------------------------

      const index = db.data.photos.findIndex(
        (photo) =>
          photo.id === req.params.photoId &&
          photo.eventId === event.id
      );

      if (index === -1) {
        return res.status(404).json({
          error: 'Photo not found'
        });
      }

      const photo = db.data.photos[index];

      // ----------------------------------------------
      // Delete actual image from ImageKit
      // ----------------------------------------------

      if (photo.imagekitFileId) {
        try {
          await imagekit.deleteFile(
            photo.imagekitFileId
          );

          console.log(
            '[FaceVault] Deleted ImageKit file:',
            photo.imagekitFileId
          );

        } catch (imagekitError) {
          console.error(
            '[FaceVault] ImageKit delete error:',
            imagekitError
          );

          // Don't stop database deletion if
          // ImageKit deletion fails.
        }
      }

      // ----------------------------------------------
      // Remove photo from database
      // ----------------------------------------------

      db.data.photos.splice(index, 1);

      await db.write();

      return res.json({
        success: true
      });

    } catch (error) {
      console.error(
        '[FaceVault] Delete photo error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to delete photo.',
        details: error.message
      });
    }
  }
);

export default router;
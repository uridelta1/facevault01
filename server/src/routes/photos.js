import { Router } from 'express';
import multer from 'multer';
import ImageKit from 'imagekit';
import { nanoid } from 'nanoid';
import Event from '../models/Event.js';
import Photo from '../models/Photo.js';
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

async function ownedEvent(req) {
  return await Event.findOne({
    _id: req.params.eventId,
    creatorId: req.user.id
  });
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
      // ----------------------------------------------
      // Check event
      // ----------------------------------------------

      const event = await ownedEvent(req);

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

          folder: `/facevault/events/${event._id}`,

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
          eventId: event._id,

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
          faces
        };

        const createdPhoto = await Photo.create(photo);
        created.push({ ...createdPhoto.toObject(), id: createdPhoto._id });
      }

      // ----------------------------------------------
      // Response
      // ----------------------------------------------

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
      const event = await ownedEvent(req);

      if (!event) {
        return res.status(404).json({
          error: 'Event not found'
        });
      }

      const photosData = await Photo.find({ eventId: event._id });

      const photos = photosData.map((p) => {
        const photo = p.toObject();
        return {
          ...photo,
          id: photo._id,
          faceCount: Array.isArray(photo.faces) ? photo.faces.length : 0
        };
      });

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
      const event = await ownedEvent(req);

      if (!event) {
        return res.status(404).json({
          error: 'Event not found'
        });
      }

      // ----------------------------------------------
      // Find photo
      // ----------------------------------------------

      const photo = await Photo.findOne({ _id: req.params.photoId, eventId: event._id });

      if (!photo) {
        return res.status(404).json({
          error: 'Photo not found'
        });
      }

      // ----------------------------------------------
      // Delete actual image from ImageKit
      // ----------------------------------------------

      if (photo.imagekitFileId) {
        try {
          await imagekit.deleteFile(photo.imagekitFileId);

          console.log(
            '[FaceVault] Deleted ImageKit file:',
            photo.imagekitFileId
          );
        } catch (imagekitError) {
          console.error(
            '[FaceVault] ImageKit delete error:',
            imagekitError
          );
        }
      }

      // ----------------------------------------------
      // Remove photo from database
      // ----------------------------------------------

      await photo.deleteOne();

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
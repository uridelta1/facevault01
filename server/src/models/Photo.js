import mongoose from 'mongoose';

const faceSchema = new mongoose.Schema(
  {
    descriptor: {
      type: [Number],
      required: true
    },

    box: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    _id: false
  }
);

const photoSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true
    },

    imageUrl: {
      type: String,
      required: true
    },

    thumbUrl: {
      type: String,
      required: true
    },

    imagekitFileId: {
      type: String,
      default: null
    },

    faces: {
      type: [faceSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('Photo', photoSchema);
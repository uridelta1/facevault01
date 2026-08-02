import * as faceapi from 'face-api.js';

let modelsLoaded = false;
let loadingPromise = null;

/**
 * Maximum dimension (width or height) before we downscale.
 * face-api.js struggles with images >2000px — both accuracy and memory.
 */
const MAX_IMAGE_DIM = 1600;

// const face = await getSelfieDescriptor(selfieFile);

// if (!face) {
//   // No face detected
//   return;
// }

// const response = await fetch(
//   `/api/search/${eventId}`,
//   {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json'
//     },
//     body: JSON.stringify({
//       descriptor: descriptorToJSON(
//         face.descriptor
//       )
//     })
//   }
// );

// const data = await response.json();

// console.log(data.matches);

/**
 * Load all required face-api.js models.
 * Uses SSD MobileNetV1 (primary — much more accurate than TinyFaceDetector)
 * and TinyFaceDetector as a fallback for edge cases.
 */
export function loadFaceModels() {
  if (modelsLoaded) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  const MODEL_URL = '/models';
  loadingPromise = Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  ]).then(() => {
    modelsLoaded = true;
    console.log('[FaceVault] All face models loaded (SSD MobileNetV1 + TinyFaceDetector + Landmarks + Recognition)');
  }).catch(err => {
    console.error('[FaceVault] Failed to load face models:', err);
    loadingPromise = null;
    throw err;
  });
  return loadingPromise;
}

export function areModelsLoaded() {
  return modelsLoaded;
}

/**
 * Resize an image element onto a canvas if it exceeds MAX_IMAGE_DIM.
 * Returns a canvas element that face-api.js can process, or the original
 * image if it's already small enough.
 */
function prepareImage(imageEl) {
  const { naturalWidth: w, naturalHeight: h } = imageEl;

  // If image is small enough, use it directly
  if (w <= MAX_IMAGE_DIM && h <= MAX_IMAGE_DIM) {
    return imageEl;
  }

  // Scale down preserving aspect ratio
  const scale = MAX_IMAGE_DIM / Math.max(w, h);
  const newW = Math.round(w * scale);
  const newH = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext('2d');

  // Use high-quality interpolation
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imageEl, 0, 0, newW, newH);

  return canvas;
}

/**
 * Detect all faces in an image element and return their 128-d descriptors + boxes.
 *
 * Strategy:
 * 1. Try SSD MobileNetV1 first (most accurate, handles group photos well)
 * 2. If SSD finds 0 faces, fall back to TinyFaceDetector with low threshold
 * 3. Image is preprocessed (resized) to avoid canvas memory issues
 */
export async function detectFaces(imageEl) {
  await loadFaceModels();

  const prepared = prepareImage(imageEl);

  // Calculate scale factor so we can map bounding boxes back to original coordinates
  const origW = imageEl.naturalWidth || imageEl.width;
  const origH = imageEl.naturalHeight || imageEl.height;
  const prepW = prepared.width || prepared.naturalWidth || origW;
  const prepH = prepared.height || prepared.naturalHeight || origH;
  const scaleX = origW / prepW;
  const scaleY = origH / prepH;

  // --- Pass 1: SSD MobileNetV1 (primary, high accuracy) ---
  let detections = await faceapi
    .detectAllFaces(prepared, new faceapi.SsdMobilenetv1Options({
      minConfidence: 0.3  // Lower threshold to catch more faces
    }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  // --- Pass 2: If SSD found nothing, try TinyFaceDetector as fallback ---
  if (detections.length === 0) {
    console.log('[FaceVault] SSD found 0 faces, trying TinyFaceDetector fallback...');
    detections = await faceapi
      .detectAllFaces(prepared, new faceapi.TinyFaceDetectorOptions({
        inputSize: 608,        // Larger input for better small-face detection
        scoreThreshold: 0.25   // Very low threshold for fallback
      }))
      .withFaceLandmarks()
      .withFaceDescriptors();
  }

  console.log(`[FaceVault] Detected ${detections.length} face(s)`);

  return detections.map(d => ({
    descriptor: Array.from(d.descriptor),
    box: {
      x: Math.round(d.detection.box.x * scaleX),
      y: Math.round(d.detection.box.y * scaleY),
      width: Math.round(d.detection.box.width * scaleX),
      height: Math.round(d.detection.box.height * scaleY)
    }
  }));
}

/**
 * Detect the single best/largest face in an image (used for guest selfies).
 * Prioritises the largest face (closest to camera).
 */
export async function detectSingleFace(imageEl) {
  const faces = await detectFaces(imageEl);
  if (faces.length === 0) return null;
  // Sort by area descending — largest face is most likely the selfie subject
  faces.sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
  return faces[0];
}

/**
 * Load an image File or Blob into an HTMLImageElement.
 * Waits for full decode before resolving.
 */
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + (e?.message || 'unknown error')));
    img.src = URL.createObjectURL(file);
  });
}



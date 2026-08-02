# Fix Face Detection/Recognition + Add Chat & Voice Bot

FaceVault's face detection and recognition has multiple issues causing poor accuracy. Additionally, we'll integrate a chat + voice assistant bot using the OmniVoice-Studio repo for TTS guidance.

## Root Cause Analysis — Why Detection/Recognition Fails

After auditing the code, I identified **5 key problems**:

### 1. Using TinyFaceDetector (unreliable)
[face.js](file:///c:/Users/shrir/Downloads/facevault/facevault/client/src/lib/face.js#L12-L14) loads only `tinyFaceDetector`, which is a lightweight model that **frequently misses faces** in group photos, low-light shots, side profiles, and partially occluded faces. The SSD MobileNetV1 model (also shipped with face-api.js) is far more accurate.

### 2. `inputSize: 416` is too small
[face.js L29](file:///c:/Users/shrir/Downloads/facevault/facevault/client/src/lib/face.js#L29) uses `inputSize: 416` for TinyFaceDetector. For group photos with many small faces, this resolution causes misses.

### 3. `scoreThreshold: 0.5` is too aggressive
[face.js L29](file:///c:/Users/shrir/Downloads/facevault/facevault/client/src/lib/face.js#L29) uses a threshold of `0.5`. Real-world photos with difficult lighting/angles produce scores between 0.3–0.5, so those faces get silently dropped.

### 4. No image preprocessing  
Raw photos from phones can be huge (4000×3000+). face-api.js struggles with very large images — canvas memory limits, slow processing, and sometimes silent failures. Images should be resized to a sensible max before detection.

### 5. Matching threshold too tight
[search.js L22](file:///c:/Users/shrir/Downloads/facevault/facevault/server/src/routes/search.js#L22) uses `threshold = 0.6` which is borderline. Face-api.js descriptor distances for the same person typically range 0.35–0.55 depending on lighting/angle. A threshold of `0.65` with a more nuanced confidence calculation would yield better results.

---

## Proposed Changes

### Component 1: Face Detection & Recognition Fix

#### [MODIFY] [face.js](file:///c:/Users/shrir/Downloads/facevault/facevault/client/src/lib/face.js)
- Switch from `TinyFaceDetector` to `SsdMobilenetv1` for much better accuracy
- Also load `SsdMobilenetv1` model alongside existing models
- Lower `scoreThreshold` from `0.5` to `0.3` to catch more faces
- Add `prepareImage()` helper that resizes images >1600px before processing (prevents canvas memory issues and improves speed)
- Add retry logic: if SSD finds 0 faces, fall back to TinyFaceDetector as a second pass
- Add multi-angle detection: try original + horizontally flipped for side profiles

#### [MODIFY] [search.js](file:///c:/Users/shrir/Downloads/facevault/facevault/server/src/routes/search.js)
- Increase default matching threshold from `0.6` to `0.65`
- Improve `toConfidence()` formula for more meaningful percentage display
- Add descriptor normalization before comparison (ensures consistent euclidean distances)

#### Download SSD MobileNetV1 Model Files
- Download `ssd_mobilenetv1_model-weights_manifest.json` and `ssd_mobilenetv1_model.bin` to `client/public/models/`

---

### Component 2: Chat + Voice Bot (OmniVoice-Studio Integration)

#### [NEW] [ChatVoiceBot.jsx](file:///c:/Users/shrir/Downloads/facevault/facevault/client/src/components/ChatVoiceBot.jsx)
A floating assistant widget that:
- Appears as a stylish floating button in the bottom-right corner
- Opens into a chat panel with message history
- Has built-in contextual knowledge about FaceVault (how to upload, search, create events, etc.)
- Provides a **voice mode** toggle: uses the browser's `SpeechRecognition` API to listen to user questions and `SpeechSynthesis` API for text-to-speech replies
- If OmniVoice-Studio backend is running (`http://localhost:7852`), uses its OpenAI-compatible TTS API (`/v1/audio/speech`) for higher quality voice output
- Falls back gracefully to browser's built-in speech synthesis if OmniVoice is not available
- Premium glassmorphism design matching FaceVault's dark theme

#### [MODIFY] [App.jsx](file:///c:/Users/shrir/Downloads/facevault/facevault/client/src/App.jsx)
- Import and render `ChatVoiceBot` component globally (visible on all pages)

#### [MODIFY] [index.css](file:///c:/Users/shrir/Downloads/facevault/facevault/client/src/index.css)
- Add CSS animations and styles for the chat bot panel (slide-up, glow effects, typing indicator)

---

## User Review Required

> [!IMPORTANT]
> **OmniVoice-Studio Backend**: The voice bot will try to connect to OmniVoice-Studio at `http://localhost:7852` for premium TTS. If OmniVoice isn't running, it falls back to the browser's built-in `SpeechSynthesis` — so the bot will still work fully without OmniVoice. You'd need to set up and run OmniVoice-Studio separately if you want the high-quality voice cloning.

> [!IMPORTANT]
> **SSD MobileNetV1 Model**: This is an additional ~5.7MB model file that needs to be downloaded into `client/public/models/`. I'll download it automatically during implementation.

## Open Questions

> [!NOTE]
> **Chat Knowledge Base**: The bot will have hardcoded knowledge about FaceVault features (creating events, uploading photos, searching faces, sharing links). Should it also have any custom FAQ or domain-specific information beyond the app's standard features?

---

## Verification Plan

### Manual Verification
1. Upload a group photo → verify more faces are detected than before (SSD MobileNetV1 vs TinyFaceDetector)
2. Upload a selfie → search against uploaded photos → verify matching works with realistic confidence scores
3. Open the chat bot → type a question like "How do I find my photos?" → verify helpful response
4. Toggle voice mode → speak a question → verify it responds with speech
5. Test on the guest page (`/e/:slug`) to verify the bot appears there too

### Automated Tests
- Server-side: verify the search endpoint accepts descriptors and returns matches with updated threshold

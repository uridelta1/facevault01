import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { detectFaces, loadImage, loadFaceModels } from '../lib/face';

const API_ORIGIN = (
  import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
).replace(/\/api$/, '');

const GUEST_ORIGIN = window.location.origin;

// ==================================================
// Image URL helper
// ==================================================

function getImageUrl(url) {
  if (!url) return '';

  // ImageKit / any external URL
  if (
    url.startsWith('http://') ||
    url.startsWith('https://')
  ) {
    return url;
  }

  // Backward compatibility for old local uploads
  return API_ORIGIN + url;
}

// ==================================================
// Event Detail
// ==================================================

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [tab, setTab] = useState('upload');
  const [modelsReady, setModelsReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ data: ev }, { data: ph }] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/photos/${id}`)
      ]);

      setEvent(ev);
      setPhotos(ph);
    } catch (error) {
      console.error('[FaceVault] Failed to load event:', error);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadFaceModels()
      .then(() => setModelsReady(true))
      .catch((error) => {
        console.error(
          '[FaceVault] Failed to load face models:',
          error
        );
      });
  }, []);

  if (!event) {
    return (
      <div className="min-h-screen bg-ink text-paper flex items-center justify-center">
        <p className="font-mono text-sm text-mist">
          Loading…
        </p>
      </div>
    );
  }

  const guestLink = `${GUEST_ORIGIN}/e/${event.slug}`;

  return (
    <div className="min-h-screen bg-ink text-paper max-w-7xl mx-auto px-6 py-8">
      <Link
        to="/dashboard"
        className="font-mono text-xs text-mist hover:text-paper"
      >
        ← Dashboard
      </Link>

      <div className="flex items-start justify-between mt-4 mb-8">
        <div>
          <h1 className="font-display text-3xl mb-2">
            {event.title}
          </h1>

          <p className="font-mono text-xs text-mist">
            {photos.length} photo
            {photos.length === 1 ? '' : 's'} ·{' '}
            {event.hasPassword
              ? 'Password protected'
              : 'Open access'}
            {event.archived && ' · Archived'}
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-edge mb-8 font-mono text-xs uppercase tracking-wider">
        {['upload', 'gallery', 'share', 'settings'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-amber text-amber'
                : 'border-transparent text-mist hover:text-paper'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'upload' && (
        <UploadPanel
          eventId={id}
          modelsReady={modelsReady}
          onUploaded={load}
        />
      )}

      {tab === 'gallery' && (
        <GalleryPanel
          eventId={id}
          photos={photos}
          onChanged={load}
        />
      )}

      {tab === 'share' && (
        <SharePanel guestLink={guestLink} />
      )}

      {tab === 'settings' && (
        <SettingsPanel
          event={event}
          onChanged={load}
          onDeleted={() => navigate('/dashboard')}
        />
      )}
    </div>
  );
}

// ==================================================
// Upload Panel
// ==================================================

function UploadPanel({
  eventId,
  modelsReady,
  onUploaded
}) {
  const inputRef = useRef();

  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({
    done: 0,
    total: 0
  });
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState(null);

  function pickFiles(list) {
    setFiles(Array.from(list));
    setResult(null);
  }

  async function handleUpload() {
    if (files.length === 0) return;

    try {
      setStatus('detecting');

      setProgress({
        done: 0,
        total: files.length
      });

      const descriptorSets = [];

      for (let i = 0; i < files.length; i++) {
        try {
          const img = await loadImage(files[i]);
          const faces = await detectFaces(img);

          descriptorSets.push(faces);
        } catch (error) {
          console.error(
            `[FaceVault] Face detection failed for ${files[i].name}:`,
            error
          );

          descriptorSets.push([]);
        }

        setProgress({
          done: i + 1,
          total: files.length
        });
      }

      setStatus('uploading');

      const formData = new FormData();

      files.forEach((file) => {
        formData.append('photos', file);
      });

      formData.append(
        'descriptors',
        JSON.stringify(descriptorSets)
      );

      const { data } = await api.post(
        `/photos/${eventId}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setResult(data);
      setStatus('done');
      setFiles([]);

      onUploaded();
    } catch (error) {
      console.error(
        '[FaceVault] Upload failed:',
        error
      );

      setStatus('idle');

      setResult({
        error:
          error.response?.data?.error ||
          'Failed to upload photos.'
      });
    }
  }

  return (
    <div>
      {!modelsReady && (
        <p className="font-mono text-xs text-mist mb-5">
          Loading face recognition models…
        </p>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-sm py-16 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-amber bg-amber/5'
            : 'border-edge hover:border-mist'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          className="hidden"
          onChange={(e) => pickFiles(e.target.files)}
        />

        <p className="font-display text-xl mb-2">
          Drop photos here
        </p>

        <p className="font-mono text-xs text-mist">
          or click to browse · JPG, PNG, WEBP, HEIC
        </p>

        {files.length > 0 && (
          <p className="font-mono text-xs text-amber mt-4">
            {files.length} file
            {files.length === 1 ? '' : 's'} selected
          </p>
        )}
      </div>

      {files.length > 0 && status === 'idle' && (
        <button
          onClick={handleUpload}
          disabled={!modelsReady}
          className="mt-5 bg-amber text-ink font-medium px-6 py-2.5 rounded-sm hover:bg-gold transition-colors disabled:opacity-50"
        >
          Process &amp; upload {files.length} photo
          {files.length === 1 ? '' : 's'}
        </button>
      )}

      {(status === 'detecting' ||
        status === 'uploading') && (
        <div className="mt-5">
          <div className="h-1.5 bg-edge rounded-full overflow-hidden max-w-sm">
            <div
              className="h-full bg-amber transition-all"
              style={{
                width:
                  status === 'uploading'
                    ? '100%'
                    : `${
                        progress.total > 0
                          ? (progress.done /
                              progress.total) *
                            100
                          : 0
                      }%`
              }}
            />
          </div>

          <p className="font-mono text-xs text-mist mt-2">
            {status === 'detecting'
              ? `Detecting faces… ${progress.done}/${progress.total}`
              : 'Uploading to ImageKit…'}
          </p>
        </div>
      )}

      {result?.error && (
        <p className="font-mono text-xs text-red-400 mt-5">
          {result.error}
        </p>
      )}

      {result && !result.error && (
        <p className="font-mono text-xs text-amber mt-5">
          Uploaded {result.uploaded} photo
          {result.uploaded === 1 ? '' : 's'} ·{' '}
          {result.faceDetections} face
          {result.faceDetections === 1 ? '' : 's'} indexed
        </p>
      )}
    </div>
  );
}

// ==================================================
// Gallery Panel
// ==================================================

function GalleryPanel({
  eventId,
  photos,
  onChanged
}) {
  const [lightbox, setLightbox] = useState(null);

  async function handleDelete(photoId) {
    try {
      await api.delete(
        `/photos/${eventId}/${photoId}`
      );

      setLightbox(null);
      onChanged();
    } catch (error) {
      console.error(
        '[FaceVault] Delete failed:',
        error
      );
    }
  }

  if (photos.length === 0) {
    return (
      <p className="font-mono text-sm text-mist">
        No photos uploaded yet. Head to the Upload tab.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {photos.map((p) => (
          <button
            key={p.id}
            onClick={() => setLightbox(p)}
            className="aspect-square bg-panel border border-edge overflow-hidden relative group"
          >
            <img
              src={getImageUrl(p.thumbUrl)}
              alt="Event photo"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              onError={(e) => {
                console.error(
                  '[FaceVault] Failed to load image:',
                  getImageUrl(p.thumbUrl)
                );

                e.currentTarget.style.display =
                  'none';
              }}
            />

            {p.faceCount > 0 && (
              <span className="absolute bottom-1 right-1 bg-ink/80 px-2 py-1 font-mono text-[10px] text-amber">
                {p.faceCount} face
                {p.faceCount === 1 ? '' : 's'}
              </span>
            )}
          </button>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 bg-ink/90 backdrop-blur-sm flex items-center justify-center z-50 p-8"
          onClick={() => setLightbox(null)}
        >
          <div
            className="max-w-3xl w-full"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <img
              src={getImageUrl(
                lightbox.imageUrl
              )}
              alt="Event photo"
              className="w-full max-h-[75vh] object-contain rounded-sm"
              onError={(e) => {
                console.error(
                  '[FaceVault] Failed to load lightbox image:',
                  getImageUrl(
                    lightbox.imageUrl
                  )
                );

                e.currentTarget.style.display =
                  'none';
              }}
            />

            <div className="flex justify-between items-center mt-4">
              <span className="font-mono text-xs text-mist">
                {lightbox.faceCount} face
                {lightbox.faceCount === 1
                  ? ''
                  : 's'}{' '}
                detected
              </span>

              <div className="flex gap-3">
                <a
                  href={getImageUrl(
                    lightbox.imageUrl
                  )}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-amber hover:underline"
                >
                  Download
                </a>

                <button
                  onClick={() =>
                    handleDelete(
                      lightbox.id
                    )
                  }
                  className="font-mono text-xs text-red-400 hover:underline"
                >
                  Delete
                </button>

                <button
                  onClick={() =>
                    setLightbox(null)
                  }
                  className="font-mono text-xs text-mist hover:underline"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ==================================================
// Share Panel
// ==================================================

function SharePanel({ guestLink }) {
  const [copied, setCopied] = useState(false);

  const qrUrl =
    `https://api.qrserver.com/v1/create-qr-code/` +
    `?size=220x220` +
    `&color=232-184-92` +
    `&bgcolor=11-15-20` +
    `&data=${encodeURIComponent(guestLink)}`;

  function copy() {
    navigator.clipboard.writeText(
      guestLink
    );

    setCopied(true);

    setTimeout(
      () => setCopied(false),
      1500
    );
  }

  return (
    <div className="max-w-xl">
      <p className="font-mono text-xs uppercase tracking-wider text-mist mb-3">
        Guest gallery link
      </p>

      <div className="flex gap-2">
        <input
          readOnly
          value={guestLink}
          className="flex-1 bg-panel border border-edge rounded-sm px-3.5 py-2.5 font-mono text-xs"
        />

        <button
          onClick={copy}
          className="bg-amber text-ink px-4 rounded-sm font-mono text-xs"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <p className="font-mono text-xs text-mist mt-5 leading-relaxed">
        Share this link with guests. They'll enter
        the event password (if set) and upload a
        selfie to find every photo they appear in.
      </p>

      <div className="mt-8">
        <p className="font-mono text-xs uppercase tracking-wider text-mist mb-3">
          QR Code
        </p>

        <img
          src={qrUrl}
          alt="Guest gallery QR code"
          className="w-56 h-56 border border-edge"
        />
      </div>
    </div>
  );
}

// ==================================================
// Settings Panel
// ==================================================

function SettingsPanel({
  event,
  onChanged,
  onDeleted
}) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] =
    useState(false);

  async function toggleArchive() {
    try {
      await api.patch(
        `/events/${event.id}`,
        {
          archived: !event.archived
        }
      );

      onChanged();
    } catch (error) {
      console.error(
        '[FaceVault] Archive update failed:',
        error
      );
    }
  }

  async function updatePassword(e) {
    e.preventDefault();

    try {
      setSaving(true);

      await api.patch(
        `/events/${event.id}`,
        {
          password
        }
      );

      setPassword('');
      onChanged();
    } catch (error) {
      console.error(
        '[FaceVault] Password update failed:',
        error
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(
        `/events/${event.id}`
      );

      onDeleted();
    } catch (error) {
      console.error(
        '[FaceVault] Event deletion failed:',
        error
      );
    }
  }

  return (
    <div className="max-w-xl space-y-8">
      <form onSubmit={updatePassword}>
        <p className="font-mono text-xs uppercase tracking-wider text-mist mb-3">
          Guest password
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            placeholder={
              event.hasPassword
                ? '••••••••'
                : 'No password set'
            }
            className="flex-1 bg-panel border border-edge rounded-sm px-3.5 py-2.5 focus:outline-none focus:border-amber transition-colors"
          />

          <button
            type="submit"
            disabled={saving}
            className="bg-amber text-ink px-4 rounded-sm font-mono text-xs disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Update'}
          </button>
        </div>

        <p className="font-mono text-[11px] text-mist mt-2">
          Leave blank and submit to remove the
          password.
        </p>
      </form>

      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-mist mb-2">
          Visibility
        </p>

        <button
          onClick={toggleArchive}
          className="border border-edge px-4 py-2 rounded-sm font-mono text-xs hover:border-mist transition-colors"
        >
          {event.archived
            ? 'Unarchive event'
            : 'Archive event'}
        </button>

        <p className="font-mono text-[11px] text-mist mt-2">
          Archived events are hidden from the
          guest link.
        </p>
      </div>

      <div className="border-t border-edge pt-6">
        <p className="font-mono text-xs uppercase tracking-wider text-red-400/80 mb-3">
          Danger zone
        </p>

        {!confirmDelete ? (
          <button
            onClick={() =>
              setConfirmDelete(true)
            }
            className="font-mono text-xs text-red-400 hover:underline"
          >
            Delete event and all photos
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xs text-mist">
              Are you sure? This can't be undone.
            </span>

            <button
              onClick={handleDelete}
              className="font-mono text-xs text-red-400 border border-red-400/40 px-3 py-1.5 rounded-sm hover:bg-red-400/10"
            >
              Delete forever
            </button>

            <button
              onClick={() =>
                setConfirmDelete(false)
              }
              className="font-mono text-xs text-mist hover:underline"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
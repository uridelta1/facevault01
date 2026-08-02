import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { detectFaces, loadImage, loadFaceModels } from '../lib/face';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');
const GUEST_ORIGIN = window.location.origin;

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [tab, setTab] = useState('upload');
  const [modelsReady, setModelsReady] = useState(false);

  const load = useCallback(async () => {
    const [{ data: ev }, { data: ph }] = await Promise.all([
      api.get(`/events/${id}`),
      api.get(`/photos/${id}`)
    ]);
    setEvent(ev);
    setPhotos(ph);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadFaceModels().then(() => setModelsReady(true)); }, []);

  if (!event) return <div className="max-w-6xl mx-auto px-6 py-16 font-mono text-sm text-mist">Loading…</div>;

  const guestLink = `${GUEST_ORIGIN}/e/${event.slug}`;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <Link to="/dashboard" className="font-mono text-xs text-mist hover:text-amber transition-colors">← Dashboard</Link>

      <div className="flex items-start justify-between mt-4 mb-8">
        <div>
          <h1 className="font-display text-3xl mb-2">{event.title}</h1>
          <p className="font-mono text-xs text-mist">
            {photos.length} photo{photos.length === 1 ? '' : 's'} · {event.hasPassword ? 'Password protected' : 'Open access'}
            {event.archived && ' · Archived'}
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-edge mb-8 font-mono text-xs uppercase tracking-wider">
        {['upload', 'gallery', 'share', 'settings'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 border-b-2 -mb-px transition-colors ${tab === t ? 'border-amber text-amber' : 'border-transparent text-mist hover:text-paper'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'upload' && <UploadPanel eventId={id} modelsReady={modelsReady} onUploaded={load} />}
      {tab === 'gallery' && <GalleryPanel eventId={id} photos={photos} onChanged={load} />}
      {tab === 'share' && <SharePanel guestLink={guestLink} />}
      {tab === 'settings' && <SettingsPanel event={event} onChanged={load} onDeleted={() => navigate('/dashboard')} />}
    </div>
  );
}

function UploadPanel({ eventId, modelsReady, onUploaded }) {
  const inputRef = useRef();
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | detecting | uploading | done
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState(null);

  function pickFiles(list) {
    setFiles(Array.from(list));
    setResult(null);
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setStatus('detecting');
    setProgress({ done: 0, total: files.length });

    const descriptorSets = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const img = await loadImage(files[i]);
        const faces = await detectFaces(img);
        descriptorSets.push(faces);
      } catch {
        descriptorSets.push([]);
      }
      setProgress({ done: i + 1, total: files.length });
    }

    setStatus('uploading');
    const formData = new FormData();
    files.forEach(f => formData.append('photos', f));
    formData.append('descriptors', JSON.stringify(descriptorSets));

    const { data } = await api.post(`/photos/${eventId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    setResult(data);
    setStatus('done');
    setFiles([]);
    onUploaded();
  }

  return (
    <div>
      {!modelsReady && (
        <p className="font-mono text-xs text-amber mb-4">Loading face recognition models…</p>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); pickFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current.click()}
        className={`border-2 border-dashed rounded-sm py-16 text-center cursor-pointer transition-colors ${dragOver ? 'border-amber bg-amber/5' : 'border-edge hover:border-mist'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={e => pickFiles(e.target.files)}
        />
        <p className="font-display text-xl mb-2">Drop photos here</p>
        <p className="font-mono text-xs text-mist">or click to browse · JPG, PNG, WEBP</p>
        {files.length > 0 && (
          <p className="font-mono text-xs text-amber mt-4">{files.length} file{files.length === 1 ? '' : 's'} selected</p>
        )}
      </div>

      {files.length > 0 && status === 'idle' && (
        <button
          onClick={handleUpload}
          disabled={!modelsReady}
          className="mt-5 bg-amber text-ink font-medium px-6 py-2.5 rounded-sm hover:bg-gold transition-colors disabled:opacity-50"
        >
          Process &amp; upload {files.length} photo{files.length === 1 ? '' : 's'}
        </button>
      )}

      {(status === 'detecting' || status === 'uploading') && (
        <div className="mt-5">
          <div className="h-1.5 bg-edge rounded-full overflow-hidden max-w-sm">
            <div
              className="h-full bg-amber transition-all"
              style={{ width: status === 'uploading' ? '100%' : `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          <p className="font-mono text-xs text-mist mt-2">
            {status === 'detecting' ? `Detecting faces… ${progress.done}/${progress.total}` : 'Uploading…'}
          </p>
        </div>
      )}

      {result && (
        <p className="font-mono text-xs text-amber mt-5">
          Uploaded {result.uploaded} photo{result.uploaded === 1 ? '' : 's'} · {result.faceDetections} face{result.faceDetections === 1 ? '' : 's'} indexed
        </p>
      )}
    </div>
  );
}

function GalleryPanel({ eventId, photos, onChanged }) {
  const [lightbox, setLightbox] = useState(null);

  async function handleDelete(photoId) {
    await api.delete(`/photos/${eventId}/${photoId}`);
    setLightbox(null);
    onChanged();
  }

  if (photos.length === 0) {
    return <p className="font-mono text-sm text-mist">No photos uploaded yet. Head to the Upload tab.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {photos.map(p => (
          <button
            key={p.id}
            onClick={() => setLightbox(p)}
            className="aspect-square bg-panel border border-edge overflow-hidden relative group"
          >
            <img src={API_ORIGIN + p.thumbUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            {p.faceCount > 0 && (
              <span className="absolute bottom-1 right-1 font-mono text-[10px] bg-ink/80 text-amber px-1.5 py-0.5 rounded-sm">
                {p.faceCount} face{p.faceCount === 1 ? '' : 's'}
              </span>
            )}
          </button>
        ))}
      </div>

      {lightbox && (
        <div className="fixed inset-0 bg-ink/90 backdrop-blur-sm flex items-center justify-center z-50 p-8" onClick={() => setLightbox(null)}>
          <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img src={API_ORIGIN + lightbox.imageUrl} alt="" className="w-full max-h-[75vh] object-contain rounded-sm" />
            <div className="flex justify-between items-center mt-4">
              <span className="font-mono text-xs text-mist">{lightbox.faceCount} face{lightbox.faceCount === 1 ? '' : 's'} detected</span>
              <div className="flex gap-3">
                <a href={API_ORIGIN + lightbox.imageUrl} download className="font-mono text-xs text-amber hover:underline">Download</a>
                <button onClick={() => handleDelete(lightbox.id)} className="font-mono text-xs text-red-400 hover:underline">Delete</button>
                <button onClick={() => setLightbox(null)} className="font-mono text-xs text-mist hover:underline">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SharePanel({ guestLink }) {
  const [copied, setCopied] = useState(false);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=232-184-92&bgcolor=11-15-20&data=${encodeURIComponent(guestLink)}`;

  function copy() {
    navigator.clipboard.writeText(guestLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="grid md:grid-cols-[1fr_auto] gap-10 items-start">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-mist mb-2">Guest gallery link</p>
        <div className="flex items-center gap-3 border border-edge rounded-sm px-4 py-3 bg-panel max-w-lg">
          <span className="font-mono text-sm truncate flex-1">{guestLink}</span>
          <button onClick={copy} className="font-mono text-xs text-amber hover:underline shrink-0">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="font-mono text-xs text-mist mt-4 max-w-md leading-relaxed">
          Share this link with guests. They'll enter the event password (if set) and upload a
          selfie to find every photo they appear in.
        </p>
      </div>
      <div className="border border-edge p-3 rounded-sm bg-panel">
        <img src={qrUrl} alt="QR code to guest gallery" width={180} height={180} />
      </div>
    </div>
  );
}

function SettingsPanel({ event, onChanged, onDeleted }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function toggleArchive() {
    await api.patch(`/events/${event.id}`, { archived: !event.archived });
    onChanged();
  }

  async function updatePassword(e) {
    e.preventDefault();
    setSaving(true);
    await api.patch(`/events/${event.id}`, { password });
    setPassword('');
    setSaving(false);
    onChanged();
  }

  async function handleDelete() {
    await api.delete(`/events/${event.id}`);
    onDeleted();
  }

  return (
    <div className="max-w-md space-y-10">
      <form onSubmit={updatePassword}>
        <p className="font-mono text-xs uppercase tracking-wider text-mist mb-2">Guest password</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={event.hasPassword ? '••••••••' : 'No password set'}
            className="flex-1 bg-panel border border-edge rounded-sm px-3.5 py-2.5 focus:outline-none focus:border-amber transition-colors"
          />
          <button type="submit" disabled={saving} className="border border-amber/60 text-amber px-4 rounded-sm hover:bg-amber hover:text-ink transition-colors font-mono text-xs">
            Update
          </button>
        </div>
        <p className="font-mono text-[11px] text-mist mt-2">Leave blank and submit to remove the password.</p>
      </form>

      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-mist mb-2">Visibility</p>
        <button onClick={toggleArchive} className="border border-edge px-4 py-2 rounded-sm font-mono text-xs hover:border-mist transition-colors">
          {event.archived ? 'Unarchive event' : 'Archive event'}
        </button>
        <p className="font-mono text-[11px] text-mist mt-2">Archived events are hidden from the guest link.</p>
      </div>

      <div className="border-t border-edge pt-6">
        <p className="font-mono text-xs uppercase tracking-wider text-red-400/80 mb-3">Danger zone</p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="font-mono text-xs text-red-400 hover:underline">
            Delete event and all photos
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-mist">Are you sure? This can't be undone.</span>
            <button onClick={handleDelete} className="font-mono text-xs text-red-400 border border-red-400/40 px-3 py-1.5 rounded-sm hover:bg-red-400/10">
              Delete forever
            </button>
            <button onClick={() => setConfirmDelete(false)} className="font-mono text-xs text-mist hover:underline">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

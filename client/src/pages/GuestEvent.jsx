import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { detectSingleFace, loadImage, loadFaceModels } from '../lib/face';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');
function getImageUrl(url) {
  if (!url) return '';

  // ImageKit / external URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Old local uploads
  return API_ORIGIN + url;
}
export default function GuestEvent() {
  const { slug } = useParams();
  const [event, setEvent] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [guestToken, setGuestToken] = useState(null);
  const [modelsReady, setModelsReady] = useState(false);

  useEffect(() => {
    api.get(`/events/public/${slug}`)
      .then(({ data }) => setEvent(data))
      .catch(() => setNotFound(true));
    loadFaceModels().then(() => setModelsReady(true));
  }, [slug]);

  if (notFound) {
    return (
      <div className="max-w-md mx-auto px-6 py-24 text-center">
        <p className="font-display text-2xl mb-2">Gallery not found</p>
        <p className="font-mono text-sm text-mist">This link may have expired or been removed.</p>
      </div>
    );
  }

  if (!event) return <div className="max-w-md mx-auto px-6 py-24 font-mono text-sm text-mist text-center">Loading…</div>;

  if (!guestToken) {
    return <PasswordGate event={event} onVerified={setGuestToken} />;
  }

  return <SelfieSearch event={event} guestToken={guestToken} modelsReady={modelsReady} />;
}

function PasswordGate({ event, onVerified }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post(`/events/public/${event.slug}/verify`, event.hasPassword ? { password } : {});
      onVerified(data.guestToken);
    } catch (err) {
      setError(err.response?.data?.error || 'Incorrect password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-24">
      {event.coverImage && (
        // <img src={API_ORIGIN + event.coverImage} alt="" className="w-full aspect-video object-cover rounded-sm mb-8 border border-edge" />
        <img
  src={getImageUrl(event.coverImage)}
  alt=""
  className="w-full aspect-video object-cover rounded-sm mb-8 border border-edge"
/>
      )}
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber mb-2">Guest gallery</p>
      <h1 className="font-display text-3xl mb-8">{event.title}</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {event.hasPassword && (
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-wider text-mist block mb-1.5">Event password</span>
            <input
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-panel border border-edge rounded-sm px-3.5 py-2.5 focus:outline-none focus:border-amber transition-colors"
              autoFocus
            />
          </label>
        )}
        {error && <p className="text-sm text-red-400 font-mono">{error}</p>}
        <button type="submit" disabled={loading} className="w-full bg-amber text-ink font-medium py-3 rounded-sm hover:bg-gold transition-colors disabled:opacity-50">
          {loading ? 'Checking…' : 'Enter gallery'}
        </button>
      </form>
    </div>
  );
}

function SelfieSearch({ event, guestToken, modelsReady }) {
  const fileRef = useRef();
  const videoRef = useRef();
  const canvasRef = useRef();
  const [mode, setMode] = useState('choose'); // choose | camera
  const [previewUrl, setPreviewUrl] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | detecting | searching | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [results, setResults] = useState(null);
  const [scanned, setScanned] = useState(0);

  async function runSearch(file) {
    setErrorMsg('');
    setPreviewUrl(URL.createObjectURL(file));
    setStatus('detecting');
    try {
      const img = await loadImage(file);
      const face = await detectSingleFace(img);
      if (!face) {
        setStatus('error');
        setErrorMsg("We couldn't detect a face in that photo. Try a clearer, front-facing selfie.");
        return;
      }
      setStatus('searching');
      const { data } = await api.post(
        `/search/${event.id}`,
        { descriptor: face.descriptor, eventId: event.id },
        { headers: { Authorization: `Bearer ${guestToken}` } }
      );
      setResults(data.matches);
      setScanned(data.totalPhotosScanned);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.error || 'Something went wrong while searching. Please try again.');
    }
  }

  async function startCamera() {
    setMode('camera');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    if (videoRef.current) videoRef.current.srcObject = stream;
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    video.srcObject.getTracks().forEach(t => t.stop());
    canvas.toBlob(blob => {
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
      runSearch(file);
    }, 'image/jpeg', 0.92);
  }

  function reset() {
    setStatus('idle');
    setResults(null);
    setPreviewUrl(null);
    setMode('choose');
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber mb-2">{event.title}</p>

      {status === 'idle' && mode === 'choose' && (
        <div className="max-w-sm">
          <h1 className="font-display text-3xl mb-3">Find your photos</h1>
          <p className="text-sm text-mist mb-8 leading-relaxed">
            Upload a selfie or take one now. Your photo never leaves your device — only a
            mathematical face signature is sent to search the gallery.
          </p>

          {!modelsReady && <p className="font-mono text-xs text-amber mb-4">Loading recognition models…</p>}

          <div className="flex flex-col gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files[0] && runSearch(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current.click()}
              disabled={!modelsReady}
              className="bg-amber text-ink font-medium py-3 rounded-sm hover:bg-gold transition-colors disabled:opacity-50"
            >
              Upload a selfie
            </button>
            <button
              onClick={startCamera}
              disabled={!modelsReady}
              className="border border-edge py-3 rounded-sm font-mono text-sm hover:border-amber hover:text-amber transition-colors disabled:opacity-50"
            >
              Take a photo
            </button>
          </div>
        </div>
      )}

      {mode === 'camera' && status === 'idle' && (
        <div className="max-w-sm">
          <div className="reticle relative border border-edge rounded-sm overflow-hidden mb-4">
            <span className="rc-tl" /><span className="rc-br" />
            <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-square object-cover" />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <button onClick={capturePhoto} className="w-full bg-amber text-ink font-medium py-3 rounded-sm hover:bg-gold transition-colors">
            Capture
          </button>
        </div>
      )}

      {(status === 'detecting' || status === 'searching') && (
        <div className="max-w-sm">
          {previewUrl && (
            <div className="reticle relative border border-edge rounded-sm overflow-hidden mb-5 max-w-[220px]">
              <span className="rc-tl" /><span className="rc-br" />
              <img src={previewUrl} alt="" className="w-full aspect-square object-cover" />
            </div>
          )}
          <p className="font-mono text-sm text-amber animate-pulse">
            {status === 'detecting' ? 'Reading your selfie…' : 'Searching the gallery…'}
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="max-w-sm">
          <p className="font-mono text-sm text-red-400 mb-5">{errorMsg}</p>
          <button onClick={reset} className="font-mono text-sm text-amber hover:underline">Try again</button>
        </div>
      )}

      {status === 'done' && (
        <div>
          <div className="flex items-center justify-between mb-8">
            <p className="font-mono text-sm text-mist">
              {results.length > 0
                ? `Found you in ${results.length} of ${scanned} photos`
                : `No matches found across ${scanned} photos`}
            </p>
            <button onClick={reset} className="font-mono text-xs text-amber hover:underline">Search again</button>
          </div>

          {results.length === 0 ? (
            <p className="text-sm text-mist">Try a clearer, front-facing selfie with even lighting.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
                {results.map(r => (
                  <div key={r.id} className="border border-edge rounded-sm overflow-hidden bg-panel">
                    {/* <img src={API_ORIGIN + r.thumbUrl} alt="" className="w-full aspect-square object-cover" /> */}
                    <img
  src={getImageUrl(r.thumbUrl)}
  alt=""
  className="w-full aspect-square object-cover"
/>
                    <div className="flex items-center justify-between px-2.5 py-2">
                      <span className="font-mono text-[10px] text-amber">{r.confidence}% match</span>
                      {/* <a href={API_ORIGIN + r.imageUrl} download className="font-mono text-[10px] text-mist hover:text-amber transition-colors">
                        ↓ Save
                      </a> */}
                      <a
  href={getImageUrl(r.imageUrl)}
  download
  className="font-mono text-[10px] text-mist hover:text-amber transition-colors"
>
  ↓ Save
</a>
                    </div>
                  </div>
                ))}
              </div>
              {/* <a
                href="#"
                onClick={e => { e.preventDefault(); results.forEach(r => window.open(API_ORIGIN + r.imageUrl, '_blank')); }}
                className="font-mono text-xs text-amber hover:underline"
              >
                Download all →
              </a> */}
              <a
  href="#"
  onClick={(e) => {
    e.preventDefault();

    results.forEach((r) => {
      window.open(getImageUrl(r.imageUrl), '_blank');
    });
  }}
  className="font-mono text-xs text-amber hover:underline"
>
  Download all →
</a>
            </>
          )}
        </div>
      )}
    </div>
  );
}

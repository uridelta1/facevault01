import { Link } from 'react-router-dom';

const steps = [
  { label: 'Upload', body: 'Organizers drop in the full event shoot — hundreds or thousands of frames at once.' },
  { label: 'Detect', body: 'Every face in every photo is located and encoded into a 128-point signature, right in the browser.' },
  { label: 'Match', body: 'A guest uploads one selfie. FaceVault compares it against every signature in seconds.' },
  { label: 'Deliver', body: 'Every photo they appear in — and only those — ready to view, download, or share.' }
];

export default function Landing() {
  return (
    <div className="grain">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 grid md:grid-cols-[1.2fr_1fr] gap-16 items-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber mb-6">
            Event photography, indexed by face
          </p>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.05] tracking-tight mb-6">
            Every guest finds
            <br />
            <span className="italic text-amber">their</span> photos.
            <br />
            No scrolling.
          </h1>
          <p className="text-mist text-lg leading-relaxed max-w-md mb-10">
            Upload the full shoot. Guests upload one selfie. FaceVault's on-device
            recognition returns every frame they're in — out of thousands — in seconds.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/register" className="bg-amber text-ink font-medium px-6 py-3 rounded-sm hover:bg-gold transition-colors">
              Create an event
            </Link>
            <Link to="/login" className="font-mono text-sm text-mist hover:text-paper transition-colors">
              Sign in →
            </Link>
          </div>
        </div>

        {/* Signature element: a viewfinder scanning a contact sheet */}
        <div className="relative">
          <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-panel border border-edge rounded-sm">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-edge/60 relative overflow-hidden">
                {i === 4 && (
                  <div className="absolute inset-2 reticle">
                    <span className="rc-tl" /><span className="rc-br" />
                  </div>
                )}
              </div>
            ))}
            <div className="absolute inset-1.5 overflow-hidden pointer-events-none">
              <div className="scanline absolute left-0 right-0 h-px bg-amber shadow-[0_0_8px_2px_rgba(232,184,92,0.6)]" />
            </div>
          </div>
          <p className="font-mono text-[11px] text-mist mt-3 text-center">match confidence 0.94 · face #04</p>
        </div>
      </section>

      {/* Process */}
      <section className="border-t border-edge/80 bg-panel/40">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="font-display text-2xl mb-12">How it works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <div key={s.label} className="border-t border-amber/40 pt-4">
                <span className="font-mono text-xs text-amber">0{i + 1}</span>
                <h3 className="font-display text-xl mt-2 mb-2">{s.label}</h3>
                <p className="text-sm text-mist leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="font-display text-2xl mb-8">Built for the events that produce thousands of frames</h2>
        <div className="flex flex-wrap gap-3">
          {['Weddings', 'College fests', 'Corporate offsites', 'Sports meets', 'Concerts', 'Festivals', 'Reunions'].map(t => (
            <span key={t} className="font-mono text-xs uppercase tracking-wide border border-edge text-mist px-4 py-2 rounded-full">
              {t}
            </span>
          ))}
        </div>
      </section>

      <footer className="border-t border-edge/80 py-8">
        <div className="max-w-6xl mx-auto px-6 font-mono text-xs text-mist">
          FaceVault — face matching runs in your browser. Selfies are never stored on the server.
        </div>
      </footer>
    </div>
  );
}

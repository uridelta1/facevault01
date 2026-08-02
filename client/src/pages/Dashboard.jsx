import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Field } from './Login';

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function loadEvents() {
    setLoading(true);
    const { data } = await api.get('/events/mine');
    setEvents(data);
    setLoading(false);
  }

  useEffect(() => { loadEvents(); }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber mb-2">Your events</p>
          <h1 className="font-display text-3xl">Dashboard</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-amber text-ink font-medium px-5 py-2.5 rounded-sm hover:bg-gold transition-colors"
        >
          + New event
        </button>
      </div>

      {loading ? (
        <p className="font-mono text-sm text-mist">Loading…</p>
      ) : events.length === 0 ? (
        <div className="border border-dashed border-edge rounded-sm py-20 text-center">
          <p className="font-display text-xl text-mist mb-2">No events yet</p>
          <p className="text-sm text-mist mb-6">Create your first event to start uploading photos.</p>
          <button onClick={() => setShowCreate(true)} className="text-amber font-mono text-sm hover:underline">
            + Create an event
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map(ev => (
            <Link
              key={ev.id}
              to={`/events/${ev.id}`}
              className="group border border-edge rounded-sm p-5 hover:border-amber/60 transition-colors bg-panel/40"
            >
              <div className="flex items-start justify-between mb-6">
                <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border ${ev.archived ? 'border-mist/40 text-mist' : 'border-amber/40 text-amber'}`}>
                  {ev.archived ? 'Archived' : 'Live'}
                </span>
                <span className="font-mono text-[10px] text-mist">{ev.hasPassword ? 'Locked' : 'Open'}</span>
              </div>
              <h3 className="font-display text-xl mb-1 group-hover:text-amber transition-colors">{ev.title}</h3>
              <p className="font-mono text-xs text-mist">{ev.photoCount} photo{ev.photoCount === 1 ? '' : 's'}</p>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadEvents(); }}
        />
      )}
    </div>
  );
}

function CreateEventModal({ onClose, onCreated }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', password: '', expiryDate: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/events', form);
      onCreated();
      navigate(`/events/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create event');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm flex items-center justify-center z-50 px-6" onClick={onClose}>
      <div className="bg-panel border border-edge rounded-sm p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="font-display text-2xl mb-6">New event</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Event title" value={form.title} onChange={v => setForm({ ...form, title: v })} required />
          <Field
            label="Guest password (optional)"
            type="text"
            value={form.password}
            onChange={v => setForm({ ...form, password: v })}
            hint="Leave blank for an open gallery"
          />
          <Field
            label="Expiry date (optional)"
            type="date"
            value={form.expiryDate}
            onChange={v => setForm({ ...form, expiryDate: v })}
          />
          {error && <p className="text-sm text-red-400 font-mono">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-edge py-2.5 rounded-sm font-mono text-sm hover:border-mist transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-amber text-ink font-medium py-2.5 rounded-sm hover:bg-gold transition-colors disabled:opacity-50">
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

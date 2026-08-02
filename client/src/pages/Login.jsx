import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-6 pt-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber mb-3">Organizer access</p>
      <h1 className="font-display text-3xl mb-8">Sign in</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Email" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} required />
        <Field label="Password" type="password" value={form.password} onChange={v => setForm({ ...form, password: v })} required />

        {error && <p className="text-sm text-red-400 font-mono">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber text-ink font-medium py-3 rounded-sm hover:bg-gold transition-colors disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="font-mono text-xs text-mist mt-6">
        New here? <Link to="/register" className="text-amber hover:underline">Create an account</Link>
      </p>
    </div>
  );
}

export function Field({ label, type = 'text', value, onChange, required, hint }) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-wider text-mist block mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-panel border border-edge rounded-sm px-3.5 py-2.5 text-paper placeholder:text-mist/50 focus:outline-none focus:border-amber transition-colors"
      />
      {hint && <span className="font-mono text-[11px] text-mist/70 mt-1 block">{hint}</span>}
    </label>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Field } from './Login';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-6 pt-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber mb-3">For photographers &amp; organizers</p>
      <h1 className="font-display text-3xl mb-8">Create your account</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Full name" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
        <Field label="Email" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} required />
        <Field label="Password" type="password" value={form.password} onChange={v => setForm({ ...form, password: v })} required hint="At least 6 characters" />

        {error && <p className="text-sm text-red-400 font-mono">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber text-ink font-medium py-3 rounded-sm hover:bg-gold transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="font-mono text-xs text-mist mt-6">
        Already have an account? <Link to="/login" className="text-amber hover:underline">Sign in</Link>
      </p>
    </div>
  );
}

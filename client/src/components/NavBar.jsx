import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-edge/80 bg-ink/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="reticle w-6 h-6 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-amber" />
          </span>
          <span className="font-display text-lg tracking-tight">FaceVault</span>
        </Link>

        <nav className="flex items-center gap-6 font-mono text-xs uppercase tracking-wider text-mist">
          {user ? (
            <>
              <Link to="/dashboard" className="hover:text-paper transition-colors">Dashboard</Link>
              <span className="text-edge">/</span>
              <span className="text-paper normal-case font-body">{user.name}</span>
              <button
                onClick={() => { logout(); navigate('/'); }}
                className="border border-edge px-3 py-1.5 rounded-sm hover:border-amber hover:text-amber transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-paper transition-colors">Sign in</Link>
              <Link to="/register" className="border border-amber/60 text-amber px-3 py-1.5 rounded-sm hover:bg-amber hover:text-ink transition-colors">
                Start free
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

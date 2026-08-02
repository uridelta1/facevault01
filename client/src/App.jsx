import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import NavBar from './components/NavBar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import EventDetail from './pages/EventDetail';
import GuestEvent from './pages/GuestEvent';

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-ink text-paper">
        <Routes>
          <Route path="/e/:slug" element={<GuestEvent />} />
          <Route
            path="*"
            element={
              <>
                <NavBar />
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/events/:id" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
                </Routes>
              </>
            }
          />
        </Routes>
      </div>
    </AuthProvider>
  );
}

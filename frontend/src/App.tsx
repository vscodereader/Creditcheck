import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import MainPage from './pages/MainPage';
import LoginPage from './pages/LoginPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import CheckPage from './pages/CheckPage';
import { useAuth } from './lib/auth';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/main" replace />} />
      <Route path="/main" element={<MainPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/profile-setup" element={<ProfileSetupGuard />} />
      <Route path="/check" element={<CheckGuard />} />
      <Route path="*" element={<Navigate to="/main" replace />} />
    </Routes>
  );
}

function ProfileSetupGuard() {
  const { loading, authenticated, user } = useAuth();

  if (loading) return <PageLoading />;
  if (!authenticated) return <Navigate to="/login" replace />;
  if (user?.profileCompleted) return <Navigate to="/check" replace />;

  return <ProfileSetupPage />;
}

function CheckGuard() {
  const { loading, authenticated, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) return <PageLoading />;
  if (!authenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!user?.profileCompleted) return <Navigate to="/profile-setup" replace />;

  return (
    <div className="check-shell">
      <div className="check-shell-topbar">
        <div className="check-shell-user">
          <span>{user.displayName ?? user.googleName ?? '사용자'}</span>
          <small>{user.email}</small>
        </div>
        <button
          className="ghost"
          onClick={() => {
            void logout().then(() => navigate('/main', { replace: true }));
          }}
        >
          로그아웃
        </button>
      </div>
      <CheckPage />
    </div>
  );
}

function PageLoading() {
  return (
    <div className="auth-page">
      <div className="auth-card auth-card--center">
        <h1 className="auth-title">잠시만 기다려주세요</h1>
        <p className="auth-subtitle">로그인 상태를 확인하고 있어요.</p>
      </div>
    </div>
  );
}

export default App;
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, useAuth } from '../lib/auth';

function LoginPage() {
  const navigate = useNavigate();
  const { loading, authenticated, user, refreshMe } = useAuth();

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (loading) return;

    if (authenticated) {
      navigate(user?.profileCompleted ? '/check' : '/profile-setup', { replace: true });
    }
  }, [loading, authenticated, user, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-eyebrow">Login</div>
        <h1 className="auth-title">Google 계정으로 로그인</h1>
        <p className="auth-subtitle">
          로그인 후 본인 데이터만 저장되고 조회됩니다.
        </p>

        <button
          className="primary auth-google-button"
          onClick={() => {
            window.location.href = `${API_BASE}/auth/google`;
          }}
        >
          Google로 로그인
        </button>

        <button className="ghost auth-back-button" onClick={() => navigate('/main')}>
          메인으로
        </button>
      </div>
    </div>
  );
}

export default LoginPage;
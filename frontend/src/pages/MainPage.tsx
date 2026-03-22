import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

function MainPage() {
  const navigate = useNavigate();
  const { loading, authenticated, user, logout, refreshMe } = useAuth();

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
      <div className="auth-card auth-card--center">
        <div className="auth-eyebrow">Welcome Student</div>
        <h1 className="auth-title">Shall We Check?</h1>
        <p className="auth-subtitle">
          가천대 전공교육과정 AI OCR 비교기를 이용하려면 로그인해주세요.
        </p>

        {loading ? (
          <div className="auth-loading-text">로그인 상태를 확인하는 중입니다...</div>
        ) : !authenticated ? (
          <button className="primary auth-main-button" onClick={() => navigate('/login')}>
            로그인
          </button>
        ) : (
          <div className="auth-main-actions">
            <div className="auth-user-box">
              <div>{user?.displayName ?? user?.googleName ?? '사용자'}</div>
              <div className="auth-user-email">{user?.email}</div>
            </div>

            <button
              className="ghost auth-main-button"
              onClick={() => {
                void logout().then(() => navigate('/main', { replace: true }));
              }}
            >
              로그아웃
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MainPage;
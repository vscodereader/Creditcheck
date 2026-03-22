import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, useAuth } from '../lib/auth';

const POLICY_TEXT = `
본 서비스는 사용자의 전공교육과정, 이수내역, 비교 결과를 사용자 본인 계정에만 연결하여 저장합니다.
수집 항목은 Google 로그인 정보(이메일, 이름), 학번, 표시 이름, 사용자가 직접 입력한 교과과정/이수내역 정보입니다.
수집 목적은 로그인 유지, 사용자별 데이터 분리, OCR 결과 저장 및 비교 서비스 제공입니다.
사용자는 언제든지 서비스 이용을 중단할 수 있습니다.
`;

function ProfileSetupPage() {
  const navigate = useNavigate();
  const { loading, authenticated, user, refreshMe } = useAuth();

  const [studentId, setStudentId] = useState(user?.studentId ?? '');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [agreePersonalPolicy, setAgreePersonalPolicy] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !authenticated) {
      navigate('/login', { replace: true });
      return;
    }

    if (!loading && authenticated && user?.profileCompleted) {
      navigate('/check', { replace: true });
    }
  }, [loading, authenticated, user, navigate]);

  const studentIdValid = /^\d{9}$/.test(studentId.trim());

  const displayNameValid = useMemo(() => {
    const trimmed = displayName.trim();
    if (!trimmed) return false;
    if (trimmed.length > 10) return false;
    if (/^(null|undefined)$/i.test(trimmed)) return false;
    return true;
  }, [displayName]);

  const canSubmit = studentIdValid && displayNameValid && agreePersonalPolicy;

  async function submitProfile() {
    if (!canSubmit) {
      setMessage('학번, 이름, 개인정보 동의를 먼저 완료해주세요.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE}/auth/profile-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          studentId: studentId.trim(),
          displayName: displayName.trim(),
          agreePersonalPolicy
        })
      });

      const json = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        throw new Error(json.message ?? '프로필 저장에 실패했습니다.');
      }

      await refreshMe();
      navigate('/check', { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '프로필 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--wide">
        <div className="auth-eyebrow">Profile Setup</div>
        <h1 className="auth-title">처음 1회만 정보 입력</h1>
        <p className="auth-subtitle">학번과 이름을 저장하면 비교 페이지로 이동합니다.</p>

        <div className="auth-form">
          <label className="auth-label">
            <span>학번</span>
            <input
              value={studentId}
              maxLength={9}
              inputMode="numeric"
              placeholder="학번 9자리를 입력하세요"
              onChange={(event) => setStudentId(event.target.value.replace(/[^\d]/g, '').slice(0, 9))}
            />
            {!studentId ? null : studentIdValid ? (
              <div className="auth-ok-text">사용 가능한 학번 형식입니다.</div>
            ) : (
              <div className="auth-error-text">학번은 숫자 9자리여야 합니다.</div>
            )}
          </label>

          <label className="auth-label">
            <span>이름</span>
            <input
              value={displayName}
              maxLength={10}
              placeholder="이름 또는 닉네임을 입력하세요"
              onChange={(event) => setDisplayName(event.target.value)}
            />
            {!displayName ? null : displayNameValid ? null : (
              <div className="auth-error-text">이름은 공백만 제외하고 1~10자로 입력해주세요.</div>
            )}
          </label>

          <div className="auth-policy-box">
            <div className="auth-policy-text">{POLICY_TEXT}</div>
            <label className="auth-policy-check">
              <input
                type="checkbox"
                checked={agreePersonalPolicy}
                onChange={(event) => setAgreePersonalPolicy(event.target.checked)}
              />
              <span>개인정보 이용에 동의합니다.</span>
            </label>
          </div>

          {message ? <div className="auth-error-text">{message}</div> : null}

          <button className="primary auth-submit-button" disabled={!canSubmit || saving} onClick={() => void submitProfile()}>
            {saving ? '저장 중...' : '저장하고 시작하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileSetupPage;
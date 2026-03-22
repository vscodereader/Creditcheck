import { Router } from 'express';
import passport from '../auth/passport.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../auth/requireAuth.js';

const router = Router();
const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${clientUrl}/login?error=google`
  }),
  (_req, res) => {
    res.redirect(`${clientUrl}/login`);
  }
);

router.get('/me', async (req, res, next) => {
  try {
    if (!req.isAuthenticated() || !req.user?.id) {
      res.json({
        authenticated: false,
        user: null
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });

    if (!user) {
      res.json({
        authenticated: false,
        user: null
      });
      return;
    }

    const profileCompleted = Boolean(
      user.studentId &&
        user.displayName &&
        user.agreedPersonalPolicyAt
    );

    res.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        googleName: user.googleName,
        googleImage: user.googleImage,
        displayName: user.displayName,
        studentId: user.studentId,
        profileCompleted
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/profile-setup', requireAuth, async (req, res, next) => {
  try {
    const { studentId, displayName, agreePersonalPolicy } = req.body as {
      studentId?: string;
      displayName?: string;
      agreePersonalPolicy?: boolean;
    };

    const normalizedStudentId = String(studentId ?? '').trim();
    const normalizedDisplayName = String(displayName ?? '').trim();

    if (!/^\d{9}$/.test(normalizedStudentId)) {
      res.status(400).json({ message: '학번은 숫자 9자리여야 합니다.' });
      return;
    }

    if (!normalizedDisplayName || normalizedDisplayName.length > 10) {
      res.status(400).json({ message: '이름은 1자 이상 10자 이하로 입력해주세요.' });
      return;
    }

    if (/^(null|undefined)$/i.test(normalizedDisplayName)) {
      res.status(400).json({ message: '이름 형식이 올바르지 않습니다.' });
      return;
    }

    if (!agreePersonalPolicy) {
      res.status(400).json({ message: '개인정보 이용 동의가 필요합니다.' });
      return;
    }

    const duplicate = await prisma.user.findFirst({
      where: {
        studentId: normalizedStudentId,
        NOT: { id: req.user!.id }
      }
    });

    if (duplicate) {
      res.status(400).json({ message: '이미 사용 중인 학번입니다.' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        studentId: normalizedStudentId,
        displayName: normalizedDisplayName,
        agreedPersonalPolicyAt: new Date()
      }
    });

    res.json({
      ok: true,
      user: {
        id: updated.id,
        email: updated.email,
        googleName: updated.googleName,
        googleImage: updated.googleImage,
        displayName: updated.displayName,
        studentId: updated.studentId,
        profileCompleted: true
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res, next) => {
  req.logout((logoutError) => {
    if (logoutError) {
      next(logoutError);
      return;
    }

    req.session.destroy((sessionError) => {
      if (sessionError) {
        next(sessionError);
        return;
      }

      res.clearCookie('coursechecker.sid');
      res.json({ ok: true });
    });
  });
});

export default router;
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import apiRouter from './routes/api.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';

app.use(cors({ origin: [clientUrl, 'http://localhost:5173'], credentials: false }));
app.use(express.json({ limit: '35mb' }));
app.use(morgan('dev'));

app.get('/', (_req, res) => {
  res.json({
    message: 'Gachon Course Checker API',
    docs: {
      health: '/api/health',
      gachonSources: '/api/sources/gachon?category=major',
      aiCurriculumOcr: '/api/ai-ocr/curriculum',
      aiCompletedOcr: '/api/ai-ocr/completed',
      catalogs: '/api/catalogs',
      completedSets: '/api/completed-sets',
      compare: '/api/compare'
    }
  });
});

app.use('/api', apiRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : '서버 오류가 발생했습니다.';
  res.status(500).json({ message });
});

app.listen(port, () => {
  console.log(`API 서버 실행 중: http://localhost:${port}`);
});

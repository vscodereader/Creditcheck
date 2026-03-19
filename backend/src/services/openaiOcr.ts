import OpenAI from 'openai';
import { appendUsageRecord, buildUsageRecord } from './usageMeter.js';

export type AiImageInput = {
  fileName: string;
  dataUrl: string;
};

export type CurriculumCourse = {
  yearLevel: number | null;
  semesterOrder: number | null;
  classification: string;
  classification1: string;
  classification2: string;
  name: string;
  credit: number | null;
};

export type GraduationCredits = {
  기초교양: number | null;
  융합교양: number | null;
  계열교양: number | null;
  전공필수: number | null;
  전공선택: number | null;
  총학점: number | null;
};

export type CompletedCourseAi = {
  yearTaken: number | null;
  termText: string;
  classification: string;
  classification1: string;
  classification2: string;
  name: string;
  credit: number | null;
  gradeText: string;
  professor: string;
};

const defaultGraduationCredits = (): GraduationCredits => ({
  기초교양: null,
  융합교양: null,
  계열교양: null,
  전공필수: null,
  전공선택: null,
  총학점: null
});

const curriculumClass1Options = ['기초교양', '융합교양', '계열교양', '전공필수', '전공선택'] as const;
const curriculumClass2Options = ['인필', '인선'] as const;

const classification1Aliases: Record<string, string> = {
  기초: '기초교양',
  기초교양: '기초교양',
  융교: '융합교양',
  융합: '융합교양',
  융합교양: '융합교양',
  계교: '계열교양',
  계열: '계열교양',
  계열교양: '계열교양',
  전필: '전공필수',
  전공필수: '전공필수',
  전선: '전공선택',
  전공선택: '전공선택',
  교필: '교양필수',
  교양필수: '교양필수',
  교선: '교양선택',
  교양선택: '교양선택',
  일선: '일반선택',
  일반선택: '일반선택'
};

const classification2Aliases: Record<string, string> = {
  인필: '인필',
  인선: '인선'
};

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 없습니다. backend/.env에 API 키를 넣어주세요.');
  }
  return new OpenAI({ apiKey });
}

function getModel(): string {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-5.4-mini';
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('AI 응답이 비어 있습니다.');

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced =
      trimmed.match(/```json\s*([\s\S]*?)```/i)?.[1] ??
      trimmed.match(/```\s*([\s\S]*?)```/i)?.[1];

    if (fenced) {
      return JSON.parse(fenced.trim());
    }

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }

    throw new Error('AI 응답에서 JSON을 찾지 못했습니다.');
  }
}

function toIntOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);

  if (typeof value === 'string' && value.trim() !== '') {
    const cleaned = value.replace(/[^\d-]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  return null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeClassification1(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  return classification1Aliases[raw] ?? raw;
}

function normalizeClassification2(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  return classification2Aliases[raw] ?? raw;
}

function combineClassification(classification1: string, classification2: string, fallback = ''): string {
  const first = normalizeClassification1(classification1);
  const second = normalizeClassification2(classification2);
  if (first && second) return `${first}/${second}`;
  if (first) return first;
  return fallback.trim();
}

function extractCurriculumClass1(value: string): string {
  const normalized = normalizeClassification1(value);
  for (const option of curriculumClass1Options) {
    if (normalized.includes(option)) return option;
  }
  return normalized;
}

function extractCurriculumClass2(value: string): string {
  const normalized = normalizeClassification2(value);
  for (const option of curriculumClass2Options) {
    if (normalized.includes(option)) return option;
  }
  return normalized;
}

function splitClassification(
  value: string,
  mode: 'curriculum' | 'completed' = 'curriculum'
): { classification1: string; classification2: string } {
  const raw = value.trim();
  if (!raw) return { classification1: '', classification2: '' };

  const slashParts = raw
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  if (slashParts.length >= 2) {
    return {
      classification1:
        mode === 'curriculum'
          ? extractCurriculumClass1(slashParts[0])
          : normalizeClassification1(slashParts[0]),
      classification2: normalizeClassification2(slashParts[1])
    };
  }

  return {
    classification1: mode === 'curriculum' ? extractCurriculumClass1(raw) : normalizeClassification1(raw),
    classification2: normalizeClassification2(raw)
  };
}

function dedupeCurriculumCourses(courses: CurriculumCourse[]): CurriculumCourse[] {
  const seen = new Set<string>();
  const results: CurriculumCourse[] = [];

  for (const course of courses) {
    const key = [
      course.yearLevel ?? '',
      course.semesterOrder ?? '',
      course.classification1,
      course.classification2,
      course.name,
      course.credit ?? ''
    ]
      .join('|')
      .toLowerCase();

    if (!course.name || seen.has(key)) continue;
    seen.add(key);
    results.push(course);
  }

  return results;
}

function dedupeCompletedCourses(courses: CompletedCourseAi[]): CompletedCourseAi[] {
  const seen = new Set<string>();
  const results: CompletedCourseAi[] = [];

  for (const course of courses) {
    const key = [
      course.yearTaken ?? '',
      course.termText,
      course.classification1,
      course.classification2,
      course.name,
      course.credit ?? '',
      course.gradeText,
      course.professor
    ]
      .join('|')
      .toLowerCase();

    if (!course.name || seen.has(key)) continue;
    seen.add(key);
    results.push(course);
  }

  return results;
}

function normalizeCurriculumPayload(value: unknown): {
  courses: CurriculumCourse[];
  graduationCredits: GraduationCredits;
} {
  const obj = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const rawCourses = Array.isArray(obj.courses) ? obj.courses : [];

  const courses = dedupeCurriculumCourses(
    rawCourses.map((item) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const classification = stringValue(row.classification);
      const parts = splitClassification(classification, 'curriculum');
      const classification1 = normalizeClassification1(stringValue(row.classification1) || parts.classification1);
      const classification2 = normalizeClassification2(stringValue(row.classification2) || parts.classification2);

      return {
        yearLevel: toIntOrNull(row.yearLevel),
        semesterOrder: toIntOrNull(row.semesterOrder),
        classification: combineClassification(classification1, classification2, classification),
        classification1,
        classification2,
        name: stringValue(row.name),
        credit: toIntOrNull(row.credit)
      } satisfies CurriculumCourse;
    })
  );

  const rawGrad = (obj.graduationCredits && typeof obj.graduationCredits === 'object'
    ? obj.graduationCredits
    : {}) as Record<string, unknown>;

  const graduationCredits: GraduationCredits = {
    기초교양: toIntOrNull(rawGrad['기초교양']),
    융합교양: toIntOrNull(rawGrad['융합교양']),
    계열교양: toIntOrNull(rawGrad['계열교양']),
    전공필수: toIntOrNull(rawGrad['전공필수']),
    전공선택: toIntOrNull(rawGrad['전공선택']),
    총학점: toIntOrNull(rawGrad['총학점'])
  };

  return { courses, graduationCredits };
}

function normalizeCompletedPayload(value: unknown): { courses: CompletedCourseAi[] } {
  const obj = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const rawCourses = Array.isArray(obj.courses) ? obj.courses : [];

  const courses = dedupeCompletedCourses(
    rawCourses.map((item) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const classification = stringValue(row.classification);
      const parts = splitClassification(classification, 'completed');
      const classification1 = normalizeClassification1(stringValue(row.classification1) || parts.classification1);
      const classification2 = normalizeClassification2(stringValue(row.classification2) || parts.classification2);

      return {
        yearTaken: toIntOrNull(row.yearTaken),
        termText: stringValue(row.termText),
        classification: combineClassification(classification1, classification2, classification),
        classification1,
        classification2,
        name: stringValue(row.name),
        credit: toIntOrNull(row.credit),
        gradeText: stringValue(row.gradeText),
        professor: stringValue(row.professor)
      } satisfies CompletedCourseAi;
    })
  );

  return { courses };
}

async function runVisionPrompt(
  prompt: string,
  images: AiImageInput[],
  route: '/api/ai-ocr/curriculum' | '/api/ai-ocr/completed'
): Promise<string> {
  const client = getClient();
  const model = getModel();

  const response = await client.responses.create({
    model,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          ...images.map((image) => ({
            type: 'input_image' as const,
            image_url: image.dataUrl,
            detail: 'high' as const
          }))
        ]
      }
    ]
  });

  const usageRecord = buildUsageRecord({
    route,
    model,
    usage: response.usage as {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
      input_tokens_details?: { cached_tokens?: number };
      output_tokens_details?: { reasoning_tokens?: number };
    } | null
  });

  appendUsageRecord(usageRecord);

  console.log(
    `[OpenAI Usage] route=${usageRecord.route} model=${usageRecord.model} input=${usageRecord.inputTokens} output=${usageRecord.outputTokens} total=${usageRecord.totalTokens} reasoning=${usageRecord.reasoningTokens} estimatedUsd=$${usageRecord.estimatedUsd.toFixed(6)}`
  );

  return response.output_text ?? '';
}

export async function analyzeCurriculumImages(args: {
  images: AiImageInput[];
  year?: number | null;
  major?: string | null;
  mode: 'courses' | 'graduation' | 'both';
}): Promise<{ courses: CurriculumCourse[]; graduationCredits: GraduationCredits; rawText: string }> {
  const context = `${args.year ? `기준 연도: ${args.year}\n` : ''}${args.major ? `전공명: ${args.major}\n` : ''}`;

  const prompt = `${context}
너는 한국 대학교 전공교육과정표를 구조화하는 추출기다.
입력은 가천대학교 요람 스크린샷이다.
반드시 유효한 JSON만 출력하고, 설명 문장이나 코드펜스는 절대 넣지 마라.

공통 규칙:
- 표의 소계, 합계 행은 courses에 넣지 마라.
- 학점은 반드시 '학점' 열 값만 사용하고, 이론/실습 숫자는 버려라.
- 과목명은 가능한 원문 그대로 복원하라.
- 값이 안 보이면 추측하지 말고 null 또는 빈 문자열로 남겨라.
- 이미지가 여러 장이면 중복 과목은 한 번만 남겨라.
- 같은 이미지 안에 1학기와 2학기가 함께 있으면 섞지 말고 각 과목에 올바른 학년/학기를 넣어라.
- 한 블록의 머리글에만 학년/학기가 보이면 그 블록의 모든 과목에 같은 값을 채워라.
- 이수구분은 가능한 아래 형식으로 나눠라. 줄임말이 보이면 전체 이름으로 복원하라. 예: 전필→전공필수, 전선→전공선택, 융교→융합교양, 기초→기초교양, 계교→계열교양.
  - classification1: 기초교양, 융합교양, 계열교양, 전공필수, 전공선택 중 하나
  - classification2: 인필, 인선 또는 빈 문자열
- classification에는 classification1/classification2를 합친 값을 넣어라. 예: 계열교양/인필

출력 형식:
{
  "courses": [
    {
      "yearLevel": 1,
      "semesterOrder": 1,
      "classification": "계열교양/인필",
      "classification1": "계열교양",
      "classification2": "인필",
      "name": "수학 1(MSC)",
      "credit": 3
    }
  ],
  "graduationCredits": {
    "기초교양": 17,
    "융합교양": 11,
    "계열교양": 24,
    "전공필수": 21,
    "전공선택": 51,
    "총학점": 130
  }
}

현재 작업 모드: ${args.mode}
- mode가 courses면 courses만 최대한 채우고 graduationCredits는 모두 null로 둬라.
- mode가 graduation이면 graduationCredits만 최대한 채우고 courses는 빈 배열로 둬라.
- mode가 both면 둘 다 채워라.`.trim();

  const rawText = await runVisionPrompt(prompt, args.images, '/api/ai-ocr/curriculum');
  const parsed = normalizeCurriculumPayload(extractJson(rawText));

  if (args.mode === 'courses') {
    return { courses: parsed.courses, graduationCredits: defaultGraduationCredits(), rawText };
  }

  if (args.mode === 'graduation') {
    return { courses: [], graduationCredits: parsed.graduationCredits, rawText };
  }

  return { ...parsed, rawText };
}

export async function analyzeCompletedImages(args: {
  images: AiImageInput[];
}): Promise<{ courses: CompletedCourseAi[]; rawText: string }> {
  const prompt = `너는 한국 대학교 수강내역표를 구조화하는 추출기다.
입력은 학생의 성적/이수내역 스크린샷이다.
반드시 유효한 JSON만 출력하고, 설명 문장이나 코드펜스는 절대 넣지 마라.

규칙:
- 과목 하나당 배열 원소 하나로 출력하라.
- 연도, 학기, 이수구분, 교과목명, 학점, 성적, 교수명을 읽어라.
- 이수구분이 계열교양/인필 같은 형태면 classification1, classification2로 나눠라.
- 줄임말을 보면 반드시 전체 이름으로 바꿔라. 예: 교필→교양필수, 교선→교양선택, 일선→일반선택, 전선→전공선택, 전필→전공필수, 융교→융합교양, 기초→기초교양, 계교→계열교양.
- 값이 보이지 않으면 추측하지 말고 null 또는 빈 문자열로 남겨라.
- 중복된 행은 한 번만 남겨라.
- 성적은 A+, A0, B+, B0, C+, C0, D+, D0, F, P, NP 등 원문에 가깝게 적어라.

출력 형식:
{
  "courses": [
    {
      "yearTaken": 2025,
      "termText": "1학기",
      "classification": "전공선택/인선",
      "classification1": "전공선택",
      "classification2": "인선",
      "name": "알고리즘",
      "credit": 3,
      "gradeText": "A0",
      "professor": "윤유림"
    }
  ]
}`.trim();

  const rawText = await runVisionPrompt(prompt, args.images, '/api/ai-ocr/completed');
  const parsed = normalizeCompletedPayload(extractJson(rawText));
  return { ...parsed, rawText };
}
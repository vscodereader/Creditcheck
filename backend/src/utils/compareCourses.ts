import { normalizeCourseCode, normalizeText } from './normalize.js';

export type CourseInput = {
  id?: string | null;
  courseCode?: string | null;
  name: string;
  credit?: number | null;
  classification?: string | null;
  classification1?: string | null;
  classification2?: string | null;
  yearLevel?: number | null;
  semesterOrder?: number | null;
  yearTaken?: number | null;
  termText?: string | null;
  gradeText?: string | null;
  professor?: string | null;
  isRequired?: boolean;
};

export type CompareCourseRow = {
  id: string;
  sourceCourseId?: string | null;
  yearLabel: string;
  termLabel: string;
  classification1: string;
  classification2: string;
  name: string;
  credit: number | null;
  gradeText: string;
  professor: string;
  matchedBy?: 'courseCode' | 'courseName';
};

export type CompareResult = {
  summary: {
    coreRequiredCourses: number;
    matchedCoreCourses: number;
    missingCoreCourses: number;
    matchedSelectiveCourses: number;
    extraCompletedCourses: number;
  };
  matchedCore: CompareCourseRow[];
  missingCore: CompareCourseRow[];
  matchedSelective: CompareCourseRow[];
  extraCompleted: CompareCourseRow[];
};

const CORE_CLASSIFICATIONS = new Set(['기초교양', '계열교양', '전공필수']);
const SELECTIVE_CLASSIFICATIONS = new Set(['전공선택']);

type IndexedCompletedCourse = {
  original: CourseInput;
  codeKey: string;
  nameKey: string;
};

export function compareCourses(requiredCourses: CourseInput[], completedCourses: CourseInput[]): CompareResult {
  const indexedCompleted = completedCourses.map((course) => ({
    original: course,
    codeKey: normalizeCourseCode(course.courseCode),
    nameKey: normalizeText(course.name)
  }));

  const usedCompleted = new Set<number>();
  const matchedCore: CompareCourseRow[] = [];
  const matchedSelective: CompareCourseRow[] = [];
  const missingCore: CompareCourseRow[] = [];

  const sortedRequired = [...requiredCourses].sort(sortRequiredCourses);

  for (const requiredCourse of sortedRequired) {
    const class1 = (requiredCourse.classification1 ?? '').trim();
    const isCore = CORE_CLASSIFICATIONS.has(class1);
    const isSelective = SELECTIVE_CLASSIFICATIONS.has(class1);

    if (!isCore && !isSelective) {
      continue;
    }

    const match = findBestMatch(requiredCourse, indexedCompleted, usedCompleted);
    if (match) {
      usedCompleted.add(match.index);
      const row = toMatchedRow(requiredCourse, match.course, match.matchedBy);
      if (isCore) matchedCore.push(row);
      if (isSelective) matchedSelective.push(row);
      continue;
    }

    if (isCore) {
      missingCore.push(toMissingRow(requiredCourse));
    }
  }

  const extraCompleted = indexedCompleted
    .filter((_, index) => !usedCompleted.has(index))
    .map(({ original }) => toExtraRow(original))
    .sort(sortCompareRows);

  return {
    summary: {
      coreRequiredCourses: matchedCore.length + missingCore.length,
      matchedCoreCourses: matchedCore.length,
      missingCoreCourses: missingCore.length,
      matchedSelectiveCourses: matchedSelective.length,
      extraCompletedCourses: extraCompleted.length
    },
    matchedCore: matchedCore.sort(sortCompareRows),
    missingCore: missingCore.sort(sortCompareRows),
    matchedSelective: matchedSelective.sort(sortCompareRows),
    extraCompleted
  };
}

function findBestMatch(requiredCourse: CourseInput, indexedCompleted: IndexedCompletedCourse[], usedCompleted: Set<number>) {
  const requiredCode = normalizeCourseCode(requiredCourse.courseCode);
  const requiredName = normalizeText(requiredCourse.name);

  if (requiredCode) {
    const byCodeIndex = indexedCompleted.findIndex((course, index) => !usedCompleted.has(index) && course.codeKey && course.codeKey === requiredCode);
    if (byCodeIndex >= 0) {
      return { index: byCodeIndex, course: indexedCompleted[byCodeIndex].original, matchedBy: 'courseCode' as const };
    }
  }

  if (requiredName) {
    const byNameIndex = indexedCompleted.findIndex((course, index) => !usedCompleted.has(index) && course.nameKey && course.nameKey === requiredName);
    if (byNameIndex >= 0) {
      return { index: byNameIndex, course: indexedCompleted[byNameIndex].original, matchedBy: 'courseName' as const };
    }
  }

  return null;
}

function toMatchedRow(requiredCourse: CourseInput, completedCourse: CourseInput, matchedBy: 'courseCode' | 'courseName'): CompareCourseRow {
  return {
    id: `${requiredCourse.id ?? requiredCourse.name}-${completedCourse.id ?? completedCourse.name}`,
    sourceCourseId: requiredCourse.id ?? null,
    yearLabel: requiredCourse.yearLevel != null ? String(requiredCourse.yearLevel) : '',
    termLabel: requiredCourse.semesterOrder != null ? String(requiredCourse.semesterOrder) : '',
    classification1: (requiredCourse.classification1 ?? '').trim(),
    classification2: (requiredCourse.classification2 ?? '').trim(),
    name: requiredCourse.name,
    credit: requiredCourse.credit ?? completedCourse.credit ?? null,
    gradeText: (completedCourse.gradeText ?? '').trim(),
    professor: (completedCourse.professor ?? '').trim(),
    matchedBy
  };
}

function toMissingRow(requiredCourse: CourseInput): CompareCourseRow {
  return {
    id: String(requiredCourse.id ?? requiredCourse.name),
    sourceCourseId: requiredCourse.id ?? null,
    yearLabel: requiredCourse.yearLevel != null ? String(requiredCourse.yearLevel) : '',
    termLabel: requiredCourse.semesterOrder != null ? String(requiredCourse.semesterOrder) : '',
    classification1: (requiredCourse.classification1 ?? '').trim(),
    classification2: (requiredCourse.classification2 ?? '').trim(),
    name: requiredCourse.name,
    credit: requiredCourse.credit ?? null,
    gradeText: '',
    professor: ''
  };
}

function toExtraRow(completedCourse: CourseInput): CompareCourseRow {
  return {
    id: String(completedCourse.id ?? completedCourse.name),
    sourceCourseId: completedCourse.id ?? null,
    yearLabel: completedCourse.yearTaken != null ? String(completedCourse.yearTaken) : '',
    termLabel: (completedCourse.termText ?? '').trim(),
    classification1: (completedCourse.classification1 ?? '').trim(),
    classification2: (completedCourse.classification2 ?? '').trim(),
    name: completedCourse.name,
    credit: completedCourse.credit ?? null,
    gradeText: (completedCourse.gradeText ?? '').trim(),
    professor: (completedCourse.professor ?? '').trim()
  };
}

function sortRequiredCourses(a: CourseInput, b: CourseInput): number {
  const yearDiff = (a.yearLevel ?? 999) - (b.yearLevel ?? 999);
  if (yearDiff !== 0) return yearDiff;
  const semesterDiff = (a.semesterOrder ?? 999) - (b.semesterOrder ?? 999);
  if (semesterDiff !== 0) return semesterDiff;
  return a.name.localeCompare(b.name, 'ko');
}

function sortCompareRows(a: CompareCourseRow, b: CompareCourseRow): number {
  const yearA = parseInt(a.yearLabel, 10);
  const yearB = parseInt(b.yearLabel, 10);
  const yearDiff = (Number.isFinite(yearA) ? yearA : 999) - (Number.isFinite(yearB) ? yearB : 999);
  if (yearDiff !== 0) return yearDiff;

  const termA = parseInt(a.termLabel, 10);
  const termB = parseInt(b.termLabel, 10);
  const termDiff = (Number.isFinite(termA) ? termA : 999) - (Number.isFinite(termB) ? termB : 999);
  if (termDiff !== 0) return termDiff;

  return a.name.localeCompare(b.name, 'ko');
}

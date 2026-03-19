import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
import {
  combineClassification,
  completedClassification1Options,
  completedClassification2Options,
  curriculumClassification1Options,
  curriculumClassification2Options,
  emptyCompletedCourseRow,
  emptyGraduationCredits,
  emptyRequiredCourseRow,
  formatCompletedText,
  formatCourseText,
  formatGraduationText,
  graduationLabels,
  normalizeClassification1,
  normalizeClassification2,
  numberOrUndefined,
  parseCompletedText,
  parseCourseText,
  parseGraduationText,
  prepareImagesForUpload,
  splitFreeClassification,
  toNumberOrEmpty,
  type CompletedCourseRow,
  type GraduationCredits,
  type RequiredCourseRow
} from './ocrUtils';

const API_BASE = 'http://localhost:4000/api';

type SourceItem = {
  id: string;
  title: string;
  category: string;
  year: number | null;
  sourceUrl: string;
};

type CatalogItem = {
  id: string;
  year: number;
  major: string;
};

type CompletedSetItem = {
  id: string;
  title: string;
  studentName?: string | null;
};

type CompareCourseRow = {
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

type CompareResponse = {
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

type CurriculumAiResponse = {
  courses: Array<{
    yearLevel: number | null;
    semesterOrder: number | null;
    classification?: string;
    classification1?: string;
    classification2?: string;
    name: string;
    credit: number | null;
  }>;
  graduationCredits: Record<string, number | null>;
  rawText: string;
};

type CompletedAiResponse = {
  courses: Array<{
    yearTaken: number | null;
    termText: string;
    classification?: string;
    classification1?: string;
    classification2?: string;
    name: string;
    credit: number | null;
    gradeText: string;
    professor: string;
  }>;
  rawText: string;
};

type GridColumn<Row extends Record<string, unknown>> = {
  key: Extract<keyof Row, string>;
  label: string;
  type: 'int' | 'text' | 'select';
  options?: string[];
  width?: string;
  filterable?: boolean;
};

type CellCoord<Row extends Record<string, unknown>> = {
  rowIndex: number;
  key: Extract<keyof Row, string>;
};

function App() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const [sources, setSources] = useState<SourceItem[]>([]);
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([]);
  const [completedSets, setCompletedSets] = useState<CompletedSetItem[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [selectedCompletedSetId, setSelectedCompletedSetId] = useState('');
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null);

  const [curriculumYear, setCurriculumYear] = useState('2025');
  const [curriculumMajor, setCurriculumMajor] = useState('컴퓨터공학전공');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedSourceUrl, setSelectedSourceUrl] = useState('');
  const [curriculumCourseFiles, setCurriculumCourseFiles] = useState<File[]>([]);
  const [curriculumGraduationFiles, setCurriculumGraduationFiles] = useState<File[]>([]);
  const [courseText, setCourseText] = useState('');
  const [graduationText, setGraduationText] = useState('');
  const [courseRows, setCourseRows] = useState<RequiredCourseRow[]>([]);
  const [graduationValues, setGraduationValues] = useState<GraduationCredits>(emptyGraduationCredits());

  const [completedTitle, setCompletedTitle] = useState('내 이수내역');
  const [studentName, setStudentName] = useState('');
  const [studentNo, setStudentNo] = useState('');
  const [completedFiles, setCompletedFiles] = useState<File[]>([]);
  const [completedText, setCompletedText] = useState('');
  const [completedRows, setCompletedRows] = useState<CompletedCourseRow[]>([]);

  const majorSources = useMemo(() => sources.filter((item) => item.category === 'major'), [sources]);

  useEffect(() => {
    void refreshCatalogs();
    void refreshCompletedSets();
  }, []);

  const courseColumns: GridColumn<RequiredCourseRow>[] = [
    { key: 'yearLevel', label: '학년', type: 'int', width: '90px' },
    { key: 'semesterOrder', label: '학기', type: 'int', width: '90px' },
    {
      key: 'classification1',
      label: '이수구분1',
      type: 'select',
      width: '150px',
      options: [...curriculumClassification1Options],
      filterable: true
    },
    {
      key: 'classification2',
      label: '이수구분2',
      type: 'select',
      width: '120px',
      options: ['', ...curriculumClassification2Options],
      filterable: true
    },
    { key: 'name', label: '교과목명', type: 'text', width: '320px' },
    { key: 'credit', label: '학점', type: 'int', width: '90px' }
  ];

  const completedColumns: GridColumn<CompletedCourseRow>[] = [
    { key: 'yearTaken', label: '연도', type: 'int', width: '100px' },
    { key: 'termText', label: '학기', type: 'text', width: '120px', filterable: true },
    {
      key: 'classification1',
      label: '이수구분1',
      type: 'select',
      width: '150px',
      options: ['', ...completedClassification1Options],
      filterable: true
    },
    {
      key: 'classification2',
      label: '이수구분2',
      type: 'select',
      width: '120px',
      options: ['', ...completedClassification2Options],
      filterable: true
    },
    { key: 'name', label: '교과목명', type: 'text', width: '260px' },
    { key: 'credit', label: '학점', type: 'int', width: '90px' },
    { key: 'gradeText', label: '성적', type: 'text', width: '90px', filterable: true },
    { key: 'professor', label: '교수명', type: 'text', width: '150px' }
  ];

  const compareColumns: GridColumn<CompareCourseRow>[] = [
    { key: 'yearLabel', label: '학년/연도', type: 'text', width: '100px', filterable: true },
    { key: 'termLabel', label: '학기', type: 'text', width: '110px', filterable: true },
    { key: 'classification1', label: '이수구분1', type: 'text', width: '150px', filterable: true },
    { key: 'classification2', label: '이수구분2', type: 'text', width: '120px', filterable: true },
    { key: 'name', label: '교과목명', type: 'text', width: '280px' },
    { key: 'credit', label: '학점', type: 'text', width: '90px' },
    { key: 'gradeText', label: '성적', type: 'text', width: '90px', filterable: true },
    { key: 'professor', label: '교수명', type: 'text', width: '150px' }
  ];

  async function refreshSources() {
    setBusy('sources');
    try {
      const data = await requestJson<{ items: SourceItem[] }>(`${API_BASE}/sources/gachon/refresh?category=major`, {
        method: 'POST'
      });
      setSources(data.items);
      setMessage('전공교육과정 링크를 새로 가져왔습니다.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function refreshCatalogs() {
    const data = await requestJson<{ items: CatalogItem[] }>(`${API_BASE}/catalogs`);
    setCatalogs(data.items);
  }

  async function refreshCompletedSets() {
    const data = await requestJson<{ items: CompletedSetItem[] }>(`${API_BASE}/completed-sets`);
    setCompletedSets(data.items);
  }

  function onChangeSource(sourceId: string) {
    setSelectedSourceId(sourceId);
    if (!sourceId) {
      setSelectedSourceUrl('');
      return;
    }
    const found = majorSources.find((item) => item.id === sourceId);
    if (!found) return;
    setSelectedSourceUrl(found.sourceUrl);
    if (found.year) setCurriculumYear(String(found.year));
  }

  async function runCurriculumAi(mode: 'courses' | 'graduation') {
    const files = mode === 'graduation' ? (curriculumGraduationFiles.length > 0 ? curriculumGraduationFiles : curriculumCourseFiles) : curriculumCourseFiles;
    if (files.length === 0) {
      setMessage(mode === 'graduation' ? '졸업이수학점 스크린샷을 먼저 선택하세요.' : '전공교육과정 스크린샷을 먼저 선택하세요.');
      return;
    }

    setBusy(`curriculum-${mode}`);
    try {
      const images = await prepareImagesForUpload(files, true);
      const data = await requestJson<CurriculumAiResponse>(`${API_BASE}/ai-ocr/curriculum`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images,
          year: curriculumYear,
          major: curriculumMajor,
          mode
        })
      });

      if (mode === 'courses') {
        const rows: RequiredCourseRow[] = data.courses.map((course) => {
          const class1 = normalizeClassification1(course.classification1 ?? '');
          const class2 = normalizeClassification2(course.classification2 ?? '');
          return {
            yearLevel: course.yearLevel ?? '',
            semesterOrder: course.semesterOrder ?? '',
            classification1: class1,
            classification2: class2,
            name: course.name ?? '',
            credit: course.credit ?? ''
          };
        });
        setCourseRows(rows);
        setCourseText(formatCourseText(rows));
        setMessage('AI가 전공 과목을 추출했습니다. 텍스트를 검수한 뒤 표에 반영하거나 표에서 직접 수정하세요.');
      } else {
        const values = emptyGraduationCredits();
        graduationLabels.forEach((label) => {
          values[label] = data.graduationCredits[label] ?? '';
        });
        setGraduationValues(values);
        setGraduationText(formatGraduationText(values));
        setMessage('AI가 졸업이수학점을 추출했습니다. 텍스트를 검수한 뒤 표에 반영하거나 표에서 직접 수정하세요.');
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function reflectCourseText() {
    const rows = parseCourseText(courseText);
    setCourseRows(rows);
    setMessage(`과목 OCR 텍스트를 표에 반영했습니다. (${rows.length}개)`);
  }

  function reflectGraduationText() {
    const values = parseGraduationText(graduationText);
    setGraduationValues(values);
    setMessage('졸업이수학점 OCR 텍스트를 표에 반영했습니다.');
  }

  async function saveCatalog() {
    const validCourses = courseRows.filter((row) => row.name.trim());
    if (!curriculumYear.trim() || !curriculumMajor.trim() || validCourses.length === 0) {
      setMessage('연도, 전공명, 전공 과목 표를 확인하세요.');
      return;
    }

    setBusy('save-catalog');
    try {
      const saved = await requestJson<{ id: string }>(`${API_BASE}/catalogs/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: curriculumYear,
          major: curriculumMajor,
          sourceId: selectedSourceId || undefined,
          sourceUrl: selectedSourceUrl || undefined,
          courses: validCourses.map((row) => ({
            yearLevel: numberOrUndefined(row.yearLevel),
            semesterOrder: numberOrUndefined(row.semesterOrder),
            semesterText: row.yearLevel !== '' && row.semesterOrder !== '' ? `${row.yearLevel}-${row.semesterOrder}` : undefined,
            classification1: normalizeClassification1(row.classification1),
            classification2: normalizeClassification2(row.classification2),
            classification: combineClassification(row.classification1, row.classification2),
            name: row.name,
            credit: numberOrUndefined(row.credit)
          })),
          graduationRequirements: graduationLabels.map((label, index) => ({
            section: '졸업이수학점',
            label,
            credits: graduationValues[label] === '' ? undefined : graduationValues[label],
            sortOrder: index
          }))
        })
      });
      await refreshCatalogs();
      setSelectedCatalogId(saved.id);
      setMessage('전공교육과정을 DB에 저장했습니다.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function runCompletedAi() {
    if (completedFiles.length === 0) {
      setMessage('이수내역 스크린샷을 먼저 선택하세요.');
      return;
    }

    setBusy('completed-ocr');
    try {
      const images = await prepareImagesForUpload(completedFiles, false);
      const data = await requestJson<CompletedAiResponse>(`${API_BASE}/ai-ocr/completed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images })
      });

      const rows: CompletedCourseRow[] = data.courses.map((course) => {
        const parts = course.classification1 || course.classification2
          ? {
              classification1: normalizeClassification1(course.classification1 ?? ''),
              classification2: normalizeClassification2(course.classification2 ?? '')
            }
          : splitFreeClassification(course.classification ?? '');
        return {
          yearTaken: course.yearTaken ?? '',
          termText: course.termText ?? '',
          classification1: parts.classification1,
          classification2: parts.classification2,
          name: course.name ?? '',
          credit: course.credit ?? '',
          gradeText: course.gradeText ?? '',
          professor: course.professor ?? ''
        };
      });
      setCompletedRows(rows);
      setCompletedText(formatCompletedText(rows));
      setMessage('AI가 이수내역을 추출했습니다. 텍스트를 검수한 뒤 표에 반영하거나 표에서 직접 수정하세요.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function reflectCompletedText() {
    const rows = parseCompletedText(completedText);
    setCompletedRows(rows);
    setMessage(`이수내역 OCR 텍스트를 표에 반영했습니다. (${rows.length}개)`);
  }

  async function saveCompletedSet() {
    const validCourses = completedRows.filter((row) => row.name.trim());
    if (!completedTitle.trim() || validCourses.length === 0) {
      setMessage('이수내역 이름과 과목 표를 확인하세요.');
      return;
    }

    setBusy('save-completed');
    try {
      const saved = await requestJson<{ id: string }>(`${API_BASE}/completed-sets/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: completedTitle,
          studentName,
          studentNo,
          courses: validCourses.map((row) => ({
            yearTaken: numberOrUndefined(row.yearTaken),
            termText: row.termText,
            classification1: normalizeClassification1(row.classification1),
            classification2: normalizeClassification2(row.classification2),
            classification: combineClassification(row.classification1, row.classification2),
            name: row.name,
            credit: numberOrUndefined(row.credit),
            gradeText: row.gradeText,
            professor: row.professor
          }))
        })
      });
      await refreshCompletedSets();
      setSelectedCompletedSetId(saved.id);
      setMessage('이수내역을 DB에 저장했습니다.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function compareSelected() {
    if (!selectedCatalogId || !selectedCompletedSetId) {
      setMessage('비교할 전공교육과정과 이수내역을 모두 선택하세요.');
      return;
    }

    setBusy('compare');
    try {
      const data = await requestJson<CompareResponse>(`${API_BASE}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogId: selectedCatalogId, completedSetId: selectedCompletedSetId })
      });
      setCompareResult(data);
      setMessage('비교를 완료했습니다.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function markMissingAsCompleted(rowId: string) {
    setCompareResult((prev) => {
      if (!prev) return prev;
      const target = prev.missingCore.find((row) => row.id === rowId);
      if (!target) return prev;
      const nextMissing = prev.missingCore.filter((row) => row.id !== rowId);
      const nextMatched = [...prev.matchedCore, { ...target, gradeText: target.gradeText || '수동이수', professor: target.professor || '' }].sort(sortCompareRows);
      return {
        ...prev,
        summary: {
          ...prev.summary,
          matchedCoreCourses: prev.summary.matchedCoreCourses + 1,
          missingCoreCourses: Math.max(0, prev.summary.missingCoreCourses - 1)
        },
        matchedCore: nextMatched,
        missingCore: nextMissing
      };
    });
    setMessage('선택한 미이수 과목을 이수과목 표로 옮겼습니다. 필요하면 저장된 원본 데이터를 함께 수정하세요.');
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <div className="eyebrow">Gachon OpenAI OCR Compare</div>
          <h1>가천대 전공교육과정 AI OCR 비교기</h1>
          <p>AI OCR 결과를 텍스트로 검수하고, 엑셀 같은 표에서 직접 수정한 뒤 DB에 저장하고 비교한다.</p>
        </div>
        <div className="hero-card">
          <div className="hero-label">DB 위치</div>
          <div className="hero-value">backend/prisma/dev.db</div>
          <div className="hero-sub">VS Code 터미널에서 npm run db:studio</div>
        </div>
      </header>

      {message ? <div className="message">{message}</div> : null}

      <section className="card">
        <div className="section-head">
          <div>
            <h2>1. 전공교육과정 링크</h2>
            <p>가천대 요람에서 전공교육과정 링크만 가져온다.</p>
          </div>
          <button className="primary" onClick={() => void refreshSources()} disabled={busy === 'sources'}>
            {busy === 'sources' ? '가져오는 중...' : '전공 링크 가져오기'}
          </button>
        </div>
        <div className="table-wrap">
          <table className="simple-table">
            <thead>
              <tr>
                <th>연도</th>
                <th>제목</th>
                <th>링크</th>
              </tr>
            </thead>
            <tbody>
              {majorSources.length === 0 ? (
                <tr>
                  <td colSpan={3}>아직 링크가 없습니다.</td>
                </tr>
              ) : (
                majorSources.map((item) => (
                  <tr key={item.id}>
                    <td>{item.year ?? '-'}</td>
                    <td>{item.title}</td>
                    <td>
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                        열기
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <h2>2. 전공교육과정 AI OCR</h2>
            <p>텍스트에서 반영하거나, 표 셀을 클릭 후 더블클릭해서 직접 수정할 수 있다.</p>
          </div>
        </div>

        <div className="grid three compact-grid">
          <label>
            <span>요람 링크</span>
            <select value={selectedSourceId} onChange={(event) => onChangeSource(event.target.value)}>
              <option value="">직접 입력</option>
              {majorSources.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.year ?? '-'} / {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>연도</span>
            <input value={curriculumYear} onChange={(event) => setCurriculumYear(event.target.value)} />
          </label>
          <label>
            <span>전공명</span>
            <input value={curriculumMajor} onChange={(event) => setCurriculumMajor(event.target.value)} />
          </label>
        </div>

        <div className="grid two top-gap">
          <div className="upload-box">
            <div className="upload-title">과목표 스크린샷</div>
            <input type="file" accept="image/*" multiple onChange={(event) => setCurriculumCourseFiles(Array.from(event.target.files ?? []))} />
            <div className="file-count">{curriculumCourseFiles.length}개 선택됨</div>
            <button className="primary" onClick={() => void runCurriculumAi('courses')} disabled={busy === 'curriculum-courses'}>
              {busy === 'curriculum-courses' ? 'AI 분석 중...' : '과목 AI OCR 실행'}
            </button>
          </div>
          <div className="upload-box">
            <div className="upload-title">졸업이수학점 스크린샷</div>
            <input type="file" accept="image/*" multiple onChange={(event) => setCurriculumGraduationFiles(Array.from(event.target.files ?? []))} />
            <div className="file-count">
              {curriculumGraduationFiles.length > 0 ? `${curriculumGraduationFiles.length}개 선택됨` : '없으면 과목표 스크린샷을 그대로 사용'}
            </div>
            <button className="secondary" onClick={() => void runCurriculumAi('graduation')} disabled={busy === 'curriculum-graduation'}>
              {busy === 'curriculum-graduation' ? 'AI 분석 중...' : '졸업이수학점 AI OCR 실행'}
            </button>
          </div>
        </div>

        <div className="grid two top-gap">
          <div>
            <div className="subhead-row">
              <h3>과목 OCR 결과</h3>
              <button className="ghost" onClick={reflectCourseText}>과목표에 반영</button>
            </div>
            <p className="hint">한 줄에 과목 1개씩. 형식: 학년 / 학기 / 이수구분1/이수구분2 / 교과목명 / 학점</p>
            <textarea value={courseText} onChange={(event) => setCourseText(event.target.value)} rows={12} />
          </div>
          <div>
            <div className="subhead-row">
              <h3>졸업이수학점 OCR 결과</h3>
              <button className="ghost" onClick={reflectGraduationText}>이수학점표에 반영</button>
            </div>
            <p className="hint">형식: 기초교양 / 17 / 융합교양 / 11 / 계열교양 / 24 / 전공필수 / 21 / 전공선택 / 51 / 총학점 / 130</p>
            <textarea value={graduationText} onChange={(event) => setGraduationText(event.target.value)} rows={12} />
          </div>
        </div>

        <div className="subhead-row top-gap">
          <h3>전공 과목 표</h3>
          <button className="ghost" onClick={() => setCourseRows((prev) => [...prev, emptyRequiredCourseRow()])}>행 추가</button>
        </div>
        <SpreadsheetTable columns={courseColumns} rows={courseRows} setRows={setCourseRows} emptyText="과목 AI OCR을 실행한 뒤 텍스트를 검수하고 반영하세요." visibleRowCount={10} filterable />

        <h3 className="top-gap">졸업이수학점 표</h3>
        <GraduationSheet values={graduationValues} onChange={setGraduationValues} />

        <div className="actions top-gap">
          <button className="primary" onClick={() => void saveCatalog()} disabled={busy === 'save-catalog'}>
            {busy === 'save-catalog' ? '저장 중...' : '전공교육과정 DB 저장'}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <h2>3. 이수내역 AI OCR</h2>
            <p>이수내역도 같은 방식으로 텍스트 검수 후 표 셀을 직접 수정해서 저장한다.</p>
          </div>
        </div>

        <div className="grid three compact-grid">
          <label>
            <span>이수내역 이름</span>
            <input value={completedTitle} onChange={(event) => setCompletedTitle(event.target.value)} />
          </label>
          <label>
            <span>학생 이름</span>
            <input value={studentName} onChange={(event) => setStudentName(event.target.value)} />
          </label>
          <label>
            <span>학번</span>
            <input value={studentNo} onChange={(event) => setStudentNo(event.target.value)} />
          </label>
        </div>

        <div className="upload-box top-gap">
          <div className="upload-title">이수내역 스크린샷</div>
          <input type="file" accept="image/*" multiple onChange={(event) => setCompletedFiles(Array.from(event.target.files ?? []))} />
          <div className="file-count">{completedFiles.length}개 선택됨</div>
          <button className="primary" onClick={() => void runCompletedAi()} disabled={busy === 'completed-ocr'}>
            {busy === 'completed-ocr' ? 'AI 분석 중...' : '이수내역 AI OCR 실행'}
          </button>
        </div>

        <div className="subhead-row top-gap">
          <h3>이수내역 OCR 결과</h3>
          <button className="ghost" onClick={reflectCompletedText}>이수내역표에 반영</button>
        </div>
        <p className="hint">한 줄에 과목 1개씩. 형식: 연도 / 학기 / 이수구분1/이수구분2 / 교과목명 / 학점 / 성적 / 교수명</p>
        <textarea value={completedText} onChange={(event) => setCompletedText(event.target.value)} rows={12} />

        <div className="subhead-row top-gap">
          <h3>이수내역 표</h3>
          <button className="ghost" onClick={() => setCompletedRows((prev) => [...prev, emptyCompletedCourseRow()])}>행 추가</button>
        </div>
        <SpreadsheetTable columns={completedColumns} rows={completedRows} setRows={setCompletedRows} emptyText="이수내역 AI OCR을 실행한 뒤 텍스트를 검수하고 반영하세요." visibleRowCount={10} filterable />

        <div className="actions top-gap">
          <button className="primary" onClick={() => void saveCompletedSet()} disabled={busy === 'save-completed'}>
            {busy === 'save-completed' ? '저장 중...' : '이수내역 DB 저장'}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <h2>4. 저장된 데이터 비교</h2>
            <p>DB에 저장된 전공교육과정과 이수내역 세트를 선택해서 비교한다.</p>
          </div>
          <button className="primary" onClick={() => void compareSelected()} disabled={busy === 'compare'}>
            {busy === 'compare' ? '비교 중...' : '비교 실행'}
          </button>
        </div>

        <div className="grid two compact-grid">
          <label>
            <span>전공교육과정</span>
            <select value={selectedCatalogId} onChange={(event) => setSelectedCatalogId(event.target.value)}>
              <option value="">선택하세요</option>
              {catalogs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.year} / {item.major}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>이수내역 세트</span>
            <select value={selectedCompletedSetId} onChange={(event) => setSelectedCompletedSetId(event.target.value)}>
              <option value="">선택하세요</option>
              {completedSets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                  {item.studentName ? ` / ${item.studentName}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        {compareResult ? (
          <div className="compare-box top-gap">
            <div className="compare-summary compare-summary--4">
              <div>이수과목(제1학과): {compareResult.summary.matchedCoreCourses}</div>
              <div>미이수 과목(제1학과): {compareResult.summary.missingCoreCourses}</div>
              <div>선택 이수 과목(제1학과): {compareResult.summary.matchedSelectiveCourses}</div>
              <div>추가 이수 과목: {compareResult.summary.extraCompletedCourses}</div>
            </div>

            <div className="top-gap">
              <h3>이수과목(제1학과)</h3>
              <ReadonlySpreadsheetTable columns={compareColumns} rows={compareResult.matchedCore} visibleRowCount={10} emptyText="일치한 이수과목이 없습니다." filterable />
            </div>

            <div className="top-gap">
              <h3>미이수 과목(제1학과)</h3>
              <ReadonlySpreadsheetTable
                columns={compareColumns}
                rows={compareResult.missingCore}
                visibleRowCount={10}
                emptyText="미이수 과목이 없습니다."
                filterable
                actionLabel="이수"
                onAction={(row) => markMissingAsCompleted(row.id)}
              />
            </div>

            <div className="top-gap">
              <h3>선택 이수 과목(제1학과)</h3>
              <ReadonlySpreadsheetTable columns={compareColumns} rows={compareResult.matchedSelective} visibleRowCount={10} emptyText="선택 이수 과목이 없습니다." filterable />
            </div>

            <div className="top-gap">
              <h3>추가 이수 과목</h3>
              <ReadonlySpreadsheetTable columns={compareColumns} rows={compareResult.extraCompleted} visibleRowCount={10} emptyText="추가 이수 과목이 없습니다." filterable />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function GraduationSheet({ values, onChange }: { values: GraduationCredits; onChange: (next: GraduationCredits) => void }) {
  const columns = graduationLabels.map((label) => ({ key: label, label, type: 'int' as const, width: '140px' }));
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);

  function commit(key: keyof GraduationCredits, value: string) {
    onChange({ ...values, [key]: toNumberOrEmpty(value) });
    setEditingCell(null);
  }

  return (
    <div className="sheet-shell sheet-shell--graduation">
      <div className="sheet-scroll graduation-scroll">
        <table className="sheet-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {columns.map((column) => {
                const key = column.key as keyof GraduationCredits;
                const cellId = `graduation-${column.key}`;
                const value = values[key];
                const isSelected = selectedCell === cellId;
                const isEditing = editingCell === cellId;
                return (
                  <td key={column.key} style={{ minWidth: column.width }}>
                    {isEditing ? (
                      <input
                        className="cell-input"
                        type="number"
                        step="1"
                        autoFocus
                        defaultValue={value === '' ? '' : String(value)}
                        onBlur={(event) => commit(key, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') commit(key, (event.target as HTMLInputElement).value);
                          if (event.key === 'Escape') setEditingCell(null);
                        }}
                      />
                    ) : (
                      <div
                        className={`sheet-cell ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedCell(cellId)}
                        onDoubleClick={() => {
                          setSelectedCell(cellId);
                          setEditingCell(cellId);
                        }}
                      >
                        {value === '' ? '' : value}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SpreadsheetTable<Row extends Record<string, unknown>>({
  columns,
  rows,
  setRows,
  emptyText,
  visibleRowCount,
  filterable
}: {
  columns: GridColumn<Row>[];
  rows: Row[];
  setRows: Dispatch<SetStateAction<Row[]>>;
  emptyText: string;
  visibleRowCount: number;
  filterable?: boolean;
}) {
  const [selectedCell, setSelectedCell] = useState<CellCoord<Row> | null>(null);
  const [editingCell, setEditingCell] = useState<CellCoord<Row> | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filteredRows = useMemo(() => {
    return rows
      .map((row, rowIndex) => ({ row, rowIndex }))
      .filter(({ row }) =>
        columns.every((column) => {
          const filterValue = filters[column.key] ?? '';
          if (!filterValue) return true;
          return String(row[column.key] ?? '') === filterValue;
        })
      );
  }, [columns, filters, rows]);

  function updateRow(rowIndex: number, key: Extract<keyof Row, string>, nextValue: unknown) {
    setRows((prev) => prev.map((row, index) => (index === rowIndex ? { ...row, [key]: nextValue } : row)));
  }

  function removeRow(rowIndex: number) {
    setRows((prev) => prev.filter((_, index) => index !== rowIndex));
  }

  return (
    <div className="sheet-shell">
      {filterable ? <FilterBar columns={columns} rows={rows} filters={filters} onChange={setFilters} /> : null}
      <div className="sheet-scroll" style={{ maxHeight: `${visibleRowCount * 56 + 52}px` }}>
        <table className="sheet-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} style={{ minWidth: column.width }}>{column.label}</th>
              ))}
              <th style={{ width: '86px' }}>삭제</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="empty-cell">{emptyText}</td>
              </tr>
            ) : (
              filteredRows.map(({ row, rowIndex }) => (
                <tr key={rowIndex}>
                  {columns.map((column) => {
                    const isSelected = selectedCell?.rowIndex === rowIndex && selectedCell.key === column.key;
                    const isEditing = editingCell?.rowIndex === rowIndex && editingCell.key === column.key;
                    const cellValue = row[column.key];
                    return (
                      <td key={column.key} style={{ minWidth: column.width }}>
                        {isEditing ? (
                          <EditableCell
                            column={column}
                            value={cellValue}
                            onCommit={(value) => updateRow(rowIndex, column.key, value)}
                            onCancel={() => setEditingCell(null)}
                          />
                        ) : (
                          <div
                            className={`sheet-cell ${isSelected ? 'selected' : ''}`}
                            onClick={() => setSelectedCell({ rowIndex, key: column.key })}
                            onDoubleClick={() => {
                              setSelectedCell({ rowIndex, key: column.key });
                              setEditingCell({ rowIndex, key: column.key });
                            }}
                          >
                            {String(cellValue ?? '')}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td>
                    <button className="danger" onClick={() => removeRow(rowIndex)}>삭제</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReadonlySpreadsheetTable<Row extends Record<string, unknown>>({
  columns,
  rows,
  visibleRowCount,
  emptyText,
  filterable,
  actionLabel,
  onAction
}: {
  columns: GridColumn<Row>[];
  rows: Row[];
  visibleRowCount: number;
  emptyText: string;
  filterable?: boolean;
  actionLabel?: string;
  onAction?: (row: Row) => void;
}) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const filteredRows = useMemo(() => {
    return rows.filter((row) =>
      columns.every((column) => {
        const filterValue = filters[column.key] ?? '';
        if (!filterValue) return true;
        return String(row[column.key] ?? '') === filterValue;
      })
    );
  }, [columns, filters, rows]);

  return (
    <div className="sheet-shell">
      {filterable ? <FilterBar columns={columns} rows={rows} filters={filters} onChange={setFilters} /> : null}
      <div className="sheet-scroll" style={{ maxHeight: `${visibleRowCount * 56 + 52}px` }}>
        <table className="sheet-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} style={{ minWidth: column.width }}>{column.label}</th>
              ))}
              {actionLabel ? <th style={{ width: '98px' }}>이수선택</th> : null}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actionLabel ? 1 : 0)} className="empty-cell">{emptyText}</td>
              </tr>
            ) : (
              filteredRows.map((row, index) => (
                <tr key={(row as { id?: string }).id ?? index}>
                  {columns.map((column) => (
                    <td key={column.key} style={{ minWidth: column.width }}>
                      <div className="sheet-cell">{String(row[column.key] ?? '')}</div>
                    </td>
                  ))}
                  {actionLabel ? (
                    <td>
                      <button className="secondary action-button" onClick={() => onAction?.(row)}>{actionLabel}</button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterBar<Row extends Record<string, unknown>>({
  columns,
  rows,
  filters,
  onChange
}: {
  columns: GridColumn<Row>[];
  rows: Row[];
  filters: Record<string, string>;
  onChange: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  return (
    <div className="sheet-filters">
      {columns.filter((column) => column.filterable).map((column) => {
        const values = column.options?.filter((value) => value !== '') ?? uniqueColumnValues(rows, column.key);
        return (
          <label key={column.key} className="filter-box">
            <span>{column.label} 필터</span>
            <select value={filters[column.key] ?? ''} onChange={(event) => onChange((prev) => ({ ...prev, [column.key]: event.target.value }))}>
              <option value="">전체</option>
              {values.map((value) => (
                <option key={value} value={value}>
                  {value || '(빈값)'}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}

function EditableCell<Row extends Record<string, unknown>>({
  column,
  value,
  onCommit,
  onCancel
}: {
  column: GridColumn<Row>;
  value: unknown;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
}) {
  if (column.type === 'select') {
    return (
      <select className="cell-input" autoFocus defaultValue={String(value ?? '')} onBlur={(event) => onCommit(event.target.value)} onChange={(event) => onCommit(event.target.value)}>
        {(column.options ?? []).map((option) => (
          <option key={option || '__blank'} value={option}>{option || '(빈값)'}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="cell-input"
      type={column.type === 'int' ? 'number' : 'text'}
      step={column.type === 'int' ? '1' : undefined}
      autoFocus
      defaultValue={String(value ?? '')}
      onBlur={(event) => onCommit(column.type === 'int' ? toNumberOrEmpty(event.target.value) : event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          const input = event.target as HTMLInputElement;
          onCommit(column.type === 'int' ? toNumberOrEmpty(input.value) : input.value);
        }
        if (event.key === 'Escape') onCancel();
      }}
    />
  );
}

function uniqueColumnValues<Row extends Record<string, unknown>>(rows: Row[], key: Extract<keyof Row, string>): string[] {
  const values = new Set<string>();
  rows.forEach((row) => {
    const value = String(row[key] ?? '').trim();
    if (value) values.add(value);
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b, 'ko'));
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

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const json = (await response.json().catch(() => ({}))) as { message?: string } & T;
  if (!response.ok) {
    throw new Error(json.message ?? '요청에 실패했습니다.');
  }
  return json;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
}

export default App;

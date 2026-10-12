import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import useAuthStore from "../../stores/authStore";
import useExperienceStore from "../../stores/experienceStore";
import useCoverLetterStore from "../../stores/coverLetterStore";
import { coverLetterAPI, questionCatalogAPI } from "../../services/api";
import {
  countCharacters,
  normalizeAnalysis,
  normalizeQuestions,
  recommendExperiences,
  experienceSourceRecords,
} from "../../utils/coverLetter";
import useUnsavedChanges from "../../hooks/useUnsavedChanges";
import ConfirmDialog from "../../components/ConfirmDialog";
import JobSiteLinks from "../../components/JobSiteLinks";
import ApplicationQuestionConnector from "./ApplicationQuestionConnector";
import { connectionTarget, mergeApplicationQuestions } from "../../utils/applicationConnector";
import { catalogLookupTarget, mergeCatalogEntry } from "../../utils/questionCatalog";
import "./coverLetter.css";

const STEPS = ["공고 가져오기", "기업 분석", "경험 연결", "자소서 작성"];
const STYLES = [
  { id: "plain", label: "담백하게", hint: "짧고 분명한 문장으로" },
  { id: "story", label: "이야기하듯", hint: "경험의 흐름이 드러나게" },
  { id: "concise", label: "핵심 위주로", hint: "행동과 결과를 간결하게" },
];
const SOURCE_LABELS = {
  posting: "공고에서 확인",
  suggested: "추천 문항",
  manual: "직접 입력",
};
const emptyLetter = () => ({
  title: "",
  targetCompany: "",
  targetPosition: "",
  sourceUrl: "",
  sourceText: "",
  sourceInputText: "",
  analysis: null,
  questions: [],
  style: "plain",
  voiceSample: "",
  additionalContext: "",
  status: "draft",
});
const newQuestion = () => ({
  id: crypto.randomUUID(),
  question: "",
  answer: "",
  maxLength: null,
  minLength: null,
  countSpaces: true,
  source: "manual",
  sourceQuote: "",
  linkedExperienceIds: [],
});
const hasQuestionPrompt = (value) => {
  const prompt = String(value || "").trim();
  return prompt.length >= 5 || /^(?:지원\s*동기|성장\s*과정|성장\s*배경|장단점|직무\s*역량)$/.test(prompt);
};
const errorText = (error) =>
  error.response?.data?.error ||
  error.message ||
  "요청을 처리하지 못했어요. 다시 시도해주세요.";
const safeLink = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

function SourceBadge({ question }) {
  return (
    <span
      className={`cl-source-badge cl-source-${question.source || "manual"}`}
    >
      {question.importMethod === "question_catalog" ? "지원서 확인 완료" : question.importMethod === "browser_extension" ? "지원서에서 가져옴" : SOURCE_LABELS[question.source] || "직접 입력"}
    </span>
  );
}

function ExperienceCard({ experience, recommendation, preview = '', rank, selected, disabled, onToggle }) {
  return <label data-experience-id={experience.id} className={`cl-experience-card ${recommendation ? 'cl-recommendation-card' : ''} ${selected ? 'is-selected' : ''}`}>
    <input type="checkbox" aria-label={`${experience.title || '제목 없는 경험'} 경험 연결`} checked={selected} disabled={disabled} onChange={onToggle} />
    <div>
      <div className="cl-experience-title"><strong>{experience.title || '제목 없는 경험'}</strong>{recommendation && <span className="cl-recommendation-rank">추천 {rank}</span>}</div>
      {recommendation ? <>
        <div className="cl-recommendation-reasons">
          {recommendation.questionReason && <p><span>문항 연결</span>{recommendation.questionReason}</p>}
          {recommendation.jobReason && <p><span>직무 연결</span>{recommendation.jobReason}</p>}
        </div>
        <div className="cl-recommendation-evidence">{recommendation.evidenceSources.map((source, index) => <blockquote key={index}><span>{source.sourceLabel}</span>{source.quote}</blockquote>)}</div>
      </> : <p>{preview ? preview.slice(0, 220) : '저장된 원문을 추가하면 문항과 연결할 이유를 확인할 수 있어요.'}</p>}
      {!recommendation && <div className="cl-experience-tags">{(Array.isArray(experience.keywords) ? experience.keywords : []).filter(keyword => typeof keyword === 'string').slice(0, 4).map(keyword => <span key={keyword}>{keyword}</span>)}</div>}
    </div>
    {selected && <Check size={16} />}
  </label>;
}

function WritingQuestionInput({ question, onChange }) {
  const setLimit = (key, value) => onChange({ [key]: value ? Math.max(1, Math.min(10000, Number(value))) : null });
  return (
    <div className="cl-writing-question-input">
      <label className="cl-field">
        실제 지원서의 자소서 문항
        <textarea rows={3} maxLength={1600} aria-label="작성할 자기소개서 문항" value={question.question} autoFocus={!question.question.trim()}
          onChange={(event) => onChange({ question: event.target.value, source: "manual", validation: "manual", sourceQuote: "" })}
          placeholder="지원서에 표시된 문항을 그대로 입력해주세요. 문항을 입력하면 관련 경험을 추천해드려요." />
      </label>
      <div className="cl-limit-row">
        <label className="cl-field">최소 글자 수<input type="number" min={1} max={10000} placeholder="제한 없음" value={question.minLength ?? ""} onChange={(event) => setLimit("minLength", event.target.value)} /></label>
        <label className="cl-field">최대 글자 수<input type="number" min={1} max={10000} placeholder="제한 없음" value={question.maxLength ?? ""} onChange={(event) => setLimit("maxLength", event.target.value)} /></label>
        <label className="cl-checkbox"><input type="checkbox" checked={question.countSpaces !== false} onChange={(event) => onChange({ countSpaces: event.target.checked })} /> 공백 포함</label>
      </div>
      {!!question.minLength && !!question.maxLength && question.minLength > question.maxLength && <p className="cl-notice">최대 글자 수를 최소 글자 수 이상으로 입력해주세요.</p>}
    </div>
  );
}

function ApplicationQuestions({
  analysis,
  selectedUrl,
  onSelect,
  onFetch,
  onPaste,
  onManual,
  onConnect,
}) {
  const links = (analysis?.applicationLinks || []).filter((link) =>
    safeLink(link.url),
  );
  const verified =
    analysis?.questionStatus === "verified" && analysis?.questions?.length;
  if (verified) return null;
  const awaiting = analysis?.questionCatalog?.status === "pending";
  return (
    <section className="cl-panel cl-question-missing">
      <h3>
        {awaiting ? "실제 지원서 문항 확인 대기 중이에요" : analysis?.questionCatalog?.status === "available" ? "확인된 지원서 문항이 준비됐어요" : analysis?.questionStatus === "selection_required"
          ? "지원할 직무를 선택해주세요"
          : analysis?.applicationAccess === "registration_required"
            ? "지원자 등록이 필요한 비공개 문항이에요"
            : analysis?.applicationAccess === "login_required"
              ? "로그인이 필요한 비공개 문항이에요"
              : "실제 지원서 문항을 확인하지 못했어요"}
      </h3>
      <p>
        {analysis?.questionNotice ||
          "지원 자격과 담당 업무를 자소서 문항으로 바꾸지 않습니다. 실제 지원서의 문항을 확인해주세요."}
      </p>
      {!!links.length && (
        <div className="cl-application-options">
          {links.map((link) => (
            <label
              key={link.url}
              className={selectedUrl === link.url ? "is-selected" : ""}
            >
              <input
                type="radio"
                name="application-role"
                checked={selectedUrl === link.url}
                onChange={() => onSelect(link.url)}
              />
              <span>{link.label || "해당 직무 지원서"}</span>
              <a
                href={safeLink(link.url)}
                target="_blank"
                rel="noreferrer"
                aria-label={`${link.label || "지원서"} 열기`}
              >
                <ExternalLink size={14} />
              </a>
            </label>
          ))}
        </div>
      )}
      <div className="cl-missing-actions">
        {!!links.length && (
          <button
            className="cl-button cl-button-dark"
            disabled={!selectedUrl}
            onClick={onFetch}
          >
            이 직무 문항 가져오기 <ArrowRight size={14} />
          </button>
        )}
        {safeLink(analysis?.applicationUrl) && (
          <a
            className="cl-button"
            href={safeLink(analysis.applicationUrl)}
            target="_blank"
            rel="noreferrer"
          >
            실제 지원서 열기 <ExternalLink size={14} />
          </a>
        )}
        <button className="cl-button" onClick={onPaste}>
          지원서 문항 붙여넣기
        </button>
        <button className="cl-button" onClick={onConnect} disabled={links.length > 1 && !selectedUrl}>
          <Link2 size={14} /> 로그인한 지원서에서 가져오기
        </button>
        <button className="cl-text-button" onClick={onManual}>
          문항 직접 입력하기
        </button>
      </div>
    </section>
  );
}

function AnalysisPanel({ analysis }) {
  if (!analysis)
    return (
      <div className="cl-notice">
        공고를 분석하면 기업의 사업과 직무 요구사항을 여기에서 확인할 수 있어요.
        직접 입력한 문항으로도 작성할 수 있습니다.
      </div>
    );
  return (
    <div className="cl-analysis-grid">
      <section className="cl-panel cl-analysis-summary">
        <span className="cl-eyebrow">기업과 직무 한눈에</span>
        <h2>
          {analysis.company || "지원 기업"}
          <span>{analysis.position || "지원 직무"}</span>
        </h2>
        <p>{analysis.summary || "확인된 기업 요약이 없어요."}</p>
        {analysis.business && (
          <div className="cl-analysis-business">
            <h3>어떤 일을 하는 기업인가요?</h3>
            <p>{analysis.business}</p>
          </div>
        )}
        {!!analysis.companyInsights?.length && (
          <div className="cl-insight-list">
            {analysis.companyInsights.map((insight, index) => (
              <div key={index}>
                <Building2 size={16} />
                <div>
                  <p>{typeof insight === "string" ? insight : insight.text}</p>
                  {insight.sourceQuote && (
                    <small>근거: {insight.sourceQuote}</small>
                  )}
                  {safeLink(
                    analysis.sources?.find(
                      (source) => source.id === insight.sourceId,
                    )?.url,
                  ) && (
                    <a
                      href={safeLink(
                        analysis.sources.find(
                          (source) => source.id === insight.sourceId,
                        ).url,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      출처 확인 <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="cl-panel">
        <h3>이 직무에서 눈여겨보는 것</h3>
        {analysis.rolePriorities?.length ? (
          <ul className="cl-analysis-list">
            {analysis.rolePriorities.map((text, index) => (
              <li key={index}>
                <span>{index + 1}</span>
                {text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="cl-muted">
            확인된 요구사항이 없어요. 공고 내용을 추가해주세요.
          </p>
        )}
        <h3 className="cl-section-gap">자소서에 연결할 포인트</h3>
        {analysis.writingPoints?.length ? (
          <ul className="cl-writing-points">
            {analysis.writingPoints.map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ul>
        ) : (
          <p className="cl-muted">지원 동기와 경험을 직접 연결해주세요.</p>
        )}
      </section>
      {(!!analysis.uncertainties?.length || !!analysis.sources?.length) && (
        <section className="cl-panel cl-analysis-sources">
          {!!analysis.uncertainties?.length && (
            <div className="cl-notice">
              <strong>추가로 확인할 내용</strong>
              <ul>
                {analysis.uncertainties.map((text, index) => (
                  <li key={index}>{text}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="cl-source-links">
            {analysis.sources?.map((source, index) =>
              safeLink(source.url) ? (
                <a
                  key={source.id || index}
                  href={safeLink(source.url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={13} />
                  {source.title || "분석 출처"}
                  <span>
                    {source.type === "posting" ? "공고" : "기업 자료"}
                  </span>
                </a>
              ) : (
                <span key={source.id || index}>
                  {source.title || "직접 입력한 공고"}
                </span>
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default function CoverLetterWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const {
    experiences,
    loading: experienceLoading,
    loadError: experienceError,
    fetchExperiences,
  } = useExperienceStore();
  const { getCoverLetter, createCoverLetter, updateCoverLetter } =
    useCoverLetterStore();
  const [letter, setLetter] = useState(emptyLetter);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify(emptyLetter()),
  );
  const [documentId, setDocumentId] = useState(id || null);
  const [step, setStep] = useState(id ? 3 : 0);
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [saving, setSaving] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [contextRequest, setContextRequest] = useState(null);
  const [inputMode, setInputMode] = useState("url");
  const [selectedApplicationUrl, setSelectedApplicationUrl] = useState("");
  const [showQuestionPaste, setShowQuestionPaste] = useState(false);
  const [showConnector, setShowConnector] = useState(false);
  const [experienceSearch, setExperienceSearch] = useState("");
  const [revision, setRevision] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const letterRef = useRef(letter);
  const selectedApplicationRef = useRef(selectedApplicationUrl);
  selectedApplicationRef.current = selectedApplicationUrl;
  const mountedRef = useRef(true);
  const workspaceIdentityRef = useRef("");
  workspaceIdentityRef.current = `${user?.uid || ""}:${id || "new"}`;
  const busyRef = useRef(false);
  const dirty =
    !loading && !loadError && JSON.stringify(letter) !== savedSnapshot;
  useUnsavedChanges(dirty || !!busy);

  useEffect(() => {
    letterRef.current = letter;
  }, [letter]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (user?.uid) fetchExperiences(user.uid);
  }, [user?.uid, fetchExperiences]);
  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    setDocumentId(id || null);
    if (!id) {
      const blank = emptyLetter();
      setLetter(blank);
      setSavedSnapshot(JSON.stringify(blank));
      setLoading(false);
      setStep(0);
      setSelectedApplicationUrl("");
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    getCoverLetter(id)
      .then((data) => {
        if (cancelled) return;
        if (!data) throw new Error("자기소개서를 찾을 수 없어요.");
        const loaded = {
          ...emptyLetter(),
          ...data,
          questions: normalizeQuestions(data.questions || []),
        };
        setLetter(loaded);
        setSavedSnapshot(JSON.stringify(loaded));
        setSelectedApplicationUrl(
          loaded.analysis?.selectedApplicationUrl || "",
        );
        const usable = loaded.questions.filter(
          (question) => question.validation !== "unverified",
        );
        setActiveId(usable[0]?.id || "");
        setStep(usable.length || loaded.analysis ? 3 : 2);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(errorText(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, getCoverLetter]);
  useEffect(() => { setShowConnector(false); }, [id, user?.uid]);
  const catalogStatus = letter.analysis?.questionCatalog?.status;
  const catalogTarget = catalogLookupTarget(letter.analysis);
  useEffect(() => {
    if (!user?.uid || loading || saving || catalogStatus !== "pending" || !catalogTarget) return;
    if (selectedApplicationUrl && letter.analysis?.selectedApplicationUrl
      && selectedApplicationUrl !== letter.analysis.selectedApplicationUrl) return;
    let cancelled = false;
    let timer;
    const workspace = workspaceIdentityRef.current;
    const target = catalogTarget;
    const unchanged = () => {
      const current = catalogLookupTarget(letterRef.current.analysis);
      return !cancelled && mountedRef.current && useAuthStore.getState().user?.uid === user.uid && workspaceIdentityRef.current === workspace
        && letterRef.current.analysis?.questionCatalog?.status === "pending"
        && (!selectedApplicationRef.current || selectedApplicationRef.current === target.applicationUrl)
        && current?.sourceUrl === target.sourceUrl && current?.applicationUrl === target.applicationUrl;
    };
    const poll = async () => {
      if (!unchanged()) return;
      if (!busyRef.current && document.visibilityState !== "hidden") {
        try {
          const result = await questionCatalogAPI.lookup(target);
          if (!unchanged()) return;
          if (busyRef.current) { timer = setTimeout(poll, 30000); return; }
          if (result.status === "verified" && result.entry) {
            const updated = mergeCatalogEntry(letterRef.current, result.entry);
            letterRef.current = updated;
            setLetter(updated);
            setActiveId(previous => updated.questions.some(q => q.id === previous && q.validation !== "unverified")
              ? previous : updated.questions.find(q => q.importMethod === "question_catalog")?.id || "");
            setShowQuestionPaste(false);
            toast.success("확인된 지원서 문항을 자동으로 가져왔어요");
            return;
          }
        } catch (error) {
          if (unchanged() && !error.response && /문항|12/.test(error.message || "")) {
            setRequestError(errorText(error));
            setLetter(previous => ({ ...previous, analysis: { ...previous.analysis,
              questionCatalog: { ...previous.analysis.questionCatalog, status: "available" },
              questionNotice: "확인된 문항이 준비되었어요. 기존 문항이 12개라 자동으로 추가할 수 없습니다. 문항 수를 정리한 뒤 다시 가져와주세요.",
            } }));
            return;
          }
        }
      }
      if (unchanged()) timer = setTimeout(poll, 30000);
    };
    timer = setTimeout(poll, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [user?.uid, id, loading, saving, catalogStatus, catalogTarget?.sourceUrl, catalogTarget?.applicationUrl, selectedApplicationUrl]);

  const patch = (fields) =>
    setLetter((previous) => ({
      ...previous,
      ...fields,
      status: fields.status || "draft",
    }));
  const patchQuestion = (questionId, fields) =>
    setLetter((previous) => ({
      ...previous,
      status: "draft",
      questions: previous.questions.map((question) =>
        question.id === questionId ? { ...question, ...fields } : question,
      ),
    }));
  const usableQuestions = letter.questions.filter(
    (question) => question.validation !== "unverified",
  );
  const unverifiedQuestions = letter.questions.filter(
    (question) => question.validation === "unverified",
  );
  const activeQuestion =
    usableQuestions.find((question) => question.id === activeId) ||
    usableQuestions[0];
  const currentId = activeQuestion?.id;
  const activeCount = countCharacters(
    activeQuestion?.answer || "",
    activeQuestion?.countSpaces !== false,
  );
  const activeTooShort =
    !!activeQuestion?.minLength && activeCount < activeQuestion.minLength;
  const activeTooLong =
    !!activeQuestion?.maxLength && activeCount > activeQuestion.maxLength;
  const recommendations = useMemo(() => recommendExperiences(activeQuestion?.question, experiences, letter.analysis || {}), [activeQuestion?.question, experiences, letter.analysis]);
  const sourceRecordsById = useMemo(() => new Map(experiences.map(experience => [experience.id, experienceSourceRecords(experience)])), [experiences]);
  const otherExperiences = useMemo(() => {
    const recommendedIds = new Set(recommendations.map(item => item.experienceId));
    return experiences.filter(experience => !recommendedIds.has(experience.id));
  }, [experiences, recommendations]);
  const matchingExperiences = useMemo(() => otherExperiences.filter(experience => !experienceSearch.trim() || [
    experience.title || '', ...(Array.isArray(experience.keywords) ? experience.keywords : []).filter(keyword => typeof keyword === 'string'),
    ...(sourceRecordsById.get(experience.id) || []).map(record => record.text),
  ].join(' ').toLowerCase().includes(experienceSearch.trim().toLowerCase())), [otherExperiences, experienceSearch, sourceRecordsById]);
  const hasQuestions = usableQuestions.length > 0;
  const canGenerate = hasQuestionPrompt(activeQuestion?.question) && (!!activeQuestion?.linkedExperienceIds?.length || !!letter.additionalContext.trim())
    && !(activeQuestion.minLength && activeQuestion.maxLength && activeQuestion.minLength > activeQuestion.maxLength);
  const answered = usableQuestions.filter((question) =>
    question.answer?.trim(),
  ).length;
  const locked = !!busy || saving;
  const setCurrent = (questionId) => {
    setActiveId(questionId);
    setRevision("");
    setRequestError("");
    setExperienceSearch("");
    setContextRequest(null);
  };

  const analyze = async (options = {}) => {
    if (busyRef.current) return;
    if (inputMode === "url" && !safeLink(letter.sourceUrl)) {
      setRequestError("https://로 시작하는 채용 공고 링크를 입력해주세요.");
      return;
    }
    if (options.questionImport && letter.sourceInputText.trim().length < 8) {
      setRequestError("실제 지원서 문항을 8자 이상 붙여넣어주세요.");
      return;
    }
    if (!options.questionImport && inputMode === "text" && letter.sourceInputText.trim().length < 30) {
      setRequestError("공고와 자소서 문항 내용을 30자 이상 붙여넣어주세요.");
      return;
    }
    busyRef.current = true;
    setBusy("analyze");
    setRequestError("");
    try {
      const response = await coverLetterAPI.analyze({
        url: inputMode === "url" ? letter.sourceUrl.trim() : undefined,
        text: letter.sourceInputText.trim() || undefined,
        questionImport: options.questionImport === true,
        applicationUrl:
          options.applicationUrl || selectedApplicationUrl || undefined,
        company: letter.targetCompany.trim(),
        position: letter.targetPosition.trim(),
      });
      if (!mountedRef.current) return;
      const analysis = normalizeAnalysis(response);
      const questions = normalizeQuestions(analysis.questions || []);
      if (options.openWriting && !questions.length) questions.push(newQuestion());
      setLetter((previous) => ({
        ...previous,
        title:
          previous.title ||
          `${analysis.company || previous.targetCompany || "지원 기업"} 자기소개서`,
        targetCompany: analysis.company || previous.targetCompany,
        targetPosition: analysis.position || previous.targetPosition,
        sourceUrl:
          analysis.sourceUrl || (inputMode === "url" ? previous.sourceUrl : ""),
        sourceText: analysis.sourceText || previous.sourceText,
        sourceInputText: analysis.sourceInputText || previous.sourceInputText,
        analysis,
        questions: [
          ...questions,
          ...previous.questions
            .filter(
              (question) =>
                question.validation === "unverified" && question.answer?.trim(),
            )
            .map((question) => ({
              ...question,
              id: questions.some((item) => item.id === question.id)
                ? `unverified-${question.id}`
                : question.id,
            })),
        ],
        status: "draft",
      }));
      setActiveId(questions[0]?.id || "");
      setSelectedApplicationUrl(
        analysis.selectedApplicationUrl ||
          options.applicationUrl ||
          (analysis.applicationLinks?.length === 1
            ? analysis.applicationLinks[0].url
            : ""),
      );
      setShowQuestionPaste(false);
      setStep(options.openWriting ? 3 : options.questionImport || options.openQuestions ? 2 : 1);
      toast.success("기업과 공고 분석을 마쳤어요");
    } catch (error) {
      if (mountedRef.current) setRequestError(errorText(error));
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy("");
    }
  };

  const save = async () => {
    if (locked) return;
    setSaving(true);
    setRequestError("");
    const snapshot = {
      ...letterRef.current,
      title:
        letterRef.current.title.trim() ||
        `${letterRef.current.targetCompany || "새"} 자기소개서`,
    };
    try {
      const savedId =
        documentId || (await createCoverLetter(user.uid, snapshot));
      if (documentId) await updateCoverLetter(documentId, snapshot);
      if (!mountedRef.current) return;
      setDocumentId(savedId);
      setLetter(snapshot);
      setSavedSnapshot(JSON.stringify(snapshot));
      toast.success("자기소개서를 저장했어요");
    } catch (error) {
      if (mountedRef.current) {
        setRequestError(errorText(error));
        toast.error("저장하지 못했어요. 작성 내용은 그대로 남아 있어요.");
      }
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const generate = async (instruction = "") => {
    if (busyRef.current || !activeQuestion) return;
    if (!hasQuestionPrompt(activeQuestion.question)) {
      setRequestError("문항 내용을 입력해주세요.");
      return;
    }
    if (!activeQuestion.linkedExperienceIds?.length && !letter.additionalContext.trim()) {
      setRequestError("이 문항에 쓸 경험을 연결하거나 실제 경험을 추가로 입력해주세요.");
      return;
    }
    if (
      activeQuestion.minLength &&
      activeQuestion.maxLength &&
      activeQuestion.minLength > activeQuestion.maxLength
    ) {
      setRequestError("최소 글자 수는 최대 글자 수보다 클 수 없어요.");
      return;
    }
    busyRef.current = true;
    setBusy(currentId);
    setRequestError("");
    const questionId = currentId;
    try {
      const result = await coverLetterAPI.generate({
        analysis: {
          ...(letter.analysis || {}),
          company: letter.targetCompany,
          position: letter.targetPosition,
        },
        question: activeQuestion,
        experienceIds: activeQuestion.linkedExperienceIds,
        style: letter.style,
        voiceSample: letter.voiceSample,
        additionalContext: letter.additionalContext,
        ...(instruction
          ? {
              revisionInstruction: instruction,
              currentAnswer: activeQuestion.answer || "",
            }
          : {}),
      });
      if (!mountedRef.current) return;
      if (result.status === "needs_context") {
        setContextRequest({ questionId, question: activeQuestion.question,
          message: result.followUpQuestion || "문항과 직접 관련된 실제 경험과 느낀 점을 알려주세요." });
        return;
      }
      if (typeof result.answer !== "string" || !result.answer.trim())
        throw new Error("초안을 받지 못했어요. 다시 시도해주세요.");
      setContextRequest(null);
      patchQuestion(questionId, {
        answer: result.answer,
        linkedExperienceIds: Array.isArray(result.linkedExperienceIds)
          ? result.linkedExperienceIds
          : activeQuestion.linkedExperienceIds,
        evidence: result.evidence || [],
        warnings: result.warnings || [],
        review: result.review || null,
      });
      setRevision("");
      toast.success(
        instruction ? "문장을 다듬었어요" : "경험을 바탕으로 초안을 작성했어요",
      );
    } catch (error) {
      if (mountedRef.current) setRequestError(errorText(error));
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy("");
    }
  };
  const requestGeneration = (instruction) =>
    activeQuestion?.answer?.trim()
      ? setPendingAction({
          type: "generate",
          instruction,
          title: instruction
            ? "현재 답변을 다듬을까요?"
            : "초안을 다시 작성할까요?",
          message:
            "현재 답변이 새 문장으로 바뀝니다. 필요한 내용은 먼저 복사해두세요.",
        })
      : generate(instruction);
  const plainText = () =>
    `${letter.title || "자기소개서"}\n${[letter.targetCompany, letter.targetPosition].filter(Boolean).join(" · ")}\n\n${usableQuestions.map((question, index) => `${index + 1}. ${question.question}\n\n${question.answer || ""}`).join("\n\n──────────\n\n")}`;
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("복사했어요");
    } catch {
      toast.error("복사하지 못했어요. 답변을 선택해 직접 복사해주세요.");
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", plainText()], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(letter.title || "자기소개서").replace(/[<>:"/\\|?*]/g, "_")}.txt`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const addQuestion = () => {
    if (usableQuestions.length >= 12) return;
    const question = newQuestion();
    patch({ questions: [...letter.questions, question] });
    setCurrent(question.id);
  };
  const moveTo = (next) => {
    if (next === 3 && !hasQuestions) {
      const question = newQuestion();
      patch({ questions: [...letter.questions, question] });
      setCurrent(question.id);
    }
    setRequestError("");
    setStep(next);
  };
  const continueManual = () => {
    if (!hasQuestions) {
      const question = newQuestion();
      patch({ questions: [...letter.questions, question] });
      setCurrent(question.id);
    }
    setRequestError("");
    setStep(2);
  };

  const requestAnalysis = (options = {}) =>
    letter.questions.some(
      (question) =>
        question.answer?.trim() && question.validation !== "unverified",
    )
      ? setPendingAction({
          type: "analyze",
          options,
          title: "공고를 다시 분석할까요?",
          message: "가져온 문항과 작성한 답변이 새 공고의 문항으로 바뀝니다.",
        })
      : analyze(options);
  const importApplicationQuestions = async (capture) => {
    if (busyRef.current || saving) throw new Error("다른 작업이 끝난 뒤 문항을 가져와주세요.");
    const snapshot = letterRef.current;
    const workspaceIdentity = workspaceIdentityRef.current;
    const target = connectionTarget(snapshot.analysis, selectedApplicationUrl);
    busyRef.current = true;
    setBusy("import");
    setRequestError("");
    try {
      const result = await coverLetterAPI.importQuestions({ capture, applicationUrl: target.selectedApplicationUrl,
        analysis: { ...snapshot.analysis, company: snapshot.targetCompany, position: snapshot.targetPosition, sourceUrl: snapshot.sourceUrl } });
      if (!mountedRef.current || workspaceIdentityRef.current !== workspaceIdentity) return;
      const analysis = normalizeAnalysis(result);
      const incoming = normalizeQuestions(result.questions || analysis.questions).map(question => ({ ...question, importMethod: "browser_extension" }));
      if (!incoming.length) throw new Error("실제 지원서 문항을 확인하지 못했어요. 문항 화면에서 다시 가져와주세요.");
      const merged = mergeApplicationQuestions(snapshot.questions, incoming);
      analysis.questions = merged.questions.filter(question => question.source === "posting" && question.validation !== "unverified");
      setLetter(previous => ({ ...previous, analysis, targetPosition: analysis.position || previous.targetPosition, questions: merged.questions, status: "draft" }));
      setActiveId(merged.importedIds[0] || "");
      setShowQuestionPaste(false);
      setStep(3);
      toast.success(`${incoming.length}개 지원서 문항을 가져왔어요`);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy("");
    }
  };
  const applicationRecovery = (
    <ApplicationQuestions
      analysis={letter.analysis}
      selectedUrl={selectedApplicationUrl}
      onSelect={setSelectedApplicationUrl}
      onFetch={() =>
        requestAnalysis({
          applicationUrl: selectedApplicationUrl,
          openWriting: true,
        })
      }
      onPaste={() => {
        setShowQuestionPaste(true);
        setInputMode(letter.sourceUrl ? "url" : "text");
        if (step !== 3) moveTo(2);
      }}
      onManual={continueManual}
      onConnect={() => setShowConnector(true)}
    />
  );

  const experiencePicker = activeQuestion && (
    <>
                    <div className="cl-experience-heading">
                      <h3>이 문항에 사용할 경험</h3>
                      <span>
                        {activeQuestion.linkedExperienceIds?.length || 0}/5 선택
                      </span>
                    </div>
                    {experienceLoading ? (
                      <p className="cl-muted" role="status">
                        경험을 불러오고 있어요…
                      </p>
                    ) : experienceError ? (
                      <div className="cl-notice">
                        {experienceError}
                        <button
                          className="cl-text-button"
                          onClick={() => fetchExperiences(user.uid)}
                        >
                          다시 불러오기
                        </button>
                      </div>
                    ) : !experiences.length ? (
                      <div className="cl-empty cl-empty-small">
                        <p>아직 저장된 경험이 없어요.</p>
                        <a
                          href="/app/experience"
                          target="_blank"
                          rel="noreferrer"
                          className="cl-button"
                        >
                          경험 정리하러 가기 <ExternalLink size={13} />
                        </a>
                        <button
                          className="cl-text-button"
                          onClick={() => fetchExperiences(user.uid)}
                        >
                          경험 목록 새로고침
                        </button>
                      </div>
                    ) : (
                      <div className="cl-experience-picker">
                        <section className="cl-recommended-experiences" aria-label="이 문항의 추천 경험">
                          <div className="cl-experience-section-heading"><h4>이 문항에 추천하는 경험</h4><span>{recommendations.length}개</span></div>
                          <p className="cl-experience-section-note">문항에서 묻는 내용부터 살펴보고, 직무와 연결할 기록을 함께 보여드려요.</p>
                          {recommendations.length ? <div className="cl-recommendation-list">{recommendations.map((recommendation, index) => {
                            const experience = recommendation.experience;
                            const selected = !!activeQuestion.linkedExperienceIds?.includes(experience.id);
                            return <ExperienceCard key={experience.id} experience={experience} recommendation={recommendation} rank={index + 1} selected={selected}
                              disabled={!selected && (activeQuestion.linkedExperienceIds?.length || 0) >= 5}
                              onToggle={() => patchQuestion(currentId, { linkedExperienceIds: selected
                                ? activeQuestion.linkedExperienceIds.filter(experienceId => experienceId !== experience.id)
                                : [...(activeQuestion.linkedExperienceIds || []), experience.id] })} />;
                          })}</div> : <p className="cl-recommendation-empty">문항과 연결할 원문 기록을 찾지 못했어요. 다른 경험을 직접 골라 연결해주세요.</p>}
                  </section>
                        <section className="cl-other-experiences" aria-label="다른 경험 선택">
                          <div className="cl-experience-section-heading"><h4>다른 경험에서 선택</h4><span>{otherExperiences.length}개</span></div>
                          {!!otherExperiences.length && <label className="cl-experience-search"><Search size={15} /><input type="search" aria-label="다른 경험 검색" value={experienceSearch} onChange={event => setExperienceSearch(event.target.value)} placeholder="경험 제목이나 기록으로 검색" /></label>}
                          <div className="cl-experience-list">{matchingExperiences.map(experience => {
                            const selected = !!activeQuestion.linkedExperienceIds?.includes(experience.id);
                            return <ExperienceCard key={experience.id} experience={experience} preview={sourceRecordsById.get(experience.id)?.[0]?.text || ''} selected={selected}
                              disabled={!selected && (activeQuestion.linkedExperienceIds?.length || 0) >= 5}
                              onToggle={() => patchQuestion(currentId, { linkedExperienceIds: selected
                                ? activeQuestion.linkedExperienceIds.filter(experienceId => experienceId !== experience.id)
                                : [...(activeQuestion.linkedExperienceIds || []), experience.id] })} />;
                          })}</div>
                          {!matchingExperiences.length && <p className="cl-muted">{experienceSearch.trim() ? '검색한 내용과 일치하는 다른 경험이 없어요.' : '저장된 경험이 모두 위의 추천 목록에 있어요.'}</p>}
                        </section>
                      </div>
                    )}
    </>
  );
  const questionPastePanel = (
              <section className="cl-panel cl-question-paste">
                <label className="cl-field">
                  실제 지원서의 자소서 문항
                  <textarea
                    rows={6}
                    maxLength={30000}
                    value={letter.sourceInputText}
                    onChange={(event) =>
                      patch({ sourceInputText: event.target.value })
                    }
                    placeholder="지원서에 표시된 자소서 문항과 글자 수 제한을 그대로 붙여넣어주세요. 지원 자격이나 담당 업무는 제외해주세요."
                  />
                </label>
                <button
                  className="cl-button cl-button-dark"
                  disabled={letter.sourceInputText.trim().length < 8}
                  onClick={() => requestAnalysis({ questionImport: true, openWriting: step === 3 })}
                >
                  붙여넣은 문항 가져오기 <ArrowRight size={14} />
                </button>
              </section>
  );

  if (loading)
    return (
      <div className="cl-page cl-empty" role="status">
        <Loader2 className="animate-spin" size={26} />
        <p>자기소개서를 불러오고 있어요</p>
      </div>
    );
  if (loadError)
    return (
      <div className="cl-page cl-empty">
        <h2>자기소개서를 불러오지 못했어요</h2>
        <p>{loadError}</p>
        <button
          className="cl-button"
          onClick={() => navigate("/app/coverletter")}
        >
          목록으로
        </button>
      </div>
    );

  return (
    <div className="cl-page cl-workspace">
      <div className="cl-workspace-heading">
        <div>
          <button
            className="cl-back"
            onClick={() => navigate("/app/coverletter")}
          >
            <ArrowLeft size={15} /> 자기소개서
          </button>
          <input
            className="cl-title-input"
            aria-label="자기소개서 제목"
            placeholder="새 자기소개서"
            value={letter.title}
            disabled={locked}
            maxLength={200}
            onChange={(event) => patch({ title: event.target.value })}
          />
          <span className="cl-save-state" role="status">
            {saving
              ? "저장 중…"
              : dirty
                ? "저장하지 않은 변경사항"
                : documentId
                  ? "저장됨"
                  : "새 초안"}
          </span>
        </div>
        <button
          className="cl-button cl-button-dark"
          disabled={locked || (!dirty && !!documentId)}
          onClick={save}
        >
          {saving ? (
            <Loader2 className="animate-spin" size={15} />
          ) : (
            <Save size={15} />
          )}{" "}
          저장
        </button>
      </div>
      <nav className="cl-steps" aria-label="자기소개서 작성 단계">
        {STEPS.map((label, index) => (
          <button
            key={label}
            className={step === index ? "is-active" : ""}
            disabled={
              locked ||
              (index === 1 && !letter.analysis) ||
              (index === 2 &&
                !hasQuestions &&
                !letter.analysis &&
                !unverifiedQuestions.length) ||
              (index === 3 && !hasQuestions && !letter.analysis)
            }
            aria-current={step === index ? "step" : undefined}
            onClick={() => moveTo(index)}
          >
            <span>{index + 1}</span>
            {label}
            {index < 3 && <ChevronRight size={14} />}
          </button>
        ))}
      </nav>
      {requestError && (
        <div className="cl-error" role="alert">
          {requestError}
        </div>
      )}
      {letter.analysis && !showConnector && <div className="cl-connector-launch"><button className="cl-text-button" disabled={locked} onClick={() => setShowConnector(true)}><Link2 size={14} /> 로그인한 지원서에서 문항 가져오기</button></div>}
      {showConnector && <ApplicationQuestionConnector key={`${user?.uid || ""}:${documentId || "new"}`} analysis={letter.analysis} selectedUrl={selectedApplicationUrl}
        company={letter.targetCompany} position={selectedApplicationUrl && selectedApplicationUrl !== letter.analysis?.selectedApplicationUrl
          ? letter.analysis?.applicationLinks?.find(link => link.url === selectedApplicationUrl)?.label || letter.targetPosition : letter.targetPosition}
        disabled={locked} onImport={importApplicationQuestions} onClose={() => setShowConnector(false)} />}
      <fieldset className="cl-workspace-fields" disabled={locked}>
        {!!unverifiedQuestions.length && (
          <section className="cl-panel cl-question-recovery">
            <h3>이전 분석에서 잘못 가져온 문항이 있어요</h3>
            <p>
              지원 자격·담당 업무·과거 합격자소서로 확인된 항목은 작성 문항에서
              제외했어요. 기존 답변은 아래에 보관됩니다.
            </p>
            <details>
              <summary>
                이전 문항과 답변 확인 ({unverifiedQuestions.length})
              </summary>
              {unverifiedQuestions.map((question) => (
                <div key={question.id}>
                  <strong>{question.question}</strong>
                  {question.answer && (
                    <>
                      <p className="whitespace-pre-wrap">{question.answer}</p>
                      <button
                        className="cl-text-button"
                        onClick={() => copy(question.answer)}
                      >
                        기존 답변 복사
                      </button>
                    </>
                  )}
                  <button
                    className="cl-text-button"
                    onClick={() => {
                      patchQuestion(question.id, {
                        source: "manual",
                        validation: "manual",
                        sourceQuote: "",
                      });
                      setCurrent(question.id);
                      moveTo(2);
                    }}
                  >
                    실제 문항으로 수정
                  </button>
                </div>
              ))}
            </details>
            <button className="cl-button" onClick={() => moveTo(0)}>
              공고 다시 분석하기
            </button>
          </section>
        )}
        {step === 0 && (
          <section className="cl-panel cl-input-panel">
            <span className="cl-eyebrow">01 · 지원할 공고</span>
            <h2>어느 기업에 지원하시나요?</h2>
            <p className="cl-intro">
              포트폴리오처럼 공고 링크를 넣어주세요. 기업과 직무, 확인할 수 있는
              자소서 문항을 함께 가져와요.
            </p>
            <div className="cl-input-tabs">
              <button
                className={inputMode === "url" ? "is-active" : ""}
                onClick={() => setInputMode("url")}
              >
                <Link2 size={15} /> 공고 링크
              </button>
              <button
                className={inputMode === "text" ? "is-active" : ""}
                onClick={() => setInputMode("text")}
              >
                <FileText size={15} /> 내용 붙여넣기
              </button>
            </div>
            {inputMode === "url" && <JobSiteLinks className="mb-5" />}
            {inputMode === "url" ? (
              <label className="cl-field">
                채용 공고 링크
                <input
                  type="url"
                  value={letter.sourceUrl}
                  maxLength={2000}
                  onChange={(event) => {
                    patch({ sourceUrl: event.target.value });
                    setSelectedApplicationUrl("");
                  }}
                  placeholder="https://careers.company.com/jobs/..."
                />
                <small>
                  로그인이 필요하거나 이미지로만 된 공고는 내용을
                  붙여넣어주세요.
                </small>
              </label>
            ) : (
              <label className="cl-field">
                공고 내용과 자소서 문항
                <textarea
                  rows={9}
                  maxLength={30000}
                  value={letter.sourceInputText}
                  onChange={(event) =>
                    patch({ sourceInputText: event.target.value })
                  }
                  placeholder="기업명, 지원 직무, 주요 업무와 자소서 문항·글자 수 제한을 붙여넣어주세요."
                />
              </label>
            )}
            {inputMode === "url" && (
              <details className="cl-extra-input">
                <summary>공고에 없는 문항이나 기업 자료 추가하기</summary>
                <label className="cl-field">
                  함께 분석할 내용
                  <textarea
                    rows={5}
                    maxLength={30000}
                    value={letter.sourceInputText}
                    onChange={(event) =>
                      patch({ sourceInputText: event.target.value })
                    }
                    placeholder="지원 페이지의 자소서 문항 또는 직접 확인한 기업 정보를 붙여넣어주세요."
                  />
                </label>
              </details>
            )}
            <div className="cl-field-row">
              <label className="cl-field">
                기업명 <span>선택</span>
                <input
                  maxLength={200}
                  value={letter.targetCompany}
                  onChange={(event) =>
                    patch({ targetCompany: event.target.value })
                  }
                  placeholder="예: 지원 기업"
                />
              </label>
              <label className="cl-field">
                지원 직무 <span>선택</span>
                <input
                  maxLength={200}
                  value={letter.targetPosition}
                  onChange={(event) =>
                    patch({ targetPosition: event.target.value })
                  }
                  placeholder="예: 프로덕트 매니저"
                />
              </label>
            </div>
            <div className="cl-input-footer">
              <button className="cl-text-button" onClick={continueManual}>
                문항 직접 입력하기
              </button>
              <button
                className="cl-button cl-button-dark"
                onClick={() => requestAnalysis()}
              >
                {busy === "analyze" ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
                {busy === "analyze"
                  ? "공고와 기업을 분석하고 있어요…"
                  : "공고·기업 분석하기"}
              </button>
            </div>
            <p className="cl-billing-note">
              AI 분석·작성은 기존 크레딧을 사용하며, 처리한 분량만큼 차감돼요.
            </p>
          </section>
        )}
        {step === 1 && (
          <>
            <div className="cl-step-heading">
              <div>
                <span className="cl-eyebrow">02 · 기업과 직무 이해</span>
                <h2>이 기업에 필요한 경험을 찾아볼게요.</h2>
              </div>
            </div>
            {applicationRecovery}
            <AnalysisPanel analysis={letter.analysis} />
            <div className="cl-next-row">
              <button className="cl-button" onClick={() => moveTo(0)}>
                <ArrowLeft size={15} /> 공고 수정
              </button>
              <button
                className="cl-button cl-button-dark"
                onClick={() => moveTo(2)}
              >
                문항·경험 연결하기 <ArrowRight size={15} />
              </button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="cl-step-heading">
              <div>
                <span className="cl-eyebrow">03 · 문항에 맞는 내 경험</span>
                <h2>어떤 이야기로 답할까요?</h2>
                <p>
                  문항과 글자 수를 확인하고, 각 문항에 쓸 경험을 골라주세요.
                </p>
              </div>
              <button
                className="cl-button"
                disabled={usableQuestions.length >= 12}
                onClick={addQuestion}
              >
                <Plus size={15} /> 문항 추가
              </button>
            </div>
            <div className="cl-notice">
              {letter.analysis?.questionNotice ||
                "실제 지원서에 표시되는 문항을 입력하고 글자 수 제한을 확인해주세요."}
            </div>
            {applicationRecovery}
            {showQuestionPaste && (
              questionPastePanel
            )}
            <div className="cl-field-row cl-target-fields">
              <label className="cl-field">
                지원 기업
                <input
                  value={letter.targetCompany}
                  maxLength={200}
                  onChange={(event) =>
                    patch({ targetCompany: event.target.value })
                  }
                />
              </label>
              <label className="cl-field">
                지원 직무
                <input
                  value={letter.targetPosition}
                  maxLength={200}
                  onChange={(event) =>
                    patch({ targetPosition: event.target.value })
                  }
                />
              </label>
            </div>
            {hasQuestions && (
              <div className="cl-mapping-layout">
                <aside className="cl-question-nav">
                  {usableQuestions.map((question, index) => (
                    <button
                      key={question.id}
                      className={currentId === question.id ? "is-active" : ""}
                      onClick={() => setCurrent(question.id)}
                    >
                      <span>
                        문항 {index + 1}
                        <SourceBadge question={question} />
                      </span>
                      <strong>
                        {question.question || "문항을 입력해주세요"}
                      </strong>
                      <small>
                        {question.linkedExperienceIds?.length || 0}개 경험 연결
                      </small>
                    </button>
                  ))}
                </aside>
                {activeQuestion && (
                  <section className="cl-panel cl-question-panel">
                    <div className="cl-question-top">
                      <h3>
                        문항{" "}
                        {usableQuestions.findIndex(
                          (question) => question.id === currentId,
                        ) + 1}
                      </h3>
                      <button
                        className="cl-icon-button"
                        aria-label="현재 문항 삭제"
                        onClick={() =>
                          setPendingAction({
                            type: "deleteQuestion",
                            questionId: currentId,
                            title: "이 문항을 삭제할까요?",
                            message:
                              "연결한 경험과 이 문항에 작성한 답변도 함께 삭제됩니다.",
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <label className="cl-field">
                      자소서 문항
                      <textarea
                        rows={3}
                        value={activeQuestion.question}
                        maxLength={1600}
                        onChange={(event) =>
                          patchQuestion(currentId, {
                            question: event.target.value,
                            source: "manual",
                            sourceQuote: "",
                            validation: "manual",
                          })
                        }
                        placeholder="지원 동기와 직무에 적합한 이유를 경험을 바탕으로 작성해주세요."
                      />
                    </label>
                    <div className="cl-limit-row">
                      <label className="cl-field">
                        최소 글자 수
                        <input
                          type="number"
                          min={1}
                          max={10000}
                          placeholder="제한 없음"
                          value={activeQuestion.minLength ?? ""}
                          onChange={(event) =>
                            patchQuestion(currentId, {
                              minLength: event.target.value
                                ? Math.max(
                                    1,
                                    Math.min(10000, Number(event.target.value)),
                                  )
                                : null,
                            })
                          }
                        />
                      </label>
                      <label className="cl-field">
                        최대 글자 수
                        <input
                          type="number"
                          min={1}
                          max={10000}
                          placeholder="제한 없음"
                          value={activeQuestion.maxLength ?? ""}
                          onChange={(event) =>
                            patchQuestion(currentId, {
                              maxLength: event.target.value
                                ? Math.max(
                                    1,
                                    Math.min(10000, Number(event.target.value)),
                                  )
                                : null,
                            })
                          }
                        />
                      </label>
                      <label className="cl-checkbox">
                        <input
                          type="checkbox"
                          checked={activeQuestion.countSpaces !== false}
                          onChange={(event) =>
                            patchQuestion(currentId, {
                              countSpaces: event.target.checked,
                            })
                          }
                        />{" "}
                        공백 포함
                      </label>
                    </div>
                    {activeQuestion.sourceQuote && (
                      <details className="cl-source-quote">
                        <summary>공고에서 가져온 원문 확인</summary>
                        <blockquote>{activeQuestion.sourceQuote}</blockquote>
                      </details>
                    )}
                    {experiencePicker}

                  </section>
                )}
              </div>
            )}
            <div className="cl-next-row">
              <button
                className="cl-button"
                onClick={() => moveTo(letter.analysis ? 1 : 0)}
              >
                <ArrowLeft size={15} /> 이전
              </button>
              <button
                className="cl-button cl-button-dark"
                onClick={() => moveTo(3)}
              >
                자소서 작성하기 <ArrowRight size={15} />
              </button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="cl-step-heading">
              <div>
                <span className="cl-eyebrow">04 · 나다운 문장으로 완성</span>
                <h2>내가 한 일이 드러나게 써요.</h2>
                <p>
                  경험에 없는 성과는 만들지 않고, 판단과 행동을 구체적으로
                  풀어내요.
                </p>
              </div>
              <div className="cl-export-actions">
                <button
                  className="cl-button"
                  disabled={!answered}
                  onClick={() => copy(plainText())}
                >
                  <Copy size={14} /> 전체 복사
                </button>
                <button
                  className="cl-button"
                  disabled={!answered}
                  onClick={download}
                >
                  <Download size={14} /> TXT
                </button>
              </div>
            </div>
            {letter.analysis && letter.analysis.questionStatus !== "verified" && !activeQuestion?.question?.trim() && (
              <div className="cl-notice cl-writing-intake-notice">
                <p>{letter.analysis.questionNotice || "공개 페이지에서 실제 지원서 문항을 확인하지 못했어요."}</p>
                <p>실제 문항을 아래에 입력하고 추천 경험을 선택하면 이 화면에서 바로 초안을 작성할 수 있어요.</p>
                <div className="cl-missing-actions">
                  {safeLink(letter.analysis.applicationUrl || selectedApplicationUrl) && <a className="cl-button" href={safeLink(letter.analysis.applicationUrl || selectedApplicationUrl)} target="_blank" rel="noreferrer">실제 지원서 열기 <ExternalLink size={14} /></a>}
                  <button className="cl-button" onClick={() => { setShowQuestionPaste(true); setInputMode(letter.sourceUrl ? "url" : "text"); }}>지원서 문항 붙여넣기</button>
                  <button className="cl-button" onClick={() => setShowConnector(true)}><Link2 size={14} /> 로그인한 지원서에서 가져오기</button>
                </div>
              </div>
            )}
            {showQuestionPaste && questionPastePanel}
            <div className="cl-writing-layout">
              <aside className="cl-writing-sidebar">
                <div className="cl-question-nav">
                  {usableQuestions.map((question, index) => (
                    <button
                      key={question.id}
                      className={currentId === question.id ? "is-active" : ""}
                      onClick={() => setCurrent(question.id)}
                    >
                      <span>
                        문항 {index + 1}
                        {question.answer?.trim() && <Check size={14} />}
                      </span>
                      <strong>{question.question || "문항 미입력"}</strong>
                      <small>
                        {countCharacters(
                          question.answer || "",
                          question.countSpaces !== false,
                        )}
                        {question.maxLength ? ` / ${question.maxLength}` : ""}자
                        · 경험 {question.linkedExperienceIds?.length || 0}개
                      </small>
                    </button>
                  ))}
                </div>
                <button className="cl-button" disabled={usableQuestions.length >= 12} onClick={addQuestion}>
                  <Plus size={14} /> 문항 추가
                </button>
                <section className="cl-panel cl-style-panel">
                  <h3>문장의 결</h3>
                  <div className="cl-style-options">
                    {STYLES.map((style) => (
                      <button
                        key={style.id}
                        className={letter.style === style.id ? "is-active" : ""}
                        onClick={() => patch({ style: style.id })}
                      >
                        <strong>{style.label}</strong>
                        <small>{style.hint}</small>
                        {letter.style === style.id && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                  <details>
                    <summary>내 말투·지원 동기 더하기</summary>
                    <label className="cl-field">
                      내가 직접 쓴 문장 <span>선택</span>
                      <textarea
                        rows={4}
                        maxLength={3000}
                        value={letter.voiceSample}
                        onChange={(event) =>
                          patch({ voiceSample: event.target.value })
                        }
                        placeholder="평소 쓴 글 3~5문장을 넣으면 문장의 길이와 말투를 참고해요."
                      />
                    </label>
                    <label className="cl-field">
                      지원하는 이유·강조할 점 <span>선택</span>
                      <textarea
                        rows={4}
                        maxLength={3000}
                        value={letter.additionalContext}
                        onChange={(event) =>
                          patch({ additionalContext: event.target.value })
                        }
                        placeholder="왜 이 기업인지, 어떤 경험을 강조하고 싶은지 직접 적어주세요."
                      />
                    </label>
                  </details>
                </section>
              </aside>
              <section className="cl-panel cl-answer-panel">
                {activeQuestion ? (
                  <>
                    <div className="cl-answer-heading">
                      <SourceBadge question={activeQuestion} />
                      <h3>{activeQuestion.question || "지원서 문항을 입력하고 작성을 시작해요"}</h3>
                      {activeQuestion.source === "manual" && <WritingQuestionInput question={activeQuestion} onChange={(fields) => patchQuestion(currentId, fields)} />}
                      <div className="cl-linked-chips">
                        {activeQuestion.linkedExperienceIds?.map(
                          (experienceId) => (
                            <span key={experienceId}>
                              <Link2 size={11} />
                              {experiences.find(
                                (experience) => experience.id === experienceId,
                              )?.title || "연결한 경험"}
                            </span>
                          ),
                        )}
                        <button
                          className="cl-text-button"
                          onClick={() => moveTo(2)}
                        >
                          경험 변경
                        </button>
                      </div>
                    </div>
                    <details className="cl-writing-experience-picker" open key={currentId}>
                      <summary>문항에 맞는 추천 경험·선택 ({activeQuestion.linkedExperienceIds?.length || 0}/5)</summary>
                      {experiencePicker}
                    </details>
                    {contextRequest?.questionId === currentId && contextRequest.question === activeQuestion.question && (
                      <div className="cl-notice cl-context-request" role="status">
                        <strong>문항에 맞는 실제 경험이 필요해요</strong>
                        <p>{contextRequest.message}</p>
                        <label className="cl-field">
                          이 문항에 답할 실제 경험과 느낀 점
                          <textarea rows={4} maxLength={6000} value={letter.additionalContext}
                            onChange={(event) => patch({ additionalContext: event.target.value })}
                            placeholder="어떤 일을 직접 경험했고, 무엇을 느끼거나 배웠는지 적어주세요." />
                        </label>
                        <p>입력한 내용으로 다시 초안 쓰기를 누르면 됩니다. 작성 중인 답변은 그대로 유지됩니다.</p>
                      </div>
                    )}
                    <div className="cl-answer-toolbar">
                      <span>
                        {!hasQuestionPrompt(activeQuestion.question)
                          ? "실제 문항을 입력하면 경험으로 초안을 만들 수 있어요."
                          : !activeQuestion.linkedExperienceIds?.length && !letter.additionalContext.trim()
                            ? "문항에 맞는 경험을 선택하거나 실제 경험을 추가로 입력해주세요."
                            : busy === currentId
                          ? "경험을 읽고 문장을 쓰고 있어요…"
                          : activeQuestion.answer
                            ? "직접 수정하면서 내 문장으로 완성해요."
                            : "연결한 경험을 바탕으로 첫 초안을 만들어요."}
                      </span>
                      <button
                        className="cl-button cl-button-dark"
                        onClick={() => requestGeneration("")}
                        disabled={!canGenerate}
                      >
                        {busy === currentId ? (
                          <Loader2 className="animate-spin" size={15} />
                        ) : (
                          <Sparkles size={15} />
                        )}
                        {activeQuestion.answer
                          ? "초안 다시 쓰기"
                          : "경험으로 초안 쓰기"}
                      </button>
                    </div>
                    <textarea
                      className="cl-answer-editor"
                      aria-label="자소서 답변"
                      value={activeQuestion.answer || ""}
                      maxLength={20000}
                      onChange={(event) =>
                        patchQuestion(currentId, {
                          answer: event.target.value,
                          review: null,
                          evidence: [],
                          warnings: [],
                        })
                      }
                      placeholder="초안을 작성하거나 직접 입력해주세요. 기업 분석과 연결한 경험을 참고해 문항에 맞는 이야기를 씁니다."
                    />
                    <div className="cl-answer-count">
                      <button
                        className="cl-text-button"
                        disabled={!activeQuestion.answer}
                        onClick={() => copy(activeQuestion.answer)}
                      >
                        <Copy size={13} /> 답변 복사
                      </button>
                      <span
                        className={
                          activeTooLong ||
                          (activeQuestion.answer && activeTooShort)
                            ? "is-over"
                            : ""
                        }
                      >
                        {activeCount.toLocaleString()}{" "}
                        {activeQuestion.maxLength
                          ? `/ ${activeQuestion.maxLength.toLocaleString()}`
                          : ""}
                        자{" "}
                        <small>
                          공백{" "}
                          {activeQuestion.countSpaces !== false
                            ? "포함"
                            : "제외"}
                        </small>
                      </span>
                    </div>
                    {activeTooLong && (
                      <div className="cl-notice">
                        글자 수 제한을 넘었어요. 문장을 줄이거나 ‘더 간결하게’를
                        눌러 다듬어주세요.
                      </div>
                    )}
                    {activeQuestion.answer && activeTooShort && (
                      <div className="cl-notice">
                        최소 {activeQuestion.minLength.toLocaleString()}자 이상
                        작성해주세요. 실제 행동이나 판단을 더 설명해보세요.
                      </div>
                    )}
                    {!!activeQuestion.warnings?.length && (
                      <div className="cl-notice">
                        <strong>제출 전에 확인해주세요</strong>
                        <ul>
                          {activeQuestion.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!!activeQuestion.evidence?.length && (
                      <details className="cl-source-quote">
                        <summary>초안에 사용한 내 경험 근거</summary>
                        {activeQuestion.evidence.map((evidence, index) => (
                          <blockquote key={index}>
                            <strong>
                              {experiences.find(
                                (experience) =>
                                  experience.id === evidence.experienceId,
                              )?.title || "연결한 경험"}
                            </strong>
                            {evidence.quote}
                          </blockquote>
                        ))}
                      </details>
                    )}
                    {!!activeQuestion.answer && (
                      <div className="cl-refine">
                        <h4>문장 다듬기</h4>
                        <div className="cl-refine-buttons">
                          {[
                            "더 담백하게",
                            "더 간결하게",
                            "내 행동을 구체적으로",
                            "지원 직무와 연결하기",
                          ].map((text) => (
                            <button
                              className="cl-button"
                              key={text}
                              onClick={() => requestGeneration(text)}
                            >
                              {text}
                            </button>
                          ))}
                        </div>
                        <div className="cl-revision-input">
                          <input
                            aria-label="문장 수정 요청"
                            maxLength={1000}
                            placeholder="예: 첫 문장을 결론부터 쓰고, 추상적인 표현은 줄여줘"
                            value={revision}
                            onChange={(event) =>
                              setRevision(event.target.value)
                            }
                          />
                          <button
                            className="cl-button"
                            disabled={!revision.trim()}
                            onClick={() => requestGeneration(revision)}
                          >
                            반영하기 <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="cl-empty cl-empty-small">
                    <p>작성할 문항을 추가해주세요.</p>
                    <button
                      className="cl-button"
                      onClick={() => {
                        addQuestion();
                      }}
                    >
                      <Plus size={14} /> 문항 추가
                    </button>
                  </div>
                )}
              </section>
            </div>
            <div className="cl-next-row">
              <button className="cl-button" onClick={() => moveTo(2)}>
                <ArrowLeft size={15} /> 문항·경험 수정
              </button>
              <label className="cl-checkbox">
                <input
                  type="checkbox"
                  checked={letter.status === "final"}
                  disabled={
                    answered !== usableQuestions.length ||
                    !answered ||
                    usableQuestions.some(
                      (question) =>
                        !hasQuestionPrompt(question.question) ||
                        (question.maxLength &&
                          countCharacters(
                            question.answer || "",
                            question.countSpaces !== false,
                          ) > question.maxLength) ||
                        (question.minLength &&
                          countCharacters(
                            question.answer || "",
                            question.countSpaces !== false,
                          ) < question.minLength),
                    )
                  }
                  onChange={(event) =>
                    setLetter((previous) => ({
                      ...previous,
                      status: event.target.checked ? "final" : "draft",
                    }))
                  }
                />{" "}
                제출 전 확인 완료
              </label>
            </div>
          </>
        )}
      </fieldset>
      <ConfirmDialog
        open={!!pendingAction}
        title={pendingAction?.title || ""}
        message={pendingAction?.message || ""}
        confirmLabel={
          pendingAction?.type === "deleteQuestion" ? "삭제" : "계속하기"
        }
        tone={pendingAction?.type === "deleteQuestion" ? "danger" : "default"}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          const action = pendingAction;
          setPendingAction(null);
          if (action.type === "generate") generate(action.instruction);
          if (action.type === "analyze") analyze(action.options);
          if (action.type === "deleteQuestion") {
            const questions = letter.questions.filter(
              (question) => question.id !== action.questionId,
            );
            patch({ questions });
            setCurrent(questions[0]?.id || "");
          }
        }}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  FileText,
  Link2,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import useAuthStore from "../../stores/authStore";
import useCoverLetterStore from "../../stores/coverLetterStore";
import FileCat from "../../components/FileCat";
import ConfirmDialog from "../../components/ConfirmDialog";
import "./coverLetter.css";

function dateLabel(value) {
  const date = new Date(
    value?.seconds
      ? value.seconds * 1000
      : value?._seconds
        ? value._seconds * 1000
        : value,
  );
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ko-KR");
}

export default function CoverLetterHub() {
  const user = useAuthStore((s) => s.user);
  const {
    coverLetters,
    loading,
    loadError,
    fetchCoverLetters,
    deleteCoverLetter,
  } = useCoverLetterStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user?.uid) fetchCoverLetters(user.uid);
  }, [user?.uid, fetchCoverLetters]);
  const visible = (user ? coverLetters : []).filter((letter) =>
    [letter.title, letter.targetCompany, letter.targetPosition].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
  );
  const start = () =>
    user
      ? navigate("/app/coverletter/new")
      : navigate("/login", { state: { from: "/app/coverletter/new" } });
  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteCoverLetter(pendingDelete.id);
      setPendingDelete(null);
      toast.success("자기소개서를 삭제했어요");
    } catch (error) {
      toast.error(
        error.response?.data?.error || error.message || "삭제하지 못했어요",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="cl-page cl-hub">
      <div className="cl-page-heading">
        <div>
          <h1>자기소개서</h1>
          <p>기업이 찾는 사람과 내가 해온 일을 연결해요.</p>
        </div>
        <button className="cl-button cl-button-dark" onClick={start}>
          <Plus size={16} /> 새 자기소개서
        </button>
      </div>
      <section className="cl-start-card">
        <div className="cl-start-copy">
          <span className="cl-eyebrow">내 경험으로 쓰는, 기업 맞춤 자소서</span>
          <h2>
            공고 하나에서 시작해
            <br />내 이야기로 완성해요.
          </h2>
          <p>
            기업과 직무를 살펴보고, 문항에 맞는 경험을 골라
            <br className="hidden sm:block" /> 내가 말하는 듯한 자연스러운
            문장으로 풀어내요.
          </p>
          <button className="cl-button cl-button-dark" onClick={start}>
            공고로 시작하기 <ArrowRight size={16} />
          </button>
        </div>
        <div className="cl-start-visual">
          <FileCat variant="happy" file="document" className="cl-cat" />
          <div className="cl-paper">
            <span>
              <Building2 size={14} /> 지원 기업 분석
            </span>
            <span>
              <Link2 size={14} /> 내 경험 연결
            </span>
            <span>
              <FileText size={14} /> 문항별 맞춤 작성
            </span>
          </div>
        </div>
      </section>
      <div className="cl-process-strip">
        {[
          "공고·문항 가져오기",
          "기업과 직무 이해하기",
          "문항별 경험 연결하기",
          "내 말투로 쓰고 다듬기",
        ].map((text, index) => (
          <div key={text}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {text}
          </div>
        ))}
      </div>
      <div className="cl-library-heading">
        <h2>
          내 자기소개서 <span>{user ? coverLetters.length : 0}</span>
        </h2>
        <label className="cl-search">
          <Search size={16} />
          <input
            aria-label="자기소개서 검색"
            placeholder="기업, 직무, 제목 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      {user && loadError ? (
        <div className="cl-empty">
          <p>{loadError}</p>
          <button
            className="cl-button"
            onClick={() => fetchCoverLetters(user.uid)}
          >
            다시 불러오기
          </button>
        </div>
      ) : user && loading ? (
        <div className="cl-empty" role="status">
          <Loader2 className="animate-spin" size={24} />
          <p>자기소개서를 불러오고 있어요</p>
        </div>
      ) : visible.length ? (
        <div className="cl-letter-grid">
          {visible.map((letter) => {
            const questions = (letter.questions || []).filter((question) => question.validation !== "unverified");
            const answered = questions.filter((question) =>
              question.answer?.trim(),
            ).length;
            return (
              <article key={letter.id} className="cl-letter-card">
                <div className="cl-card-top">
                  <span className="cl-doc-icon">
                    <FileText size={20} />
                  </span>
                  <span className="cl-status">
                    {!questions.length ? "문항 확인 필요" : letter.status === "final" ? "작성 완료" : "작성 중"}
                  </span>
                  <button
                    aria-label={`${letter.title} 삭제`}
                    className="cl-icon-button"
                    onClick={() => setPendingDelete(letter)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <button
                  className="cl-card-link"
                  onClick={() => navigate(`/app/coverletter/edit/${letter.id}`)}
                >
                  <h3>{letter.title || "새 자기소개서"}</h3>
                  <p>
                    {letter.targetCompany || "기업 미지정"}
                    {letter.targetPosition ? ` · ${letter.targetPosition}` : ""}
                  </p>
                  <div className="cl-card-bottom">
                    <span>
                      {answered}/{questions.length} 문항 작성
                    </span>
                    <span>
                      {dateLabel(letter.updatedAt || letter.createdAt)}{" "}
                      <ArrowRight size={13} />
                    </span>
                  </div>
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="cl-empty">
          <FileText size={28} />
          <h3>
            {search ? "검색 결과가 없어요" : "첫 자기소개서를 만들어볼까요?"}
          </h3>
          <p>
            {search
              ? "다른 기업명이나 제목으로 찾아보세요."
              : "정리해둔 경험을 가져와 지원하는 기업에 맞게 써보세요."}
          </p>
          {!search && (
            <button className="cl-button" onClick={start}>
              자기소개서 만들기 <ArrowRight size={15} />
            </button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={!!pendingDelete}
        title="자기소개서를 삭제할까요?"
        message={`‘${pendingDelete?.title || "새 자기소개서"}’와 작성한 답변이 삭제됩니다.`}
        tone="danger"
        confirmLabel={deleting ? "삭제 중…" : "삭제"}
        onConfirm={remove}
        onCancel={() => !deleting && setPendingDelete(null)}
      />
    </div>
  );
}

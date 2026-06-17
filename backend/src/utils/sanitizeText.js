// AI가 프롬프트의 작성 지시 표기를 결과물에 그대로 흘려 넣는 경우가 있어
// (예: 【XYZ 공식】, "...구축함(X)", "[작성 필요]"), 사용자에게 보이는
// 내보내기 결과에서 이 흔적들을 제거한다. 정상 본문은 건드리지 않도록
// 트리거 문자가 없으면 즉시 반환한다.

const TRIGGER = /[【[（(]/; // 이 문자들이 없으면 제거할 표기도 없다

export function stripFormulaArtifacts(value) {
  if (typeof value !== 'string') return value;
  if (!TRIGGER.test(value)) return value;

  let s = value;
  // 【...】 형태의 지시 라벨(kicker): 【XYZ 공식】, 【피라미드+XYZ】, 【CARL】, 【Google XYZ】 등
  s = s.replace(/【[^】]*】/g, '');
  // 대괄호 안 공식/플레이스홀더: [XYZ 공식], [XYZ], [작성 필요], [검증 필요]
  s = s.replace(/\[[^\]]*(XYZ|공식|작성\s*필요|검증\s*필요)[^\]]*\]/gi, '');
  // 괄호로 감싸지 않은 'XYZ 공식' 잔여 표기
  s = s.replace(/XYZ\s*공식/gi, '');
  // (원본에 없음) 류 주석
  s = s.replace(/[（(]\s*원본에\s*없[음다][^）)]*[）)]/g, '');
  // 단독 (X)/(Y)/(Z) · [x]/[y]/[z] 마커 (대소문자, 전각 괄호 포함)
  s = s.replace(/\s*[（([]\s*[xXyYzZ]\s*[）)\]]/g, '');

  // 정리: 빈 괄호/대괄호, 중복 공백, 문장부호 앞 공백
  s = s.replace(/[（(]\s*[）)]/g, '');
  s = s.replace(/\[\s*\]/g, '');
  s = s.replace(/[ \t]{2,}/g, ' ');
  s = s.replace(/[ \t]+([.,)\]」』。、])/g, '$1');
  return s.trim();
}

// 객체/배열을 재귀적으로 순회하며 모든 문자열에 stripFormulaArtifacts 적용.
export function sanitizeArtifactsDeep(value) {
  if (typeof value === 'string') return stripFormulaArtifacts(value);
  if (Array.isArray(value)) return value.map(sanitizeArtifactsDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeArtifactsDeep(v);
    return out;
  }
  return value;
}

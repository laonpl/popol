// Amazon Bedrock API 키 연결 테스트 (Converse API, Bearer 토큰 인증)
//
//   backend/.env 에 아래 값을 넣은 뒤 backend 폴더에서 실행:
//     AWS_BEARER_TOKEN_BEDROCK=발급한_Bedrock_API키
//     BEDROCK_REGION=us-east-1                     (모델을 호출할 리전)
//     BEDROCK_MODEL_ID=모델ID                       (쉼표로 여러 개 → 차례로 각각 테스트)
//
//   기본 프롬프트:   node scripts/test-bedrock.mjs
//   프롬프트 지정:   node scripts/test-bedrock.mjs "자기소개 한 줄 써줘"
import 'dotenv/config';

const token = process.env.AWS_BEARER_TOKEN_BEDROCK;
const region = process.env.BEDROCK_REGION || 'us-east-1';
const modelIds = (process.env.BEDROCK_MODEL_ID || '').split(',').map(s => s.trim()).filter(Boolean);
const prompt = process.argv[2] || '취업 준비생의 프로젝트 경험을 정리하기 위해 꼭 물어봐야 할 질문 5개를 한국어로 작성해줘.';

const missing = [!token && 'AWS_BEARER_TOKEN_BEDROCK', !modelIds.length && 'BEDROCK_MODEL_ID'].filter(Boolean);
if (missing.length) {
  console.error(`❌ backend/.env 에 ${missing.join(', ')} 값이 없습니다.`);
  process.exit(1);
}

function hintFor(status, message) {
  if (/service control policy/i.test(message)) return '계정/조직 정책(SCP)이 이 리전에서 키 사용을 막고 있습니다(무료 플랜 제한 가능성). 호출이 되는 리전을 쓰거나 유료 플랜 전환 후 다시 시도하세요.';
  if (/being verified/i.test(message)) return 'AWS 계정 검증 중입니다. 검증 완료 메일을 받은 뒤 다시 시도하세요.';
  if (/not available for this account/i.test(message)) return '키는 정상이지만 이 계정에서 이 모델을 쓸 수 없습니다. 다른 모델(예: Amazon Nova)로 시도하세요.';
  if (/invalid api key|expired|security token/i.test(message)) return '키가 잘못됐거나 만료됐습니다. 단기 키는 최대 12시간만 유효합니다.';
  if (/on-demand throughput/i.test(message)) return '추론 프로파일 ID가 필요합니다. 모델 ID 앞에 리전 접두어(us./apac. 등)를 붙인 값을 쓰세요.';
  return {
    400: 'modelId 형식을 확인하세요. Playground의 API 예제 값을 그대로 쓰는 게 정확합니다.',
    403: '이 모델/리전 권한이 없습니다. 모델 접근 허용(Claude는 사용 목적 제출)과 리전을 확인하세요.',
    404: '이 리전에서 해당 모델을 찾을 수 없습니다. BEDROCK_REGION과 modelId를 확인하세요.',
    429: '호출 한도 초과입니다. 잠시 후 다시 시도하세요.',
  }[status];
}

async function testModel(modelId) {
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`;
  console.log(`\n▶ region=${region}  model=${modelId}  key=${token.slice(0, 6)}…(${token.length}자)`);

  const started = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 500 },
    }),
  });
  const body = await res.json().catch(() => ({}));
  const ms = Date.now() - started;

  if (!res.ok) {
    const message = body.message || body.Message || JSON.stringify(body);
    const hint = hintFor(res.status, message);
    console.error(`❌ HTTP ${res.status} (${ms}ms): ${message}`);
    if (hint) console.error(`   → ${hint}`);
    return false;
  }

  const text = (body.output?.message?.content || []).map(b => b.text).filter(Boolean).join('\n');
  console.log(`✅ 정상 응답 (${ms}ms)\n\n${text}\n`);
  console.log(`토큰 사용량: 입력 ${body.usage?.inputTokens} / 출력 ${body.usage?.outputTokens}  · stopReason=${body.stopReason}`);
  return true;
}

const results = [];
for (const modelId of modelIds) results.push([modelId, await testModel(modelId)]);

if (modelIds.length > 1) {
  console.log('\n── 요약 ──');
  for (const [modelId, ok] of results) console.log(`${ok ? '✅' : '❌'} ${modelId}`);
}
process.exit(results.every(([, ok]) => ok) ? 0 : 1);

import React from 'react';
import { createRoot } from 'react-dom/client';
import JobDiscoveryPanel from './src/components/JobDiscoveryPanel';
import CareerNarrativeSections from './src/components/CareerNarrativeSections';
import './src/index.css';
import './src/brand.css';
const experiences = [1, 2, 3].map((id) => ({ id, title: ['고객 인터뷰로 바꾼 예약 서비스', '전환율을 높인 온보딩 개선', '팀과 함께 만든 데이터 대시보드'][id-1], competencyTags: ['기획/전략', '문제해결'], createdAt: `2026-0${id+5}-03`, updatedAt: `2026-0${id+5}-14`, structuredResult: { identitySignal: { sentence: '작은 관찰에서 출발해, 근거 있는 변화를 만드는 사람입니다.', pattern: '사용자 중심으로 판단하기' }, keyExperiences: [{ title: '사용자 이탈 문제', decisionTrace: { newPrinciple: '빠르게 가설을 세우고 사용자에게 먼저 확인한다.', decisionCriteria: ['사용자 가치', '실행 가능성'] }, honestReview: { misjudgment: '기능이 많을수록 만족도가 높을 것이라 생각했다.', nextTime: '핵심 흐름부터 검증하고 확장한다.' }, evidenceBundle: [{ status: '확보됨' }] }] } }));
createRoot(document.getElementById('root')).render(<div className="app-shell" style={{background:'#f6f6f2',padding:'24px 14px'}}><main className="fp-experience-dashboard" style={{maxWidth:1000,margin:'auto'}}><div style={{background:'white',border:'2px solid #111',borderRadius:22,padding:'clamp(14px,3vw,30px)'}}><JobDiscoveryPanel targetRole="기획 / PM" experienceCount={13}/></div><CareerNarrativeSections experiences={experiences} targetCompetencies={['기획/전략','문제해결','협업']} /></main></div>);

import { adminDb } from './config/firebase.js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function listAllPortfolios() {
  console.log('🔄 Firestore에서 포트폴리오 데이터를 불러오는 중...');
  try {
    const snap = await adminDb.collection('portfolios').get();
    if (snap.empty) {
      console.log('❌ 저장된 포트폴리오가 없습니다.');
      return;
    }

    console.log(`📋 총 ${snap.size}개의 포트폴리오를 찾았습니다.\n`);
    
    const list = [];
    snap.forEach(doc => {
      const data = doc.data();
      list.push({
        id: doc.id,
        userName: data.userName || '(이름 없음)',
        headline: data.headline || '(헤드라인 없음)',
        templateId: data.templateId || 'notion',
        customSlug: data.customSlug || '',
        isPublic: !!data.isPublic,
        updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt) : 'N/A'
      });
    });

    fs.writeFileSync('./portfolios_list.json', JSON.stringify(list, null, 2), 'utf8');
    console.log('✅ portfolios_list.json 파일에 저장을 완료했습니다.');

  } catch (error) {
    console.error('❌ 포트폴리오 목록 조회 중 에러 발생:', error);
  }
  process.exit(0);
}

listAllPortfolios();

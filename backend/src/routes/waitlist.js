import express from 'express';
import { adminDb } from '../config/firebase.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { email } = req.body;
    
    // 이메일 유효성 검사
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '유효한 이메일 주소를 입력해주세요.' });
    }

    // 중복 체크
    const snapshot = await adminDb.collection('waitlist').where('email', '==', email).get();
    if (!snapshot.empty) {
      return res.status(400).json({ error: '이미 사전 예약된 이메일입니다.' });
    }

    // 데이터베이스 저장
    await adminDb.collection('waitlist').add({
      email,
      createdAt: new Date().toISOString()
    });

    return res.status(200).json({ message: '사전 예약이 완료되었습니다.' });
  } catch (error) {
    console.error('[Waitlist Error]', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

export default router;

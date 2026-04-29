import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 30000,
  socketTimeout: 30000,
});

export async function sendOtpEmail(to, otp) {
  const from = process.env.EMAIL_FROM || `FitPoly <${process.env.EMAIL_USER}>`;

  await transporter.sendMail({
    from,
    to,
    subject: '[FitPoly] 이메일 인증 코드',
    html: `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Apple SD Gothic Neo',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- 헤더 -->
        <tr>
          <td style="background:linear-gradient(135deg,#3b5bdb,#5c7cfa);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">FitPoly</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">이메일 인증</p>
          </td>
        </tr>
        <!-- 본문 -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;color:#495057;font-size:15px;">안녕하세요!</p>
            <p style="margin:0 0 32px;color:#495057;font-size:15px;line-height:1.6;">아래 <strong>6자리 인증 코드</strong>를 입력하여 이메일 인증을 완료해주세요.<br>코드는 <strong>15분 후</strong> 만료됩니다.</p>
            <!-- OTP 코드 박스 -->
            <div style="background:#f0f4ff;border:2px solid #c5d0fc;border-radius:12px;padding:28px;text-align:center;margin-bottom:32px;">
              <p style="margin:0 0 8px;color:#748ffc;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">인증 코드</p>
              <p style="margin:0;color:#3b5bdb;font-size:48px;font-weight:800;letter-spacing:12px;font-variant-numeric:tabular-nums;">${otp}</p>
            </div>
            <p style="margin:0;color:#adb5bd;font-size:13px;line-height:1.6;">
              본인이 요청하지 않은 경우 이 이메일을 무시하세요.<br>
              코드를 타인에게 공유하지 마세요.
            </p>
          </td>
        </tr>
        <!-- 푸터 -->
        <tr>
          <td style="background:#f8f9fa;padding:20px 40px;border-top:1px solid #e9ecef;text-align:center;">
            <p style="margin:0;color:#adb5bd;font-size:12px;">© 2025 FitPoly. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

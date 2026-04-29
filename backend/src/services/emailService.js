import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import dns from 'dns/promises';

const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const resendApiKey = process.env.RESEND_API_KEY;
const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const googleRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

async function resolveSmtpHosts(host) {
  try {
    const ipv4List = await dns.resolve4(host);
    if (ipv4List && ipv4List.length > 0) {
      return ipv4List.map(ip => ({ host: ip, servername: host }));
    }
  } catch (e) {
    logEmail(`[WARN] IPv4 DNS 조회 실패: ${host} - ${e.message}`);
  }
  return [{ host, servername: host }];
}

function getTransportPlan() {
  const envPort = Number(process.env.EMAIL_PORT || 587);
  const envSecure = process.env.EMAIL_SECURE === 'true';
  const plan = [{ port: envPort, secure: envSecure }];

  // Render 환경에서 587 타임아웃이 날 수 있어 Gmail 465 TLS를 폴백으로 시도
  if (!(envPort === 465 && envSecure === true)) {
    plan.push({ port: 465, secure: true });
  }

  return plan;
}

function hasGoogleApiConfig() {
  return Boolean(googleClientId && googleClientSecret && googleRefreshToken && emailUser);
}

async function getGmailAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: googleRefreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Google OAuth token fetch failed: ${response.status} ${body}`);
    err.code = 'GOOGLE_OAUTH_FAILED';
    throw err;
  }

  const data = await response.json();
  if (!data.access_token) {
    const err = new Error('Google OAuth token missing access_token');
    err.code = 'GOOGLE_OAUTH_FAILED';
    throw err;
  }

  return data.access_token;
}

function buildRawMimeMessage({ from, to, subject, html }) {
  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    html,
  ].join('\r\n');

  return Buffer.from(mime)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function sendWithGmailApi({ to, from, subject, html }) {
  if (!hasGoogleApiConfig()) {
    throw Object.assign(new Error('Google OAuth env is not configured'), { code: 'GOOGLE_OAUTH_NOT_CONFIGURED' });
  }

  const accessToken = await getGmailAccessToken();
  const raw = buildRawMimeMessage({ from, to, subject, html });
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Gmail API send failed: ${response.status} ${body}`);
    err.code = 'GMAIL_API_SEND_FAILED';
    throw err;
  }

  const data = await response.json();
  return { messageId: data.id };
}

async function sendWithResend({ to, from, subject, html }) {
  if (!resendApiKey) {
    throw Object.assign(new Error('RESEND_API_KEY is not set'), { code: 'RESEND_NOT_CONFIGURED' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      const err = new Error(`Resend API ${response.status}: ${body}`);
      err.code = 'RESEND_API_ERROR';
      throw err;
    }

    const data = await response.json();
    return { messageId: data.id };
  } catch (error) {
    if (error.name === 'AbortError') {
      const err = new Error('Resend API timeout');
      err.code = 'ETIMEDOUT';
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// 이메일 발송 로그 파일 경로
const emailLogPath = path.join(process.cwd(), 'email-logs.txt');

function logEmail(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(emailLogPath, logEntry, 'utf8');
  console.log(logEntry);
}

export async function sendOtpEmail(to, otp) {
  const from = process.env.EMAIL_FROM || `FitPoly <${emailUser}>`;
  const transportPlan = getTransportPlan();
  let lastError = null;
  const smtpHosts = Array.from(new Set([emailHost, 'smtp.googlemail.com']));
  const subject = '[FitPoly] 이메일 인증 코드';
  const html = `
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
        <tr>
          <td style="background:#f8f9fa;padding:20px 40px;border-top:1px solid #e9ecef;text-align:center;">
            <p style="margin:0;color:#adb5bd;font-size:12px;">© 2025 FitPoly. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  logEmail(`[START] OTP 발송 시작: ${to}`);

  // 1) HTTP 기반 메일 API를 우선 시도해 Render SMTP 네트워크 문제를 우회
  if (hasGoogleApiConfig()) {
    try {
      const result = await sendWithGmailApi({ to, from, subject, html });
      logEmail(`[SUCCESS] OTP 발송 완료(Gmail API): ${to} (Message ID: ${result.messageId})`);
      return result;
    } catch (error) {
      lastError = error;
      logEmail(`[ERROR] Gmail API 발송 실패: ${to} - ${error.message}`);
    }
  }

  if (resendApiKey) {
    try {
      const result = await sendWithResend({ to, from, subject, html });
      logEmail(`[SUCCESS] OTP 발송 완료(Resend): ${to} (Message ID: ${result.messageId})`);
      return result;
    } catch (error) {
      lastError = error;
      logEmail(`[ERROR] Resend 발송 실패: ${to} - ${error.message}`);
    }
  }

  for (const hostName of smtpHosts) {
    const smtpTargets = await resolveSmtpHosts(hostName);
    for (const transport of transportPlan) {
      for (const smtpTarget of smtpTargets) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpTarget.host,
            port: transport.port,
            secure: transport.secure,
            family: 4,
            auth: {
              user: emailUser,
              pass: emailPass,
            },
            connectionTimeout: 12000,
            greetingTimeout: 12000,
            socketTimeout: 12000,
            tls: {
              servername: smtpTarget.servername,
            },
          });
          logEmail(`[TRY] SMTP ${smtpTarget.host}:${transport.port} secure=${transport.secure} (servername=${smtpTarget.servername})`);

          const result = await transporter.sendMail({
            from,
            to,
            subject,
            html,
          });

          logEmail(`[SUCCESS] OTP 발송 완료: ${to} (Message ID: ${result.messageId})`);
          return result;
        } catch (error) {
          lastError = error;
          logEmail(`[ERROR] OTP 발송 실패: ${to} - ${error.message} (${smtpTarget.servername}:${transport.port})`);
        }
      }
    }
  }

  logEmail(`[DEBUG] Email Config - HOST: ${emailHost}, USER: ${emailUser}, PASS: ${emailPass ? '***' : 'NOT SET'}`);

  const wrappedError = new Error(lastError?.message || '이메일 발송에 실패했습니다');
  wrappedError.code = lastError?.code;
  wrappedError.responseCode = lastError?.responseCode;
  throw wrappedError;
}

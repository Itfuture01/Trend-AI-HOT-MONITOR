import webpush from 'web-push';
import nodemailer from 'nodemailer';
import { config, appendToEnv } from './config.js';
import { db } from './db.js';
import { broadcast } from './events.js';

let emailTransport = null;
let vapidReady = false;

// 首次启动自动生成 VAPID 密钥并写回 .env
export function ensureVapidKeys() {
  if (config.vapidPublicKey && config.vapidPrivateKey) {
    webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
    vapidReady = true;
    return;
  }
  const keys = webpush.generateVAPIDKeys();
  appendToEnv('VAPID_PUBLIC_KEY', keys.publicKey);
  appendToEnv('VAPID_PRIVATE_KEY', keys.privateKey);
  config.vapidPublicKey = keys.publicKey;
  config.vapidPrivateKey = keys.privateKey;
  webpush.setVapidDetails(config.vapidSubject, keys.publicKey, keys.privateKey);
  vapidReady = true;
  console.log('[notify] 已生成 VAPID 密钥并写入 .env');
}

export function vapidPublicKey() {
  return config.vapidPublicKey;
}

export function emailEnabled() {
  return !!(config.smtp.host && config.smtp.user && config.smtp.pass && config.smtp.from && config.smtp.to);
}

function getEmailTransport() {
  if (!emailEnabled()) return null;
  if (!emailTransport) {
    emailTransport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return emailTransport;
}

export async function sendEmail({ subject, text, html }) {
  const transport = getEmailTransport();
  if (!transport) return { ok: false, error: 'SMTP 未配置' };
  try {
    await transport.sendMail({ from: config.smtp.from, to: config.smtp.to, subject, text, html });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function sendPushToAll(payload) {
  if (!vapidReady) return { ok: false, error: 'VAPID 未初始化' };
  const subs = db.prepare('SELECT * FROM push_subscriptions').all();
  if (!subs.length) return { ok: false, error: '无浏览器订阅' };
  const payloadStr = JSON.stringify(payload);
  const results = [];
  for (const sub of subs) {
    const subscription = { endpoint: sub.endpoint, keys: JSON.parse(sub.keys_json || '{}') };
    try {
      await webpush.sendNotification(subscription, payloadStr);
      results.push({ ok: true });
    } catch (e) {
      results.push({ ok: false, error: e.message });
      // 订阅失效则清理
      if (e.statusCode === 404 || e.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
      }
    }
  }
  const okCount = results.filter((r) => r.ok).length;
  return { ok: okCount > 0, sent: okCount, total: results.length, results };
}

// 核心：告警 + 多渠道通知 + 落库
export async function notifyAlert({ keyword_id, keyword, title, url, source, reason, ai_verdict }) {
  const sentVia = [];

  const emailRes = emailEnabled()
    ? await sendEmail({
        subject: `[TrendMonitor] 关键词「${keyword}」命中`,
        text: `${title}\n来源：${source}\n链接：${url}\n\n${reason || ''}`,
        html: `<h3>🔥 关键词「${keyword}」命中</h3><p><b>${title}</b></p><p>来源：${source}</p><p><a href="${url}">${url}</a></p><p>${reason || ''}</p>`,
      })
    : { ok: false, error: '未配置' };
  if (emailRes.ok) sentVia.push('email');

  const pushRes = await sendPushToAll({ title: `关键词「${keyword}」命中`, body: title, url });
  if (pushRes.ok) sentVia.push('push');

  const sentViaStr = sentVia.join(',') || 'none';
  const info = db.prepare(
    'INSERT INTO alerts (keyword_id, keyword, title, url, source, reason, ai_verdict, sent_via) VALUES (?,?,?,?,?,?,?,?)',
  ).run(
    keyword_id ?? null,
    keyword ?? null,
    title ?? null,
    url ?? null,
    source ?? null,
    reason ?? null,
    ai_verdict ?? null,
    sentViaStr,
  );

  const alert = {
    id: info.lastInsertRowid,
    keyword,
    title,
    url,
    source,
    reason,
    ai_verdict,
    sentVia: sentViaStr,
    createdAt: new Date().toISOString(),
  };
  broadcast('alert', alert);

  return { sentVia: sentViaStr, email: emailRes, push: pushRes, alert };
}

export async function testEmail() {
  return sendEmail({
    subject: '[TrendMonitor] 测试邮件',
    text: '这是一封测试邮件，说明 SMTP 配置正确。',
    html: '<p>这是一封<b>测试邮件</b>，说明 SMTP 配置正确。</p>',
  });
}

export async function testPush() {
  return sendPushToAll({ title: '[TrendMonitor] 测试推送', body: '浏览器推送已连通 ✅', url: '/' });
}

import { useEffect, useState } from 'react';
import { api, urlBase64ToUint8Array } from '../api.js';
import { IconX } from './icons.jsx';

function Dot({ on, color = '#4ade80' }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: on ? color : '#334155', boxShadow: on ? `0 0 8px ${color}` : 'none' }}
    />
  );
}

function Row({ label, value, on, color }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <span className="text-sm text-fg">{label}</span>
      <div className="flex items-center gap-2 font-mono text-xs text-muted">
        {value && <span className="max-w-[200px] truncate">{value}</span>}
        <Dot on={on} color={color} />
      </div>
    </div>
  );
}

function Toggle({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-white/15'}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
          on ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

function subscriptionToPlain(sub) {
  const key = (b) => (b ? btoa(String.fromCharCode(...new Uint8Array(b))) : null);
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: key(sub.getKey('p256dh')), auth: key(sub.getKey('auth')) },
  };
}

export default function Settings({ stats, onClose, onChanged }) {
  const [pushState, setPushState] = useState('checking'); // checking | on | off | unsupported
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [sources, setSources] = useState([]);

  useEffect(() => {
    api
      .sources()
      .then((d) => setSources(d.sources || []))
      .catch(() => {});
  }, []);

  // 初始推送状态（注册 SW + 检查已有订阅）
  useEffect(() => {
    let active = true;
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushState('unsupported');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const sub = await reg.pushManager.getSubscription();
        if (active) setPushState(sub ? 'on' : 'off');
      } catch {
        if (active) setPushState('off');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function enablePush() {
    setBusy(true);
    setMsg('');
    try {
      // 显式请求通知权限：权限未决时 pushManager.subscribe 可能直接失败
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        setMsg('❌ 通知权限被拒绝，请在浏览器地址栏点击锁/信息图标 → 允许通知后重试');
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw.js');
      const { publicKey } = await api.vapidPublicKey();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await api.subscribe(subscriptionToPlain(sub));
      setPushState('on');
      setMsg('✅ 浏览器推送已开启');
      await onChanged();
    } catch (e) {
      setMsg('❌ 订阅失败：' + e.message + (e.name === 'NotAllowedError' ? '（通知权限被拒绝）' : ''));
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setMsg('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await api.unsubscribe(sub.endpoint);
      }
      setPushState('off');
      setMsg('浏览器推送已关闭');
      await onChanged();
    } catch (e) {
      setMsg('❌ 操作失败：' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleSource(name, enabled) {
    try {
      await api.setSource(name, enabled);
      setSources((prev) => prev.map((s) => (s.name === name ? { ...s, enabled: enabled ? 1 : 0 } : s)));
      setMsg('');
    } catch (e) {
      setMsg('❌ ' + e.message);
    }
  }

  async function test(type) {
    setBusy(true);
    setMsg('');
    try {
      const r = type === 'email' ? await api.testEmail() : await api.testPush();
      setMsg(r.ok ? '✅ 发送成功' : '❌ ' + (r.error || '失败'));
    } catch (e) {
      setMsg('❌ ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  const pushLabel =
    pushState === 'on'
      ? `${stats?.subscriptions || 0} 个订阅`
      : pushState === 'unsupported'
        ? '当前浏览器不支持'
        : '未开启';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="设置"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono text-sm font-semibold tracking-wider text-fg">系统状态 · 通知与数据源</h2>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:text-fg"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {/* 系统状态 */}
        <div className="space-y-2">
          <Row label="AI 分析（OpenRouter）" value={stats?.aiEnabled ? stats?.model : ''} on={stats?.aiEnabled} />
          <Row label="邮件通知（SMTP）" value={stats?.emailEnabled ? '已配置' : ''} on={stats?.emailEnabled} />
          <Row label="浏览器推送" value={pushLabel} on={pushState === 'on'} />
          <Row
            label="Twitter / X 源"
            value={stats?.twitterEnabled ? '已连接' : '未配置 key'}
            on={stats?.twitterEnabled}
            color="#60a5fa"
          />
          <Row label="网络代理" value={stats?.hasProxy ? '已启用' : ''} on={stats?.hasProxy} color="#a78bfa" />
        </div>

        {/* 通知操作 */}
        <div className="mt-5 flex flex-wrap gap-2">
          {pushState !== 'unsupported' && (
            <button
              onClick={pushState === 'on' ? disablePush : enablePush}
              disabled={busy}
              className="flex-1 rounded-lg bg-accent px-3 py-2 font-mono text-xs font-semibold text-[#052e16] transition hover:bg-signal disabled:opacity-50"
            >
              {pushState === 'on' ? '关闭推送' : '开启推送'}
            </button>
          )}
          <button
            onClick={() => test('email')}
            disabled={busy || !stats?.emailEnabled}
            className="flex-1 rounded-lg border border-white/10 px-3 py-2 font-mono text-xs text-fg transition hover:border-white/20 disabled:opacity-40"
          >
            测试邮件
          </button>
          <button
            onClick={() => test('push')}
            disabled={busy || pushState !== 'on'}
            className="flex-1 rounded-lg border border-white/10 px-3 py-2 font-mono text-xs text-fg transition hover:border-white/20 disabled:opacity-40"
          >
            测试推送
          </button>
        </div>

        {/* 数据源管理 */}
        <div className="mt-6 border-t border-white/5 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-mono text-sm font-semibold tracking-wider text-fg">数据源管理</h3>
            <span className="font-mono text-xs text-muted">
              {sources.filter((s) => s.enabled).length}/{sources.length}
            </span>
          </div>
          <ul className="space-y-1.5">
            {sources.length === 0 && (
              <li className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-muted">
                加载中…
              </li>
            )}
            {sources.map((s) => (
              <li
                key={s.name}
                className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-fg">{s.label || s.name}</div>
                  {s.note && <div className="truncate text-[11px] text-muted">{s.note}</div>}
                </div>
                <Toggle
                  on={!!s.enabled}
                  onChange={() => toggleSource(s.name, !s.enabled)}
                  label={`${s.label || s.name} 开关`}
                />
              </li>
            ))}
          </ul>
        </div>

        {msg && <p className="mt-3 text-center text-xs text-muted">{msg}</p>}
      </div>
    </div>
  );
}

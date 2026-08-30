import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api.js';
import StatusBar from './components/StatusBar.jsx';
import Radar from './components/Radar.jsx';
import StatCards from './components/StatCards.jsx';
import KeywordPanel from './components/KeywordPanel.jsx';
import HotspotList from './components/HotspotList.jsx';
import SearchView from './components/SearchView.jsx';
import AlertStream from './components/AlertStream.jsx';
import Settings from './components/Settings.jsx';
import { AuroraBackground } from './components/ui/aurora-background.jsx';
import { Meteors } from './components/ui/meteors.jsx';
import { IconRadar, IconHash, IconSearch } from './components/icons.jsx';

const TABS = [
  { key: 'radar', label: '热点雷达', Icon: IconRadar },
  { key: 'keywords', label: '监控词', Icon: IconHash },
  { key: 'search', label: '搜索关键词', Icon: IconSearch },
];

export default function App() {
  const [tab, setTab] = useState('radar');
  const [stats, setStats] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [range, setRange] = useState('');
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 1 });
  const [keywords, setKeywords] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scanTimer = useRef(null);

  const load = useCallback(
    async (rng = range, pg = page) => {
      try {
        const [s, h, k, a] = await Promise.all([
          api.stats(),
          api.hotspots(rng, pg, 20),
          api.keywords(),
          api.alerts(),
        ]);
        setStats(s);
        setHotspots(h.hotspots || []);
        setRanges(h.ranges || []);
        setPageInfo({ total: h.total || 0, totalPages: h.totalPages || 1 });
        setKeywords(k.keywords || []);
        setAlerts(a.alerts || []);
      } catch (e) {
        console.error('[load]', e);
      }
    },
    [range, page],
  );

  useEffect(() => {
    load();
  }, [load]);

  // SSE 实时连接
  useEffect(() => {
    const es = new EventSource('/api/events');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener('alert', () => load());
    es.addEventListener('scan-done', () => {
      setScanning(false);
      load();
    });
    return () => es.close();
  }, [load]);

  const handleRange = (r) => {
    setRange(r);
    setPage(1);
  };

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      await api.scan();
    } catch (e) {
      console.error(e);
      setScanning(false);
    }
    clearTimeout(scanTimer.current);
    scanTimer.current = setTimeout(() => {
      setScanning(false);
      load();
    }, 90000);
  };

  return (
    <div className="relative min-h-screen pb-12">
      <AuroraBackground />
      <div className="tech-scanlines pointer-events-none fixed inset-0 z-[1]" aria-hidden="true" />
      <StatusBar
        stats={stats}
        connected={connected}
        scanning={scanning}
        onScan={handleScan}
        onOpenSettings={() => setSettingsOpen(true)}
        alerts={alerts}
      />

      {/* Tab 图标导航 */}
      <nav className="relative z-10 mx-auto mt-5 flex max-w-[1500px] items-center justify-center px-4 lg:px-6">
        <div className="flex items-center gap-1 rounded-2xl border border-white/8 bg-white/[0.03] p-1.5 backdrop-blur-md">
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-sm transition ${
                  active
                    ? 'bg-accent/15 text-signal shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]'
                    : 'text-muted hover:bg-white/5 hover:text-fg'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="relative z-10 mx-auto mt-5 max-w-[1500px] px-4 lg:px-6">
        {/* 热点雷达：从上往下 统计指标 → 雷达图 → 热点信号 */}
        {tab === 'radar' && (
          <div className="space-y-5">
            <StatCards stats={stats} />
            <div className="glass relative overflow-hidden rounded-2xl p-5">
              <Meteors number={10} color="#22d3ee" className="opacity-40" />
              <Radar hotspots={hotspots} range={range} total={pageInfo.total} />
              <p className="mt-3 text-center font-mono text-xs text-muted">
                光点越亮越大 → 相关性越强 · 点击光点跳转原文
              </p>
            </div>
            <HotspotList
              hotspots={hotspots}
              ranges={ranges}
              range={range}
              onRange={handleRange}
              page={page}
              total={pageInfo.total}
              totalPages={pageInfo.totalPages}
              onPage={setPage}
            />
          </div>
        )}

        {/* 监控词：双栏（左关键词 / 右告警流） */}
        {tab === 'keywords' && (
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <KeywordPanel keywords={keywords} onChanged={load} />
            </div>
            <div className="lg:col-span-7">
              <AlertStream alerts={alerts} onCleared={load} />
            </div>
          </div>
        )}

        {/* 搜索关键词 */}
        {tab === 'search' && <SearchView />}
      </main>

      {settingsOpen && <Settings stats={stats} onClose={() => setSettingsOpen(false)} onChanged={load} />}
    </div>
  );
}

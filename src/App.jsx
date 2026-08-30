import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api.js';
import StatusBar from './components/StatusBar.jsx';
import Radar from './components/Radar.jsx';
import StatCards from './components/StatCards.jsx';
import KeywordPanel from './components/KeywordPanel.jsx';
import HotspotList from './components/HotspotList.jsx';
import Settings from './components/Settings.jsx';
import { AuroraBackground } from './components/ui/aurora-background.jsx';

export default function App() {
  const [stats, setStats] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [range, setRange] = useState('');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 1 });
  const [keywords, setKeywords] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scanTimer = useRef(null);

  const load = useCallback(
    async (rng = range, pg = page, q = query) => {
      try {
        const [s, h, k, a] = await Promise.all([
          api.stats(),
          api.hotspots(rng, pg, 20, q),
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
    [range, page, query],
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

  const handleQuery = (q) => {
    setQuery(q);
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

      <main className="relative z-10 mx-auto mt-6 grid max-w-[1500px] grid-cols-1 items-start gap-5 px-4 lg:grid-cols-12 lg:px-6">
        {/* 中上方：热点雷达（映衬项目名，光点可点击跳转原文） */}
        <div className="lg:col-span-12">
          <div className="glass relative overflow-hidden rounded-2xl p-6">
            <Radar hotspots={hotspots} range={range} total={pageInfo.total} />
            <p className="mt-3 text-center font-mono text-xs text-muted">
              光点越亮越大 → 相关性越强 · 点击光点跳转原文
            </p>
          </div>
        </div>

        {/* 统计指标 */}
        <div className="lg:col-span-12">
          <StatCards stats={stats} />
        </div>

        {/* 左：关键词监控 */}
        <div className="order-2 lg:order-none lg:col-span-3">
          <KeywordPanel keywords={keywords} onChanged={load} />
        </div>

        {/* 主体：热点列表 */}
        <div className="order-1 lg:order-none lg:col-span-9">
          <HotspotList
            hotspots={hotspots}
            ranges={ranges}
            range={range}
            onRange={handleRange}
            query={query}
            onQuery={handleQuery}
            page={page}
            total={pageInfo.total}
            totalPages={pageInfo.totalPages}
            onPage={setPage}
          />
        </div>
      </main>

      {settingsOpen && <Settings stats={stats} onClose={() => setSettingsOpen(false)} onChanged={load} />}
    </div>
  );
}

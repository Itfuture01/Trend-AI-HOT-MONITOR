import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api.js';
import StatusBar from './components/StatusBar.jsx';
import StatCards from './components/StatCards.jsx';
import KeywordPanel from './components/KeywordPanel.jsx';
import HotspotList from './components/HotspotList.jsx';
import Settings from './components/Settings.jsx';

export default function App() {
  const [stats, setStats] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [range, setRange] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scanTimer = useRef(null);

  const load = useCallback(
    async (rng = range) => {
      try {
        const [s, h, k, a] = await Promise.all([
          api.stats(),
          api.hotspots(rng),
          api.keywords(),
          api.alerts(),
        ]);
        setStats(s);
        setHotspots(h.hotspots || []);
        setRanges(h.ranges || []);
        setKeywords(k.keywords || []);
        setAlerts(a.alerts || []);
      } catch (e) {
        console.error('[load]', e);
      }
    },
    [range],
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
    <div className="min-h-screen pb-12">
      <StatusBar
        stats={stats}
        connected={connected}
        scanning={scanning}
        onScan={handleScan}
        onOpenSettings={() => setSettingsOpen(true)}
        alerts={alerts}
      />

      <main className="mx-auto mt-6 grid max-w-[1500px] grid-cols-1 items-start gap-5 px-4 lg:grid-cols-12 lg:px-6">
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
          <HotspotList hotspots={hotspots} ranges={ranges} range={range} onRange={setRange} />
        </div>
      </main>

      {settingsOpen && <Settings stats={stats} onClose={() => setSettingsOpen(false)} onChanged={load} />}
    </div>
  );
}

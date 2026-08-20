// src/app/extractemailfacebookurlfromwebsite/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";

interface LogEntry {
  name: string;
  status: string;
  email?: string;
  fb?: string;
}

interface Stats {
  total: number;
  extracted: number;
  working: number;
  broken: number;
  pending: number;
}

export default function ExtractEmailFacebookPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const isRunningRef = useRef(false);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/extractemailfacebookurlfromwebsite");
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error("Failed to load stats", e);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const runExtraction = async () => {
    setIsRunning(true);
    isRunningRef.current = true;

    while (isRunningRef.current) {
      try {
        const res = await fetch("/api/extractemailfacebookurlfromwebsite", { method: "POST" });
        const data = await res.json();

        if (data.logs && data.logs.length > 0) {
          setLogs((prev) => [...data.logs, ...prev].slice(0, 100));
        }

        await fetchStats();

        if (!data.success || data.remaining === 0) {
          isRunningRef.current = false;
          setIsRunning(false);
          break;
        }
      } catch (err) {
        console.error("Batch error:", err);
        isRunningRef.current = false;
        setIsRunning(false);
        break;
      }
    }
  };

  const stopExtraction = () => {
    isRunningRef.current = false;
    setIsRunning(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Website Email & Facebook Extractor</h1>
            <p className="text-sm text-slate-400 mt-1">
              Extracts social profiles and contact emails from business sites while flagging offline domains.
            </p>
          </div>
          <div className="flex gap-3">
            {!isRunning ? (
              <button
                onClick={runExtraction}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 font-medium rounded-lg shadow-sm transition"
              >
                Start Extraction
              </button>
            ) : (
              <button
                onClick={stopExtraction}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 font-medium rounded-lg shadow-sm transition"
              >
                Pause Extraction
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <p className="text-xs text-slate-400 uppercase font-semibold">Total Leads</p>
            <p className="text-2xl font-bold text-white mt-1">{stats?.total ?? "-"}</p>
          </div>
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <p className="text-xs text-slate-400 uppercase font-semibold">Extracted</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{stats?.extracted ?? "-"}</p>
          </div>
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <p className="text-xs text-slate-400 uppercase font-semibold">Pending</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{stats?.pending ?? "-"}</p>
          </div>
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <p className="text-xs text-slate-400 uppercase font-semibold">Active Sites</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{stats?.working ?? "-"}</p>
          </div>
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <p className="text-xs text-slate-400 uppercase font-semibold">Offline / Errors</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">{stats?.broken ?? "-"}</p>
          </div>
        </div>

        {/* Live Activity Logs */}
        <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-5">
          <h2 className="text-sm font-semibold uppercase text-slate-400 mb-4 tracking-wide">
            Live Execution Feed {isRunning && <span className="inline-block w-2 h-2 ml-2 bg-emerald-400 rounded-full animate-ping" />}
          </h2>
          
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-slate-500 py-6 text-center">No batch runs recorded in this session. Click Start Extraction to begin.</p>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="p-3 bg-slate-900/80 rounded border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-slate-200">{log.name}</span>
                    {log.email && <span className="text-emerald-400 ml-3">📧 {log.email}</span>}
                    {log.fb && <span className="text-blue-400 ml-3">🔗 {log.fb}</span>}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] ${log.status === "Success" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : "bg-rose-950 text-rose-300 border border-rose-800"}`}>
                    {log.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
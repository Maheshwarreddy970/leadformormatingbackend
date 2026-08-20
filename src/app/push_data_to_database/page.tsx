// src/app/push_data_to_database/page.tsx
"use client";

import { useState, useRef } from "react";

export default function PushDataPage() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState("");
  const isCanceled = useRef(false);

  const handlePush = async () => {
    setLoading(true);
    setMessage("Starting import process...");
    setProgress(0);
    isCanceled.current = false;
    
    let offset = 0;
    const batchSize = 100;
    let keepGoing = true;

    while (keepGoing && !isCanceled.current) {
      try {
        const res = await fetch("/api/import-leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, batchSize }),
        });
        
        const data = await res.json();

        if (data.success) {
          offset += batchSize;
          setTotal(data.total);
          setProgress(Math.min(offset, data.total));
          setMessage(`Processing... ${Math.min(offset, data.total)} / ${data.total} leads pushed.`);
          
          if (!data.hasMore) {
            keepGoing = false;
            setMessage(`Done! Successfully pushed all ${data.total} unique records to Neon DB.`);
          }
        } else {
          setMessage(`Error: ${data.error}`);
          keepGoing = false;
        }
      } catch (err: any) {
        setMessage(`Network Error: ${err.message}`);
        keepGoing = false;
      }
    }

    setLoading(false);
  };

  const handleCancel = () => {
    isCanceled.current = true;
    setMessage("Import canceled. You can resume by clicking Push Data again.");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-md">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Push Leads to Database</h1>
        
        <p className="text-sm text-gray-600 mb-6">
          This system processes leads in batches of 100 to prevent database connection timeouts.
        </p>

        <div className="flex gap-2">
          <button
            onClick={handlePush}
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Importing..." : "Push Data to Database"}
          </button>
          
          {loading && (
            <button
              onClick={handleCancel}
              className="rounded-lg bg-red-100 text-red-600 px-4 py-2.5 font-semibold hover:bg-red-200"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Progress Bar UI */}
        {total > 0 && (
          <div className="mt-6">
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${(progress / total) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-center text-gray-500 font-medium">
              {Math.round((progress / total) * 100)}% Complete
            </p>
          </div>
        )}

        {message && (
          <div className={`mt-4 rounded-lg p-3 text-sm font-medium ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-800'} break-words`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
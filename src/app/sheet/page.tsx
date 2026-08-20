// src/app/sheet/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { getSheetData, updateSheetCell, bulkUpdateSheetCells } from "@/actions/sheet";

const COLUMNS = [
  { key: "name", label: "Business Name", type: "text" },
  { key: "category", label: "Category", type: "text" },
  { key: "email", label: "Provided Email", type: "text" },
  { key: "extractedEmail", label: "Extracted Email", type: "text" },
  { key: "website", label: "Website", type: "text" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "isExtracted", label: "Scraped", type: "boolean" },
  { key: "isWebsiteWorking", label: "Web OK", type: "boolean" },
  { key: "emailSubject1", label: "Email 1 Subject", type: "text" },
  { key: "emailBody1", label: "Email 1 Body", type: "text" },
  { key: "emailSent1", label: "Sent 1", type: "date" },
  { key: "viewedWebsite", label: "Viewed Web", type: "boolean" },
  { key: "facebook", label: "Facebook", type: "text" },
  { key: "address", label: "Address", type: "text" },
];

export default function AdvancedSheetPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  
  // Bulk Edit State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkField, setBulkField] = useState(COLUMNS[0].key);
  const [bulkValue, setBulkValue] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const leads = await getSheetData();
    setData(leads);
    setLoading(false);
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig?.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  const handleCellSave = async (id: string, field: string, newValue: any) => {
    setEditingCell(null);
    const itemIndex = data.findIndex((d) => d.id === id);
    if (data[itemIndex][field] === newValue) return;

    const updatedData = [...data];
    updatedData[itemIndex][field] = newValue;
    setData(updatedData);

    const res = await updateSheetCell(id, field, newValue);
    if (!res.success) {
      alert(`Save failed: ${res.error}`);
      fetchData();
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;
    const idsArray = Array.from(selectedIds);
    
    // Optimistic Update
    const updatedData = data.map(row => {
      if (idsArray.includes(row.id)) return { ...row, [bulkField]: bulkValue };
      return row;
    });
    setData(updatedData);
    setSelectedIds(new Set());
    setBulkValue("");

    const res = await bulkUpdateSheetCells(idsArray, bulkField, bulkValue);
    if (!res.success) {
      alert(`Bulk update failed: ${res.error}`);
      fetchData();
    }
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(new Set(filteredData.map(d => d.id)));
    else setSelectedIds(new Set());
  };

  const toggleRowSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const filteredData = useMemo(() => {
    let result = data;
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter((item) =>
        Object.values(item).some((val) => String(val || "").toLowerCase().includes(lowerSearch))
      );
    }
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? "";
        const bVal = b[sortConfig.key] ?? "";
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [data, search, sortConfig]);

  if (loading) return <div className="p-8 text-gray-500 min-h-screen bg-gray-50 font-sans">Loading data grid...</div>;

  return (
    <div className="flex flex-col h-screen bg-white text-sm font-sans text-gray-800">
      
      {/* Header & Toolbar */}
      <div className="flex flex-col p-4 bg-white border-b border-gray-200 shrink-0 gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Lead Database</h1>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 font-medium text-xs bg-gray-100 px-2 py-1 rounded-md">{filteredData.length} Records</span>
            <input
              type="text"
              placeholder="Search anything..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-72 transition"
            />
          </div>
        </div>

        {/* Bulk Action Toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-4 bg-blue-50 p-3 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-2">
            <span className="font-semibold text-blue-700">{selectedIds.size} selected</span>
            <div className="flex items-center gap-2">
              <select 
                value={bulkField} 
                onChange={e => setBulkField(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 bg-white text-gray-700 shadow-sm"
              >
                {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <input 
                type="text" 
                placeholder="New value..." 
                value={bulkValue} 
                onChange={e => setBulkValue(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 bg-white shadow-sm w-64"
              />
              <button 
                onClick={handleBulkUpdate}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded font-medium shadow-sm transition"
              >
                Apply to Selected
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full border-collapse whitespace-nowrap">
          <thead className="sticky top-0 bg-gray-50 z-20 shadow-[0_1px_0_#e5e7eb]">
            <tr>
              <th className="px-4 py-3 border-r border-gray-200 sticky left-0 bg-gray-50 z-30 w-12">
                <input 
                  type="checkbox" 
                  checked={selectedIds.size === filteredData.length && filteredData.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                />
              </th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 border-r border-gray-200 sticky left-12 bg-gray-50 z-30 w-16 shadow-[1px_0_0_#e5e7eb]">
                #
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3 text-left font-semibold text-gray-600 border-r border-gray-200 cursor-pointer hover:bg-gray-100 select-none group"
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    <span className="text-gray-400 group-hover:text-gray-600">
                      {sortConfig?.key === col.key ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, index) => (
              <tr key={row.id} className={`hover:bg-gray-50/80 border-b border-gray-100 group transition-colors ${selectedIds.has(row.id) ? 'bg-blue-50/30' : ''}`}>
                <td className="px-4 py-2 border-r border-gray-100 sticky left-0 bg-white group-hover:bg-gray-50 z-10 text-center">
                   <input 
                    type="checkbox" 
                    checked={selectedIds.has(row.id)}
                    onChange={() => toggleRowSelect(row.id)}
                    className="rounded border-gray-300 w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                  />
                </td>
                <td className="px-3 py-2 text-gray-400 font-medium border-r border-gray-100 sticky left-12 bg-white group-hover:bg-gray-50 z-10 shadow-[1px_0_0_#f3f4f6]">
                  {index + 1}
                </td>
                
                {COLUMNS.map((col) => {
                  const isEditing = editingCell?.id === row.id && editingCell?.field === col.key;
                  let cellValue = row[col.key];

                  if (col.type === "boolean") {
                    return (
                      <td key={col.key} className="px-4 py-2 border-r border-gray-100 text-center">
                        <input
                          type="checkbox"
                          checked={!!cellValue}
                          onChange={(e) => handleCellSave(row.id, col.key, e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                    );
                  }

                  if (isEditing) {
                    return (
                      <td key={col.key} className="p-0 border-r border-blue-500 outline outline-2 outline-blue-500 z-20 relative bg-white">
                        <input
                          autoFocus
                          type={col.type === "date" ? "date" : "text"}
                          defaultValue={col.type === "date" && cellValue ? new Date(cellValue).toISOString().split("T")[0] : cellValue || ""}
                          onBlur={(e) => handleCellSave(row.id, col.key, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCellSave(row.id, col.key, e.currentTarget.value);
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                          className="w-full h-full px-3 py-2 bg-transparent text-gray-900 outline-none m-0 shadow-inner"
                        />
                      </td>
                    );
                  }

                  return (
                    <td
                      key={col.key}
                      onDoubleClick={() => setEditingCell({ id: row.id, field: col.key })}
                      className="px-4 py-2 border-r border-gray-100 cursor-cell text-gray-700 truncate max-w-[250px]"
                    >
                      {col.type === "date" && cellValue
                        ? new Date(cellValue).toLocaleDateString()
                        : cellValue === null || cellValue === undefined
                        ? <span className="text-gray-300 italic">—</span>
                        : String(cellValue)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
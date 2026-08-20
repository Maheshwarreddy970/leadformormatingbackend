// src/app/sheet/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { getSheetData, updateSheetCell } from "@/actions/sheet";

// Definition of all columns matching your Prisma schema
const COLUMNS = [
  { key: "name", label: "Name", type: "text" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "website", label: "Website", type: "text" },
  { key: "category", label: "Category", type: "text" },
  { key: "address", label: "Address", type: "text" },
  { key: "placeId", label: "Place ID", type: "text" },
  { key: "cid", label: "CID", type: "text" },
  { key: "reviewCount", label: "Reviews", type: "number" },
  { key: "averageRating", label: "Rating", type: "number" },
  { key: "extractedEmail", label: "Extracted Email", type: "text" },
  { key: "extractedFacebook", label: "Extracted Facebook", type: "text" },
  { key: "isExtracted", label: "Is Extracted", type: "boolean" },
  { key: "isWebsiteWorking", label: "Web Working", type: "boolean" },
  { key: "websiteError", label: "Web Error", type: "text" },
  { key: "instagram", label: "Instagram", type: "text" },
  { key: "facebook", label: "Facebook", type: "text" },
  { key: "twitter", label: "Twitter", type: "text" },
  { key: "linkedin", label: "LinkedIn", type: "text" },
  { key: "yelp", label: "Yelp", type: "text" },
  { key: "youtube", label: "YouTube", type: "text" },
  { key: "emailSubject1", label: "Email 1 Subj", type: "text" },
  { key: "emailBody1", label: "Email 1 Body", type: "text" },
  { key: "emailSent1", label: "Email 1 Sent", type: "date" },
  { key: "emailSubject2", label: "Email 2 Subj", type: "text" },
  { key: "emailBody2", label: "Email 2 Body", type: "text" },
  { key: "emailSent2", label: "Email 2 Sent", type: "date" },
  { key: "emailSubject3", label: "Email 3 Subj", type: "text" },
  { key: "emailBody3", label: "Email 3 Body", type: "text" },
  { key: "emailSent3", label: "Email 3 Sent", type: "date" },
  { key: "viewedLink", label: "Viewed Link", type: "boolean" },
  { key: "viewedWebsite", label: "Viewed Website", type: "boolean" },
  { key: "logoUrl", label: "Logo URL", type: "text" },
];

export default function SheetPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);

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
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleCellSave = async (id: string, field: string, newValue: any) => {
    setEditingCell(null);
    const itemIndex = data.findIndex((d) => d.id === id);
    const currentValue = data[itemIndex][field];

    if (currentValue === newValue) return; // No changes made

    // Optimistic UI update
    const updatedData = [...data];
    updatedData[itemIndex][field] = newValue;
    setData(updatedData);

    const res = await updateSheetCell(id, field, newValue);
    if (!res.success) {
      alert(`Failed to save: ${res.error}`);
      fetchData(); // Rollback if failed
    }
  };

  const filteredAndSortedData = useMemo(() => {
    let result = data;

    // Search
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter((item) =>
        Object.values(item).some((val) =>
          String(val || "").toLowerCase().includes(lowerSearch)
        )
      );
    }

    // Sort
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

  if (loading) return <div className="p-8 text-white bg-slate-900 min-h-screen">Loading database...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200 text-sm overflow-hidden font-sans">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700 shrink-0">
        <h1 className="text-xl font-bold text-white">Database Sheet View</h1>
        <div className="flex gap-4 items-center">
          <span className="text-slate-400">{filteredAndSortedData.length} records</span>
          <input
            type="text"
            placeholder="Search all rows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-blue-500 w-72"
          />
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="flex-1 overflow-auto bg-slate-900">
        <table className="w-full border-collapse whitespace-nowrap">
          <thead className="sticky top-0 bg-slate-800 z-10 shadow-sm border-b border-slate-700">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-300 border-r border-slate-700 w-16 sticky left-0 bg-slate-800 z-20">
                #
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-2 text-left font-semibold text-slate-300 border-r border-slate-700 cursor-pointer hover:bg-slate-700 select-none min-w-[150px]"
                >
                  {col.label} {sortConfig?.key === col.key && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedData.map((row, index) => (
              <tr key={row.id} className="hover:bg-slate-800/50 border-b border-slate-800 group">
                <td className="px-3 py-1.5 text-slate-500 border-r border-slate-800 sticky left-0 bg-slate-900 group-hover:bg-slate-800 z-10">
                  {index + 1}
                </td>
                
                {COLUMNS.map((col) => {
                  const isEditing = editingCell?.id === row.id && editingCell?.field === col.key;
                  let cellValue = row[col.key];

                  // Boolean Checkbox Direct Edit
                  if (col.type === "boolean") {
                    return (
                      <td key={col.key} className="px-3 py-1.5 border-r border-slate-800 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={!!cellValue}
                          onChange={(e) => handleCellSave(row.id, col.key, e.target.checked)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 cursor-pointer accent-blue-600"
                        />
                      </td>
                    );
                  }

                  // Editable Input Mode
                  if (isEditing) {
                    return (
                      <td key={col.key} className="p-0 border-r border-blue-600 outline outline-2 outline-blue-600 z-20 relative">
                        <input
                          autoFocus
                          type={col.type === "date" ? "date" : col.type === "number" ? "number" : "text"}
                          defaultValue={
                            col.type === "date" && cellValue
                              ? new Date(cellValue).toISOString().split("T")[0]
                              : cellValue || ""
                          }
                          onBlur={(e) => handleCellSave(row.id, col.key, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCellSave(row.id, col.key, e.currentTarget.value);
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                          className="w-full h-full px-3 py-1.5 bg-slate-950 text-white outline-none focus:ring-0 m-0"
                        />
                      </td>
                    );
                  }

                  // Read-Only View Mode (Double click to edit)
                  return (
                    <td
                      key={col.key}
                      onDoubleClick={() => setEditingCell({ id: row.id, field: col.key })}
                      className="px-3 py-1.5 border-r border-slate-800 cursor-cell text-slate-300 truncate max-w-[250px]"
                      title={cellValue ? String(cellValue) : ""}
                    >
                      {col.type === "date" && cellValue
                        ? new Date(cellValue).toLocaleDateString()
                        : cellValue === null || cellValue === undefined
                        ? <span className="text-slate-600 italic">null</span>
                        : String(cellValue)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredAndSortedData.length === 0 && (
          <div className="p-8 text-center text-slate-500">No leads found.</div>
        )}
      </div>
    </div>
  );
}
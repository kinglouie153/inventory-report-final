import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { supabase } from "./supabase";

const Input = React.forwardRef((props, ref) => (
  <input
    {...props}
    ref={ref}
    className={`px-2 py-1 rounded border ${props.className || "border-gray-300"}`}
  />
));

const Button = (props) => (
  <button
    {...props}
    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
  />
);

export default function InventoryApp({ session }) {
  const { username, role } = session;
  const [userRole] = useState(role);
  const [currentUser] = useState(username);
  const [excelData, setExcelData] = useState([]);
  const [fileId, setFileId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [reportHistory, setReportHistory] = useState([]);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (userRole === "user") {
      loadLatestFile();
    }
  }, []);

  const handleLogout = () => {
    window.location.reload();
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = evt.target.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData[0].length < 5) {
        jsonData[0].push("Entered By");
      }

      const { data: inserted, error } = await supabase.from("files").insert([
        {
          uploaded_by: currentUser,
          data: jsonData,
        },
      ]).select();

      if (error) {
        console.error("Upload failed", error);
      } else {
        setExcelData(jsonData);
        setFileId(inserted[0].id);
      }
    };
    reader.readAsBinaryString(file);
  };

  const loadLatestFile = async () => {
    const { data, error } = await supabase
      .from("files")
      .select("id, data")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!error && data?.data) {
      setExcelData(data.data);
      setFileId(data.id);
    }
  };

  const saveToSupabase = async (newData) => {
    if (!fileId) return;
    await supabase.from("files").update({ data: newData }).eq("id", fileId);
  };

  const handleInputChange = (index, value) => {
    const updatedData = [...excelData];
    updatedData[index][2] = value === "" ? "" : parseInt(value);
    updatedData[index][4] = currentUser;
    setExcelData(updatedData);
    saveToSupabase(updatedData);
    setEditMessage("Changes saved. Report will reflect latest values.");
    setTimeout(() => setEditMessage(""), 3000);
  };

  const getInputClass = (actual, expected) => {
    if (actual === undefined || actual === "") return "border-gray-300";
    const diff = Math.abs(actual - expected);
    if (diff === 0) return "border-green-500";
    if (diff <= 10) return "border-yellow-400";
    if (diff <= 20) return "border-orange-400";
    return "border-red-500";
  };

  const handleSubmit = () => {
    saveToSupabase(excelData);
    alert("Submitted. Data has been saved.");
  };

  const handleGeneratePDF = () => {
    const doc = new jsPDF();
    const missing = excelData.slice(1).filter((row) => row[2] === undefined || row[2] === "");
    const rows = missing.map((row) => [row[0], row[3]]);
    doc.text("Items Missing Physical Count", 14, 16);
    doc.autoTable({ head: [["SKU", "Description"]], body: rows, startY: 20 });
    doc.save(`Missing_Counts_${Date.now()}.pdf`);
  };

  const filteredData = excelData.filter((row, index) => {
    if (index === 0) return true;
    return row[0]?.toString().toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Inventory Report System</h1>
        <div className="text-right">
          <span className="block text-sm text-gray-500">
            Logged in as: {currentUser} ({userRole})
          </span>
          <button
            onClick={handleLogout}
            className="mt-1 text-sm text-red-600 underline hover:text-red-800"
          >
            Logout
          </button>
        </div>
      </div>

      {userRole === "admin" && (
        <div>
          <Input type="file" accept=".xlsx,.xls" onChange={handleUpload} />
        </div>
      )}

      {excelData.length > 0 && (
        <div className="space-y-4">
          {userRole === "user" && (
            <div className="flex justify-between items-center">
              <Input
                type="text"
                placeholder="Search SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 border-gray-400"
              />
              <Button onClick={handleGeneratePDF}>Download Missing Counts PDF</Button>
            </div>
          )}

          {editMessage && <div className="text-green-600 text-sm">{editMessage}</div>}

          <div className="overflow-auto border rounded p-2">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-2 py-1">SKU</th>
                  {userRole === "admin" && <th className="px-2 py-1">On Hand</th>}
                  <th className="px-2 py-1">Physical Count</th>
                  <th className="px-2 py-1">Description</th>
                  {userRole === "admin" && <th className="px-2 py-1">Entered By</th>}
                </tr>
              </thead>
              <tbody>
                {filteredData.slice(1).map((row, idx) => {
                  const rowIndex = excelData.findIndex((r) => r[0] === row[0]);
                  const physicalCount = row[2];
                  const onHand = row[1];
                  return (
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-1">
                        <span
                          className={
                            row[2] === undefined || row[2] === "" ? "font-bold" : ""
                          }
                        >
                          {row[0]}
                        </span>
                      </td>
                      {userRole === "admin" && <td className="px-2 py-1">{onHand}</td>}
                      <td className="px-2 py-1">
                        {row[3] ? (
                          <Input
                            ref={(el) => (inputRefs.current[rowIndex] = el)}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={physicalCount ?? ""}
                            onChange={(e) => handleInputChange(rowIndex, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const next = inputRefs.current[rowIndex + 1];
                                if (next) next.focus();
                              }
                            }}
                            className={`border-2 w-full ${getInputClass(
                              parseInt(physicalCount),
                              parseInt(onHand)
                            )}`}
                          />
                        ) : (
                          <span className="text-gray-400 italic">N/A</span>
                        )}
                      </td>
                      <td className="px-2 py-1">{row[3]}</td>
                      {userRole === "admin" && <td className="px-2 py-1">{row[4]}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {userRole === "user" && excelData.length > 0 && (
        <Button onClick={handleSubmit}>Submit</Button>
      )}

      {userRole === "admin" && excelData.length > 0 && (
        <div className="mt-6 border-t pt-4 space-y-3">
          <div className="flex gap-4">
            <Button onClick={handleSubmit}>Generate Report</Button>
            <Button onClick={handleGeneratePDF}>Download Missing Counts PDF</Button>
          </div>
          {reportHistory.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mt-2">Report History</h2>
              <ul className="list-disc list-inside text-blue-700 mt-1">
                {reportHistory.map((file, index) => (
                  <li key={index}>{file}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

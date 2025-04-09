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
  const [reportList, setReportList] = useState([]);
  const inputRefs = useRef([]);

  useEffect(() => {
    loadReportList();
  }, []);

  const loadReportList = async () => {
    const { data, error } = await supabase
      .from("files")
      .select("id, created_at")
      .order("created_at", { ascending: false });
    if (!error) {
      setReportList(data);
    }
  };

  const loadFileById = async (id) => {
    const { data, error } = await supabase
      .from("files")
      .select("id, data")
      .eq("id", id)
      .single();

    if (!error && data?.data) {
      setExcelData(data.data);
      setFileId(data.id);
    }
  };

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

      if (!error) {
        setExcelData(jsonData);
        setFileId(inserted[0].id);
        loadReportList();
      }
    };
    reader.readAsBinaryString(file);
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
  };

  const getInputClass = (actual, expected) => {
    if (actual === undefined || actual === "") return "border-gray-300";
    const diff = Math.abs(actual - expected);
    if (diff === 0) return "border-green-500";
    if (diff <= 10) return "border-yellow-400";
    if (diff <= 20) return "border-orange-400";
    return "border-red-500";
  };

  const handleGenerateMismatchReport = () => {
    const doc = new jsPDF();
    const mismatched = excelData.slice(1).filter(
      (row) => row[2] !== undefined && row[2] !== "" && row[2] !== row[1]
    );
    const rows = mismatched.map((row) => [row[0], row[1], row[2]]);
    doc.text("Mismatched Count Report", 14, 16);
    doc.autoTable({ head: [["SKU", "On Hand", "Count"]], body: rows, startY: 20 });
    doc.save(`Mismatch_Report_${Date.now()}.pdf`);
  };

  const handleDownloadMissingCounts = () => {
    const doc = new jsPDF();
    const missing = excelData.slice(1).filter((row) => row[2] === undefined || row[2] === "");
    const rows = missing.map((row) => [row[0], row[2]]);
    doc.text("Items Missing Physical Count", 14, 16);
    doc.autoTable({ head: [["SKU", "Count"]], body: rows, startY: 20 });
    doc.save(`Missing_Counts_${Date.now()}.pdf`);
  };

  const focusNextEditableInput = (startIndex) => {
    for (let i = startIndex + 1; i < excelData.length - 1; i++) {
      if (excelData[i + 1][3]) {
        const next = inputRefs.current[i];
        if (next) {
          next.focus();
          break;
        }
      }
    }
  };

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

      <div className="space-y-2">
        {userRole === "admin" && (
          <Input type="file" accept=".xlsx,.xls" onChange={handleUpload} />
        )}

        <div>
          <label className="mr-2 font-medium">Select Report:</label>
          <select
            onChange={(e) => loadFileById(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="">-- Choose a report --</option>
            {reportList.map((file) => (
              <option key={file.id} value={file.id}>
                {new Date(file.created_at).toLocaleString()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {excelData.length > 0 && (
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <strong>Legend:</strong>
            <ul className="list-disc ml-6">
              <li><span className="text-green-600 font-medium">Green</span>: Count matches On Hand</li>
              <li><span className="text-yellow-500 font-medium">Yellow</span>: 1–10 off</li>
              <li><span className="text-orange-500 font-medium">Orange</span>: 11–20 off</li>
              <li><span className="text-red-500 font-medium">Red</span>: 21+ off</li>
            </ul>
          </div>

          <div className="overflow-auto border rounded p-2">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-2 py-1">SKU</th>
                  {userRole === "admin" && <th className="px-2 py-1">On Hand</th>}
                  <th className="px-2 py-1">Physical Count</th>
                  {userRole === "admin" && <th className="px-2 py-1">Entered By</th>}
                </tr>
              </thead>
              <tbody>
                {excelData.slice(1).map((row, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-2 py-1 font-bold">{row[0]}</td>
                    {userRole === "admin" && <td className="px-2 py-1">{row[1]}</td>}
                    <td className="px-2 py-1">
                      {row[3] ? (
                        <Input
                          ref={(el) => (inputRefs.current[index] = el)}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={row[2] ?? ""}
                          onChange={(e) => handleInputChange(index + 1, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              focusNextEditableInput(index);
                            }
                          }}
                          className={`border-2 w-full ${getInputClass(
                            parseInt(row[2]),
                            parseInt(row[1])
                          )}`}
                        />
                      ) : (
                        <span className="text-gray-400 italic">N/A</span>
                      )}
                    </td>
                    {userRole === "admin" && <td className="px-2 py-1">{row[4]}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-4">
            {userRole === "admin" && (
              <Button onClick={handleGenerateMismatchReport}>Generate Report</Button>
            )}
            <Button onClick={handleDownloadMissingCounts}>Download Missing Counts PDF</Button>
          </div>
        </div>
      )}
    </div>
  );
}

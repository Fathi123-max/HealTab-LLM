import { useState, useEffect, useRef } from 'react';
import { DocumentItem } from '../types';
import { Card, CardContent } from './ui/card';

interface CaseReaderProps {
  activeDoc: DocumentItem | null;
  onAskAboutTerm: (term: string) => void;
}

export default function CaseReader({ activeDoc, onAskAboutTerm }: CaseReaderProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; text: string } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentPage(1);
    setSelectionBox(null);
  }, [activeDoc]);

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      
      if (text && text.length > 2 && text.length < 50 && bodyRef.current?.contains(selection!.anchorNode)) {
        try {
          const range = selection!.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setSelectionBox({
            x: rect.left + window.scrollX + (rect.width / 2) - 60,
            y: rect.top + window.scrollY - 45,
            text
          });
        } catch (e) {
          // ignore selection math errors
        }
      } else {
        setSelectionBox(null);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const badge = window.document.getElementById('floating-selection-badge');
      if (badge && !badge.contains(e.target as Node)) {
        setSelectionBox(null);
      }
    };

    window.document.addEventListener('mouseup', handleMouseUp);
    window.document.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.document.removeEventListener('mouseup', handleMouseUp);
      window.document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  if (!activeDoc) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 p-8">
        <span className="text-6xl opacity-30">📋</span>
        <p className="text-sm font-medium text-center">No document loaded in workspace. Select a preloaded sample or upload your own files to read.</p>
      </div>
    );
  }

  const getDashboardMetrics = () => {
    const isRetinopathy = activeDoc.name.toLowerCase().includes('retinopathy');
    const isAlzheimer = activeDoc.name.toLowerCase().includes('alzheimer') || activeDoc.name.toLowerCase().includes('solanezumab');
    
    if (isRetinopathy) {
      return [
        { label: "Visual Acuity", val: "OS 20/80 • OD 20/40", change: "Requires Anti-VEGF", color: "border-cyan-500 text-cyan-400" },
        { label: "Macular Thickness", val: "CST 450 µm", change: "Severe DME OS", color: "border-amber-500 text-amber-400" },
        { label: "Glycemic Marker", val: "HbA1c 8.7%", change: "Target < 7.0%", color: "border-rose-500 text-rose-400" },
        { label: "Primary Treatment", val: "Aflibercept 2.0mg", change: "PRP Scheduled OS", color: "border-emerald-500 text-emerald-400" }
      ];
    } else if (isAlzheimer) {
      return [
        { label: "ADAS-Cog 13 Scale", val: "32% Slower Decline", change: "p < 0.001 (Efficacious)", color: "border-cyan-500 text-cyan-400" },
        { label: "Amyloid Plaque", val: "45% Reduction", change: "PET verified Arm A", color: "border-emerald-500 text-emerald-400" },
        { label: "Safety Signal", val: "8.5% ARIA-E Edema", change: "Asymptomatic / MRI", color: "border-rose-500 text-rose-400" },
        { label: "Primary Compound", val: "GNT-889 / Infusion", change: "10 mg/kg q4w Schedule", color: "border-purple-500 text-purple-400" }
      ];
    } else {
      return [
        { label: "Analysis Index", val: "Processed", change: "Workspace Active", color: "border-cyan-500 text-cyan-400" },
        { label: "Total Length", val: `${activeDoc.text.split(/\s+/).length} Words`, change: "Text Dossier", color: "border-amber-500 text-amber-400" },
        { label: "Segments Grid", val: `${activeDoc.pages.length} Pages`, change: "Parsed Matrix", color: "border-purple-500 text-purple-400" },
        { label: "Timestamp", val: new Date(activeDoc.uploadedAt).toLocaleDateString(), change: "Upload Date", color: "border-emerald-500 text-emerald-400" }
      ];
    }
  };

  const activePage = activeDoc.pages.find(p => p.pageNum === currentPage) || activeDoc.pages[0];

  return (
    <div className="flex flex-col h-full p-6 gap-4 overflow-hidden relative">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">{activeDoc.name}</h2>
          <span className="text-xs text-slate-400">Format: {activeDoc.type} • Pages: {activeDoc.pages.length}</span>
        </div>
        
        {activeDoc.pages.length > 1 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-xs font-semibold bg-white/5 border border-white/10 rounded-md text-white hover:bg-white/10 disabled:opacity-40"
            >
              &larr; Prev
            </button>
            <span className="text-xs font-semibold text-slate-300">Page {currentPage} of {activeDoc.pages.length}</span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, activeDoc.pages.length))}
              disabled={currentPage === activeDoc.pages.length}
              className="px-3 py-1 text-xs font-semibold bg-white/5 border border-white/10 rounded-md text-white hover:bg-white/10 disabled:opacity-40"
            >
              Next &rarr;
            </button>
          </div>
        )}
      </div>

      {/* EHR Clinical Stats Dashboard */}
      <div className="grid grid-cols-4 gap-4 mt-2">
        {getDashboardMetrics().map((m, idx) => (
          <div key={idx} className={`p-4 rounded-xl bg-slate-950/45 border-l-4 border border-white/5 shadow-lg backdrop-blur-xl ${m.color.split(' ')[0]}`}>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">
              {m.label}
            </span>
            <div className={`text-base font-extrabold tracking-tight ${m.color.split(' ')[1]}`}>
              {m.val}
            </div>
            <span className="text-[9px] text-slate-400 font-semibold block mt-1">
              {m.change}
            </span>
          </div>
        ))}
      </div>

      <Card className="flex-1 bg-slate-950/45 border-white/5 shadow-2xl backdrop-blur-xl overflow-y-auto">
        <CardContent className="p-8 leading-relaxed text-sm text-slate-200 whitespace-pre-wrap select-text" ref={bodyRef}>
          {activePage ? activePage.text : activeDoc.text}
        </CardContent>
      </Card>

      {selectionBox && (
        <div
          id="floating-selection-badge"
          style={{
            position: 'absolute',
            left: `${selectionBox.x}px`,
            top: `${selectionBox.y}px`,
            zIndex: 1000
          }}
          onClick={() => {
            onAskAboutTerm(selectionBox.text);
            setSelectionBox(null);
            window.getSelection()?.removeAllRanges();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-cyan-400 to-indigo-500 hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-cyan-400/20 border border-white/10 transition-all select-none"
        >
          🔬 Ask AI about "{selectionBox.text.substring(0, 10)}..."
        </div>
      )}
    </div>
  );
}

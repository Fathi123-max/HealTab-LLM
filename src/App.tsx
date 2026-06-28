import React, { useState, useEffect } from 'react';
import { DocumentItem, GraphNode, GraphLink, SlideItem, Message, PodcastTurn } from './types';
import { validateApiKey, generateText, generateJson } from './data/gemini';
import { loadStaticSample, parseTxt, parsePdf, formatBytes } from './data/storage';
import {
  getGraphExtractionSchema,
  getSlidesExtractionSchema,
  searchDocumentContext,
  calculateGroundingScore,
  getOfflineSummaryData,
  MEDICAL_CODES
} from './domain/clinical';

import CaseReader from './components/CaseReader';
import ClinicalGraph from './components/ClinicalGraph';
import SummarySlides from './components/SummarySlides';
import PodcastBrief from './components/PodcastBrief';
import AgentChat from './components/AgentChat';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('reader');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  // Authentication & Model Settings
  const [apiKey, setApiKey] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');

  // Analysis States
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null);
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [podcastDialogue, setPodcastDialogue] = useState<PodcastTurn[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isContextLocked, setIsContextLocked] = useState<boolean>(false);

  // Loader Flags
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // Chat Console logs
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGeneratingChat, setIsGeneratingChat] = useState<boolean>(false);

  // Restore API key from session storage
  useEffect(() => {
    const savedKey = sessionStorage.getItem('healtab_gemini_key');
    if (savedKey) {
      setApiKey(savedKey);
      checkKeyValidity(savedKey);
    }
    
    // Add default clinical welcoming guide
    setMessages([
      {
        id: 'welcome',
        role: 'ai',
        text: 'Hello, I am HealTab AI, your Agentic Clinical Assistant. Enter your Gemini API Key in the sidebar and upload a patient record or click one of our Preloaded Clinical Samples below to test immediately! I can summarize cases, check medications, map diagnostic markers, or draft patient instructions.',
        isGrounded: true
      }
    ]);
  }, []);

  const checkKeyValidity = async (key: string) => {
    setIsCheckingKey(true);
    const valid = await validateApiKey(key);
    setIsConnected(valid);
    setIsCheckingKey(false);
    if (valid) {
      sessionStorage.setItem('healtab_gemini_key', key);
    } else {
      sessionStorage.removeItem('healtab_gemini_key');
    }
  };

  const handleApiKeyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKey(val);
    if (val.trim().length > 20) {
      checkKeyValidity(val.trim());
    } else {
      setIsConnected(false);
    }
  };

  const getActiveDocument = (): DocumentItem | null => {
    return documents.find(d => d.id === activeDocId) || null;
  };

  const handleSelectDocument = (docId: string) => {
    setActiveDocId(docId);
    setGraphData(null);
    setSlides([]);
    setPodcastDialogue([]);
    setSelectedNodeId(null);

    const doc = documents.find(d => d.id === docId);
    if (doc) {
      // Auto-extract analysis with pre-configured static structured objects
      const localData = getOfflineSummaryData(doc.name);
      setGraphData({ nodes: localData.nodes, links: localData.links });
      setSlides(localData.slides);
      
      // Clear message history & reset welcome prompt
      setMessages([
        {
          id: 'welcome-' + docId,
          role: 'ai',
          text: `Loaded patient data: "${doc.name}". You can now query clinical metrics or view synthesized graph structure tabs.`,
          isGrounded: true
        }
      ]);
    }
  };

  const handlePreloadSample = (type: 'retinopathy' | 'alzheimer') => {
    const doc = loadStaticSample(type);
    
    // Add to list if not already present
    if (!documents.some(d => d.id === doc.id)) {
      setDocuments(prev => [...prev, doc]);
    }
    handleSelectDocument(doc.id);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFile(files[0]);
  };

  const processFile = async (file: File) => {
    try {
      let docText = '';
      let docPages: Array<{ pageNum: number; text: string }> = [];

      if (file.type === 'application/pdf') {
        const parsed = await parsePdf(file);
        docText = parsed.fullText;
        docPages = parsed.pages;
      } else {
        docText = await parseTxt(file);
        // split pages
        const lines = docText.split('\n');
        let pageText = '';
        let pageNum = 1;
        for (let i = 0; i < lines.length; i++) {
          pageText += lines[i] + '\n';
          if (pageText.length > 800 || i === lines.length - 1) {
            docPages.push({ pageNum, text: pageText.trim() });
            pageText = '';
            pageNum++;
          }
        }
      }

      const newDoc: DocumentItem = {
        id: 'upload-' + Date.now(),
        name: file.name,
        type: file.type || 'text/plain',
        size: file.size,
        text: docText,
        pages: docPages,
        uploadedAt: new Date()
      };

      setDocuments(prev => [...prev, newDoc]);
      setActiveDocId(newDoc.id);
      
      // Auto-analyze structural elements if API key is connected
      if (isConnected) {
        triggerStructuralAnalysis(newDoc);
      } else {
        // Mock default placeholder outline
        const mockNodes: GraphNode[] = [
          { id: "node-1", label: file.name.substring(0, 15), type: "patient", details: "Extracted patient profile summary." }
        ];
        setGraphData({ nodes: mockNodes, links: [] });
      }
    } catch (err: any) {
      alert("Failed to load file: " + err.message);
    }
  };

  const triggerStructuralAnalysis = async (doc: DocumentItem) => {
    if (!isConnected) return;
    setIsAnalyzing(true);
    try {
      // 1. Graph Extraction
      const graphPrompt = `Extract key medical entities and their linkages from this record:\n\n${doc.text}`;
      const graphRes = await generateJson(
        apiKey,
        selectedModel,
        graphPrompt,
        "You are an expert clinical graph constructor. Map medical drugs, tests, recommendations, diagnoses, and symptomatologies.",
        getGraphExtractionSchema()
      );
      
      if (graphRes.nodes) {
        setGraphData({
          nodes: graphRes.nodes,
          links: graphRes.links || []
        });
      }

      // 2. Slide Deck Extraction
      const slidePrompt = `Extract a 3-slide clinical briefing slide deck summary from this record:\n\n${doc.text}`;
      const slideRes = await generateJson(
        apiKey,
        selectedModel,
        slidePrompt,
        "You are a clinical presentation compiler. Write high-quality categorical slides outlining patient efficacy, complications, and metrics.",
        getSlidesExtractionSchema()
      );
      if (slideRes.slides) {
        setSlides(slideRes.slides);
      }

    } catch (e) {
      console.error("Clinical structural analysis failed", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGeneratePodcast = async (style: 'technical' | 'layman' | 'debate') => {
    const doc = getActiveDocument();
    if (!doc) return;

    setIsGeneratingPodcast(true);
    try {
      const stylePrompts = {
        technical: "Write in the style of Clinical Rounds (Technical). Use exact scientific metrics, biomarkers, trial terminology, and clinical pathways.",
        layman: "Write in the style of Patient Consultation (Layman). Use easy-to-understand analogies, metaphors, and focus on simple terms, symptoms, and prognosis.",
        debate: "Write in the style of Peer Review (Skeptical Debate). Host Sarah focuses on the positive findings and endpoints, while Dr. James acts as the skeptic, questioning safety flags, sample sizes, and limitations."
      };

      const systemInstruction = 
        "You are a clinical podcast scriptwriter. Generate an interactive 6-turn dialogue script between Dr. Sarah (host) " +
        "and Dr. James (expert neurologist/clinician) reviewing the case study. Dr. Sarah initiates. " +
        "Dr. James explains diagnostic scores and drug schedules. Dr. Sarah wraps up. " +
        `${stylePrompts[style]} Output MUST match the JSON schema strictly.`;

      const prompt = `Write a 6-turn podcast script based on this document: \n\n${doc.text}`;
      
      const schema = {
        type: "OBJECT",
        properties: {
          dialogue: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                speaker: { type: "STRING", enum: ["sarah", "james"] },
                text: { type: "STRING", description: "Line of clinical speech (1-2 sentences)" }
              },
              required: ["speaker", "text"]
            }
          }
        },
        required: ["dialogue"]
      };

      const res = await generateJson(apiKey, selectedModel, prompt, systemInstruction, schema);
      if (res.dialogue) {
        setPodcastDialogue(res.dialogue);
      }
    } catch (e) {
      console.error("Failed to generate dialogue", e);
      // Fallback to static offline scripts
      setPodcastDialogue([
        { speaker: 'sarah', text: `Hi team. We are going over ${doc.name} in this episode.` },
        { speaker: 'james', text: 'Yes, looking at the diagnostic details, there are some important medication parameters.' },
        { speaker: 'sarah', text: 'Exactly, lets review the target outcomes.' }
      ]);
    } finally {
      setIsGeneratingPodcast(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    // Add user message
    const userMsg: Message = {
      id: 'msg-' + Date.now(),
      role: 'user',
      text,
      isGrounded: true
    };
    setMessages(prev => [...prev, userMsg]);

    const activeDoc = getActiveDocument();
    if (!activeDoc) {
      const genericAiMsg: Message = {
        id: 'msg-ai-' + Date.now(),
        role: 'ai',
        text: 'Please upload a clinical case study or select a preloaded sample in the sidebar to retrieve grounded clinical answers.',
        isGrounded: false
      };
      setMessages(prev => [...prev, genericAiMsg]);
      return;
    }

    setIsGeneratingChat(true);

    try {
      // 1. RAG Search inside active file
      const searchHits = searchDocumentContext(text, activeDoc);
      const ragContextText = searchHits.slice(0, 2).map(h => `[Page ${h.pageNum}]: ${h.text}`).join('\n\n');

      // 2. Locked node parameters
      let selectedNodeContext = '';
      if (isContextLocked && selectedNodeId && graphData) {
        const nodeObj = graphData.nodes.find(n => n.id === selectedNodeId);
        if (nodeObj) {
          selectedNodeContext = `[Graph Node Focus: ${nodeObj.label} (${nodeObj.type.toUpperCase()}) - ${nodeObj.details}]\n`;
        }
      }

      let systemInstruction = 
        "You are HealTab AI, a medical clinical assistant. Answer the user's queries using the provided grounding context text. " +
        "If the answer is found in the context, quote page numbers as [Page X]. " +
        "If the answer is not found in the context, reply using general medical knowledge but start the response with " +
        "'Disclaimer: This answer is derived from general knowledge sources and is not grounded in your active documents.'";

      if (selectedNodeContext) {
        systemInstruction += `\nPrioritize answering with respect to this active graph entity: ${selectedNodeContext}`;
      }

      const prompt = `[GROUNDING CONTEXT]:\n${ragContextText}\n\n[USER QUERY]:\n${text}`;

      let aiText = '';
      if (isConnected) {
        aiText = await generateText(apiKey, selectedModel, prompt, systemInstruction);
      } else {
        // Offline heuristic matching
        const textLower = text.toLowerCase();
        if (textLower.includes('warning') || textLower.includes('danger') || textLower.includes('contraindication')) {
          aiText = activeDoc.name.toLowerCase().includes('retinopathy')
            ? "Untreated retinopathy leads to high risk of vision loss due to vitreous hemorrhage. Blood pressure targets must be kept < 130/80 mmHg."
            : "Secondary safety warnings highlight Amyloid-Related Imaging Abnormalities (ARIA-E edema) in 8.5% of the treated cohort, requiring regular MRI scans.";
        } else if (textLower.includes('dose') || textLower.includes('drug') || textLower.includes('treatment')) {
          aiText = activeDoc.name.toLowerCase().includes('retinopathy')
            ? "Treatment plan: Intravitreal Aflibercept injections 2.0mg OD/OS (monthly for 3 months, then treat-and-extend checks)."
            : "Treatment regime: Solanezumab-Beta (GNT-889) 10 mg/kg intravenous infusion administered every 4 weeks.";
        } else {
          aiText = `Summary of loaded case file: ${activeDoc.text.substring(0, 160)}... [Page 1]`;
        }
      }

      // Check if text is grounded
      const groundingScore = calculateGroundingScore(aiText, activeDoc.text);
      const isGrounded = groundingScore > 0.3 && !aiText.includes('Disclaimer');

      // Extract citation references from page search mapping
      const citations: Array<{ docName: string; docId: string; pageNum: number }> = [];
      searchHits.slice(0, 2).forEach(hit => {
        if (aiText.includes(`Page ${hit.pageNum}`) || aiText.includes(`[Page ${hit.pageNum}]`)) {
          citations.push({
            docName: activeDoc.name,
            docId: activeDoc.id,
            pageNum: hit.pageNum
          });
        }
      });

      const aiMsg: Message = {
        id: 'msg-ai-' + Date.now(),
        role: 'ai',
        text: aiText,
        isGrounded,
        citations: citations.length > 0 ? citations : undefined
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (e: any) {
      console.error(e);
      const errMsg: Message = {
        id: 'msg-ai-err-' + Date.now(),
        role: 'ai',
        text: `Error processing query: ${e.message}`,
        isGrounded: false
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsGeneratingChat(false);
    }
  };

  const handleAskAboutTerm = (term: string) => {
    handleSendMessage(`Explain the clinical significance of "${term}" relative to our case records.`);
  };

  const handleRemoveFile = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDocuments(prev => prev.filter(d => d.id !== docId));
    if (activeDocId === docId) {
      setActiveDocId(null);
      setGraphData(null);
      setSlides([]);
      setPodcastDialogue([]);
      setSelectedNodeId(null);
    }
  };

  // Printable Summary report
  const printSummaryReport = () => {
    const doc = getActiveDocument();
    if (!doc) {
      alert("No active case file selected. Load a document to print the report.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let codingHtml = '';
    const nodesList = graphData?.nodes || [];
    if (nodesList.length > 0) {
      codingHtml = `
        <h2>Standardized Medical Coding Map</h2>
        <table>
          <thead>
            <tr>
              <th>Clinical Entity</th>
              <th>Category</th>
              <th>Medical Identifier (ICD-10 / RxNorm)</th>
            </tr>
          </thead>
          <tbody>
      `;
      nodesList.forEach(node => {
        const lookup = node.label.toLowerCase().trim();
        const matchedKey = Object.keys(MEDICAL_CODES).find(k => lookup.includes(k) || k.includes(lookup));
        const code = matchedKey ? MEDICAL_CODES[matchedKey].code : 'Not Coded';
        const type = matchedKey ? MEDICAL_CODES[matchedKey].type : node.type.toUpperCase();
        codingHtml += `
          <tr>
            <td><strong>${node.label}</strong></td>
            <td>${type}</td>
            <td><code>${code}</code></td>
          </tr>
        `;
      });
      codingHtml += `</tbody></table>`;
    }

    let slidesHtml = '';
    if (slides.length > 0) {
      slidesHtml = `<h2>Clinical Summary Presentation Slides</h2>`;
      slides.forEach((slide, i) => {
        const bullets = slide.bulletPoints.map(p => `<li>${p}</li>`).join('');
        slidesHtml += `
          <div style="background:#f9fafb; padding:12px; margin-bottom:12px; border-left:3px solid #06b6d4;">
            <h3 style="margin-top:0;">Slide ${i+1}: [${slide.category}] ${slide.title}</h3>
            <ul>${bullets}</ul>
          </div>
        `;
      });
    }

    printWindow.document.write(`
      <html>
      <head>
        <title>Clinical Summary Report: ${doc.name}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.5; color: #334155; padding: 40px; }
          h1 { font-size: 24px; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; font-size: 13px; }
          th { background: #f8fafc; }
          pre { background: #fafafa; border: 1px solid #e2e8f0; padding: 12px; font-size: 12px; white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <h1>HealTab Medical Intelligence System</h1>
        <p><strong>Case Report:</strong> ${doc.name}</p>
        <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
        ${codingHtml}
        ${slidesHtml}
        <h2>Original Dossier Text</h2>
        <pre>${doc.text}</pre>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#060913] text-slate-100 font-sans antialiased">
      {/* Sidebar */}
      <aside className="w-[320px] border-r border-white/5 bg-slate-950/40 flex flex-col h-full z-10 backdrop-blur-xl">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-r from-cyan-400 to-indigo-600 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-cyan-400/20">
            H
          </div>
          <div>
            <h1 className="text-base font-bold bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">HealTab LLM</h1>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Clinical Intelligence</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* API Auth */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Authentication</span>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={handleApiKeyInput}
                placeholder="Enter Gemini API Key..."
                className="w-full bg-slate-900 border border-white/10 rounded-md py-2 px-3 text-xs text-white outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${
                isCheckingKey ? 'bg-amber-400 animate-pulse' : isConnected ? 'bg-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-red-500'
              }`} />
              <span className="text-[11px] font-medium text-slate-400">
                {isCheckingKey ? 'Verifying key...' : isConnected ? 'Active Connection' : 'Offline / Disconnected'}
              </span>
            </div>
          </div>

          {/* Model Selector */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Generative Brain</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-md py-2 px-3 text-xs text-white outline-none cursor-pointer"
            >
              <option value="gemini-3.5-flash">Gemini 3.5 Flash (Recommended)</option>
              <option value="gemini-3.1-pro">Gemini 3.1 Pro (Flagship Reasoning)</option>
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (High Efficiency)</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Stable Legacy)</option>
            </select>
          </div>

          {/* Quick Samples */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Quick Sample Cases</span>
            <button
              onClick={() => handlePreloadSample('retinopathy')}
              className="w-full text-left bg-slate-900 border border-white/10 hover:border-cyan-400 hover:bg-slate-900/60 rounded-md py-2.5 px-3 text-xs text-slate-300 transition-all flex items-center gap-2 font-medium"
            >
              👁️ Case Study: Retinopathy
            </button>
            <button
              onClick={() => handlePreloadSample('alzheimer')}
              className="w-full text-left bg-slate-900 border border-white/10 hover:border-cyan-400 hover:bg-slate-900/60 rounded-md py-2.5 px-3 text-xs text-slate-300 transition-all flex items-center gap-2 font-medium"
            >
              🧠 Clinical Trial: Alzheimer
            </button>
          </div>

          {/* Drag & Drop File Zone */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Add Custom Records</span>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-picker-input')?.click()}
              className={`border-2 border-dashed border-white/10 rounded-xl p-6 text-center cursor-pointer hover:border-cyan-400/50 hover:bg-white/5 transition-all flex flex-col items-center gap-2 ${
                isDraggingOver ? 'bg-cyan-500/5 border-cyan-400' : ''
              }`}
            >
              <input
                type="file"
                id="file-picker-input"
                accept=".txt,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="text-2xl text-cyan-400 select-none">📤</span>
              <span className="text-xs font-bold text-slate-300">Upload PDF or TXT</span>
              <span className="text-[10px] text-slate-500">Drag case records here</span>
            </div>
          </div>

          {/* Uploaded Documents */}
          {documents.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Workspace Dossiers</span>
              <div className="space-y-1.5">
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    onClick={() => handleSelectDocument(doc.id)}
                    className={`flex items-center justify-between p-2.5 border rounded-lg cursor-pointer transition-all ${
                      doc.id === activeDocId
                        ? 'border-cyan-400/40 bg-cyan-400/5'
                        : 'border-white/5 bg-slate-900/40 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                      <span className="text-cyan-400 text-xs">📄</span>
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold text-slate-200 truncate">{doc.name}</p>
                        <span className="text-[9px] text-slate-500 font-bold">{formatBytes(doc.size)}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleRemoveFile(doc.id, e)}
                      className="text-slate-500 hover:text-red-500 p-1 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Workspace Display Panel */}
      <main className="flex-1 flex flex-col bg-slate-950/20">
        {/* Workspace Tab Header */}
        <header className="h-[70px] border-b border-white/5 flex items-center justify-between px-6 bg-slate-950/40 backdrop-blur-xl">
          <div className="flex gap-1.5">
            {[
              { id: 'reader', label: '📖 Case Reader' },
              { id: 'graph', label: '🔬 Clinical Graph' },
              { id: 'deck', label: '📊 Summary Slides' },
              { id: 'podcast', label: '🎙️ Podcast Study' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all border ${
                  activeTab === tab.id
                    ? 'bg-cyan-500/10 text-cyan-300 border-cyan-400/25 shadow-md shadow-cyan-500/5'
                    : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {isAnalyzing && (
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider animate-pulse mr-2">
                ⚡ Analyzing Medical Data...
              </span>
            )}
            <button
              onClick={printSummaryReport}
              className="px-3.5 py-1.5 rounded-md text-xs font-bold text-cyan-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center gap-1.5"
            >
              📄 Print Report
            </button>
          </div>
        </header>

        {/* Tab display sections */}
        <div className="flex-1 relative overflow-hidden">
          {activeTab === 'reader' && (
            <CaseReader
              activeDoc={getActiveDocument()}
              onAskAboutTerm={handleAskAboutTerm}
            />
          )}

          {activeTab === 'graph' && (
            <ClinicalGraph
              graphData={graphData}
              selectedNodeId={selectedNodeId}
              onSelectNode={(node) => setSelectedNodeId(node ? node.id : null)}
              isContextLocked={isContextLocked}
              onToggleContextLock={setIsContextLocked}
            />
          )}

          {activeTab === 'deck' && (
            <SummarySlides
              slides={slides}
              onSaveSlides={setSlides}
            />
          )}

          {activeTab === 'podcast' && (
            <PodcastBrief
              dialogue={podcastDialogue}
              onGeneratePodcast={handleGeneratePodcast}
              isLoading={isGeneratingPodcast}
            />
          )}
        </div>
      </main>

      {/* Right Chat Console Panel */}
      <section className="w-[380px] border-l border-white/5 h-full">
        <AgentChat
          messages={messages}
          onSendMessage={handleSendMessage}
          isGenerating={isGeneratingChat}
          onNavigateCitation={(docId, _pageNum) => {
            handleSelectDocument(docId);
            setActiveTab('reader');
          }}
        />
      </section>
    </div>
  );
}

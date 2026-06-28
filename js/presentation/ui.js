// Presentation Layer: Application bootstrap, event wiring, RAG coordination, and UI state updates.

class UIController {
  constructor() {
    // API State
    this.apiKey = sessionStorage.getItem('HEALTAB_API_KEY') || '';
    this.selectedModel = 'gemini-1.5-flash';
    
    // UI Elements Cache
    this.apiKeyInput = document.getElementById('api-key');
    this.statusIndicator = document.getElementById('status-indicator');
    this.statusText = document.getElementById('status-text');
    this.modelSelect = document.getElementById('model-select');
    this.toggleApiVisibility = document.getElementById('toggle-api-visibility');
    
    this.uploadZone = document.getElementById('upload-zone');
    this.fileInput = document.getElementById('file-input');
    this.sidebarFileList = document.getElementById('sidebar-file-list');
    
    this.themeToggle = document.getElementById('theme-toggle');
    this.tabButtons = document.querySelectorAll('.tab-btn');
    this.workspacePanels = document.querySelectorAll('.workspace-panel');
    
    // Panels Content Cache
    this.docTitle = document.getElementById('doc-title');
    this.docBody = document.getElementById('doc-body');
    this.viewerPlaceholder = document.getElementById('viewer-placeholder');
    this.viewerCard = document.getElementById('viewer-content-card');
    
    // Chat Controls
    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput = document.getElementById('chat-input');
    this.chatSubmit = document.getElementById('chat-submit');
    this.chatChips = document.querySelectorAll('.chat-chip');
    this.chatDocSelect = document.getElementById('chat-doc-select');
    this.chatMicBtn = document.getElementById('chat-mic-btn');
    
    // Graph Action Trigger
    this.btnGenerateGraph = document.getElementById('btn-generate-graph');
    this.graphSearchInput = document.getElementById('graph-search-input');
    
    // Renderers
    this.graphRenderer = null;
    this.deckRenderer = null;
    
    // Dictation state
    this.isDictating = false;
    this.recognition = null;
    
    // Podcast state
    this.isPodcastPlaying = false;
    this.podcastDialogue = [];
    this.currentPodcastIndex = 0;
  }

  // Bootstrap application
  init() {
    this.graphRenderer = new window.GraphRenderer(
      'graph-svg', 
      'graph-detail-title', 
      'graph-detail-body', 
      'graph-details-panel'
    );
    
    this.deckRenderer = new window.DeckRenderer(
      'slide-container',
      'deck-prev',
      'deck-next',
      'deck-indicator',
      'deck-fullscreen'
    );

    this.setupEventListeners();
    
    // Pre-fill API key from session storage
    if (this.apiKey) {
      this.apiKeyInput.value = this.apiKey;
      this.verifyApiKey(this.apiKey);
    }

    // Add some default system messages to Chatbot
    this.appendChatMessage(
      'ai', 
      'Hello, I am <strong>HealTab AI</strong>, your Agentic Clinical Assistant. ' +
      'To get started, enter your <strong>Gemini API Key</strong> in the sidebar and upload a patient file or trial document, ' +
      'or click one of our **Preloaded Clinical Samples** below to test immediately! ' +
      '<br><br>I can summarize cases, check medications, map diagnostic markers, or draft patient instructions.',
      false
    );

    // Render default empty panels
    this.graphRenderer.render({ nodes: [], links: [] });
    this.deckRenderer.render({ slides: [] });
  }

  // Setup Event Listeners
  setupEventListeners() {
    // API Visibility toggle
    if (this.toggleApiVisibility) {
      this.toggleApiVisibility.addEventListener('click', () => {
        const type = this.apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
        this.apiKeyInput.setAttribute('type', type);
        this.toggleApiVisibility.textContent = type === 'password' ? '👁️' : '🔒';
      });
    }

    // API Key input change listener
    if (this.apiKeyInput) {
      this.apiKeyInput.addEventListener('change', (e) => {
        const key = e.target.value.trim();
        if (key) {
          this.verifyApiKey(key);
        } else {
          sessionStorage.removeItem('HEALTAB_API_KEY');
          this.apiKey = '';
          this.statusIndicator.className = 'status-indicator';
          this.statusText.textContent = 'Disconnected';
        }
      });
    }

    // Model dropdown listener
    if (this.modelSelect) {
      this.modelSelect.addEventListener('change', (e) => {
        this.selectedModel = e.target.value;
      });
    }

    // Dark/Light Theme Switch
    if (this.themeToggle) {
      this.themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        this.themeToggle.textContent = document.body.classList.contains('light-theme') ? '🌙' : '☀️';
      });
    }

    // Tab buttons switcher
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });

    // File Drag and Drop events
    if (this.uploadZone) {
      this.uploadZone.addEventListener('click', () => this.fileInput.click());
      
      this.uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.uploadZone.classList.add('dragover');
      });

      this.uploadZone.addEventListener('dragleave', () => {
        this.uploadZone.classList.remove('dragover');
      });

      this.uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        this.uploadZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          this.handleFilesUpload(files);
        }
      });
    }

    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
          this.handleFilesUpload(files);
        }
      });
    }

    // Chat submit events
    if (this.chatSubmit) {
      this.chatSubmit.addEventListener('click', () => this.submitUserQuery());
    }

    if (this.chatInput) {
      this.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.submitUserQuery();
        }
      });
    }

    // Quick suggestion chips listener
    this.chatChips.forEach(chip => {
      chip.addEventListener('click', () => {
        if (this.chatInput) {
          this.chatInput.value = chip.getAttribute('data-prompt');
          this.chatInput.focus();
        }
      });
    });

    // Graph Entity Chat button
    if (this.btnGenerateGraph) {
      this.btnGenerateGraph.addEventListener('click', () => {
        const selectedLabel = this.graphRenderer.selectedNodeLabel;
        if (selectedLabel) {
          this.chatInput.value = `Explain the relevance of ${selectedLabel} in this patient's case study.`;
          this.chatInput.focus();
          this.submitUserQuery();
        }
      });
    }

    // Graph node search text input
    if (this.graphSearchInput) {
      this.graphSearchInput.addEventListener('input', (e) => {
        this.graphRenderer.filterNodes(e.target.value);
      });
    }

    // Slide Theme dropdown
    const themeSelect = document.getElementById('slide-theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        this.deckRenderer.setTheme(e.target.value);
      });
    }

    // Slide Editor save button
    const saveSlideBtn = document.getElementById('btn-save-slide');
    if (saveSlideBtn) {
      saveSlideBtn.addEventListener('click', () => {
        const editorText = document.getElementById('slide-editor-textarea').value;
        const bullets = editorText.split('\n').filter(line => line.trim().length > 0);
        this.deckRenderer.updateCurrentSlide(bullets);
      });
    }

    // Chat Voice Microphone dictation
    if (this.chatMicBtn) {
      this.chatMicBtn.addEventListener('click', () => {
        this.toggleSpeechRecognition();
      });
    }

    // Podcast Studio Controls
    const btnPlayPodcast = document.getElementById('btn-play-podcast');
    const btnPausePodcast = document.getElementById('btn-pause-podcast');
    const btnResetPodcast = document.getElementById('btn-reset-podcast');
    if (btnPlayPodcast) btnPlayPodcast.addEventListener('click', () => this.playPodcast());
    if (btnPausePodcast) btnPausePodcast.addEventListener('click', () => this.pausePodcast());
    if (btnResetPodcast) btnResetPodcast.addEventListener('click', () => this.resetPodcast());

    // Export HTML Deck button trigger
    const btnExportDeck = document.getElementById('deck-export');
    if (btnExportDeck) {
      btnExportDeck.addEventListener('click', () => {
        this.deckRenderer.exportHtmlDeck();
      });
    }
  }

  // API verification controller
  async verifyApiKey(key) {
    this.statusIndicator.className = 'status-indicator checking';
    this.statusText.textContent = 'Connecting...';
    try {
      const isValid = await window.geminiAPI.validateApiKey(key);
      if (isValid) {
        this.apiKey = key;
        sessionStorage.setItem('HEALTAB_API_KEY', key);
        this.statusIndicator.className = 'status-indicator connected';
        this.statusText.textContent = 'Connected (Gemini)';
      } else {
        throw new Error();
      }
    } catch (e) {
      this.statusIndicator.className = 'status-indicator';
      this.statusText.textContent = 'Invalid Key';
      sessionStorage.removeItem('HEALTAB_API_KEY');
      this.apiKey = '';
    }
  }

  // Switch workspace layout tab
  switchTab(tabId) {
    this.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    this.workspacePanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${tabId}`);
    });
  }

  // Handle uploaded files list
  async handleFilesUpload(files) {
    for (const file of files) {
      const fileId = 'file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      const isText = file.type.startsWith('text/') || file.name.endsWith('.txt');
      
      if (!isPdf && !isText) {
        alert(`Unsupported file format: ${file.name}. Please upload Clinical Text or PDF files.`);
        continue;
      }

      this.appendUploadIndicator(file.name);
      
      try {
        let textResult = '';
        let parsedPages = [];
        
        if (isPdf) {
          const { fullText, pages } = await window.documentStorage.parsePdf(file);
          textResult = fullText;
          parsedPages = pages;
        } else {
          textResult = await window.documentStorage.parseTxt(file);
        }

        window.documentStorage.addDocument(fileId, file.name, file.type, file.size, textResult, parsedPages);
        this.updateSidebarFiles();
        this.selectDocument(fileId);
        this.removeUploadIndicator();
      } catch (e) {
        console.error(e);
        alert(`Failed to parse ${file.name}: ${e.message}`);
        this.removeUploadIndicator();
      }
    }
  }

  // Show upload in-progress text
  appendUploadIndicator(name) {
    const loader = document.createElement('div');
    loader.id = 'uploading-indicator';
    loader.style.padding = '10px';
    loader.style.fontSize = '12px';
    loader.style.color = 'var(--accent-yellow)';
    loader.textContent = `Parsing ${name}...`;
    this.sidebarFileList.appendChild(loader);
  }

  removeUploadIndicator() {
    const indicator = document.getElementById('uploading-indicator');
    if (indicator) indicator.remove();
  }

  // Update lists inside sidebar
  updateSidebarFiles() {
    if (!this.sidebarFileList) return;
    this.sidebarFileList.innerHTML = '';
    
    // Re-populate active files list
    window.documentStorage.documents.forEach(doc => {
      const item = document.createElement('div');
      item.className = `file-item ${doc.id === window.documentStorage.activeDocumentId ? 'active' : ''}`;
      
      item.innerHTML = `
        <span class="file-item-icon">${doc.type.includes('pdf') ? '📄' : '📝'}</span>
        <div class="file-item-details">
          <div class="file-item-name" title="${doc.name}">${doc.name}</div>
          <div class="file-item-size">${window.documentStorage.formatBytes(doc.size)}</div>
        </div>
        <span class="file-item-remove" data-id="${doc.id}">×</span>
      `;
      
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('file-item-remove')) {
          e.stopPropagation();
          const docId = e.target.getAttribute('data-id');
          window.documentStorage.removeDocument(docId);
          this.updateSidebarFiles();
          this.updateChatDocSelector();
          const activeDoc = window.documentStorage.getActiveDocument();
          if (activeDoc) {
            this.selectDocument(activeDoc.id);
          } else {
            this.clearDocumentView();
          }
        } else {
          this.selectDocument(doc.id);
        }
      });
      
      this.sidebarFileList.appendChild(item);
    });

    this.updateChatDocSelector();
  }

  // Populate dropdown in chat window
  updateChatDocSelector() {
    if (!this.chatDocSelect) return;
    this.chatDocSelect.innerHTML = '<option value="all">All Documents</option>';
    
    window.documentStorage.documents.forEach(doc => {
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = doc.name;
      if (doc.id === window.documentStorage.activeDocumentId) {
        option.selected = true;
      }
      this.chatDocSelect.appendChild(option);
    });
  }

  // Navigate to text document from reference clicks
  navigateToCitation(docId, pageNum) {
    this.selectDocument(docId);
    this.switchTab('reader');
    
    // Find page header text within the document and scroll to it
    const pageHeader = `--- Page ${pageNum} ---`;
    const bodyText = this.docBody.textContent;
    const offset = bodyText.indexOf(pageHeader);
    
    if (offset !== -1) {
      // Simple highlight effect
      const markerSpan = document.createElement('span');
      markerSpan.style.backgroundColor = 'rgba(0, 242, 254, 0.4)';
      markerSpan.textContent = pageHeader;
      
      const parts = bodyText.split(pageHeader);
      this.docBody.innerHTML = '';
      this.docBody.appendChild(document.createTextNode(parts[0]));
      this.docBody.appendChild(markerSpan);
      this.docBody.appendChild(document.createTextNode(parts.slice(1).join(pageHeader)));
      
      markerSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        markerSpan.style.backgroundColor = '';
      }, 3000);
    }
  }

  // Select document and trigger domain analysis automatically
  async selectDocument(id) {
    window.documentStorage.setActiveDocument(id);
    this.updateSidebarFiles();
    
    const doc = window.documentStorage.getActiveDocument();
    if (!doc) return;

    // Show Reader content
    this.viewerPlaceholder.style.display = 'none';
    this.viewerCard.style.display = 'block';
    this.docTitle.textContent = doc.name;
    
    // Format text body with highlights
    this.docBody.innerHTML = this.highlightMedicalTerms(doc.text);

    // Auto trigger Knowledge Graph and Presentation summary extraction
    this.triggerClinicalAnalysis(doc.text);
  }

  clearDocumentView() {
    this.viewerPlaceholder.style.display = 'flex';
    this.viewerCard.style.display = 'none';
    this.docTitle.textContent = '';
    this.docBody.innerHTML = '';
    
    this.graphRenderer.render({ nodes: [], links: [] });
    this.deckRenderer.render({ slides: [] });
  }

  // Highlight clinical keywords directly in document viewer
  highlightMedicalTerms(text) {
    const terms = [
      'Proliferative Diabetic Retinopathy', 'Macular Edema', 'Central subfield thickness', 
      'Panretinal Photocoagulation', 'Aflibercept', 'Eylea', 'Lisnopril', 'Atorvastatin', 
      'Alzheimer\'s Disease', 'monoclonal antibody', 'amyloid-beta plaques', 'amyloid PET', 
      'ARIA-E', 'Neovascularization', 'vitreous hemorrhage', 'HbA1c', 'Lisnoperil'
    ];
    let formattedText = text;
    terms.forEach(term => {
      const regex = new RegExp(`\\b(${term})\\b`, 'gi');
      formattedText = formattedText.replace(regex, '<span class="med-highlight" onclick="window.uiController.askAboutTerm(\'$1\')">$1</span>');
    });
    return formattedText;
  }

  // Triggers chatbot search directly from highlighted text click
  askAboutTerm(term) {
    if (this.chatInput) {
      this.chatInput.value = `Tell me about the relevance of ${term} in the context of our patient files.`;
      this.chatInput.focus();
      this.submitUserQuery();
    }
  }

  // Auto extraction of structures
  async triggerClinicalAnalysis(docText) {
    const graphWrapper = document.getElementById('tab-graph');
    const deckWrapper = document.getElementById('tab-deck');
    
    // Render placeholders/loaders
    graphWrapper.querySelector('.graph-canvas-wrapper').innerHTML = 
      `<div class="pulse-loader"><div class="pulse-bubble"></div><div class="pulse-bubble"></div><div class="pulse-bubble"></div><p style="font-size:12px; color:var(--text-muted); margin-left:8px;">Extracting Medical Graph...</p></div>`;
    
    deckWrapper.querySelector('.deck-workspace').innerHTML = 
      `<div class="viewer-placeholder"><div class="pulse-loader"><div class="pulse-bubble"></div><div class="pulse-bubble"></div><div class="pulse-bubble"></div></div><p style="font-size:13px; color:var(--text-muted); margin-top:10px;">Synthesizing presentation deck slides...</p></div>`;

    if (!this.apiKey) {
      // Fallback local layouts if API key is not supplied
      setTimeout(() => {
        const fallbackGraph = window.clinicalSummarizer.getFallbackGraph(docText);
        const fallbackDeck = window.clinicalSummarizer.getFallbackDeck(docText);
        
        this.graphRenderer.render(fallbackGraph);
        this.deckRenderer.render(fallbackDeck);
      }, 500);
      return;
    }

    try {
      // Non-blocking parallel calls
      const graphPromise = window.clinicalSummarizer.generateKnowledgeGraph(this.apiKey, this.selectedModel, docText);
      const deckPromise = window.clinicalSummarizer.generatePresentationDeck(this.apiKey, this.selectedModel, docText);
      
      const [graphData, deckData] = await Promise.all([graphPromise, deckPromise]);
      
      this.graphRenderer.render(graphData);
      this.deckRenderer.render(deckData);
    } catch (e) {
      console.error(e);
      // Fallbacks on API fail
      this.graphRenderer.render(window.clinicalSummarizer.getFallbackGraph(docText));
      this.deckRenderer.render(window.clinicalSummarizer.getFallbackDeck(docText));
    }
  }

  // Load samples from pre-loaded server/txt files
  async loadSample(sampleName, relativePath) {
    const doc = await window.documentStorage.preloadSample(sampleName, relativePath);
    if (doc) {
      this.updateSidebarFiles();
      this.selectDocument(doc.id);
    } else {
      alert(`Could not fetch local sample study from ${relativePath}. Make sure project matches folder structure.`);
    }
  }

  // Handle chatbot messaging submits
  async submitUserQuery() {
    let text = this.chatInput.value.trim();
    if (!text) return;
    
    this.chatInput.value = '';
    
    // Check if graph context lock is active
    const lockCheckbox = document.getElementById('graph-lock-context');
    let displayQuery = text;
    
    if (lockCheckbox && lockCheckbox.checked && this.graphRenderer.selectedNodeLabel) {
      // Prepend context instructions for the RAG agent
      text = `[Focus Context: Diagnostic/Clinical Entity '${this.graphRenderer.selectedNodeLabel}' (Type: ${this.graphRenderer.selectedNodeType}, Description: ${this.graphRenderer.selectedNodeDetails})]. Query: ${text}`;
      displayQuery = `<span style="font-size:10px; display:block; color:rgba(255,255,255,0.6); margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">🔒 Locked on node: ${this.graphRenderer.selectedNodeLabel}</span>` + displayQuery;
    }
    
    // Add user message to screen
    this.appendChatMessage('user', displayQuery);
    
    // Show typing loader
    const loaderId = this.appendChatTypingIndicator();
    
    const docTarget = this.chatDocSelect.value;
    
    try {
      // Force API prompt logic in grounded chat
      const response = await window.agenticChat.askQuestion(
        this.apiKey, 
        this.selectedModel, 
        text, 
        docTarget
      );
      
      this.removeChatTypingIndicator(loaderId);
      
      this.appendChatMessage(
        'ai', 
        response.text, 
        response.isGrounded,
        response.citations
      );
    } catch (e) {
      this.removeChatTypingIndicator(loaderId);
      this.appendChatMessage(
        'ai', 
        `<span style="color:var(--accent-red)">⚠️ Clinical query failed. Reason: ${e.message}</span>`,
        false
      );
    }
  }

  // Chat interface display managers
  appendChatMessage(role, text, isGrounded = false, citations = []) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = text;
    msgDiv.appendChild(bubble);

    // Meta-tags (Grounded vs General Medical Knowledge indication)
    if (role === 'ai') {
      const meta = document.createElement('div');
      meta.className = 'message-meta';
      
      const badge = document.createElement('span');
      badge.className = `message-badge ${isGrounded ? 'grounded' : 'general'}`;
      badge.textContent = isGrounded ? '🔬 Grounded Research' : '🧠 General Knowledge';
      meta.appendChild(badge);
      
      msgDiv.appendChild(meta);
    }

    this.chatMessages.appendChild(msgDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  appendChatTypingIndicator() {
    const loaderId = 'chat-typing-' + Date.now();
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message ai';
    msgDiv.id = loaderId;
    
    msgDiv.innerHTML = `
      <div class="message-bubble" style="padding:8px 12px;">
        <div class="pulse-loader" style="padding:0">
          <div class="pulse-bubble"></div>
          <div class="pulse-bubble"></div>
          <div class="pulse-bubble"></div>
        </div>
      </div>
    `;
    
    this.chatMessages.appendChild(msgDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    return loaderId;
  }

  removeChatTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) indicator.remove();
  }

  // TOGGLE SPEECH-TO-TEXT CLINICAL DICTATION
  toggleSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Safari.");
      return;
    }
    
    if (this.isDictating) {
      this.recognition.stop();
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'en-US';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
    
    this.recognition.onstart = () => {
      this.isDictating = true;
      if (this.chatMicBtn) {
        this.chatMicBtn.classList.add('mic-active');
        this.chatMicBtn.textContent = '🛑';
      }
      this.chatInput.placeholder = "Listening clinical query...";
    };
    
    this.recognition.onresult = (event) => {
      const speechResult = event.results[0][0].transcript;
      this.chatInput.value = speechResult;
    };
    
    this.recognition.onerror = (e) => {
      console.error("Speech recognition error:", e);
      this.stopSpeechRecognition();
    };
    
    this.recognition.onend = () => {
      this.stopSpeechRecognition();
    };
    
    this.recognition.start();
  }
  
  stopSpeechRecognition() {
    this.isDictating = false;
    if (this.chatMicBtn) {
      this.chatMicBtn.classList.remove('mic-active');
      this.chatMicBtn.textContent = '🎙️';
    }
    this.chatInput.placeholder = "Ask about clinical studies or patient files...";
  }

  // 2-HOST CLINICAL PODCAST STUDIO INTERACTIVE ENGINE
  async playPodcast() {
    const doc = window.documentStorage.getActiveDocument();
    if (!doc) {
      alert("Please select or upload a clinical document first to generate the podcast study.");
      return;
    }

    if (this.isPodcastPlaying) return;

    this.isPodcastPlaying = true;
    document.getElementById('btn-play-podcast').disabled = true;
    document.getElementById('btn-pause-podcast').disabled = false;
    
    const eq = document.getElementById('podcast-equalizer');
    if (eq) eq.classList.add('playing');

    if (this.podcastDialogue.length === 0) {
      const box = document.getElementById('podcast-transcript-box');
      box.textContent = "Writing clinical brief discussion script (Sarah & James)...";
      
      this.podcastDialogue = await this.generatePodcastDialogue(doc);
      this.currentPodcastIndex = 0;
    }

    this.speakPodcastTurn();
  }

  pausePodcast() {
    this.isPodcastPlaying = false;
    document.getElementById('btn-play-podcast').disabled = false;
    document.getElementById('btn-pause-podcast').disabled = true;
    
    const eq = document.getElementById('podcast-equalizer');
    if (eq) eq.classList.remove('playing');
    
    window.speechSynthesis.cancel();
  }

  resetPodcast() {
    this.pausePodcast();
    this.currentPodcastIndex = 0;
    this.podcastDialogue = [];
    
    const sarah = document.getElementById('host-sarah');
    const james = document.getElementById('host-james');
    if (sarah) { sarah.style.opacity = '0.4'; sarah.style.transform = 'scale(0.95)'; }
    if (james) { james.style.opacity = '0.4'; james.style.transform = 'scale(0.95)'; }
    
    const box = document.getElementById('podcast-transcript-box');
    if (box) box.textContent = "Click Play Podcast to start listening to the clinical discussion.";
  }

  // Audio turn voice player
  speakPodcastTurn() {
    if (!this.isPodcastPlaying || this.currentPodcastIndex >= this.podcastDialogue.length) {
      this.resetPodcast();
      return;
    }

    const turn = this.podcastDialogue[this.currentPodcastIndex];
    const box = document.getElementById('podcast-transcript-box');
    const sarah = document.getElementById('host-sarah');
    const james = document.getElementById('host-james');

    // Update avatar styles to visually emphasize speaker
    if (turn.speaker === 'sarah') {
      if (sarah) { sarah.style.opacity = '1.0'; sarah.style.transform = 'scale(1.05)'; }
      if (james) { james.style.opacity = '0.3'; james.style.transform = 'scale(0.95)'; }
      box.innerHTML = `<strong>Dr. Sarah:</strong> "${turn.text}"`;
    } else {
      if (james) { james.style.opacity = '1.0'; james.style.transform = 'scale(1.05)'; }
      if (sarah) { sarah.style.opacity = '0.3'; sarah.style.transform = 'scale(0.95)'; }
      box.innerHTML = `<strong>Dr. James:</strong> "${turn.text}"`;
    }

    // Cancel active voice to avoid overlay queues
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(turn.text);
    
    // Choose male or female voices from Web Speech lists
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = null;

    if (turn.speaker === 'sarah') {
      // Find a standard female sounding voice
      selectedVoice = voices.find(v => v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('google us english') || v.name.toLowerCase().includes('female'));
    } else {
      // Find a standard male sounding voice
      selectedVoice = voices.find(v => v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('alex') || v.name.toLowerCase().includes('daniel') || v.name.toLowerCase().includes('google uk english male') || v.name.toLowerCase().includes('male'));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    // Adjust rate and pitch
    utterance.rate = 1.0;
    utterance.pitch = turn.speaker === 'sarah' ? 1.05 : 0.95;

    // Trigger next turn on end
    utterance.onend = () => {
      if (this.isPodcastPlaying) {
        this.currentPodcastIndex++;
        this.speakPodcastTurn();
      }
    };

    utterance.onerror = (err) => {
      console.warn("Speech synthesis turn error. Moving next.", err);
      if (this.isPodcastPlaying) {
        setTimeout(() => {
          this.currentPodcastIndex++;
          this.speakPodcastTurn();
        }, 1000);
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  // Generates 6 dialogue turns based on active document context
  async generatePodcastDialogue(doc) {
    if (!this.apiKey) {
      return this.getFallbackPodcastDialogue(doc.name, doc.text);
    }

    const systemInstruction = 
      "You are a clinical podcast scriptwriter. Generate an interactive 6-turn dialogue script between Dr. Sarah (host) " +
      "and Dr. James (expert neurologist/clinician) reviewing the case study. Dr. Sarah initiates. " +
      "Dr. James explains diagnostic scores and drug schedules. Dr. Sarah wraps up. " +
      "Output MUST match the JSON schema strictly.";

    const prompt = 
      `Write a 6-turn podcast script based on this document: \n\n${doc.text}`;

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

    try {
      const res = await window.geminiAPI.generateJson(this.apiKey, this.selectedModel, prompt, systemInstruction, schema);
      return res.dialogue || [];
    } catch (e) {
      console.error("Failed to generate dialogue script, using fallback", e);
      return this.getFallbackPodcastDialogue(doc.name, doc.text);
    }
  }

  // Deterministic fallback script dialogue mapping
  getFallbackPodcastDialogue(docName, text) {
    if (docName.toLowerCase().includes('retinopathy')) {
      return [
        { speaker: 'sarah', text: "Hello everyone, welcome back to Clinical Studio. Today James and I are unpacking a highly complex case of Proliferative Diabetic Retinopathy." },
        { speaker: 'james', text: "That is right, Sarah. The subject is a 58-year-old female with Type 2 Diabetes for fifteen years, presenting with significant macular edema." },
        { speaker: 'sarah', text: "Yes, and the central subfield thickness on OCT was four hundred and fifty micrometers in the left eye. That calls for immediate treatment." },
        { speaker: 'james', text: "Indeed, the intervention strategy calls for intravitreal injections of Aflibercept and targeted laser photocoagulation." },
        { speaker: 'sarah', text: "And we shouldn't forget systemic glycemic optimizations, targets are set at HbA1c below seven percent." },
        { speaker: 'james', text: "Exactly, managing local vascular leakage and systemic metabolic control together is the key to preventing permanent vision loss." }
      ];
    } else if (docName.toLowerCase().includes('alzheimer') || docName.toLowerCase().includes('solanezumab')) {
      return [
        { speaker: 'sarah', text: "Welcome back, team. Today we are breaking down the Phase Three trials of Solanezumab-Beta, also known as GNT-889, for early Alzheimer's." },
        { speaker: 'james', text: "This is a big study, Sarah. One thousand two hundred participants, double-blind testing, targeting early cognitive decline." },
        { speaker: 'sarah', text: "The primary metrics showed a thirty-two percent slower rate of cognitive decline compared to placebo. That is statistically significant!" },
        { speaker: 'james', text: "It is! Also, Amyloid PET scans showed a forty-five percent reduction in brain amyloid plaque burden." },
        { speaker: 'sarah', text: "What about secondary safety warnings? There were mentions of ARIA-E occurrences." },
        { speaker: 'james', text: "Yes, Amyloid-Related abnormalities were detected in eight point five percent of patients. Most were asymptomatic but require close MRI observation." }
      ];
    } else {
      return [
        { speaker: 'sarah', text: "Welcome back to Clinical Studio. We are reviewing the clinical highlights of the newly uploaded patient study documents." },
        { speaker: 'james', text: "It is an interesting study, Sarah. The records detail active diagnostics, patient indicators, and a treatment plan." },
        { speaker: 'sarah', text: "Absolutely, and the chatbot shows several references to drug dosage schedules and target interventions." },
        { speaker: 'james', text: "Right, checking clinical highlights, safety, and systemic alignment will yield optimal patient outcomes." }
      ];
    }
  }
}

// Instantiate UI controller upon DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.uiController = new UIController();
  window.uiController.init();
});


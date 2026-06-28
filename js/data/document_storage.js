// Data Layer: Manages document state, upload processing, and PDF parsing.

class DocumentStorage {
  constructor() {
    this.documents = [];
    this.activeDocumentId = null;
    
    // Configure PDF.js worker
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }

  // Add a document to the state
  addDocument(id, name, type, size, text, pages = []) {
    const doc = {
      id,
      name,
      type,
      size,
      text,
      pages: pages.length ? pages : [{ pageNum: 1, text }],
      uploadedAt: new Date(),
    };
    this.documents.push(doc);
    return doc;
  }

  // Remove a document by ID
  removeDocument(id) {
    this.documents = this.documents.filter(doc => doc.id !== id);
    if (this.activeDocumentId === id) {
      this.activeDocumentId = this.documents.length ? this.documents[0].id : null;
    }
  }

  // Get active document
  getActiveDocument() {
    return this.documents.find(doc => doc.id === this.activeDocumentId) || null;
  }

  // Set active document
  setActiveDocument(id) {
    this.activeDocumentId = id;
  }

  // Format file size
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Parse TXT File
  async parseTxt(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error("Failed to read text file."));
      reader.readAsText(file);
    });
  }

  // Parse PDF File using PDF.js
  async parsePdf(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          if (!window.pdfjsLib) {
            throw new Error("PDF.js library is not loaded yet.");
          }
          const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let fullText = '';
          const pages = [];
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `--- Page ${i} ---\n${pageText}\n\n`;
            pages.push({
              pageNum: i,
              text: pageText
            });
          }
          resolve({ fullText, pages });
        } catch (err) {
          reject(new Error("Failed to parse PDF: " + err.message));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read PDF file binary."));
      reader.readAsArrayBuffer(file);
    });
  }

  // Preload local samples
  async preloadSample(fileName, path) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const text = await response.text();
      const id = 'sample-' + fileName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      // Basic page splitting by double newline or reference section for demo
      const pages = [];
      const lines = text.split('\n');
      let pageText = '';
      let pageNum = 1;
      
      for (let i = 0; i < lines.length; i++) {
        pageText += lines[i] + '\n';
        if (pageText.length > 800 || i === lines.length - 1) {
          pages.push({ pageNum, text: pageText.trim() });
          pageText = '';
          pageNum++;
        }
      }

      return this.addDocument(id, fileName, 'text/plain', text.length, text, pages);
    } catch (e) {
      console.error("Failed to preload sample: " + fileName, e);
      return null;
    }
  }
}

// Export for global access
window.documentStorage = new DocumentStorage();

// Domain Layer: Grounded Q&A (RAG), citation matching, and general clinical fallback reasoning.

class AgenticChat {
  // Rank pages across selected documents to find the best matching context
  getRelevantContext(query, selectedDocId = 'all') {
    const documents = window.documentStorage.documents;
    if (!documents || documents.length === 0) {
      return { context: '', citations: [] };
    }

    const searchDocs = selectedDocId === 'all' 
      ? documents 
      : documents.filter(d => d.id === selectedDocId);

    if (searchDocs.length === 0) {
      return { context: '', citations: [] };
    }

    // Tokenize query for scoring
    const queryTokens = query.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 2);

    let scoredPages = [];

    for (const doc of searchDocs) {
      for (const page of doc.pages) {
        let score = 0;
        const pageTextLower = page.text.toLowerCase();
        
        for (const token of queryTokens) {
          // Exact match counts
          if (pageTextLower.includes(token)) {
            score += 1;
            // Consecutive term matches or full phrasing get extra weight
            const idx = pageTextLower.indexOf(token);
            if (idx !== -1 && pageTextLower.slice(idx, idx + 30).includes(token)) {
              score += 0.5;
            }
          }
        }
        scoredPages.push({
          docName: doc.name,
          docId: doc.id,
          pageNum: page.pageNum,
          text: page.text,
          score: score
        });
      }
    }

    // Sort by match score descending
    scoredPages.sort((a, b) => b.score - a.score);

    // Filter relevant pages (score > 0)
    let selectedPages = scoredPages.filter(p => p.score > 0);
    
    // Default to top 2 pages if no keywords matched, otherwise take top 3 matched
    if (selectedPages.length === 0) {
      selectedPages = scoredPages.slice(0, 2);
    } else {
      selectedPages = selectedPages.slice(0, 3);
    }

    const contextParts = selectedPages.map(p => 
      `[Document: ${p.docName}, Page: ${p.pageNum}]\n${p.text}`
    );

    const citations = selectedPages.map(p => ({
      docName: p.docName,
      docId: p.docId,
      pageNum: p.pageNum
    }));

    return {
      context: contextParts.join('\n\n---\n\n'),
      citations: citations
    };
  }

  // Answer a question using Gemini API with grounding
  async askQuestion(apiKey, model, query, selectedDocId = 'all') {
    const { context, citations } = this.getRelevantContext(query, selectedDocId);
    
    let systemInstruction = 
      "You are HealTab AI, an advanced Clinical Q&A Specialist. Your answers must be professional, " +
      "clinical in tone, highly accurate, and clear. Follow these rules:\n\n";

    let prompt = "";

    const hasDocs = window.documentStorage.documents.length > 0;

    if (hasDocs && context) {
      systemInstruction += 
        "1. Answer the query primarily based on the provided DOCUMENT CONTEXT below.\n" +
        "2. When explaining facts from the text, you MUST cite the page in brackets, exactly like: " +
        "[DocName, Page X] (e.g. [clinical_study.txt, Page 1]). Make sure this citation is present.\n" +
        "3. If the user asks a general medical question that is NOT addressed in the document context at all, " +
        "you may answer it using your general medical expertise, but you MUST start your response with '[General Medical Knowledge] ' " +
        "and explain that the information is not in the uploaded documents. Do not hallucinate citations.\n\n" +
        "DOCUMENT CONTEXT:\n" + context;

      prompt = `Based on the clinical documentation, answer this query:\n\n${query}`;
    } else {
      systemInstruction += 
        "1. No documents are uploaded or available in context.\n" +
        "2. Answer the query using your general clinical expertise.\n" +
        "3. You MUST start your response with '[General Medical Knowledge] ' so the user knows this is ungrounded advice.";
      
      prompt = query;
    }

    try {
      const responseText = await window.geminiAPI.generateText(apiKey, model, prompt, systemInstruction);
      
      // Post-process the response text to replace standard citation text [DocName, Page X] with clickable links
      const formattedResponse = this.formatCitations(responseText);
      const isGrounded = hasDocs && !responseText.includes('[General Medical Knowledge]');

      return {
        text: formattedResponse,
        rawText: responseText,
        isGrounded: isGrounded,
        citations: isGrounded ? citations : []
      };
    } catch (e) {
      console.error("Clinical Q&A Failed:", e);
      throw e;
    }
  }

  // Regex utility to render markdown-like citations as styled interactive elements
  formatCitations(text) {
    // Matches patterns like [filename.txt, Page 1] or [filename.pdf, Page 3]
    const citationRegex = /\[([^,\n\]]+),\s*Page\s*(\d+)\]/g;
    
    return text.replace(citationRegex, (match, docName, pageNum) => {
      // Find the corresponding document ID to link correctly
      const doc = window.documentStorage.documents.find(d => d.name === docName.trim());
      const docId = doc ? doc.id : 'unknown';
      return `<a class="citation-link" data-doc-id="${docId}" data-page="${pageNum}" onclick="window.uiController.navigateToCitation('${docId}', ${pageNum})">${match}</a>`;
    });
  }
}

// Export for global access
window.agenticChat = new AgenticChat();

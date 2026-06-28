// Data Layer: Interacts with Google Gemini API endpoints directly.

class GeminiAPI {
  constructor() {
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  // Validate API Key by performing a minimal request
  async validateApiKey(apiKey) {
    const url = `${this.baseUrl}/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello, this is a validation test. Respond only with "OK".' }] }]
        })
      });
      
      if (!response.ok) {
        throw new Error(`API key validation failed with status ${response.status}`);
      }
      
      const data = await response.json();
      return !!(data.candidates && data.candidates[0]?.content?.parts[0]?.text);
    } catch (e) {
      console.error('Gemini API Key Validation Error:', e);
      throw e;
    }
  }

  // General Text Generation
  async generateText(apiKey, model, prompt, systemInstruction = null) {
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || `HTTP ${response.status}`;
        throw new Error(`Gemini API Call Failed: ${errMsg}`);
      }

      const data = await response.json();
      const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textResult) {
        throw new Error("Empty response received from model.");
      }

      return textResult;
    } catch (e) {
      console.error('Gemini Text Generation Error:', e);
      throw e;
    }
  }

  // Structured JSON Generation
  async generateJson(apiKey, model, prompt, systemInstruction = null, responseSchema = null) {
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      }
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    if (responseSchema) {
      requestBody.generationConfig.responseSchema = responseSchema;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || `HTTP ${response.status}`;
        throw new Error(`Gemini JSON Call Failed: ${errMsg}`);
      }

      const data = await response.json();
      const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textResult) {
        throw new Error("Empty JSON response received from model.");
      }

      return JSON.parse(textResult);
    } catch (e) {
      console.error('Gemini JSON Generation Error:', e);
      throw e;
    }
  }
}

// Export for global access
window.geminiAPI = new GeminiAPI();

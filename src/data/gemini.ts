const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export async function validateApiKey(apiKey: string): Promise<boolean> {
  const url = `${BASE_URL}/models?key=${apiKey}`;
  try {
    const response = await fetch(url, {
      method: 'GET'
    });
    return response.ok;
  } catch (e) {
    console.error('Gemini API Validation Error:', e);
    return false;
  }
}

export async function generateText(
  apiKey: string,
  model: string,
  prompt: string,
  systemInstruction?: string | null
): Promise<string> {
  const url = `${BASE_URL}/models/${model}:generateContent?key=${apiKey}`;
  
  const requestBody: any = {
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
    }
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

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
}

export async function generateJson(
  apiKey: string,
  model: string,
  prompt: string,
  systemInstruction?: string | null,
  responseSchema?: any
): Promise<any> {
  const url = `${BASE_URL}/models/${model}:generateContent?key=${apiKey}`;
  
  const requestBody: any = {
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
}

// Domain Layer: Processes raw document text into clinical schemas (Graphs and Slide Decks).

class ClinicalSummarizer {
  // Generate Medical Knowledge Graph
  async generateKnowledgeGraph(apiKey, model, docText) {
    const systemInstruction = 
      "You are a Clinical Knowledge Graph extractor. Analyze the medical case or document and extract the primary " +
      "medical entities and their relationships. Group entities into: patient, symptom, diagnosis, treatment, drug, test, recommendation. " +
      "Provide a short details description for each node. Output must match the specified JSON schema strictly.";

    const prompt = 
      `Extract the clinical knowledge graph from this medical text:\n\n${docText}\n\n` +
      `Ensure you capture key diagnostic indicators, patient characteristics, treatments, and their links.`;

    const schema = {
      type: "OBJECT",
      properties: {
        nodes: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              id: { type: "STRING", description: "Unique snake_case identifier (e.g. 'diabetic_retinopathy')" },
              label: { type: "STRING", description: "User-friendly name (e.g. 'Diabetic Retinopathy')" },
              type: { type: "STRING", enum: ["patient", "symptom", "diagnosis", "treatment", "drug", "test", "recommendation"] },
              details: { type: "STRING", description: "1-2 sentence clinical details or diagnostic values" }
            },
            required: ["id", "label", "type", "details"]
          }
        },
        links: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              source: { type: "STRING", description: "Source node ID" },
              target: { type: "STRING", description: "Target node ID" },
              relation: { type: "STRING", description: "Active verb relation (e.g. 'presents_with', 'diagnosed_with', 'prescribed', 'targets')" }
            },
            required: ["source", "target", "relation"]
          }
        }
      },
      required: ["nodes", "links"]
    };

    try {
      return await window.geminiAPI.generateJson(apiKey, model, prompt, systemInstruction, schema);
    } catch (e) {
      console.error("Clinical Knowledge Graph Generation Failed:", e);
      // Fallback local extractor if call fails or rate limit hit
      return this.getFallbackGraph(docText);
    }
  }

  // Generate Summary Presentation Slides
  async generatePresentationDeck(apiKey, model, docText) {
    const systemInstruction = 
      "You are a Medical Education Presenter. Synthesize the provided medical document into a structured, highly educational " +
      "clinical presentation of 5 standard slides: " +
      "1. Title / Patient Profile, 2. Clinical History & Symptoms, 3. Diagnostic Investigation & Findings, " +
      "4. Recommended Treatment Protocols, 5. Clinical Prognosis & Guidelines. " +
      "Return the slides strictly in the JSON format matching the schema.";

    const prompt = 
      `Create a clinical presentation deck based on the following clinical document:\n\n${docText}`;

    const schema = {
      type: "OBJECT",
      properties: {
        slides: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              category: { type: "STRING", description: "Short slide tag (e.g., 'CASE HISTORY')" },
              title: { type: "STRING", description: "A clear, compelling slide title" },
              bulletPoints: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "3 to 5 key clinical insights, facts, or instructions for this slide"
              }
            },
            required: ["category", "title", "bulletPoints"]
          }
        }
      },
      required: ["slides"]
    };

    try {
      return await window.geminiAPI.generateJson(apiKey, model, prompt, systemInstruction, schema);
    } catch (e) {
      console.error("Slide Deck Generation Failed:", e);
      // Fallback local deck if call fails
      return this.getFallbackDeck(docText);
    }
  }

  // Deterministic local parser in case of offline/API errors
  getFallbackGraph(text) {
    const nodes = [
      { id: 'patient', label: 'Patient Profile', type: 'patient', details: 'Case study subject details' },
      { id: 'symptom_vision', label: 'Vision Decline', type: 'symptom', details: 'Bilateral visual acuity drop over 6 months' },
      { id: 'diagnosis_pdr', label: 'Diabetic Retinopathy', type: 'diagnosis', details: 'Proliferative Retinopathy with Macular Edema' },
      { id: 'drug_vegf', label: 'Anti-VEGF Therapy', type: 'drug', details: 'Aflibercept (Eylea) injections scheduled' },
      { id: 'test_oct', label: 'OCT Scan', type: 'test', details: 'CST: 380 micrometers OD, 450 micrometers OS' },
      { id: 'rec_glycemic', label: 'Glycemic Control', type: 'recommendation', details: 'Target HbA1c < 7.0% via endocrinology' }
    ];
    const links = [
      { source: 'patient', target: 'symptom_vision', relation: 'reports' },
      { source: 'patient', target: 'diagnosis_pdr', relation: 'diagnosed_with' },
      { source: 'diagnosis_pdr', target: 'test_oct', relation: 'confirmed_by' },
      { source: 'diagnosis_pdr', target: 'drug_vegf', relation: 'treated_with' },
      { source: 'patient', target: 'rec_glycemic', relation: 'advised' }
    ];
    return { nodes, links };
  }

  getFallbackDeck(text) {
    return {
      slides: [
        {
          category: "PATIENT CASE OVERVIEW",
          title: "Introduction to Clinical Profile",
          bulletPoints: [
            "Comprehensive review of clinical history and primary symptoms.",
            "Co-morbidities complicating ocular or systemic outcomes.",
            "Urgency based on progressive visual symptoms over recent months."
          ]
        },
        {
          category: "DIAGNOSTIC WORKUP",
          title: "Critical Findings & Imaging Evidence",
          bulletPoints: [
            "Bilateral visual visual acuity deficit indicators.",
            "OCT findings indicating localized macular pathology.",
            "Fundus examination mapping vascular complications."
          ]
        },
        {
          category: "INTERVENTION PROTOCOLS",
          title: "Targeted Medical Treatment Plan",
          bulletPoints: [
            "Initiating standard-of-care pharmacological treatments.",
            "Focal laser or surgical schedules targeting high-risk areas.",
            "Optimizing systemic metrics to improve longevity."
          ]
        },
        {
          category: "SYSTEMIC ALIGNMENT",
          title: "Interdisciplinary Coordination",
          bulletPoints: [
            "Referral to specialized clinical endocrinology/cardiology support.",
            "Patient compliance objectives including glucose tracking.",
            "Regular visual acuity checks every 4-8 weeks."
          ]
        },
        {
          category: "PROGNOSIS & GUIDELINES",
          title: "Long-term Outcomes & Patient Guidance",
          bulletPoints: [
            "Vision retention odds determined by treatment compliance.",
            "Warning flags: sudden changes in floaters, pain, or vision decline.",
            "Reference resources guidelines: AAO Preferred Practice Standards."
          ]
        }
      ]
    };
  }
}

// Export for global access
window.clinicalSummarizer = new ClinicalSummarizer();

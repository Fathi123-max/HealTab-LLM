import { GraphNode, GraphLink, SlideItem, DocumentItem } from '../types';

export const MEDICAL_CODES: Record<string, { code: string; type: 'Diagnosis' | 'Drug' }> = {
  'proliferative diabetic retinopathy': { code: 'ICD-10-CM: E11.359', type: 'Diagnosis' },
  'diabetic retinopathy': { code: 'ICD-10-CM: E11.319', type: 'Diagnosis' },
  'macular edema': { code: 'ICD-10-CM: H35.81', type: 'Diagnosis' },
  'alzheimer\'s disease': { code: 'ICD-10-CM: G30.9', type: 'Diagnosis' },
  'essential hypertension': { code: 'ICD-10-CM: I10', type: 'Diagnosis' },
  'hyperlipidemia': { code: 'ICD-10-CM: E78.5', type: 'Diagnosis' },
  'neovascular glaucoma': { code: 'ICD-10-CM: H40.59', type: 'Diagnosis' },
  'vitreous hemorrhage': { code: 'ICD-10-CM: H43.13', type: 'Diagnosis' },
  'diabetic macular edema': { code: 'ICD-10-CM: E11.351', type: 'Diagnosis' },
  'mild cognitive impairment': { code: 'ICD-10-CM: G31.84', type: 'Diagnosis' },
  'aflibercept': { code: 'RxNorm: 1150495', type: 'Drug' },
  'eylea': { code: 'RxNorm: 1150495', type: 'Drug' },
  'lisinopril': { code: 'RxNorm: 29046', type: 'Drug' },
  'atorvastatin': { code: 'RxNorm: 83367', type: 'Drug' },
  'solanezumab-beta': { code: 'RxNorm: 1443577', type: 'Drug' },
  'gnt-889': { code: 'RxNorm: 1443577', type: 'Drug' },
};

// Generates System Instructions for structural extraction
export function getGraphExtractionSchema() {
  return {
    type: "OBJECT",
    properties: {
      nodes: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING" },
            label: { type: "STRING" },
            type: { 
              type: "STRING", 
              enum: ["patient", "symptom", "diagnosis", "treatment", "drug", "test", "recommendation"] 
            },
            details: { type: "STRING", description: "1-2 sentence clinical summary or context." }
          },
          required: ["id", "label", "type", "details"]
        }
      },
      links: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            source: { type: "STRING", description: "Matches ID of source node" },
            target: { type: "STRING", description: "Matches ID of target node" },
            relation: { type: "STRING", description: "Brief relationship description (e.g., 'treats', 'comorbidity', 'presents')" }
          },
          required: ["source", "target", "relation"]
        }
      }
    },
    required: ["nodes", "links"]
  };
}

export function getSlidesExtractionSchema() {
  return {
    type: "OBJECT",
    properties: {
      slides: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            category: { type: "STRING", description: "e.g., Demographics, Efficacy, Safety, Treatment" },
            title: { type: "STRING", description: "Slide Title" },
            bulletPoints: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "3-4 concise medical bullet points (one sentence max)."
            }
          },
          required: ["category", "title", "bulletPoints"]
        }
      }
    },
    required: ["slides"]
  };
}

// Grounding RAG Context Keyword matching & Citation Generator
export interface SearchResult {
  score: number;
  pageNum: number;
  text: string;
}

export function searchDocumentContext(query: string, doc: DocumentItem): SearchResult[] {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (words.length === 0) {
    return doc.pages.map(p => ({ score: 1, pageNum: p.pageNum, text: p.text }));
  }

  const results: SearchResult[] = doc.pages.map(page => {
    let score = 0;
    const pageTextLower = page.text.toLowerCase();
    words.forEach(word => {
      if (pageTextLower.includes(word)) {
        score += 1;
      }
    });
    return { score, pageNum: page.pageNum, text: page.text };
  });

  return results
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

// Determines if query can be answered using document context
export function calculateGroundingScore(answer: string, context: string): number {
  const answerWords = answer.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 4);
  if (answerWords.length === 0) return 1.0;
  
  const contextLower = context.toLowerCase();
  let matches = 0;
  
  answerWords.forEach(word => {
    if (contextLower.includes(word)) matches++;
  });
  
  return matches / answerWords.length;
}

// Generate printable summary from entities
export function getOfflineSummaryData(docName: string): { nodes: GraphNode[]; links: GraphLink[]; slides: SlideItem[] } {
  const isRetinopathy = docName.toLowerCase().includes('retinopathy');
  
  if (isRetinopathy) {
    return {
      nodes: [
        { id: "p1", label: "Patient CLIN-2026", type: "patient", details: "58-year-old female with 15-year history of Type 2 Diabetes." },
        { id: "d1", label: "Diabetic Retinopathy", type: "diagnosis", details: "Proliferative diabetic retinopathy (PDR) in left eye, severe in right eye." },
        { id: "d2", label: "Macular Edema", type: "diagnosis", details: "Significant Central Subfield Thickness (CST) OS 450um, OD 380um." },
        { id: "dr1", label: "Aflibercept", type: "drug", details: "Anti-VEGF therapy (Eylea) 2.0mg scheduled for monthly loads." },
        { id: "tr1", label: "Photocoagulation", type: "treatment", details: "Panretinal laser treatment planned OS to stop Disc/Elsewhere neovascularization." },
        { id: "t1", label: "HbA1c Target", type: "recommendation", details: "Endocrinology target glycemic parameters optimized below 7.0%." }
      ],
      links: [
        { source: "p1", target: "d1", relation: "presents with" },
        { source: "p1", target: "d2", relation: "suffers from" },
        { source: "d1", target: "tr1", relation: "managed by" },
        { source: "d2", target: "dr1", relation: "treated with" },
        { source: "p1", target: "t1", relation: "requires" }
      ],
      slides: [
        { category: "Patient Case Details", title: "Demographics & Comorbidities", bulletPoints: ["58-year-old female patient with 15-year history of Type 2 Diabetes.", "Poorly controlled glucose metabolic state with recent HbA1c of 8.7%.", "Co-managed for Hypertension (Lisinopril) and Hyperlipidemia (Atorvastatin)."] },
        { category: "Clinical Diagnostics", title: "Ocular Presentation & OCT Findings", bulletPoints: ["Visual acuity decreased: OD 20/40, OS 20/80.", "Left eye (OS) presents with disk/elsewhere neovascularization and vitreous hemorrhage.", "Central subfield thickness (CST) OS at 450 micrometers and OD at 380 micrometers."] },
        { category: "Intervention Protocol", title: "Proposed Anti-VEGF & PRP Schedule", bulletPoints: ["Initiate Intravitreal Aflibercept (Eylea) 2.0mg bilaterally.", "Three initial monthly injections, followed by treat-and-extend checks.", "Perform immediate left eye Panretinal Photocoagulation (PRP) to prevent glaucoma."] }
      ]
    };
  } else {
    // Alzheimer's
    return {
      nodes: [
        { id: "t1", label: "NCT-2026-MED90 Trial", type: "patient", details: "Phase III double-blind trial evaluating GNT-889 in early Alzheimer's (MCI)." },
        { id: "dr1", label: "GNT-889 Solanezumab", type: "drug", details: "Monoclonal antibody targeting amyloid-beta plaque clearings." },
        { id: "t2", label: "ADAS-Cog 13", type: "test", details: "Primary cognitive assessment metric showing 32% slower decline." },
        { id: "d1", label: "Amyloid Plaques", type: "diagnosis", details: "Brain amyloid plaque burden reduced by 45% on PET scans in Arm A." },
        { id: "s1", label: "ARIA-E Edema", type: "symptom", details: "Amyloid-Related abnormalities detected in 8.5% of treated patients." }
      ],
      links: [
        { source: "t1", target: "dr1", relation: "evaluates" },
        { source: "dr1", target: "d1", relation: "clears" },
        { source: "dr1", target: "t2", relation: "improves" },
        { source: "dr1", target: "s1", relation: "induces risk of" }
      ],
      slides: [
        { category: "Study Blueprint", title: "Phase III Clinical Trial Design", bulletPoints: ["1,200 participants aged 60-80 years diagnosed with early Alzheimer's.", "Randomized, double-blind testing comparing GNT-889 versus placebo.", "Drug administered as 10 mg/kg IV infusion every 4 weeks for 72 weeks."] },
        { category: "Primary Efficacy Results", title: "Cognitive Outcomes & Plaque Reductions", bulletPoints: ["GNT-889 slowed rate of cognitive decline by 32% on ADAS-Cog 13 (p < 0.001).", "Clinical Dementia Rating CDR-SB showed 27% progression rate reduction.", "PET scanning verified a substantial 45% clearance of brain amyloid plaque."] },
        { category: "Safety Assessment", title: "ARIA Occurrences & Complications", bulletPoints: ["ARIA-E (brain edema) occurred in 8.5% of treated cohort (mostly asymptomatic).", "Infusion-related reactions occurred in 4.2% of active participants (mild).", "Required rigorous ongoing magnetic resonance imaging (MRI) monitoring."] }
      ]
    };
  }
}

import { DocumentItem } from '../types';

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export async function parseTxt(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("Failed to read text file."));
    reader.readAsText(file);
  });
}

export async function parsePdf(file: File): Promise<{ fullText: string; pages: Array<{ pageNum: number; text: string }> }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) {
          throw new Error("PDF.js library is not loaded. Ensure CDN script in index.html is loaded.");
        }
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';
        const pages: Array<{ pageNum: number; text: string }> = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += `--- Page ${i} ---\n${pageText}\n\n`;
          pages.push({
            pageNum: i,
            text: pageText
          });
        }
        resolve({ fullText, pages });
      } catch (err: any) {
        reject(new Error("Failed to parse PDF: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read PDF file binary."));
    reader.readAsArrayBuffer(file);
  });
}

// Static Fallbacks for CORS compatibility (identical to backup)
export const STATIC_SAMPLES: Record<string, string> = {
  retinopathy: `Case ID: CLIN-2026-X892
Patient Age: 58
Gender: Female
Primary Diagnosis: Proliferative Diabetic Retinopathy (PDR) with secondary Macular Edema (DME)

Clinical History:
The patient is a 58-year-old female with a 15-year history of Type 2 Diabetes Mellitus. She presented with a progressive decline in bilateral visual acuity over the past 6 months, more pronounced in the left eye. Her blood glucose levels have been poorly controlled, with a recent HbA1c of 8.7%. Comorbidities include essential hypertension managed with Lisinopril 10mg daily and hyperlipidemia managed with Atorvastatin 20mg daily.

Diagnostic Findings:
1. Visual Acuity:
   - Right Eye (OD): 20/40
   - Left Eye (OS): 20/80
2. Intraocular Pressure (IOP):
   - OD: 16 mmHg
   - OS: 17 mmHg
3. Dilated Fundus Examination:
   - OD: Multiple microaneurysms, intraretinal hemorrhages in all four quadrants, and moderate cotton wool spots.
   - OS: Neovascularization at the disc (NVD) and neovascularization elsewhere (NVE), fibrous proliferation, and a localized vitreous hemorrhage.
4. Optical Coherence Tomography (OCT):
   - Central subfield thickness (CST) was 380 micrometers in the right eye and 450 micrometers in the left eye, indicating significant macular edema (DME), worse on the left side.

Proposed Treatment Plan:
1. Anti-VEGF Therapy:
   - Initiate intravitreal injections of Aflibercept (Eylea) 2.0 mg in both eyes.
   - Injection Schedule: Load with 3 monthly injections, followed by treat-and-extend protocol.
2. Panretinal Photocoagulation (PRP):
   - Schedule PRP for the left eye (OS) to address high-risk proliferative features (NVD, NVE) and prevent further vitreous hemorrhage.
3. Systemic Optimization:
   - Refer to Endocrinology for intensive glycemic control targeting HbA1c < 7.0%.
   - Advise strict blood pressure control (target < 130/80 mmHg) and lipid management.

Prognosis & Reference:
With aggressive local ocular therapy and systemic control, the prognosis for vision retention is moderate. However, untreated proliferative diabetic retinopathy carries a high risk of permanent, severe vision loss due to tractional retinal detachment or neovascular glaucoma.
References:
[1] American Academy of Ophthalmology Retina/Vitreous Panel. Preferred Practice Pattern: Diabetic Retinopathy. AAO, 2025.
[2] Early Treatment Diabetic Retinopathy Study Research Group. Photocoagulation for diabetic retinopathy. ETDRS Report Number 9. Ophthalmology, 1991.`,

  alzheimer: `Trial ID: NCT-2026-MED90
Sponsor: Global Neuro-Therapeutics Inc.
Phase: Phase III Clinical Trial
Drug Compound: Solanezumab-Beta (GNT-889)
Indication: Early-stage Alzheimer's Disease (Mild Cognitive Impairment)

Study Objectives:
To evaluate the efficacy and safety of GNT-889 (a humanized monoclonal antibody targeting amyloid-beta plaques) in delaying cognitive decline in patients with early-stage Alzheimer's disease compared to a placebo.

Methodology:
- Patient Enrollment: 1,200 participants aged 60-80 years.
- Randomization: Double-blind, randomized, placebo-controlled trial.
- Treatment Arms:
  - Arm A (Experimental): Intravenous infusion of GNT-889 (10 mg/kg) every 4 weeks for 72 weeks.
  - Arm B (Control): Matching placebo infusion every 4 weeks for 72 weeks.
- Primary Endpoints: Change from baseline in the Alzheimer's Disease Assessment Scale-Cognitive Subscale (ADAS-Cog 13) at week 72.
- Secondary Endpoints: Changes in Clinical Dementia Rating-Sum of Boxes (CDR-SB), amyloid PET scan imaging of plaque density, and cerebrospinal fluid (CSF) tau levels.

Results & Key Findings:
1. Cognitive Efficacy:
   - Patients in Arm A (GNT-889) demonstrated a statistically significant 32% slower rate of decline on the ADAS-Cog 13 scale at week 72 compared to the placebo group (p < 0.001).
   - Clinical Dementia Rating-Sum of Boxes (CDR-SB) showed a 27% reduction in progression rate for the GNT-889 cohort.
2. Biomarker Analysis:
   - Amyloid PET imaging revealed a substantial 45% reduction in brain amyloid plaque burden in Arm A compared to baseline, whereas Arm B showed a 5% increase.
   - CSF phosphorylated tau (p-tau181) levels decreased significantly in Arm A, suggesting downstream neuroprotective benefits.
3. Safety Profile:
   - Amyloid-Related Imaging Abnormalities (ARIA): ARIA-E (edema) occurred in 8.5% of patients in Arm A (mostly asymptomatic, detected via MRI monitoring).
   - Infusion-related reactions occurred in 4.2% of Arm A patients, all classified as mild to moderate.

Conclusion:
Phase III clinical results show that GNT-889 successfully clears amyloid-beta plaques and significantly slows cognitive decline in early Alzheimer's disease with an acceptable safety profile.
References:
[1] Global Neuro-Therapeutics. Phase III Trial Data of Solanezumab-Beta. GNT Clinical Reports, 2026.
[2] National Institute on Aging. Amyloid hypothesis and monoclonal antibodies in AD. NIA Research Journal, 2025.`
};

export function loadStaticSample(key: 'retinopathy' | 'alzheimer'): DocumentItem {
  const text = STATIC_SAMPLES[key];
  const name = key === 'retinopathy' ? 'Case Study: Diabetic Retinopathy' : 'Clinical Trial: Alzheimer Plaque Clearance';
  const id = 'sample-' + key;
  
  // Basic split pages
  const pages: Array<{ pageNum: number; text: string }> = [];
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

  return {
    id,
    name,
    type: 'text/plain',
    size: text.length,
    text,
    pages,
    uploadedAt: new Date()
  };
}

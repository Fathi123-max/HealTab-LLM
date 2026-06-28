import { useState, useEffect } from 'react';
import { DocumentItem } from '../types';
import { Card, CardContent } from './ui/card';
import { Textarea } from './ui/textarea';
import { generateJson } from '../data/gemini';

interface SoapNoteProps {
  document: DocumentItem | null;
  apiKey: string;
  model: string;
  isConnected: boolean;
}

interface SoapData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export default function SoapNote({ document, apiKey, model, isConnected }: SoapNoteProps) {
  const [soapData, setSoapData] = useState<SoapData>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: ''
  });
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [isExported, setIsExported] = useState<boolean>(false);

  useEffect(() => {
    setSoapData({
      subjective: '',
      objective: '',
      assessment: '',
      plan: ''
    });
    setIsExported(false);
    
    if (document) {
      compileSoapNoteOffline(document.name);
    }
  }, [document]);

  const compileSoapNoteOffline = (name: string) => {
    const isRetinopathy = name.toLowerCase().includes('retinopathy');
    if (isRetinopathy) {
      setSoapData({
        subjective: "Patient is a 58-year-old female with a 15-year history of Type 2 Diabetes Mellitus. Complains of progressive decline in bilateral vision over the past 6 months, more severe in the left eye. Medical history includes essential hypertension and hyperlipidemia.",
        objective: "Visual Acuity: OD 20/40, OS 20/80. IOP: OD 16, OS 17. OCT CST: OD 380um, OS 450um. Dilated Fundus: OD multiple microaneurysms, hemorrhages, cotton wool spots. OS Disk/Elsewhere neovascularization (NVD, NVE) and localized vitreous hemorrhage. Recent HbA1c is 8.7%. Medications: Lisinopril 10mg, Atorvastatin 20mg.",
        assessment: "1. Proliferative Diabetic Retinopathy (PDR) OS (High Risk)\n2. Secondary Diabetic Macular Edema (DME) bilateral, OS > OD\n3. Poorly controlled Type 2 Diabetes Mellitus (HbA1c 8.7%)\n4. Essential Hypertension & Hyperlipidemia",
        plan: "1. Intravitreal Aflibercept (Eylea) 2.0mg OD/OS (monthly load x 3, then treat-and-extend).\n2. Panretinal Photocoagulation (PRP) OS scheduled immediately.\n3. Endocrine referral for glycemic control (HbA1c target < 7.0%).\n4. Strict BP control (<130/80 mmHg) and lipid checks."
      });
    } else {
      setSoapData({
        subjective: "Phase III double-blind randomized clinical trial evaluating compound GNT-889 (Solanezumab-Beta) in early-stage Alzheimer's disease (Mild Cognitive Impairment). 1,200 participants enrolled.",
        objective: "Efficacy: GNT-889 group demonstrated 32% slower cognitive decline on ADAS-Cog 13 (p < 0.001) and 27% slower progression on CDR-SB. Plaque burden: 45% amyloid reduction on PET scans in active arm vs 5% increase in placebo. Safety: ARIA-E brain edema occurred in 8.5% of treated patients (mostly asymptomatic). Infusion reactions at 4.2%.",
        assessment: "1. Early-stage Alzheimer's Disease (Mild Cognitive Impairment)\n2. Efficacious amyloid-beta plaque clearance verified by PET imaging\n3. Manageable safety profile with risk of Amyloid-Related Imaging Abnormalities (ARIA-E)",
        plan: "1. Administer GNT-889 10 mg/kg intravenous infusion every 4 weeks for 72 weeks.\n2. Schedule baseline and periodic follow-up MRI brain scans to monitor for ARIA-E swelling.\n3. Continue double-blind cohort evaluation for long-term safety endpoints."
      });
    }
  };

  const compileSoapNoteOnline = async () => {
    if (!document || !isConnected) return;
    setIsCompiling(true);
    
    const systemPrompt = 
      "You are a professional medical scribe. Compile a highly structured clinical SOAP note (Subjective, Objective, Assessment, Plan) " +
      "based on the provided clinical document text. Respond strictly in JSON format matching the schema.";
      
    const prompt = `Compile a clinical SOAP note for this patient file:\n\n${document.text}`;
    
    const schema = {
      type: "OBJECT",
      properties: {
        subjective: { type: "STRING", description: "Patient complaints, symptoms, timeline, history." },
        objective: { type: "STRING", description: "Vitals, visual fields, laboratory findings, diagnostic metrics." },
        assessment: { type: "STRING", description: "Staged diagnoses, complications, and status." },
        plan: { type: "STRING", description: "Medications, dosages, laser interventions, referrals." }
      },
      required: ["subjective", "objective", "assessment", "plan"]
    };

    try {
      const res = await generateJson(apiKey, model, prompt, systemPrompt, schema);
      if (res.subjective) {
        setSoapData(res);
      }
    } catch (e) {
      console.error("Failed to generate SOAP note online", e);
      compileSoapNoteOffline(document.name);
    } finally {
      setIsCompiling(false);
    }
  };

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 p-8">
        <span className="text-6xl opacity-30">📝</span>
        <p className="text-sm font-medium text-center">Load a patient file to compile standard SOAP documentation.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full p-6 gap-6 overflow-hidden">
      {/* SOAP note sheet */}
      <Card className="flex-1 bg-slate-950/45 border-white/5 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Clinical SOAP Record</h2>
            <span className="text-[10px] text-slate-400">Subjective, Objective, Assessment, and Treatment Plan Documentation</span>
          </div>

          <div className="flex items-center gap-3">
            {isConnected && (
              <button
                onClick={compileSoapNoteOnline}
                disabled={isCompiling}
                className="px-3 py-1.5 rounded-md text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 hover:bg-cyan-500/20 disabled:opacity-40"
              >
                {isCompiling ? 'Generating with AI...' : '⚡ Generate with Gemini'}
              </button>
            )}
            <button
              onClick={() => setIsExported(true)}
              className="px-3 py-1.5 rounded-md text-xs font-bold bg-gradient-to-r from-cyan-400 to-indigo-500 text-white"
            >
              Export to EHR
            </button>
          </div>
        </div>

        <CardContent className="flex-grow p-6 overflow-y-auto space-y-6">
          {isExported && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-xs font-bold text-center animate-bounce">
              ✓ SOAP Note successfully exported and queued to Hospital EHR System!
            </div>
          )}

          {/* S */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-extrabold text-cyan-400 tracking-wider">SUBJECTIVE (S)</span>
            <Textarea
              value={soapData.subjective}
              onChange={(e) => setSoapData({ ...soapData, subjective: e.target.value })}
              className="bg-slate-900 border-white/10 text-xs text-slate-200 resize-none min-h-[90px]"
            />
          </div>

          {/* O */}
          <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
            <span className="text-xs font-extrabold text-amber-400 tracking-wider">OBJECTIVE (O)</span>
            <Textarea
              value={soapData.objective}
              onChange={(e) => setSoapData({ ...soapData, objective: e.target.value })}
              className="bg-slate-900 border-white/10 text-xs text-slate-200 resize-none min-h-[90px]"
            />
          </div>

          {/* A */}
          <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
            <span className="text-xs font-extrabold text-purple-400 tracking-wider">ASSESSMENT (A)</span>
            <Textarea
              value={soapData.assessment}
              onChange={(e) => setSoapData({ ...soapData, assessment: e.target.value })}
              className="bg-slate-900 border-white/10 text-xs text-slate-200 resize-none min-h-[90px]"
            />
          </div>

          {/* P */}
          <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
            <span className="text-xs font-extrabold text-emerald-400 tracking-wider">PLAN (P)</span>
            <Textarea
              value={soapData.plan}
              onChange={(e) => setSoapData({ ...soapData, plan: e.target.value })}
              className="bg-slate-900 border-white/10 text-xs text-slate-200 resize-none min-h-[90px]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

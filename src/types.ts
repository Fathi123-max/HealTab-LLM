export interface DocumentItem {
  id: string;
  name: string;
  type: string;
  size: number;
  text: string;
  pages: Array<{ pageNum: number; text: string }>;
  uploadedAt: Date;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'patient' | 'symptom' | 'diagnosis' | 'treatment' | 'drug' | 'test' | 'recommendation';
  details: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  relation: string;
}

export interface ClinicalGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface SlideItem {
  category: string;
  title: string;
  bulletPoints: string[];
}

export interface PresentationDeck {
  slides: SlideItem[];
}

export interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  isGrounded: boolean;
  citations?: Array<{ docName: string; docId: string; pageNum: number }>;
}

export interface PodcastTurn {
  speaker: 'sarah' | 'james';
  text: string;
}

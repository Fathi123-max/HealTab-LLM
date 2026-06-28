import { useState, useEffect } from 'react';
import { SlideItem } from '../types';
import { Card, CardContent } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';

interface SummarySlidesProps {
  slides: SlideItem[];
  onSaveSlides: (updated: SlideItem[]) => void;
}

type SlideTheme = 'midnight' | 'emerald' | 'cyber' | 'crimson';

export default function SummarySlides({ slides, onSaveSlides }: SummarySlidesProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [theme, setTheme] = useState<SlideTheme>('midnight');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  // Custom editor states for active slide
  const [editTitle, setEditTitle] = useState<string>('');
  const [editBullets, setEditBullets] = useState<string>('');

  useEffect(() => {
    if (slides.length > 0) {
      const active = slides[currentIndex] || slides[0];
      setEditTitle(active.title);
      setEditBullets(active.bulletPoints.join('\n'));
    } else {
      setEditTitle('');
      setEditBullets('');
    }
  }, [slides, currentIndex]);

  // Keyboard navigation for fullscreen presenter mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreen) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setCurrentIndex(prev => Math.min(prev + 1, slides.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, slides.length]);

  if (slides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 p-8">
        <span className="text-6xl opacity-30">📊</span>
        <p className="text-sm font-medium text-center">Generate clinical slides to present patient records.</p>
      </div>
    );
  }

  const activeSlide = slides[currentIndex] || slides[0];

  const handleUpdateSlide = () => {
    const updated = [...slides];
    updated[currentIndex] = {
      ...activeSlide,
      title: editTitle,
      bulletPoints: editBullets.split('\n').filter(b => b.trim().length > 0)
    };
    onSaveSlides(updated);
  };

  const getThemeClass = (t: SlideTheme) => {
    switch (t) {
      case 'emerald':
        return 'bg-gradient-to-br from-teal-950 to-emerald-950 border-emerald-500/10 text-emerald-100';
      case 'cyber':
        return 'bg-gradient-to-br from-slate-950 to-purple-950 border-fuchsia-500/10 text-pink-100';
      case 'crimson':
        return 'bg-gradient-to-br from-rose-950 to-slate-950 border-rose-500/10 text-rose-100';
      default: // midnight
        return 'bg-gradient-to-br from-slate-950 to-indigo-950 border-white/5 text-slate-100';
    }
  };

  const getTitleColor = (t: SlideTheme) => {
    switch (t) {
      case 'emerald': return 'from-emerald-400 to-teal-200';
      case 'cyber': return 'from-fuchsia-400 to-cyan-300';
      case 'crimson': return 'from-rose-400 to-pink-200';
      default: return 'from-cyan-400 to-indigo-300';
    }
  };

  // HTML Presentation Exporter
  const handleExportDeck = () => {
    const slideItemsHtml = slides.map((slide, idx) => `
      <div class="slide ${idx === 0 ? 'active' : ''}" id="slide-${idx}">
        <div class="category">${slide.category}</div>
        <div class="title">${slide.title}</div>
        <ul>
          ${slide.bulletPoints.map(bullet => `<li>${bullet}</li>`).join('')}
        </ul>
      </div>
    `).join('');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Clinical Case Summary Deck</title>
  <style>
    body {
      margin: 0;
      background: #090d16;
      color: #f3f4f6;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
    }
    .deck {
      width: 800px;
      aspect-ratio: 16/9;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 48px;
      box-sizing: border-box;
      position: relative;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    }
    .slide {
      display: none;
      height: 100%;
      flex-direction: column;
      justify-content: center;
    }
    .slide.active {
      display: flex;
    }
    .category {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #38bdf8;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .title {
      font-size: 32px;
      font-weight: 800;
      margin-bottom: 24px;
      background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    ul {
      padding-left: 24px;
      margin: 0;
    }
    li {
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 12px;
      color: #cbd5e1;
    }
    .controls {
      display: flex;
      justify-content: space-between;
      width: 800px;
      margin-top: 24px;
      align-items: center;
    }
    button {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: #fff;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }
    button:hover {
      background: rgba(255,255,255,0.1);
    }
    .indicator {
      font-size: 14px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="deck">
    ${slideItemsHtml}
  </div>
  <div class="controls">
    <button onclick="prevSlide()">&larr; Back</button>
    <span class="indicator" id="ind">Slide 1 of ${slides.length}</span>
    <button onclick="nextSlide()">Next &rarr;</button>
  </div>

  <script>
    let current = 0;
    const total = ${slides.length};
    function showSlide(idx) {
      document.querySelectorAll('.slide').forEach((s, i) => {
        s.classList.toggle('active', i === idx);
      });
      document.getElementById('ind').textContent = \`Slide \${idx + 1} of \${total}\`;
    }
    function nextSlide() {
      if (current < total - 1) {
        current++;
        showSlide(current);
      }
    }
    function prevSlide() {
      if (current > 0) {
        current--;
        showSlide(current);
      }
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    });
  </script>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinical_slide_deck_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full p-6 gap-6 overflow-hidden">
      {/* Slide Visual Area */}
      <div className="flex-1 flex flex-col items-center justify-between overflow-hidden">
        <Card className={`w-full aspect-[16/9] ${getThemeClass(theme)} shadow-2xl relative p-12 flex flex-col justify-center transition-all duration-300`}>
          <CardContent className="p-0 flex flex-col justify-center height-full">
            <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 mb-2">
              {activeSlide.category}
            </span>
            <h2 className={`text-3xl font-extrabold bg-gradient-to-r ${getTitleColor(theme)} bg-clip-text text-transparent mb-6 tracking-tight leading-snug`}>
              {activeSlide.title}
            </h2>
            <div className="text-sm font-medium leading-relaxed">
              <ul className="list-disc pl-6 space-y-4 text-slate-300">
                {activeSlide.bulletPoints.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Presenter Controls */}
        <div className="flex items-center justify-between w-full mt-4">
          <button
            onClick={() => setCurrentIndex(prev => Math.max(prev - 1, 0))}
            disabled={currentIndex === 0}
            className="px-4 py-2 text-xs font-semibold bg-white/5 border border-white/10 rounded-md text-white hover:bg-white/10 disabled:opacity-40"
          >
            &larr; Back
          </button>
          <span className="text-xs font-bold text-slate-400">
            Slide {currentIndex + 1} of {slides.length}
          </span>
          <button
            onClick={() => setCurrentIndex(prev => Math.min(prev + 1, slides.length - 1))}
            disabled={currentIndex === slides.length - 1}
            className="px-4 py-2 text-xs font-semibold bg-white/5 border border-white/10 rounded-md text-white hover:bg-white/10 disabled:opacity-40"
          >
            Next &rarr;
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsFullscreen(true)}
              className="px-3.5 py-2 text-xs font-bold bg-white/5 border border-white/10 text-white rounded-md hover:bg-white/10 transition-colors"
            >
              📺 Fullscreen
            </button>
            <button
              onClick={handleExportDeck}
              className="px-3.5 py-2 text-xs font-bold bg-white/5 border border-white/10 text-cyan-400 rounded-md hover:bg-white/10 transition-colors"
            >
              📥 Export Slide Deck
            </button>
          </div>
        </div>
      </div>

      {/* Editor & Stylist Sidebar */}
      <Card className="w-[300px] bg-slate-950/45 border-white/5 p-6 shadow-2xl backdrop-blur-xl flex flex-col gap-6 overflow-y-auto">
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Slide Theme</h3>
          <Select value={theme} onValueChange={(val: any) => setTheme(val)}>
            <SelectTrigger className="bg-slate-900 border-white/10 text-white text-xs">
              <SelectValue placeholder="Theme style..." />
            </SelectTrigger>
            <SelectContent className="bg-slate-950 border-white/10 text-white text-xs">
              <SelectItem value="midnight">🌌 Midnight Space</SelectItem>
              <SelectItem value="emerald">💚 Clinical Emerald</SelectItem>
              <SelectItem value="cyber">💜 Cybernetic Glow</SelectItem>
              <SelectItem value="crimson">❤️ Deep Crimson</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 border-t border-white/5 pt-5 flex flex-col gap-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customizer</h3>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 uppercase font-bold">Slide Title</label>
            <Input
              value={editTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditTitle(e.target.value)}
              className="bg-slate-900 border-white/10 text-xs text-white"
            />
          </div>

          <div className="flex-grow flex flex-col gap-1.5 min-h-[140px]">
            <label className="text-[10px] text-slate-400 uppercase font-bold">Bullet Points (One per line)</label>
            <Textarea
              value={editBullets}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditBullets(e.target.value)}
              className="flex-1 bg-slate-900 border-white/10 text-xs text-white resize-none"
            />
          </div>

          <button
            onClick={handleUpdateSlide}
            className="w-full py-2.5 rounded-md font-bold text-xs bg-gradient-to-r from-cyan-400 to-indigo-500 hover:opacity-90 transition-opacity text-white"
          >
            Update Slide Content
          </button>
        </div>
      </Card>

      {/* Fullscreen Presenter Mode Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-16 select-none">
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-8 right-8 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center font-bold text-lg cursor-pointer transition-colors"
          >
            ✕
          </button>
          
          <div className={`w-full max-w-[1000px] aspect-[16/9] ${getThemeClass(theme)} border border-white/10 p-16 rounded-2xl flex flex-col justify-center shadow-2xl`}>
            <span className="text-xs uppercase font-bold tracking-widest text-cyan-400 mb-2">
              {activeSlide.category}
            </span>
            <h2 className={`text-4xl font-extrabold bg-gradient-to-r ${getTitleColor(theme)} bg-clip-text text-transparent mb-8 tracking-tight`}>
              {activeSlide.title}
            </h2>
            <ul className="list-disc pl-8 space-y-5 text-base text-slate-300">
              {activeSlide.bulletPoints.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
          </div>
          
          <div className="absolute bottom-8 text-xs text-slate-400 font-semibold">
            Slide {currentIndex + 1} of {slides.length} • Use Arrow Keys to navigate • Press ESC to exit
          </div>
        </div>
      )}
    </div>
  );
}

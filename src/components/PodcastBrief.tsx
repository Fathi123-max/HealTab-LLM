import { useState, useEffect, useRef } from 'react';
import { PodcastTurn } from '../types';
import { Card } from './ui/card';

interface PodcastBriefProps {
  dialogue: PodcastTurn[];
  onGeneratePodcast: (style: 'technical' | 'layman' | 'debate') => void;
  isLoading: boolean;
}

export default function PodcastBrief({ dialogue, onGeneratePodcast, isLoading }: PodcastBriefProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [style, setStyle] = useState<'technical' | 'layman' | 'debate'>('technical');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isPlayingRef = useRef<boolean>(isPlaying);

  // Keep ref up to date to prevent stale closures in async speech events
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    
    const updateVoices = () => {
      if (synthRef.current) {
        setVoices(synthRef.current.getVoices());
      }
    };

    updateVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  // When play status changes
  useEffect(() => {
    if (isPlaying) {
      if (synthRef.current && synthRef.current.paused) {
        synthRef.current.resume();
      } else {
        speakTurn();
      }
    } else {
      if (synthRef.current) synthRef.current.pause();
    }
  }, [isPlaying, currentIndex]);

  const speakTurn = () => {
    if (!synthRef.current || dialogue.length === 0) return;
    if (currentIndex >= dialogue.length) {
      setIsPlaying(false);
      setCurrentIndex(0);
      return;
    }

    // Cancel active voices to clear queues
    synthRef.current.cancel();

    const turn = dialogue[currentIndex];
    const utterance = new SpeechSynthesisUtterance(turn.text);
    utteranceRef.current = utterance;

    // Use state loaded voices
    let voice = null;
    if (turn.speaker === 'sarah') {
      voice = voices.find(v => v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('google us english') || v.name.toLowerCase().includes('female'));
    } else {
      voice = voices.find(v => v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('alex') || v.name.toLowerCase().includes('daniel') || v.name.toLowerCase().includes('google uk english male') || v.name.toLowerCase().includes('male'));
    }

    if (voice) utterance.voice = voice;
    utterance.rate = 1.05;
    utterance.pitch = turn.speaker === 'sarah' ? 1.05 : 0.95;

    utterance.onend = () => {
      if (isPlayingRef.current) {
        setCurrentIndex(prev => prev + 1);
      }
    };

    utterance.onerror = (err) => {
      // Ignore interruption/cancel errors so they don't trigger skipping loops
      if (err.error === 'interrupted' || err.error === 'canceled') {
        return;
      }
      console.warn("Speech turn error:", err);
      if (isPlayingRef.current) {
        setTimeout(() => {
          setCurrentIndex(prev => prev + 1);
        }, 1000);
      }
    };

    // A small timeout allows the asynchronous cancel() call to clear before we speak
    setTimeout(() => {
      if (isPlayingRef.current && synthRef.current) {
        synthRef.current.speak(utterance);
      }
    }, 50);
  };

  const handlePlayPause = () => {
    if (dialogue.length === 0) {
      onGeneratePodcast(style);
      setIsPlaying(true);
      return;
    }
    
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    if (synthRef.current) synthRef.current.cancel();
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const activeTurn = dialogue[currentIndex];

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 items-center justify-center gap-4 sm:gap-6 overflow-y-auto max-w-xl mx-auto">
      <div className="text-center shrink-0">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent mb-2 tracking-tight">
          Clinical Podcast Studio
        </h2>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-md">
          Simulate and listen to an interactive case discussion between Host <strong>Dr. Sarah</strong> and Medical Specialist <strong>Dr. James</strong>.
        </p>
      </div>

      {/* Controller Parameters */}
      <div className="flex items-center gap-3 shrink-0">
        <label className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Discussion Style:</label>
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value as any)}
          disabled={isPlaying}
          className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-md px-3 py-1 text-xs outline-none cursor-pointer disabled:opacity-40"
        >
          <option value="technical">🔬 Clinical Rounds (Technical)</option>
          <option value="layman">🌱 Patient Consultation (Layman)</option>
          <option value="debate">⚔️ Peer Review (Skeptical Debate)</option>
        </select>
      </div>

      <Card className="w-full bg-[var(--card-bg)] border-[var(--border-color)] shadow-2xl backdrop-blur-xl p-5 sm:p-8 flex flex-col items-center gap-6 sm:gap-8 relative overflow-hidden shrink-0">
        {/* Equalizer Visualizer */}
        <div className={`flex gap-1.5 items-end h-[50px] transition-opacity duration-300 shrink-0 ${isPlaying ? 'opacity-100' : 'opacity-30'}`}>
          <div style={{ animationDelay: '0.1s', animationPlayState: isPlaying ? 'running' : 'paused' }} className="w-1 h-3 bg-cyan-400 rounded-full animate-[eq-dance_0.8s_ease-in-out_infinite_alternate]"></div>
          <div style={{ animationDelay: '0.3s', animationPlayState: isPlaying ? 'running' : 'paused' }} className="w-1 h-6 bg-teal-400 rounded-full animate-[eq-dance_1.1s_ease-in-out_infinite_alternate]"></div>
          <div style={{ animationDelay: '0.5s', animationPlayState: isPlaying ? 'running' : 'paused' }} className="w-1 h-10 bg-emerald-400 rounded-full animate-[eq-dance_0.6s_ease-in-out_infinite_alternate]"></div>
          <div style={{ animationDelay: '0.2s', animationPlayState: isPlaying ? 'running' : 'paused' }} className="w-1 h-4 bg-purple-400 rounded-full animate-[eq-dance_0.9s_ease-in-out_infinite_alternate]"></div>
          <div style={{ animationDelay: '0.4s', animationPlayState: isPlaying ? 'running' : 'paused' }} className="w-1 h-8 bg-pink-400 rounded-full animate-[eq-dance_1.2s_ease-in-out_infinite_alternate]"></div>
          <div style={{ animationDelay: '0.6s', animationPlayState: isPlaying ? 'running' : 'paused' }} className="w-1 h-3 bg-rose-400 rounded-full animate-[eq-dance_0.7s_ease-in-out_infinite_alternate]"></div>
          <div style={{ animationDelay: '0.1s', animationPlayState: isPlaying ? 'running' : 'paused' }} className="w-1 h-9 bg-cyan-400 rounded-full animate-[eq-dance_1.0s_ease-in-out_infinite_alternate]"></div>
        </div>

        {/* Avatars */}
        <div className="flex gap-6 sm:gap-12 justify-center w-full shrink-0">
          {/* Host Sarah */}
          <div
            className="flex flex-col items-center transition-all duration-300"
            style={{
              opacity: isPlaying && activeTurn?.speaker === 'sarah' ? 1.0 : 0.35,
              transform: isPlaying && activeTurn?.speaker === 'sarah' ? 'scale(1.05)' : 'scale(0.95)'
            }}
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-400 to-indigo-400 flex items-center justify-center text-3xl shadow-lg shadow-cyan-400/10 text-white select-none">
              👩‍⚕️
            </div>
            <span className="text-xs font-bold mt-2 text-[var(--text-primary)]">Dr. Sarah</span>
            <span className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Senior Director</span>
          </div>

          {/* Expert James */}
          <div
            className="flex flex-col items-center transition-all duration-300"
            style={{
              opacity: isPlaying && activeTurn?.speaker === 'james' ? 1.0 : 0.35,
              transform: isPlaying && activeTurn?.speaker === 'james' ? 'scale(1.05)' : 'scale(0.95)'
            }}
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/10 text-white select-none">
              👨‍⚕️
            </div>
            <span className="text-xs font-bold mt-2 text-[var(--text-primary)]">Dr. James</span>
            <span className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Specialist Analyst</span>
          </div>
        </div>

        {/* Subtitles Area */}
        <div className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl p-4 min-h-[70px] flex items-center justify-center text-center">
          {isLoading ? (
            <div className="flex gap-1 items-center justify-center">
              <span className="text-xs text-[var(--text-secondary)]">Writing custom podcast script...</span>
            </div>
          ) : isPlaying && activeTurn ? (
            <p className="text-xs text-[var(--text-primary)] leading-relaxed font-medium">
              <strong>{activeTurn.speaker === 'sarah' ? 'Dr. Sarah' : 'Dr. James'}:</strong> "{activeTurn.text}"
            </p>
          ) : (
            <p className="text-xs text-[var(--text-secondary)] italic">Click Play to begin the simulated clinical rounds podcast.</p>
          )}
        </div>

        {/* Player controls buttons */}
        <div className="flex items-center gap-4">
          <button
            onClick={handlePlayPause}
            disabled={isLoading}
            className="px-6 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-cyan-400 to-indigo-500 hover:opacity-90 disabled:opacity-40 text-white shadow-md shadow-cyan-500/10 cursor-pointer"
          >
            {isLoading ? 'Loading...' : isPlaying ? '⏸ Pause' : '▶ Play Briefing'}
          </button>
          <button
            onClick={handleReset}
            disabled={dialogue.length === 0}
            className="px-4 py-2 rounded-full text-xs font-bold bg-white/5 border border-[var(--border-color)] hover:bg-white/10 disabled:opacity-40 text-[var(--text-primary)] cursor-pointer"
          >
            ✕ Reset
          </button>
        </div>
      </Card>
    </div>
  );
}

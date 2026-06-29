import React, { useState, useEffect, useRef } from 'react';
import { Message } from '../types';
import { Card } from './ui/card';
import { Input } from './ui/input';

interface AgentChatProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isGenerating: boolean;
  onNavigateCitation: (docId: string, pageNum: number) => void;
}

export default function AgentChat({
  messages,
  onSendMessage,
  isGenerating,
  onNavigateCitation
}: AgentChatProps) {
  const [inputText, setInputText] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // STT Voice Speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setInputText(prev => (prev + ' ' + text).trim());
        setIsListening(false);
      };

      rec.onerror = (e: any) => {
        console.warn("STT Speech recognition error:", e);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const formatMessageText = (text: string) => {
    if (text.startsWith("Disclaimer:")) {
      const index = text.indexOf('\n');
      if (index !== -1) {
        const disclaimer = text.substring(0, index);
        const rest = text.substring(index + 1);
        return (
          <div className="flex flex-col gap-2.5">
            <div className="bg-amber-500/10 border-l-2 border-amber-500/80 p-2.5 rounded text-[10px] text-amber-300 font-semibold leading-normal select-none">
              ⚠️ {disclaimer}
            </div>
            <div className="whitespace-pre-wrap">{rest}</div>
          </div>
        );
      }
    }

    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
      <div className="whitespace-pre-wrap">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={idx} className="text-cyan-400 font-bold">{part.slice(2, -2)}</strong>;
          }
          return part;
        })}
      </div>
    );
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const toggleSpeechRecognition = () => {
    if (!recognitionRef.current) {
      alert("Browser SpeechRecognition API is not supported in this browser. Try Chrome or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const suggestionChips = [
    { label: "📝 Case Summary", prompt: "Summarize the primary patient diagnostic markers and demographics." },
    { label: "💊 Drug Dosage", prompt: "What are the critical interventions scheduled and therapeutic drug dosage instructions?" },
    { label: "⚠️ Clinical Warnings", prompt: "Are there any clinical warning signals, contraindications, or risk parameters highlighted?" }
  ];

  return (
    <Card className="flex flex-col h-full bg-[var(--card-bg)] border-none shadow-2xl rounded-none">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold text-lg select-none">🤖</span>
          <div>
            <h2 className="text-xs font-bold text-[var(--text-primary)] tracking-wide uppercase">HealTab AI Agent</h2>
            <span className="text-[10px] text-[var(--text-secondary)]">Grounded Medical Companion</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col max-w-[85%] gap-1.5 ${
              msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
            }`}
          >
            <div
              className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white rounded-br-none shadow-md shadow-cyan-500/10'
                  : 'bg-[var(--chat-msg-ai)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-bl-none'
              }`}
            >
              {formatMessageText(msg.text)}

              {/* Render Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-2 border-t border-[var(--border-color)] flex flex-wrap gap-1.5 items-center">
                  <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase mr-1">Citations:</span>
                  {msg.citations.map((cit, idx) => (
                    <button
                      key={idx}
                      onClick={() => onNavigateCitation(cit.docId, cit.pageNum)}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 hover:bg-cyan-500/20 active:scale-95 transition-all cursor-pointer"
                    >
                      Ref [p.{cit.pageNum}]
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-secondary)] font-medium px-1">
              <span>{msg.role === 'user' ? 'Clinician' : 'HealTab AI'}</span>
              <span>•</span>
              {msg.role === 'ai' && (
                <span
                  className={`px-1 py-0.2 rounded text-[8px] font-bold border uppercase tracking-wider ${
                    msg.isGrounded
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                      : 'bg-violet-500/10 text-violet-400 border-violet-500/25'
                  }`}
                >
                  {msg.isGrounded ? 'Grounded' : 'General Knowledge'}
                </span>
              )}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex flex-col max-w-[80%] mr-auto items-start gap-1">
            <div className="p-3.5 rounded-2xl bg-[var(--chat-msg-ai)] border border-[var(--border-color)] flex gap-1 items-center rounded-bl-none">
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
            </div>
            <span className="text-[9px] text-[var(--text-secondary)] px-1 font-bold">HealTab AI is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="px-4 py-2 border-t border-[var(--border-color)] flex flex-wrap gap-1.5">
        {suggestionChips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => onSendMessage(chip.prompt)}
            disabled={isGenerating}
            className="text-[10px] px-2.5 py-1 rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-cyan-400/25 hover:bg-[var(--input-bg)] active:scale-95 disabled:opacity-40 transition-all select-none cursor-pointer"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--border-color)] flex items-center gap-3 bg-[var(--header-bg)]">
        <div className="flex-1 relative flex items-center">
          <Input
            value={inputText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening dictation..." : "Ask about clinical case parameters..."}
            disabled={isGenerating}
            className="w-full bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)] rounded-full pl-4 pr-10 py-5 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-cyan-400/50"
          />
          <button
            onClick={toggleSpeechRecognition}
            className={`absolute right-3.5 text-sm p-1 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer select-none ${
              isListening ? 'animate-pulse text-red-500 scale-110' : ''
            }`}
            title="Dictate Query (Voice Input)"
          >
            🎙️
          </button>
        </div>
        <button
          onClick={handleSend}
          disabled={!inputText.trim() || isGenerating}
          className="w-9 h-9 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-cyan-400/10 hover:opacity-95 active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:shadow-none transition-all cursor-pointer"
        >
          ✈️
        </button>
      </div>
    </Card>
  );
}

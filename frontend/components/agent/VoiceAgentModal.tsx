// frontend/components/agent/VoiceAgentModal.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic, MicOff, Volume2, X, Send, Sparkles, AlertCircle,
  CheckCircle, ArrowRight, ShieldCheck, Film, Compass, RefreshCw
} from 'lucide-react';
import {
  createAgentSession, sendAgentMessage, confirmAgentAction,
  type AgentMessageResponse, type AgentConfirmationCard
} from '@/services/api';
import { useCinemaStore } from '@/store/useCinemaStore';

interface MessageBubble {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  confirmationCard?: AgentConfirmationCard;
  isConfirmed?: boolean;
}

interface VoiceAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceAgentModal({ isOpen, onClose }: VoiceAgentModalProps) {
  const router = useRouter();
  const cinemaStore = useCinemaStore();

  const [language, setLanguage] = useState<'en' | 'hi' | 'kn'>('en');
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<MessageBubble[]>([]);
  const [inputText, setInputText] = useState('');
  const [state, setState] = useState<'idle' | 'listening' | 'thinking' | 'speaking' | 'error'>('idle');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [micError, setMicError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Session
  useEffect(() => {
    if (isOpen && !sessionId) {
      createAgentSession(language)
        .then((res) => {
          setSessionId(res.session_id);
          setMessages([
            {
              id: 'msg_welcome',
              sender: 'agent',
              text: res.welcome_message,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        })
        .catch((err) => console.warn('Agent session initialization error:', err));
    }
  }, [isOpen, language, sessionId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript]);

  // Handle Speech Recognition setup
  const startListening = () => {
    if (typeof window === 'undefined') return;

    // Barge-in: cancel any speaking voice
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError('Speech recognition is not supported in this browser. Please use text input.');
      setState('error');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;

      // Locale mapping
      recognition.lang = language === 'hi' ? 'hi-IN' : language === 'kn' ? 'kn-IN' : 'en-IN';

      recognition.onstart = () => {
        setState('listening');
        setMicError(null);
        setInterimTranscript('');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setInterimTranscript(transcript);

        if (event.results[0].isFinal) {
          handleSendMessage(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setMicError('Microphone permission was denied. Please allow microphone access or type your request.');
        } else {
          setMicError(`Audio capture notice: ${event.error}. You can type below.`);
        }
        setState('idle');
      };

      recognition.onend = () => {
        if (state === 'listening') {
          setState('idle');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn('Recognition start exception:', err);
      setState('idle');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setState('idle');
    }
  };

  const toggleListening = () => {
    if (state === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  };

  // Speak agent reply via Web Speech API
  const speakReply = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'hi' ? 'hi-IN' : language === 'kn' ? 'kn-IN' : 'en-IN';
    utterance.rate = 1.0;

    utterance.onstart = () => setState('speaking');
    utterance.onend = () => setState('idle');
    utterance.onerror = () => setState('idle');

    window.speechSynthesis.speak(utterance);
  };

  // Handle Query Submission
  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputText;
    if (!textToSend.trim() || !sessionId) return;

    if (state === 'listening') {
      recognitionRef.current?.stop();
    }

    const userMsg: MessageBubble = {
      id: `msg_u_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setInterimTranscript('');
    setState('thinking');

    try {
      const res = await sendAgentMessage(sessionId, textToSend, language);

      const agentMsg: MessageBubble = {
        id: `msg_a_${Date.now()}`,
        sender: 'agent',
        text: res.reply_text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confirmationCard: res.confirmation_card,
      };

      setMessages((prev) => [...prev, agentMsg]);

      // Execute UI actions returned by agent
      for (const act of res.ui_actions) {
        if (act.action === 'navigate' && act.params.url) {
          router.push(act.params.url);
        } else if (act.action === 'open_3d_seat_pov' && act.params.seat_id) {
          cinemaStore.enterPOV(act.params.seat_id);
          cinemaStore.showToast(`3D Camera sightline: Seat ${act.params.seat_id}`);
        } else if (act.action === 'highlight_seats' && act.params.seat_ids) {
          cinemaStore.clearSelection();
          for (const s of act.params.seat_ids) {
            cinemaStore.selectSeat(s);
          }
        } else if (act.action === 'navigate_3d') {
          if (act.params.action === 'sitAt') {
            cinemaStore.showToast('Seated at eye-level sightline.');
          } else if (act.params.action === 'standUp') {
            cinemaStore.exitPOV();
            cinemaStore.showToast('Standing in auditorium aisle.');
          }
        }
      }

      speakReply(res.reply_text);
    } catch (err: any) {
      console.warn('Agent message failure:', err);
      setState('error');
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          sender: 'agent',
          text: err.message || 'Sorry, I encountered an issue. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  // Handle Card Tap Confirmation (Non-negotiable Rule 2)
  const handleConfirmCard = async (msgId: string, card: AgentConfirmationCard) => {
    try {
      const res = await confirmAgentAction(sessionId, card.action_token, card.card_type);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                isConfirmed: true,
                text: `${m.text}\n\n[SUCCESS] ${res.message}`,
              }
            : m
        )
      );
      if (card.card_type === 'HOLD_SEATS') {
        cinemaStore.showToast('Seats locked! Timer active for 5 minutes.');
      }
    } catch (err: any) {
      alert(err.message || 'Confirmation failed. Please sign in or re-select seats.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="CineVerse Voice Assistant"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-4 animate-in fade-in"
    >
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0c0d14] shadow-2xl flex flex-col h-[85vh] sm:h-[680px] overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-[#12131d]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#e50914] to-red-600 shadow-lg shadow-red-600/30">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">CineVerse Voice Assistant</h2>
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[11px] text-zinc-400">Talk to find movies, preview 3D seats & book</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="flex rounded-xl bg-white/5 p-0.5 border border-white/10 text-[11px] font-semibold">
              {(['en', 'hi', 'kn'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLanguage(l)}
                  data-testid={`lang-btn-${l}`}
                  className={`px-2 py-1 rounded-lg transition ${
                    language === l ? 'bg-[#e50914] text-white shadow' : 'text-zinc-400 hover:text-white'
                  }`}
                  aria-label={`Select language ${l}`}
                >
                  {l === 'en' ? 'EN' : l === 'hi' ? 'हिन्दी' : 'ಕನ್ನಡ'}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 transition"
              aria-label="Close assistant"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-[#e50914] text-white font-medium rounded-tr-none'
                    : 'bg-[#181926] text-zinc-200 border border-white/5 rounded-tl-none shadow-md'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>

                {/* State-Changing Confirmation Card */}
                {m.confirmationCard && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>{m.confirmationCard.title}</span>
                    </div>
                    <p className="text-[11px] text-zinc-300">{m.confirmationCard.description}</p>

                    {m.isConfirmed ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold mt-2">
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Action Confirmed by User Tap</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConfirmCard(m.id, m.confirmationCard!)}
                        data-testid="agent-card-tap-confirm"
                        className="w-full mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-xs font-bold text-white hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-900/40 transition active:scale-95"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Tap to Confirm ({m.confirmationCard.card_type === 'HOLD_SEATS' ? 'Lock Seats' : 'Cancel Booking'})</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <span className="text-[9px] text-zinc-500 mt-1 px-1">{m.timestamp}</span>
            </div>
          ))}

          {/* Interim Real-Time Transcript */}
          {interimTranscript && (
            <div className="flex flex-col items-end">
              <div className="rounded-2xl rounded-tr-none bg-[#e50914]/60 px-4 py-2.5 text-xs text-white/90 italic">
                {interimTranscript}...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="border-t border-white/5 px-4 py-2 bg-[#0e0f17] flex items-center gap-2 overflow-x-auto text-[11px]">
          <span className="text-zinc-500 whitespace-nowrap">Try saying:</span>
          {[
            'Best seats in middle',
            'Show view from E5',
            'Compare E5 vs F5',
            'Hold E5 and E6',
            'Apply FIRSTSHOW',
          ].map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSendMessage(prompt)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-300 hover:text-white hover:bg-white/10 whitespace-nowrap transition"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Bottom Voice & Text Input Control Bar */}
        <div className="border-t border-white/10 bg-[#12131d] p-4 space-y-3">
          {micError && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-950/20 border border-amber-500/20 p-2 rounded-xl">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{micError}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Interactive Mic Button */}
            <button
              onClick={toggleListening}
              data-testid="voice-agent-mic-button"
              className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-300 ${
                state === 'listening'
                  ? 'bg-red-600 text-white shadow-xl shadow-red-600/50 scale-105 animate-pulse'
                  : state === 'thinking'
                  ? 'bg-amber-600 text-white animate-spin'
                  : state === 'speaking'
                  ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/30'
                  : 'bg-[#e50914] text-white hover:bg-red-700 shadow-lg shadow-red-900/40'
              }`}
              aria-label={state === 'listening' ? 'Stop listening' : 'Start voice input'}
            >
              {state === 'listening' ? (
                <Mic className="h-5 w-5" />
              ) : state === 'thinking' ? (
                <RefreshCw className="h-5 w-5" />
              ) : state === 'speaking' ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>

            {/* Text Input Fallback */}
            <div className="flex-1 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#090a0f] px-3.5 py-1.5 focus-within:border-[#e50914] transition">
              <input
                type="text"
                data-testid="voice-agent-text-input"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={
                  state === 'listening'
                    ? 'Listening... speak now'
                    : state === 'thinking'
                    ? 'Thinking...'
                    : 'Type a message or tap the mic...'
                }
                className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim()}
                data-testid="voice-agent-send-button"
                className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 transition"
                aria-label="Send query"
              >
                <Send className="h-4 w-4 text-[#e50914]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

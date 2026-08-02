import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Knowledge Base ─────────────────────────────────────────────────────────
// Contextual Q&A about FaceVault — the bot matches user input to these entries.
const KNOWLEDGE_BASE = [
  {
    keywords: ['upload', 'add photo', 'add photos', 'upload photo', 'drag', 'drop'],
    answer: 'To upload photos: go to your event\'s **Upload** tab, then drag & drop images or click to browse. FaceVault auto-detects faces in every photo using AI — you\'ll see a progress bar as faces are indexed. Supported formats: JPG, PNG, WEBP.'
  },
  {
    keywords: ['find', 'search', 'selfie', 'my photo', 'my photos', 'recognize', 'match'],
    answer: 'To find your photos: open the **guest link** for the event, enter the password (if any), then **upload a selfie** or **take a photo** with your camera. FaceVault compares your face against all indexed photos and shows matches ranked by confidence. Try a clear, front-facing selfie with good lighting for best results!'
  },
  {
    keywords: ['create event', 'new event', 'make event', 'start event'],
    answer: 'To create a new event: go to your **Dashboard** and click **"New event"**. Give it a title, optionally set a password for guest access, and optionally set an expiry date. Once created, you can upload photos and share the guest link.'
  },
  {
    keywords: ['share', 'guest link', 'qr', 'invite', 'send link'],
    answer: 'To share your event: open the event and go to the **Share** tab. You\'ll find a **guest link** you can copy and a **QR code** that guests can scan. Guests enter the event password (if set) and use a selfie to find their photos.'
  },
  {
    keywords: ['download', 'save', 'get photo'],
    answer: 'To download photos: after searching with a selfie, each matching photo has a **"↓ Save"** link. You can also click **"Download all →"** to open all matched photos for saving. In the gallery view, click any photo and use the **Download** button.'
  },
  {
    keywords: ['password', 'protect', 'security', 'private'],
    answer: 'You can password-protect your event in **Settings**. When set, guests must enter the password before they can search the gallery. You can update or remove the password anytime from the event\'s **Settings** tab.'
  },
  {
    keywords: ['face', 'detect', 'recognition', 'not working', 'no face', 'can\'t detect', 'accuracy'],
    answer: 'FaceVault uses **SSD MobileNetV1** AI for face detection — it works best with:\n• Clear, front-facing photos\n• Good, even lighting\n• Faces that aren\'t too small in the frame\n\nIf detection fails, try a different photo with better lighting. Group photos with many people work well too!'
  },
  {
    keywords: ['archive', 'hide', 'delete', 'remove'],
    answer: 'To manage events: go to the event\'s **Settings** tab.\n• **Archive**: hides the event from the guest link (you can unarchive later)\n• **Delete**: permanently removes the event and all its photos — this cannot be undone!'
  },
  {
    keywords: ['how', 'what is', 'about', 'facevault', 'help', 'guide'],
    answer: 'Welcome to **FaceVault**! 📸\n\nFaceVault is an AI-powered photo gallery where guests can find photos of themselves using just a selfie. Here\'s how it works:\n\n1. **Create an event** → upload group/event photos\n2. **Share the guest link** → guests open it on their phone\n3. **Guests take a selfie** → AI finds all their photos instantly\n\nYour photos stay private. Only a mathematical face signature is used for matching — no face data is stored from selfies.'
  },
  {
    keywords: ['voice', 'speak', 'talk', 'microphone', 'mic'],
    answer: 'You can use **voice mode** by clicking the 🎙️ microphone button! Speak your question and I\'ll respond with both text and voice. Make sure to allow microphone access when prompted. Click the mic again to stop listening.'
  },
  {
    keywords: ['hello', 'hi', 'hey', 'greet'],
    answer: 'Hello! 👋 I\'m your FaceVault assistant. I can help you with uploading photos, finding your pictures, creating events, sharing galleries, and more. What would you like to know?'
  }
];

const DEFAULT_RESPONSE = "I'm not sure about that, but I can help you with:\n• **Uploading photos** to events\n• **Finding your photos** using a selfie\n• **Creating & sharing events**\n• **Downloading** your matched photos\n• **Password protection** & settings\n\nTry asking about any of these topics!";

// ─── OmniVoice TTS Helper ───────────────────────────────────────────────────
const OMNIVOICE_URL = 'http://localhost:7852';

async function isOmniVoiceAvailable() {
  try {
    const resp = await fetch(`${OMNIVOICE_URL}/api/health`, { signal: AbortSignal.timeout(1500) });
    return resp.ok;
  } catch {
    return false;
  }
}

async function speakWithOmniVoice(text) {
  try {
    const resp = await fetch(`${OMNIVOICE_URL}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'omnivoice',
        input: text.replace(/[*#_`]/g, ''), // Strip markdown
        voice: 'alloy',
        response_format: 'mp3'
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!resp.ok) throw new Error('OmniVoice TTS failed');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
    audio.onended = () => URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

function speakWithBrowser(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const cleaned = text.replace(/[*#_`•\n]/g, ' ').replace(/\s+/g, ' ').trim();
  const utterance = new SpeechSynthesisUtterance(cleaned);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 0.9;
  // Prefer a natural-sounding voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
    || voices.find(v => v.lang.startsWith('en') && v.localService)
    || voices[0];
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

// ─── Bot Logic ──────────────────────────────────────────────────────────────
function findAnswer(input) {
  const lower = input.toLowerCase().trim();
  if (!lower) return DEFAULT_RESPONSE;

  let bestMatch = null;
  let bestScore = 0;

  for (const entry of KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += kw.length; // Longer keyword matches are more specific
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestMatch ? bestMatch.answer : DEFAULT_RESPONSE;
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function ChatVoiceBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hi! 👋 I'm your FaceVault assistant. Ask me anything about uploading photos, finding your pictures, or using the app. You can also tap the 🎙️ to use voice!" }
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [omniVoiceReady, setOmniVoiceReady] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);

  // Check OmniVoice availability on mount
  useEffect(() => {
    isOmniVoiceAvailable().then(setOmniVoiceReady);
    // Load voices for browser TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const speak = useCallback(async (text) => {
    if (!voiceEnabled) return;
    if (omniVoiceReady) {
      const used = await speakWithOmniVoice(text);
      if (used) return;
    }
    speakWithBrowser(text);
  }, [voiceEnabled, omniVoiceReady]);

  const handleSend = useCallback(async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed) return;

    setMessages(prev => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setIsTyping(true);

    // Simulate a small delay for natural feel
    await new Promise(r => setTimeout(r, 400 + Math.random() * 400));

    const answer = findAnswer(trimmed);
    setIsTyping(false);
    setMessages(prev => [...prev, { role: 'bot', text: answer }]);
    speak(answer);
  }, [input, speak]);

  const toggleListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages(prev => [...prev, { role: 'bot', text: "Sorry, your browser doesn't support speech recognition. Try Chrome or Edge." }]);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      handleSend(transcript);
    };

    recognition.onerror = (event) => {
      console.warn('[FaceVault Bot] Speech error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setMessages(prev => [...prev, { role: 'bot', text: "Microphone access was denied. Please allow microphone permissions in your browser settings." }]);
      }
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, handleSend]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format markdown-like text to simple HTML
  function formatMessage(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>')
      .replace(/• /g, '&bull; ');
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        id="chat-bot-trigger"
        onClick={() => { setIsOpen(o => !o); }}
        className="chat-bot-trigger"
        aria-label="Open assistant"
        title="FaceVault Assistant"
      >
        {isOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        )}
        {!isOpen && <span className="chat-bot-pulse" />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="chat-bot-panel" id="chat-bot-panel">
          {/* Header */}
          <div className="chat-bot-header">
            <div className="chat-bot-header-left">
              <div className="chat-bot-avatar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div>
                <span className="chat-bot-title">FaceVault Assistant</span>
                <span className="chat-bot-subtitle">
                  {omniVoiceReady ? '🟢 OmniVoice connected' : 'Ask me anything'}
                </span>
              </div>
            </div>
            <div className="chat-bot-header-actions">
              <button
                onClick={() => setVoiceEnabled(v => !v)}
                className={`chat-bot-icon-btn ${voiceEnabled ? 'active' : ''}`}
                title={voiceEnabled ? 'Mute voice' : 'Enable voice'}
              >
                {voiceEnabled ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="chat-bot-icon-btn"
                title="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="chat-bot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-bot-msg ${msg.role}`}>
                {msg.role === 'bot' && (
                  <div className="chat-bot-msg-avatar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                )}
                <div
                  className={`chat-bot-bubble ${msg.role}`}
                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }}
                />
              </div>
            ))}
            {isTyping && (
              <div className="chat-bot-msg bot">
                <div className="chat-bot-msg-avatar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <div className="chat-bot-bubble bot typing-indicator">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="chat-bot-input-area">
            <button
              onClick={toggleListening}
              className={`chat-bot-mic-btn ${isListening ? 'listening' : ''}`}
              title={isListening ? 'Stop listening' : 'Speak your question'}
            >
              {isListening ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              )}
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Listening…' : 'Ask about FaceVault…'}
              className="chat-bot-input"
              disabled={isListening}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isListening}
              className="chat-bot-send-btn"
              title="Send"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState, useEffect, useRef } from 'react';

type PageData = {
    narration: string;
    image_url: string;
    era: string;
    emotion: string;
    chapter: string;
    key_people: string[];
};

export default function BookSession({
    userId,
    bookId,
    storytellerName,
    backendUrl,
    onBackToBooks,
    onLogout,
}: {
    userId: string;
    bookId: string;
    storytellerName: string;
    backendUrl: string;
    onBackToBooks: () => void;
    onLogout: () => void;
}) {
    const [mode, setMode] = useState<'voice' | 'text'>('voice');
    const [status, setStatus] = useState({ class: 'connected', text: 'Ready' });
    const [isRecording, setIsRecording] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);
    const [textInput, setTextInput] = useState("");
    const [pages, setPages] = useState<PageData[]>([]);
    const [pageCount, setPageCount] = useState(0);
    const [sessionPages, setSessionPages] = useState(0);
    const [vizHeights, setVizHeights] = useState<number[]>(Array(12).fill(4));
    const [liveTranscript, setLiveTranscript] = useState("");

    const recognitionRef = useRef<any>(null);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const accumulatedTextRef = useRef<string>("");
    const isRecordingRef = useRef(false);
    const isPausedRef = useRef(false);
    const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const isMountedRef = useRef(true);

    const ws = useRef<WebSocket | null>(null);
    const mediaStream = useRef<MediaStream | null>(null);
    const audioContext = useRef<AudioContext | null>(null);
    const outputAudioContext = useRef<AudioContext | null>(null);
    const processor = useRef<ScriptProcessorNode | null>(null);
    const analyser = useRef<AnalyserNode | null>(null);
    const nextAudioTime = useRef(0);
    const rafId = useRef<number>(0);
    const hasGreeted = useRef(false);
    const transcriptBoxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        isMountedRef.current = true;
        reconnectAttemptsRef.current = 0;

        // Initial load — only fetch greeting and pages, do NOT open WebSocket yet
        async function initSession() {
            try {
                const res = await fetch(`${backendUrl}/session-greeting/${userId}/${bookId}`);
                const data = await res.json();
                setTranscript([{ role: 'agent', text: data.greeting }]);
            } catch (e) {
                setTranscript([{ role: 'agent', text: 'Hello! I am EchoBook. Tell me a memory from your childhood.' }]);
            }
            loadExistingPages();
        }
        initSession();

        return () => {
            isMountedRef.current = false;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            ws.current?.close();
            stopRecording();
            if (outputAudioContext.current) outputAudioContext.current.close();
            cancelAnimationFrame(rafId.current);
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            if (recognitionRef.current) recognitionRef.current.stop();
        };
    }, [userId, bookId, backendUrl]);

    useEffect(() => {
        if (transcriptBoxRef.current) {
            transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight;
        }
    }, [transcript]);

    async function loadExistingPages() {
        try {
            const res = await fetch(`${backendUrl}/book/${userId}/${bookId}`);
            const data = await res.json();
            if (data.pages?.length) {
                setPages(data.pages);
                setPageCount(data.pages.length);
            }
        } catch (e) { }
    }

    function connectWebSocket(initialGreeting: string) {
        if (!isMountedRef.current) return;
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        const wsUrl = backendUrl.replace('http', 'ws') + `/ws/interview/${userId}/${bookId}`;
        const socket = new WebSocket(wsUrl);
        ws.current = socket;

        socket.onopen = () => {
            reconnectAttemptsRef.current = 0; // Reset on successful connection
            setStatus({ class: 'connected', text: 'Ready to listen' });
        };
        socket.onmessage = (e) => handleMessage(JSON.parse(e.data));
        socket.onclose = () => {
            if (!isMountedRef.current) return;
            setStatus({ class: '', text: 'Disconnected' });
            hasGreeted.current = false;

            // Exponential backoff: 3s, 6s, 12s, 24s... capped at 30s, max 10 attempts
            const attempts = reconnectAttemptsRef.current;
            if (attempts < 10) {
                const delay = Math.min(3000 * Math.pow(2, attempts), 30000);
                reconnectAttemptsRef.current = attempts + 1;
                console.log(`[WS] Reconnecting in ${delay/1000}s (attempt ${attempts + 1}/10)`);
                reconnectTimerRef.current = setTimeout(() => connectWebSocket(""), delay);
            } else {
                console.log('[WS] Max reconnect attempts reached — voice may be unavailable');
                setStatus({ class: '', text: 'Voice unavailable — use text mode' });
            }
        };
    }

    function handleMessage(msg: any) {
        switch (msg.type) {
            case 'audio':
                queueAudio(msg.data);
                break;
            case 'transcript':
                if (msg.text) {
                    setTranscript(prev => [...prev, { role: 'agent', text: msg.text }]);
                }
                
                function checkAudioQueue() {
                    if (!outputAudioContext.current || !isRecordingRef.current) {
                        isPausedRef.current = false;
                        return;
                    }
                    const diff = nextAudioTime.current - outputAudioContext.current.currentTime;
                    if (diff > 0.1) {
                        setTimeout(checkAudioQueue, diff * 1000);
                    } else {
                        isPausedRef.current = false;
                        if (isRecordingRef.current) setStatus({ class: 'listening', text: 'Listening' });
                    }
                }
                
                if (isRecordingRef.current) {
                    setStatus({ class: 'thinking', text: 'Agent is speaking...' });
                    setTimeout(checkAudioQueue, 400); 
                }
                break;
            case 'page_generating':
                setIsGenerating(true);
                break;
            case 'new_page':
                setIsGenerating(false);
                setPages(prev => [...prev, msg]);
                setPageCount(p => p + 1);
                setSessionPages(p => p + 1);
                break;
            case 'error':
                console.error('Backend:', msg.message);
                break;
        }
    }

    function float32ToInt16(buffer: Float32Array) {
        let l = buffer.length;
        const buf = new Int16Array(l);
        while (l--) {
            buf[l] = Math.min(1, buffer[l]) * 0x7FFF;
        }
        return buf;
    }

    async function toggleMic() {
        isRecording ? stopRecording() : await startRecording();
    }

    async function startRecording() {
        try {
            mediaStream.current = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } });
            const ctx = new AudioContext({ sampleRate: 16000 });
            audioContext.current = ctx;

            const source = ctx.createMediaStreamSource(mediaStream.current);
            const ana = ctx.createAnalyser();
            ana.fftSize = 256;
            analyser.current = ana;
            source.connect(ana);

            setIsRecording(true);
            isRecordingRef.current = true;
            setStatus({ class: 'listening', text: 'Listening' });
            animateVisualizer();

            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition && !recognitionRef.current) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';

                recognition.onresult = (event: any) => {
                    if (!isRecordingRef.current || isPausedRef.current) return;
                    let interim = '';
                    let final = '';
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const t = event.results[i][0].transcript;
                        if (event.results[i].isFinal) final += t;
                        else interim += t;
                    }
                    if (final) accumulatedTextRef.current += final + " ";
                    setLiveTranscript(accumulatedTextRef.current + interim);

                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = setTimeout(() => {
                        const textToSend = accumulatedTextRef.current.trim();
                        if (textToSend) {
                            processTextTurn(textToSend, true);
                            accumulatedTextRef.current = "";
                            setLiveTranscript("");
                        }
                    }, 5000);
                };

                recognition.onend = () => {
                    if (isRecordingRef.current && recognitionRef.current) {
                        try { recognitionRef.current.start(); } catch (e) {}
                    }
                };

                recognitionRef.current = recognition;
            }

            if (recognitionRef.current) {
                try { recognitionRef.current.start(); } catch (e) {}
            }

            if (!outputAudioContext.current) {
                outputAudioContext.current = new AudioContext({ sampleRate: 24000 });
            }
            if (outputAudioContext.current.state === 'suspended') {
                await outputAudioContext.current.resume();
            }

            // Connect WebSocket lazily — only when user actually starts voice
            if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
                reconnectAttemptsRef.current = 0;
                connectWebSocket("");
                // Wait briefly for connection to establish
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            if (!hasGreeted.current && ws.current?.readyState === WebSocket.OPEN) {
                hasGreeted.current = true;
                if (transcript.length === 0) {
                    ws.current.send(JSON.stringify({ type: "greeting", text: "Hello" }));
                } else {
                    ws.current.send(JSON.stringify({ type: "history", history: transcript }));
                }
            }
        } catch (e) {
            alert('Microphone access denied.');
        }
    }

    function stopRecording() {
        setIsRecording(false);
        isRecordingRef.current = false;
        
        if (processor.current) { processor.current.disconnect(); processor.current = null; }
        if (audioContext.current) { audioContext.current.close(); audioContext.current = null; }
        if (mediaStream.current) { mediaStream.current.getTracks().forEach(t => t.stop()); mediaStream.current = null; }
        
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
        }
        accumulatedTextRef.current = "";
        setLiveTranscript("");
        
        setStatus({ class: 'connected', text: 'Ready' });
        setVizHeights(Array(12).fill(4));
        cancelAnimationFrame(rafId.current);
    }

    async function queueAudio(b64: string) {
        if (!outputAudioContext.current) {
            outputAudioContext.current = new AudioContext({ sampleRate: 24000 });
        }
        const oCtx = outputAudioContext.current;
        if (oCtx.state === 'suspended') await oCtx.resume();

        try {
            const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            const i16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
            const f32 = new Float32Array(i16.length);
            for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768;

            const buf = oCtx.createBuffer(1, f32.length, 24000);
            buf.copyToChannel(f32, 0);
            const src = oCtx.createBufferSource();
            src.buffer = buf;
            src.connect(oCtx.destination);

            if (nextAudioTime.current < oCtx.currentTime) {
                nextAudioTime.current = oCtx.currentTime + 0.05;
            }
            src.start(nextAudioTime.current);
            nextAudioTime.current += buf.duration;
        } catch (e) {
            console.error(e);
        }
    }

    function animateVisualizer() {
        if (!analyser.current) return;

        // Use time domain data for better amplitude spikes instead of purely frequency
        const data = new Uint8Array(analyser.current.frequencyBinCount);
        analyser.current.getByteTimeDomainData(data);

        setVizHeights(Array.from({ length: 12 }).map((_, i) => {
            // Check amplitude deviation from 128 (silence in 8-bit time domain data)
            const rawVal = data[Math.floor(i * data.length / 12)];
            const amplitude = Math.abs(rawVal - 128); // 0 to 128

            // Exaggerate the sensitivity dramatically so quiet talking still spikes
            const spikeHeight = Math.max(4, (amplitude / 128) * 200);
            return spikeHeight > 100 ? 100 : spikeHeight; // Cap at 100px height
        }));

        rafId.current = requestAnimationFrame(animateVisualizer);
    }

    function speakWithBrowserTTS(text: string) {
        if (!text) return;
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'en-US';
        // Try to find a female voice
        const voices = window.speechSynthesis.getVoices();
        const femaleVoice = voices.find(v => 
            v.name.includes('Samantha') || v.name.includes('Karen') || 
            v.name.includes('Victoria') || v.name.includes('Female') ||
            v.name.includes('Zira') || v.name.includes('Google UK English Female')
        );
        if (femaleVoice) utter.voice = femaleVoice;
        utter.rate = 0.95;
        utter.pitch = 1.1;
        utter.onend = () => {
            isPausedRef.current = false;
            if (isRecordingRef.current) setStatus({ class: 'listening', text: 'Listening' });
        };
        utter.onerror = () => {
            isPausedRef.current = false;
            if (isRecordingRef.current) setStatus({ class: 'listening', text: 'Listening' });
        };
        window.speechSynthesis.speak(utter);
    }

    async function playWavAudio(b64: string, fallbackText: string) {
        if (!outputAudioContext.current) {
            outputAudioContext.current = new AudioContext({ sampleRate: 24000 });
        }
        const oCtx = outputAudioContext.current;
        if (oCtx.state === 'suspended') await oCtx.resume();

        try {
            const binaryString = window.atob(b64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const audioBuffer = await oCtx.decodeAudioData(bytes.buffer.slice(0));
            const source = oCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(oCtx.destination);
            
            source.onended = () => {
                isPausedRef.current = false;
                if (isRecordingRef.current) setStatus({ class: 'listening', text: 'Listening' });
            };
            
            source.start(0);
        } catch (e) {
            console.error('Gemini audio decode failed, using browser TTS:', e);
            speakWithBrowserTTS(fallbackText);
        }
    }

    async function processTextTurn(msg: string, isFromVoice: boolean = false) {
        setTranscript(prev => [...prev, { role: 'user', text: msg }]);
        setIsThinking(true);
        if (isFromVoice) {
            isPausedRef.current = true;
            setStatus({ class: 'thinking', text: 'Agent is speaking...' });
        }
        
        try {
            const history = transcript.map(t => ({ role: t.role === 'agent' ? 'assistant' : 'user', content: t.text }));
            const res = await fetch(`${backendUrl}/api/text-turn`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg, history, user_id: userId, book_id: bookId })
            });
            const data = await res.json();

            setTranscript(prev => [...prev, { role: 'agent', text: data.reply }]);
            
            if (isFromVoice) {
                speakWithBrowserTTS(data.reply);
            }

            if (data.captured && data.vignette) {
                setPages(prev => [...prev, {
                    id: String(Date.now()),
                    narration: data.vignette.narration,
                    image_url: data.image_url,
                    era: data.vignette.era,
                    emotion: data.vignette.emotion,
                    chapter: data.vignette.chapter,
                    key_people: data.vignette.key_people,
                }]);
                setPageCount(p => p + 1);
                setSessionPages(p => p + 1);
            }
        } catch (e) {
            console.error(e);
            setTranscript(prev => [...prev, { role: 'agent', text: 'Sorry, something went wrong.' }]);
            if (isFromVoice) {
                isPausedRef.current = false;
                if (isRecordingRef.current) setStatus({ class: 'listening', text: 'Listening' });
            }
        } finally {
            setIsThinking(false);
            setIsGenerating(false);
        }
    }

    function handleManualSend() {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        const msgToSend = liveTranscript.trim() || accumulatedTextRef.current.trim();
        if (msgToSend) {
            processTextTurn(msgToSend, true);
            accumulatedTextRef.current = "";
            setLiveTranscript("");
        }
    }

    async function sendText() {
        const msg = textInput.trim();
        if (!msg || isThinking || isGenerating) return;
        setTextInput("");
        await processTextTurn(msg, false);
    }

    return (
        <>
            <header>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <button className="btn-books" onClick={onBackToBooks}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                        Books
                    </button>
                    <div>
                        <span className="logo-title">EchoBook</span>
                        <span className="logo-sub">— Living Memory</span>
                    </div>
                </div>
                <div className="header-status">
                    <div className={`status-dot ${status.class}`}></div>
                    <span id="status-text">{status.text}</span>
                </div>
            </header>

            <aside id="sidebar">
                <div className="mode-toggle">
                    <button className={`mode-btn ${mode === 'voice' ? 'active' : ''}`} onClick={() => setMode('voice')}>🎙 Voice</button>
                    <button className={`mode-btn ${mode === 'text' ? 'active' : ''}`} onClick={() => setMode('text')}>✏️ Text</button>
                </div>

                <div id="voice-panel" style={{ display: mode === 'voice' ? 'flex' : 'none' }}>
                    <div className="mic-ring">
                        <div className={`mic-ring-outer ${isRecording ? 'active' : ''}`}></div>
                        <button id="mic-btn" className={isRecording ? 'recording' : ''} onClick={toggleMic}>
                            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="22" />
                                <line x1="8" y1="22" x2="16" y2="22" />
                            </svg>
                        </button>
                    </div>
                    <p className="mic-label">{isRecording ? 'Listening…' : 'Tap to speak'}</p>
                    <div id="visualizer">
                        {vizHeights.map((h, i) => (
                            <div key={i} className="viz-bar" style={{ height: `${h}px` }}></div>
                        ))}
                    </div>
                    {liveTranscript && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                            <div className="live-transcript" style={{ fontStyle: 'italic', color: 'var(--ink-soft)', textAlign: 'center', fontSize: '0.9rem', maxWidth: '280px', lineHeight: 1.5 }}>
                                "{liveTranscript}"
                            </div>
                            <button className="btn-books" style={{ fontSize: '0.8rem', padding: '6px 14px' }} onClick={handleManualSend}>
                                Send Memory
                            </button>
                        </div>
                    )}
                </div>

                <div id="text-panel" style={{ display: mode === 'text' ? 'flex' : 'none' }}>
                    <textarea
                        id="text-input"
                        placeholder="Type a memory here and press Send…"
                        value={textInput}
                        onChange={e => setTextInput(e.target.value)}
                        disabled={isThinking || isGenerating}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendText();
                            }
                        }}
                        style={isThinking || isGenerating ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                    ></textarea>
                    <button
                        id="send-btn"
                        onClick={sendText}
                        disabled={isThinking || isGenerating}
                        style={isThinking || isGenerating ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                    >
                        {isThinking ? '✦ Thinking…' : isGenerating ? '✦ Illustrating…' : 'Send Memory'}
                    </button>
                </div>

                {(isThinking || isGenerating) && (
                    <div id="generating-banner" style={{ display: 'flex' }}>
                        <div className="gen-spinner"></div>
                        <span>{isThinking ? 'Thinking about your story…' : 'Illustrating your memory…'}</span>
                    </div>
                )}

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>
                    <p className="transcript-label">Conversation</p>
                    <div id="transcript-box" ref={transcriptBoxRef}>
                        {transcript.length === 0 ? (
                            <span style={{ opacity: 0.4, fontStyle: 'italic' }}>Your conversation will appear here…</span>
                        ) : (
                            transcript.map((t, i) => (
                                <p key={i} className={t.role === 'agent' ? 'transcript-agent' : 'transcript-user'} style={{ marginBottom: '10px' }}>
                                    {t.text}
                                </p>
                            ))
                        )}
                    </div>
                </div>

                {sessionPages > 0 && (
                    <div className="session-info" style={{ display: 'block' }}>
                        <strong>📚 Today's session</strong><br />
                        <span>{sessionPages} {sessionPages === 1 ? 'page' : 'pages'} created</span>
                    </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                    <button className="btn-signout" onClick={onLogout} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>Sign Out</button>
                </div>
            </aside>

            <main id="book-area">
                {pages.length === 0 ? (
                    <div id="welcome-state">
                        <div className="welcome-ornament">✦</div>
                        <h2 className="welcome-title">Every memory<br />becomes a page</h2>
                        <p className="welcome-sub">Start speaking — or switch to Text mode — and watch your story come to life.</p>
                        <p className="welcome-hint">Use the Voice or Text toggle on the left</p>
                    </div>
                ) : (
                    <div id="book-content">
                        <div className="book-header">
                            <h2 className="book-title-text">The Book of {storytellerName}</h2>
                            <span className="book-page-count">{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>
                        </div>
                        <div id="pages-container">
                            {pages.map((p, i) => (
                                <div key={i} className="book-page page-appear">
                                    <div className="page-illustration">
                                        <img src={p.image_url} alt="Memory illustration" className="loaded" />
                                    </div>
                                    <div className="page-content">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="page-number">Page {i + 1}</span>
                                            <span className="page-chapter-tag">{p.chapter || 'MEMORY'}</span>
                                        </div>
                                        <p className="page-narration">{p.narration}</p>
                                        <div className="page-divider"></div>
                                        <div>
                                            <span className="page-era">{p.era || 'Unknown era'}</span>
                                        </div>
                                        {p.key_people?.length > 0 && (
                                            <div className="page-people">
                                                {p.key_people.map((person, pi) => (
                                                    <span key={pi} className="person-tag">{person}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}

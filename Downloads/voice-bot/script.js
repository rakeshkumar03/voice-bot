const micButton = document.getElementById('micButton');
const sendButton = document.getElementById('sendButton');
const textInput = document.getElementById('textInput');
const status = document.getElementById('status');
const chatContainer = document.getElementById('chatContainer');
const interimTranscript = document.getElementById('interimTranscript');
const historyToggle = document.getElementById('historyToggle');
const historySidebar = document.getElementById('historySidebar');
const closeHistory = document.getElementById('closeHistory');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistory');

let recognition;
let isListening = false;
let hasGreeted = false;
let chatHistory = [];
let savedSessions = [];

// Load saved sessions from localStorage
function loadSavedSessions() {
    const saved = localStorage.getItem('chatSessions');
    if (saved) {
        savedSessions = JSON.parse(saved);
        updateHistoryDisplay();
    }
}

// Save current session
function saveCurrentSession() {
    if (chatHistory.length > 0) {
        const session = {
            id: Date.now(),
            timestamp: new Date().toLocaleString(),
            messages: [...chatHistory]
        };
        savedSessions.unshift(session); // Add to beginning
        
        // Keep only last 20 sessions
        if (savedSessions.length > 20) {
            savedSessions = savedSessions.slice(0, 20);
        }
        
        localStorage.setItem('chatSessions', JSON.stringify(savedSessions));
        updateHistoryDisplay();
    }
}

// Update history display
function updateHistoryDisplay() {
    if (savedSessions.length === 0) {
        historyList.innerHTML = '<p class="no-history">No chat history yet</p>';
        return;
    }
    
    historyList.innerHTML = savedSessions.map(session => {
        const exchanges = session.messages
            .filter(msg => msg.isUser)
            .map((msg, idx) => {
                const botResponse = session.messages.find(
                    (m, i) => i > session.messages.indexOf(msg) && !m.isUser
                );
                return `
                    <div class="history-exchange">
                        <div class="history-user">You: ${msg.text}</div>
                        ${botResponse ? `<div class="history-bot">Rakesh: ${botResponse.text}</div>` : ''}
                    </div>
                `;
            })
            .join('');
        
        return `
            <div class="history-item">
                <div class="history-timestamp">${session.timestamp}</div>
                ${exchanges}
            </div>
        `;
    }).join('');
}

// History toggle
historyToggle.addEventListener('click', () => {
    historySidebar.classList.add('open');
});

closeHistory.addEventListener('click', () => {
    historySidebar.classList.remove('open');
});

// Clear all history
clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all chat history?')) {
        savedSessions = [];
        localStorage.removeItem('chatSessions');
        updateHistoryDisplay();
    }
});

// Save session when user leaves or starts new chat
window.addEventListener('beforeunload', saveCurrentSession);

// Load sessions on startup
loadSavedSessions();

// Speak greeting on first user interaction
document.addEventListener('click', () => {
    if (!hasGreeted) {
        speak("Welcome! I'm Rakesh. Please use the microphone button for voice input or type your message below.");
        hasGreeted = true;
    }
}, { once: true });

// Initialize Speech Recognition
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isListening = true;
        micButton.classList.add('listening');
        status.textContent = '🎤 Listening... Speak now';
        interimTranscript.textContent = '';
    };

    recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                final += transcript;
            } else {
                interim += transcript;
            }
        }

        interimTranscript.textContent = interim;

        if (final) {
            handleUserInput(final);
            interimTranscript.textContent = '';
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
            status.textContent = 'No speech detected. Try again.';
        } else if (event.error === 'not-allowed') {
            status.textContent = '⚠️ Microphone access denied. Please allow microphone access.';
        } else {
            status.textContent = `Error: ${event.error}. Please try again.`;
        }
        resetMicButton();
    };

    recognition.onend = () => {
        resetMicButton();
    };
} else {
    status.textContent = '⚠️ Voice input not supported in this browser.';
    micButton.disabled = true;
}

// Voice input button
micButton.addEventListener('click', () => {
    if (isListening) {
        recognition.stop();
    } else {
        try {
            recognition.start();
        } catch (error) {
            console.error('Failed to start recognition:', error);
            status.textContent = 'Failed to start. Please try again.';
        }
    }
});

// Text input handlers
sendButton.addEventListener('click', sendTextMessage);

textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendTextMessage();
    }
});

function sendTextMessage() {
    const message = textInput.value.trim();
    if (message) {
        handleUserInput(message);
        textInput.value = '';
    }
}

function resetMicButton() {
    isListening = false;
    micButton.classList.remove('listening');
    status.textContent = 'Click mic for voice or type above';
}

function addMessage(text, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Add to chat history for display only (not sent to API)
    chatHistory.push({ text, isUser });
    
    // Keep only last 20 messages in current session
    if (chatHistory.length > 20) {
        chatHistory = chatHistory.slice(-20);
    }
}

async function handleUserInput(text) {
    addMessage(text, true);
    status.textContent = '💭 Thinking...';
    micButton.disabled = true;
    sendButton.disabled = true;
    textInput.disabled = true;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: text
                // NO history sent - each message is independent
            })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.response) {
            addMessage(data.response, false);
            speak(data.response);
            status.textContent = 'Click mic for voice or type above';
        } else {
            throw new Error('Empty response from server');
        }
    } catch (error) {
        console.error('Error:', error);
        addMessage('Sorry, something went wrong. Please try again.', false);
        status.textContent = 'Error occurred. Please retry.';
    } finally {
        micButton.disabled = false;
        sendButton.disabled = false;
        textInput.disabled = false;
        textInput.focus();
    }
}

function speak(text) {
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Get available voices
    const voices = speechSynthesis.getVoices();
    
    // Priority list for natural American English voices
    const usEnglishVoice = voices.find(voice => 
        voice.lang === 'en-US' && 
        (voice.name.includes('Male') || 
         voice.name.includes('David') ||
         voice.name.includes('Mark') ||
         !voice.name.toLowerCase().includes('female'))
    );
    
    // Fallback: Any US English voice
    const anyUSVoice = voices.find(voice => voice.lang === 'en-US');
    
    // Set the voice
    if (usEnglishVoice) {
        utterance.voice = usEnglishVoice;
        console.log('✅ Using US English voice:', usEnglishVoice.name);
    } else if (anyUSVoice) {
        utterance.voice = anyUSVoice;
        console.log('⚠️ Using US voice:', anyUSVoice.name);
    } else {
        console.log('❌ Using default voice');
    }
    
    utterance.lang = 'en-US';  // Standard American English
    utterance.rate = 0.95;     // Natural pace
    utterance.pitch = 1.0;     // Normal pitch
    utterance.volume = 1.0;    // Full volume
    
    utterance.onstart = () => {
        status.textContent = '🔊 Speaking...';
    };
    
    utterance.onend = () => {
        status.textContent = 'Click mic for voice or type above';
    };
    
    utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        status.textContent = 'Click mic for voice or type above';
    };
    
    speechSynthesis.speak(utterance);
}

// Load voices
let voicesLoaded = false;

function loadVoices() {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0 && !voicesLoaded) {
        voicesLoaded = true;
        console.log('🎙️ Available US English voices:');
        voices
            .filter(v => v.lang === 'en-US')
            .forEach(v => console.log(`- ${v.name} (${v.lang})`));
    }
}

speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

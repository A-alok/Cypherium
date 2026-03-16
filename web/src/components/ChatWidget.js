import React, { useState, useRef, useEffect } from 'react';
import './ChatWidget.css';

const API = 'http://localhost:8000';

const ChatWidget = ({ token }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am your Cypherium Digital Safety Coach. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (textOverride) => {
    const text = textOverride || input;
    if (!text.trim()) return;

    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    if (!textOverride) setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: text,
          history: messages 
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages([...newMessages, { 
          role: 'assistant', 
          content: data.response,
          suggestions: data.suggested_actions 
        }]);
      } else {
        setMessages([...newMessages, { role: 'assistant', content: "Sorry, I'm having trouble connecting right now." }]);
      }
    } catch (e) {
      console.error('Chat error:', e);
      setMessages([...newMessages, { role: 'assistant', content: "Error connecting to Cypherium Brain." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button className="chat-fab" onClick={() => setIsOpen(true)}>
        <span className="fab-icon">🤖</span>
      </button>
    );
  }

  return (
    <div className="chat-widget">
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-icon">🤖</span>
          <strong>Cypherium Coach</strong>
        </div>
        <button className="chat-close" onClick={() => setIsOpen(false)}>×</button>
      </div>
      
      <div className="chat-body">
        {messages.map((m, i) => (
          <div key={i} className={`chat-message-wrapper ${m.role}`}>
            <div className={`chat-message ${m.role}`}>
              {m.content}
            </div>
            {m.suggestions && m.suggestions.length > 0 && (
              <div className="chat-suggestions">
                {m.suggestions.map((s, idx) => (
                  <button key={idx} className="suggestion-pill" onClick={() => handleSend(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-message-wrapper assistant">
            <div className="chat-message assistant typing">
              <span className="dot"></span><span className="dot"></span><span className="dot"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-footer">
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about your security..." 
          disabled={loading}
        />
        <button onClick={() => handleSend()} disabled={loading || !input.trim()}>
          ➤
        </button>
      </div>
    </div>
  );
};

export default ChatWidget;

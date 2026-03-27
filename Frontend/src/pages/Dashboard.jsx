import React, { useState, useRef, useEffect } from 'react';
import { Menu, Send, Bot, User, MessageCircle, X, Mail, Phone, MapPin, Loader2, Moon, Sun, LogOut, Settings, ChevronDown, GraduationCap, ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import { FaGithub, FaLinkedin, FaTwitter } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { HfInference } from '@huggingface/inference';

/* IMPORT COMPONENTS */
import HomeContent from '../components/HomeContent';
import TopicsContent from '../components/TopicsContent';
import LibraryContent from '../components/LibraryContent';
import QuizContent from '../components/QuizContent';
import NotesQuizContent from '../components/NotesQuizContent';
import TutorialsContent from '../components/TutorialsContent';
import ReportContent from '../components/ReportContent';
import AboutContent from '../components/AboutContent';

const hf = new HfInference(import.meta.env.VITE_HUGGINGFACE_API_KEY);

const buildTutorContext = () => {
  try {
    const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    const userKey = currentUser?.id || currentUser?.email || 'guest';
    const reportsStore = JSON.parse(localStorage.getItem('bodha_reports_history') || '{}');
    const reports = Array.isArray(reportsStore[userKey]) ? reportsStore[userKey].slice(0, 5) : [];

    const weakCounts = new Map();
    reports.forEach((r) => {
      (r.weakAreas || []).forEach((area) => {
        weakCounts.set(area.name, (weakCounts.get(area.name) || 0) + 1);
      });
    });

    const focusAreas = Array.from(weakCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    return {
      learnerName: currentUser?.username || 'Learner',
      reportsCount: reports.length,
      focusAreas,
    };
  } catch {
    return {
      learnerName: 'Learner',
      reportsCount: 0,
      focusAreas: [],
    };
  }
};

const formatAssistantResponse = (text) => `${text || ''}`
  .replace(/\r/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

export default function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('bodha_active_tab') || 'home';
  });

  const [historyStack, setHistoryStack] = useState(() => {
    return [localStorage.getItem('bodha_active_tab') || 'home'];
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('bodha_theme') || 'light';
  });

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [quizSelection, setQuizSelection] = useState(null);
  const [inputText, setInputText] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatFullscreen, setIsChatFullscreen] = useState(false);
  
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi, I'm Bodha! I'm an AI Knowledge Gap Tutor. You can drag me anywhere. What are we studying today?" }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const [chatPos, setChatPos] = useState({ x: window.innerWidth - 420, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });

  const profileRef = useRef(null);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/', { replace: true });
      return;
    }

    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('bodha_theme', theme);
  }, [navigate, theme]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const selectTab = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('bodha_active_tab', tab);
    setHistoryStack(prev => {
      if (prev[prev.length - 1] === tab) return prev;
      return [...prev, tab];
    });
    window.scrollTo(0, 0); 
  };

  const goBack = () => {
    setHistoryStack(prev => {
       if (prev.length <= 1) return prev;
       const newStack = [...prev];
       newStack.pop(); 
       const previousTab = newStack[newStack.length - 1];
       setActiveTab(previousTab);
       localStorage.setItem('bodha_active_tab', previousTab);
       return newStack;
    });
  };

  const openQuizWithSelection = (selection) => {
    setQuizSelection(selection);
    setActiveTab('quiz');
    localStorage.setItem('bodha_active_tab', 'quiz');
    window.scrollTo(0, 0);
  };

  const startPrimaryQuizForTopic = (selection) => {
    openQuizWithSelection({ type: 'primary', ...selection });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <HomeContent onNavigate={selectTab} />;
      case 'topics': return <TopicsContent onNavigate={selectTab} onStartPrimaryQuiz={startPrimaryQuizForTopic} />;
      case 'library': return <LibraryContent onNavigate={selectTab} />;
      case 'quiz':
        if (quizSelection?.type === 'primary') {
          return <QuizContent onNavigate={selectTab} quizSelection={quizSelection} onConsumeQuizSelection={() => setQuizSelection(null)} />;
        }
        return <NotesQuizContent onNavigate={selectTab} />;
      case 'tutorials': return <TutorialsContent onNavigate={selectTab} />;
      case 'report': return <ReportContent onNavigate={selectTab} />;
      case 'about': return <AboutContent />;
      default: return <HomeContent onNavigate={selectTab} />;
    }
  };

  const onMouseDown = (e) => {
    if (isChatFullscreen) {
      return;
    }

    if (e.target.closest('.chat-window-drag-handle')) {
      setIsDragging(true);
      dragStartOffset.current = {
        x: e.clientX - chatPos.x,
        y: e.clientY - chatPos.y
      };
    }
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (isDragging) {
        setChatPos({
          x: Math.max(0, Math.min(e.clientX - dragStartOffset.current.x, window.innerWidth - 400)),
          y: Math.max(0, Math.min(e.clientY - dragStartOffset.current.y, window.innerHeight - 100))
        });
      }
    };

    const onMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, isChatFullscreen]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userMsgContent = inputText;
    const updatedMessages = [...messages, { role: 'user', content: userMsgContent }];
    setMessages(updatedMessages);
    setInputText('');
    setIsTyping(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const tutorContext = buildTutorContext();
    const focusText = tutorContext.focusAreas.length > 0 ? tutorContext.focusAreas.join(', ') : 'none recorded yet';

    const systemInstruction = [
      'You are Bodha, a personalized AI Tutor for learning, studying, doubt-solving, revision, interview prep, and coding practice.',
      'You are not restricted to only predefined topics. Help across software/programming concepts, study techniques, planning, and doubt clarification.',
      'Keep tone encouraging, clear, and practical. Adapt depth to user intent.',
      'Personalize every response using learner context when available.',
      'Formatting rules:',
      '- Use clean structured plain text.',
      '- Start with: "Direct Answer:" (1-3 lines).',
      '- Then: "Why It Matters:" (short explanation).',
      '- Then: "Next Steps:" with exactly 3 numbered steps.',
      '- If user asks for code, add "Code Example:" and provide fenced markdown code.',
      '- Keep answer compact, readable, and actionable.',
      `Learner name: ${tutorContext.learnerName}`,
      `Recent reports analyzed: ${tutorContext.reportsCount}`,
      `Frequent focus areas: ${focusText}`,
      `Current app section: ${activeTab}`,
    ].join('\n');

    try {
      const stream = hf.chatCompletionStream({
        model: "meta-llama/Meta-Llama-3-8B-Instruct",
        messages: [
          { role: "system", content: systemInstruction },
          ...updatedMessages
        ],
        max_tokens: 1000,
      });

      let accumulatedContent = '';
      for await (const chunk of stream) {
        if (chunk.choices && chunk.choices.length > 0) {
          const delta = chunk.choices[0].delta.content || "";
          accumulatedContent += delta;
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: formatAssistantResponse(accumulatedContent) };
            return newMsgs;
          });
        }
      }
    } catch (error) {
      console.error("AI inference issue:", error);
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { role: 'assistant', content: "SYSTEM ERROR: Connection failed." };
        return newMsgs;
      });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="app-layout bg-grid">
      <header className="topbar">
        <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <button 
            className="mobile-menu-btn" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: 0 }}
          >
            {isMobileMenuOpen ? <X size={28} strokeWidth={2.5} /> : <Menu size={28} strokeWidth={2.5} />}
          </button>
          
          <button
            onClick={() => selectTab('home')}
            className="brand-logo brutalist-font desktop-logo"
            style={{ border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}
            aria-label="Go to Home"
            title="Go to Home"
          >
            BODHA
          </button>
          
          <nav className="top-nav desktop-nav">
            {['home', 'topics', 'library', 'quiz', 'tutorials', 'report', 'about'].map(tab => (
              <button 
                key={tab}
                className={`top-nav-link ${activeTab === tab ? 'active' : ''}`} 
                onClick={() => selectTab(tab)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="topbar-center mobile-logo" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <button
            onClick={() => selectTab('home')}
            className="brand-logo brutalist-font"
            style={{ border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}
            aria-label="Go to Home"
            title="Go to Home"
          >
            BODHA
          </button>
        </div>
        
        <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {/* THEME TOGGLE - UNTOUCHED */}
          <button 
            onClick={toggleTheme} 
            className="btn-primary" 
            style={{ width: 'auto', padding: '0.4rem', background: 'var(--accent-yellow)', color: 'black', borderRadius: '50%', border: '3px solid black' }}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          {/* PROPER PROFILE DROPDOWN */}
          <div style={{ position: 'relative' }} ref={profileRef}>
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="profile-icon"
              style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '50%', 
                cursor: 'pointer', 
                transition: 'all 0.2s', 
                border: '3px solid var(--border-color)', 
                background: 'var(--card-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0
              }}
            >
              <User size={24} strokeWidth={3} />
            </button>

            {isProfileOpen && (
              <div 
                className="card" 
                style={{ 
                  position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '220px', 
                  padding: '0.5rem', zIndex: 1100, border: '4px solid black', 
                  boxShadow: '10px 10px 0px 0px rgba(0,0,0,1)', background: 'white' 
                }}
              >
                <div style={{ padding: '0.75rem 1rem', borderBottom: '2px solid black', marginBottom: '0.5rem' }}>
                  <p style={{ fontFamily: 'Barlow Semi Condensed', fontWeight: 900, fontSize: '1.2rem', margin: 0, color: 'black' }}>{user?.username || 'STUDENT'}</p>
                  <p style={{ fontFamily: 'Inter', fontSize: '0.7rem', fontWeight: 700, opacity: 0.5, color: 'black' }}>{user?.email || 'student@bodha.ai'}</p>
                </div>
                
                <button 
                  className="sidebar-link" 
                  style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', background: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', color: 'black' }}
                >
                  <Settings size={16} /> ACCOUNT SETTINGS
                </button>
                
                <button 
                  onClick={handleLogout}
                  className="sidebar-link" 
                  style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', background: 'var(--accent-red)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', marginTop: '0.5rem' }}
                >
                  <LogOut size={16} /> LOGOUT
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MOBILE SIDEBAR */}
      <aside className={`sidebar-left ${isMobileMenuOpen ? 'visible' : ''}`} style={{ background: 'var(--card-bg)', borderRight: '4px solid var(--border-color)', zIndex: 999, top: '70px', padding: 0, boxShadow: isMobileMenuOpen ? '10px 0px 30px rgba(0,0,0,0.5)' : 'none' }}>
         <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {['home', 'topics', 'library', 'quiz', 'tutorials', 'report', 'about'].map(tab => (
              <button 
                key={`mobile-${tab}`}
                onClick={() => { selectTab(tab); setIsMobileMenuOpen(false); }} 
                style={{ 
                  background: activeTab === tab ? 'var(--accent-yellow)' : 'transparent', 
                  color: activeTab === tab ? 'black' : 'var(--text-dark)',
                  textAlign: 'left', border: 'none', borderBottom: '3px solid var(--border-color)', 
                  fontWeight: 900, fontSize: '1.25rem', fontFamily: 'Barlow Semi Condensed', fontStyle: 'italic', padding: '1.25rem 2rem', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s', width: '100%'
                }}
              >
                {tab}
              </button>
            ))}
         </div>
      </aside>

      <div className="dashboard-body relative">
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%' }}>
          <main className="center-content" style={{ padding: 0, flex: '1 0 auto' }}>
            {historyStack.length > 1 && activeTab !== 'home' && (
              <div
                style={{
                  position: 'fixed',
                  top: '84px',
                  left: '14px',
                  zIndex: 1200,
                }}
              >
                <button 
                  onClick={goBack}
                  aria-label="Go back"
                  title="Go back"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', background: 'var(--card-bg)', border: '2px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-dark)', opacity: 0.95, boxShadow: '3px 3px 0 0 rgba(0,0,0,0.5)' }}
                >
                  <ArrowLeft size={16} strokeWidth={3} />
                </button>
              </div>
            )}
            {renderContent()}
          </main>

          <footer style={{ background: 'transparent', color: 'var(--text-dark)', padding: '3rem 2rem', marginTop: '4rem', borderTop: '2px solid var(--border-color)' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '2rem' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => selectTab('home')}
                  className="brand-logo brutalist-font"
                  style={{ fontSize: '2.5rem', margin: 0, color: 'var(--text-dark)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                  aria-label="Go to Home"
                  title="Go to Home"
                >
                  BODHA
                </button>
                <div style={{ width: '4px', height: '1.5rem', background: 'var(--accent-yellow)' }}></div>
                <p style={{ fontFamily: 'Inter', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-light)', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  AI-Powered Tutor
                </p>
              </div>
              
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', gap: '2rem', flexWrap: 'wrap', fontFamily: 'Inter', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'opacity 0.2s', opacity: 0.8 }} className="hover:opacity-100">
                  <Mail size={16} color="var(--text-light)" /> hello@bodha.ai
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'opacity 0.2s', opacity: 0.8 }} className="hover:opacity-100">
                  <Phone size={16} color="var(--text-light)" /> +1 (800) 555-0199
                </li>
              </ul>
              
            </div>
          </footer>
        </div>

        {!isChatOpen && (
          <div 
            className="fab-bot group" 
            onClick={() => {
              setIsChatOpen(true);
              setIsChatFullscreen(false);
            }}
            style={{ position: 'fixed', bottom: '2rem', right: '2rem' }}
          >
            {/* TOOLTIP ON HOVER */}
            <div 
              style={{ 
                position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', 
                background: 'black', color: 'white', padding: '0.25rem 0.75rem', 
                whiteSpace: 'nowrap', fontFamily: 'Space Grotesk', fontWeight: 800, 
                fontSize: '0.8rem', border: '2px solid white', display: 'none'
              }}
              className="bot-tooltip"
            >
              BODHA AI
            </div>
            <GraduationCap size={32} strokeWidth={2.5} />
          </div>
        )}

        {isChatOpen && (
          <div 
            className="bodha-chat-container" 
            style={isChatFullscreen
              ? {
                  left: '1rem',
                  top: '80px',
                  width: 'calc(100vw - 2rem)',
                  height: 'calc(100vh - 96px)',
                  maxHeight: 'none',
                }
              : { left: `${chatPos.x}px`, top: `${chatPos.y}px` }}
            onMouseDown={onMouseDown}
          >
            <div className="chat-window-drag-handle brutalist-font" style={{ background: 'var(--accent-yellow)', color: 'black', borderBottom: '4px solid black' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bot size={24} /> BODHA AI
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsChatFullscreen((prev) => !prev);
                  }}
                  aria-label={isChatFullscreen ? 'Exit full screen' : 'Full screen'}
                  title={isChatFullscreen ? 'Exit full screen' : 'Full screen'}
                  style={{ background: '#111827', border: 'none', cursor: 'pointer', color: 'white', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {isChatFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsChatOpen(false);
                    setIsChatFullscreen(false);
                  }} 
                  style={{ background: 'black', border: 'none', cursor: 'pointer', color: 'white', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="bodha-chat-body" style={{ flex: 1, overflowY: 'auto' }}>
              <div className="chat-messages relative" style={{ height: '100%', padding: '1.5rem', background: 'white' }}>
                {messages.map((msg, idx) => (
                  <div key={idx} className={`message ${msg.role === 'assistant' ? 'bot' : 'user'}`} style={
                    msg.role === 'user'
                      ? { marginLeft: 'auto', background: 'black', color: 'white', whiteSpace: 'pre-wrap', lineHeight: 1.55 }
                      : { whiteSpace: 'pre-wrap', lineHeight: 1.6 }
                  }>
                    {msg.content === '' ? <Loader2 className="animate-spin" /> : msg.content}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <form className="chat-input-area" onSubmit={handleSendMessage} style={{ borderTop: '4px solid black', background: '#f8fafc' }}>
              <div className="chat-input-wrapper">
                <input type="text" className="chat-input" placeholder="Ask Bodha AI..." value={inputText} onChange={(e) => setInputText(e.target.value)} onMouseDown={(e) => e.stopPropagation()} disabled={isTyping} />
                <button type="submit" className="chat-send" disabled={isTyping}><Send size={20} /></button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

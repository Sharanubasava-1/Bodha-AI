import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, FolderOpen, Target, Video, BarChart2, Layers } from 'lucide-react';
import { SiJavascript, SiPython, SiDocker, SiGit, SiCplusplus, SiMysql, SiReact, SiNodedotjs } from 'react-icons/si';
import { FaJava, FaAws, FaBrain, FaChartLine, FaFastForward, FaCogs } from 'react-icons/fa';

const STACK_ITEMS = [
  { icon: <FaJava size={80} />, color: '#E76F00' },
  { icon: <SiPython size={80} />, color: '#3776AB' },
  { icon: <SiCplusplus size={80} />, color: '#00599C' },
  { icon: <SiMysql size={80} />, color: '#4479A1' },
  { icon: <SiGit size={80} />, color: '#F05032' },
  { icon: <SiDocker size={80} />, color: '#2496ED' },
  { icon: <SiJavascript size={80} />, color: '#F7DF1E' },
  { icon: <FaAws size={80} />, color: '#FF9900' }
];

export default function AboutContent() {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef(null);

  useEffect(() => {
    setIsVisible(true);
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="center-content relative" style={{ padding: '0 0 6rem 0', overflowX: 'hidden' }}>
      
      {/* Advanced Premium Hero Section */}
      <section className="animate-slide-up relative" style={{ padding: '8rem 2rem 6rem', borderBottom: '4px solid var(--border-color)', background: 'var(--bg-color)', overflow: 'hidden' }}>
        
        {/* Decorative Grid Mesh Background */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundSize: '40px 40px', backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)', pointerEvents: 'none' }}></div>
        
        <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>

            <h1 className="brutalist-font" style={{ fontSize: 'clamp(5rem, 12vw, 9rem)', lineHeight: '0.85', margin: '2rem 0', textTransform: 'uppercase', color: 'var(--text-dark)', letterSpacing: '-0.04em' }}>
              ABOUT <br/>
              <span style={{ color: 'transparent', WebkitTextStroke: '3px var(--text-dark)' }}>US.</span>
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3rem', marginTop: '1rem' }}>
              <p style={{ fontFamily: 'Inter', fontSize: '1.35rem', fontWeight: 500, color: 'var(--text-light)', margin: 0, lineHeight: 1.6, maxWidth: '800px', textAlign: 'center' }}>
                We built Bodha to eradicate the "tutorial hell" loop. An elite, unfiltered AI engine engineered to instantly identify your logic gaps and serve exactly what you need to master software engineering.
              </p>
              
              <div style={{ display: 'flex', gap: '4rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="brutalist-font" style={{ fontSize: '4rem', lineHeight: '1', color: 'var(--accent-red)', WebkitTextStroke: '2px var(--text-dark)' }}>5+</span>
                  <span style={{ fontFamily: 'Inter', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.9rem', color: 'var(--text-dark)' }}>Logic Modules</span>
                </div>
                <div style={{ width: '4px', height: '50px', background: 'var(--text-dark)' }}></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="brutalist-font" style={{ fontSize: '4rem', lineHeight: '1', color: 'var(--accent-blue)', WebkitTextStroke: '2px var(--text-dark)' }}>∞</span>
                  <span style={{ fontFamily: 'Inter', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.9rem', color: 'var(--text-dark)' }}>AI Interactions</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Agenda & Mission */}
      <section className={`animate-slide-up delay-100`} style={{ padding: '6rem 2rem', background: 'var(--card-bg)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 className="brutalist-font" style={{ fontSize: '3rem', color: 'var(--text-dark)', marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <FaCogs color="var(--accent-blue)" /> SYSTEM AGENDA
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem' }}>
            
            <div className="lux-card" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--bg-color)' }}>
              <FaChartLine size={48} color="var(--accent-red)" />
              <h3 className="brutalist-font" style={{ fontSize: '1.75rem', margin: 0, color: 'var(--text-dark)' }}>Identify Gaps</h3>
              <p style={{ fontFamily: 'Inter', fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-light)', lineHeight: 1.6 }}>
                Advanced diagnostic quizzes instantly pinpoint your exact logic weaknesses.
              </p>
            </div>

            <div className="lux-card" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--bg-color)' }}>
              <FaFastForward size={48} color="var(--accent-green)" />
              <h3 className="brutalist-font" style={{ fontSize: '1.75rem', margin: 0, color: 'var(--text-dark)' }}>Target Fixes</h3>
              <p style={{ fontFamily: 'Inter', fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-light)', lineHeight: 1.6 }}>
                Receive hyper-targeted reading and practice materials directly matching your specific logic gaps.
              </p>
            </div>

            <div className="lux-card" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--bg-color)' }}>
              <FaBrain size={48} color="var(--accent-yellow)" />
              <h3 className="brutalist-font" style={{ fontSize: '1.75rem', margin: 0, color: 'var(--text-dark)' }}>AI-Assisted Clarity</h3>
              <p style={{ fontFamily: 'Inter', fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-light)', lineHeight: 1.6 }}>
                Talk with a personalized AI companion trained to break down and explain the toughest engineering concepts.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Platform Features / Sections Overview */}
      <section className={`animate-slide-up delay-200`} style={{ padding: '6rem 2rem', background: 'var(--card-bg)', borderTop: '4px solid var(--border-color)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 className="brutalist-font" style={{ fontSize: '3rem', color: 'var(--text-dark)', marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Layers color="var(--text-dark)" /> APP SECTIONS
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            
            <div className="card" style={{ padding: '2rem', display: 'flex', alignItems: 'flex-start', gap: '1.5rem', background: 'var(--bg-color)', border: '4px solid var(--border-color)', boxShadow: '8px 8px 0px 0px rgba(0,0,0,0.1)' }}>
              <div style={{ padding: '1rem', background: 'var(--bg-color)', border: '3px solid black', color: 'black', borderRadius: '50%' }}>
                <BookOpen size={28} />
              </div>
              <div>
                <h3 className="brutalist-font" style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--accent-yellow)', WebkitTextStroke: '0.5px var(--text-dark)' }}>TOPICS</h3>
                <p style={{ fontFamily: 'Inter', fontSize: '1rem', color: 'var(--text-light)', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
                  Select specific programming languages to begin an AI-driven customized learning path.
                </p>
              </div>
            </div>

            <div className="card" style={{ padding: '2rem', display: 'flex', alignItems: 'flex-start', gap: '1.5rem', background: 'var(--bg-color)', border: '4px solid var(--border-color)', boxShadow: '8px 8px 0px 0px rgba(0,0,0,0.1)' }}>
              <div style={{ padding: '1rem', background: 'var(--bg-color)', border: '3px solid black', color: 'black', borderRadius: '50%' }}>
                <FolderOpen size={28} />
              </div>
              <div>
                <h3 className="brutalist-font" style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--accent-blue)', WebkitTextStroke: '0.5px var(--text-dark)' }}>LIBRARY</h3>
                <p style={{ fontFamily: 'Inter', fontSize: '1rem', color: 'var(--text-light)', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
                  Upload PDFs or documentation and leverage the AI bot to summarize the material.
                </p>
              </div>
            </div>

            <div className="card" style={{ padding: '2rem', display: 'flex', alignItems: 'flex-start', gap: '1.5rem', background: 'var(--bg-color)', border: '4px solid var(--border-color)', boxShadow: '8px 8px 0px 0px rgba(0,0,0,0.1)' }}>
              <div style={{ padding: '1rem', background: 'var(--bg-color)', border: '3px solid black', color: 'black', borderRadius: '50%' }}>
                <Target size={28} />
              </div>
              <div>
                <h3 className="brutalist-font" style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--accent-red)', WebkitTextStroke: '0.5px var(--text-dark)' }}>QUIZ</h3>
                <p style={{ fontFamily: 'Inter', fontSize: '1rem', color: 'var(--text-light)', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
                  Engage in auto-generated multiple choice exams that directly target your knowledge limits.
                </p>
              </div>
            </div>

            <div className="card" style={{ padding: '2rem', display: 'flex', alignItems: 'flex-start', gap: '1.5rem', background: 'var(--bg-color)', border: '4px solid var(--border-color)', boxShadow: '8px 8px 0px 0px rgba(0,0,0,0.1)' }}>
              <div style={{ padding: '1rem', background: 'var(--bg-color)', border: '3px solid black', color: 'black', borderRadius: '50%' }}>
                <Video size={28} />
              </div>
              <div>
                <h3 className="brutalist-font" style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--accent-green)', WebkitTextStroke: '0.5px var(--text-dark)' }}>TUTORIALS</h3>
                <p style={{ fontFamily: 'Inter', fontSize: '1rem', color: 'var(--text-light)', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
                  Watch curated, high-level computer science crash courses integrated via YouTube.
                </p>
              </div>
            </div>

            <div className="card" style={{ padding: '2rem', display: 'flex', alignItems: 'flex-start', gap: '1.5rem', background: 'var(--bg-color)', border: '4px solid var(--border-color)', boxShadow: '8px 8px 0px 0px rgba(0,0,0,0.1)' }}>
              <div style={{ padding: '1rem', background: 'var(--bg-color)', border: '3px solid black', color: 'black', borderRadius: '50%' }}>
                <BarChart2 size={28} />
              </div>
              <div>
                <h3 className="brutalist-font" style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>REPORT</h3>
                <p style={{ fontFamily: 'Inter', fontSize: '1rem', color: 'var(--text-light)', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
                  Review highly detailed post-quiz intelligence covering your accuracy and performance trends.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Stack Marquee Section */}
      <section className={`animate-slide-up delay-200`} style={{ marginTop: 'auto', background: '#ffffff' }}>
        <div style={{ paddingTop: '5rem', paddingBottom: '2rem', textAlign: 'center' }}>
          <h2 className="brutalist-font" style={{ fontSize: '2.5rem', color: '#000000', margin: 0 }}>POWERED LOGIC STACK</h2>
          <p style={{ fontFamily: 'Inter', color: '#666666', fontSize: '1rem', fontWeight: 600, marginTop: '1rem' }}>Syllabus mapping across enterprise technologies.</p>
        </div>
        
        {/* Infinite Scrolling Marquee */}
        <div className="marquee-container" style={{ background: '#ffffff', color: '#000000', borderTop: '4px solid black', borderBottom: '4px solid black' }}>
          <div className="marquee-content" style={{ padding: '1rem 0' }}>
            {/* Render 3 copies to ensure smooth infinite loop without gaps */}
            {[...STACK_ITEMS, ...STACK_ITEMS, ...STACK_ITEMS, ...STACK_ITEMS].map((item, idx) => (
              <div 
                key={idx} 
                className="marquee-item" 
                style={{ 
                  margin: '0 4rem', 
                  transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)', 
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <span style={{ color: item.color, display: 'flex' }}>{item.icon}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}

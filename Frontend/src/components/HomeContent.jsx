import React, { useState, useEffect } from 'react';
import { Activity, Calendar as CalendarIcon, AlertOctagon, Brain } from 'lucide-react';
import { HfInference } from '@huggingface/inference';
import { SiJavascript, SiPython, SiDocker, SiGit, SiCplusplus, SiMysql, SiReact, SiNodedotjs } from 'react-icons/si';
import { FaJava, FaAws } from 'react-icons/fa';

const hf = new HfInference(import.meta.env.VITE_HUGGINGFACE_API_KEY);

const TOPIC_LOGOS = {
  'Java': <FaJava size={22} color="#E76F00" />,
  'Python': <SiPython size={22} color="#3776AB" />,
  'C / C++': <SiCplusplus size={22} color="#00599C" />,
  'SQL': <SiMysql size={22} color="#4479A1" />,
  'Git': <SiGit size={22} color="#F05032" />,
  'Docker': <SiDocker size={22} color="#2496ED" />,
  'JavaScript': <SiJavascript size={22} color="#F7DF1E" />,
  'AWS': <FaAws size={22} color="#FF9900" />,
};

export default function HomeContent({ onNavigate }) {
  const [calendarDays, setCalendarDays] = useState([]);
  const [currentMonth, setCurrentMonth] = useState('');
  const [activeCount, setActiveCount] = useState(0);
  const [recentTopics, setRecentTopics] = useState([]);
  const [aiInsights, setAiInsights] = useState('Analyzing... Complete quizzes to unlock elite insights.');
  const [aiFocusAreas, setAiFocusAreas] = useState([]);

  let displayName = 'Hackathoner';
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user?.username) {
      displayName = user.username;
    }
  } catch {
    displayName = 'Hackathoner';
  }
  
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    setRecentTopics(JSON.parse(localStorage.getItem('bodha_recent_topics') || '[]'));

    let activeDates = new Set();
    
    try {
      const reportsHistory = JSON.parse(localStorage.getItem('bodha_reports_history') || '{}');
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      const userKey = user?.id || user?.email || 'guest';
      const reports = reportsHistory[userKey] || [];
      
      reports.forEach(r => {
        if (r.createdAt) {
          const d = new Date(r.createdAt);
          d.setHours(0, 0, 0, 0);
          activeDates.add(d.getTime());
        }
      });

      const cachedKey = `bodha_ai_insights_${userKey}_count_${reports.length}`;
      const cachedData = localStorage.getItem(cachedKey);
      
      if (reports.length === 0) {
        setAiInsights("Take your first complete quiz to unlock AI-powered logic analytics.");
        setAiFocusAreas([]);
      } else if (cachedData) {
        const parsed = JSON.parse(cachedData);
        setAiInsights(parsed.insight);
        setAiFocusAreas(parsed.focus.split(',').map(s=>s.trim()).filter(Boolean));
      } else {
        const weakString = reports.slice(0, 5).map(r => 
          `Mode: ${r.mode}, Topic: ${r.sourceLabel}, Correct: ${r.correct}/${r.total}. Weak Areas: ${r.weakAreas?.map(w=>w.name).join(', ')}`
        ).join(' | ');
        
        const analyzeReports = async () => {
           try {
              const res = await hf.chatCompletion({
                model: "meta-llama/Meta-Llama-3-8B-Instruct",
                messages: [
                  { role: "system", content: "You strictly output JSON. Output format: {\"insight\": \"One crisp empirical sentence about their learning trajectory.\", \"focus\": \"3 specific programming concepts to focus on, as comma separated string.\"}" },
                  { role: "user", content: `Analyze these recent quiz results: ${weakString}` }
                ],
                max_tokens: 150
              });
              const text = res.choices[0].message.content;
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                 const parsed = JSON.parse(jsonMatch[0]);
                 setAiInsights(parsed.insight);
                 setAiFocusAreas(parsed.focus.split(',').map(s=>s.trim()).filter(Boolean));
                 localStorage.setItem(cachedKey, jsonMatch[0]);
              } else {
                 throw new Error("Invalid output");
              }
           } catch(e) {
               console.error("AI Insight Error: ", e);
               const map = new Map();
               reports.forEach(r => (r.weakAreas || []).forEach(a => map.set(a.name, (map.get(a.name)||0)+1)));
               const topF = Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
               setAiInsights("Consistent learning detected. Keep up the high quiz volume.");
               setAiFocusAreas(topF);
           }
        };
        analyzeReports();
      }
    } catch(e) {
      console.error(e);
    }

    const year = today.getFullYear();
    const month = today.getMonth();
    const date = today.getDate();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const daysArray = [];
    for (let i = 0; i < firstDay; i++) {
        daysArray.push(null);
    }

    let monthActiveCount = 0;
    for (let i = 1; i <= daysInMonth; i++) {
        const currentDate = new Date(year, month, i);
        currentDate.setHours(0, 0, 0, 0);
        
        const isActive = activeDates.has(currentDate.getTime());
        if (isActive) monthActiveCount++;

        daysArray.push({
            day: i,
            isActive: isActive,
            isToday: i === date
        });
    }

    const remainder = daysArray.length % 7;
    if (remainder !== 0) {
        for(let i=0; i < (7 - remainder); i++) {
            daysArray.push(null);
        }
    }

    const matrix = [];
    for(let i=0; i<daysArray.length; i+=7) {
        matrix.push(daysArray.slice(i, i+7));
    }

    setCalendarDays(matrix);
    setActiveCount(monthActiveCount);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    setCurrentMonth(`${monthNames[month]} ${year}`);
  }, []);

  return (
    <div className="center-content" style={{ padding: '3rem 4rem' }}>
      <header style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '3rem', width: '100%' }}>
        <div style={{ textAlign: 'center', width: '100%' }}>
          <h1 className="student-name brutalist-font" style={{ margin: 0, fontSize: '4rem', color: 'var(--accent-blue)', textAlign: 'center' }}>
            {`WELCOME ${displayName}`}
          </h1>
        </div>
      </header>
      
      <div className="widgets-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginBottom: '4rem' }}>
        {/* ACTIVITY CARD */}
        <div className="card" style={{ background: 'var(--card-bg)' }}>
          <h2 className="card-title brutalist-font" style={{ fontSize: '1.25rem', paddingBottom: '0.75rem', borderBottom: '2px solid black' }}>
             RECENTS
          </h2>
          <ul className="activity-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            {recentTopics.length > 0 ? recentTopics.map((topic, idx) => (
              <li 
                key={idx} 
                className="activity-item" 
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--card-bg)', padding: '0.75rem', border: '2px solid var(--border-color)', boxShadow: '3px 3px 0px rgba(0,0,0,1)', cursor: 'pointer', transition: 'transform 0.2s' }}
                onClick={() => {
                  localStorage.setItem('bodha_active_focus_topic', topic.name);
                  if (onNavigate) onNavigate('topics');
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {TOPIC_LOGOS[topic.name] || <SiJavascript size={22} />}
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--text-dark)' }}>{topic.name} Syllabus</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontFamily: 'Inter' }}>Viewed • {new Date(topic.date).toLocaleDateString()}</span>
                </div>
              </li>
            )) : (
              <li style={{ fontFamily: 'Inter', fontSize: '0.9rem', color: 'var(--text-light)' }}>No recent topics viewed yet.</li>
            )}
          </ul>
        </div>

        {/* AI INSIGHTS CARD */}
        <div className="card" style={{ background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
          <h2 className="card-title brutalist-font" style={{ background: 'var(--accent-yellow)', color: 'black', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '-1.5rem -1.5rem 1.5rem -1.5rem', borderBottom: '4px solid black' }}>
            <Brain size={24} strokeWidth={2.5} /> AI INSIGHTS
          </h2>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
               <h3 className="brutalist-font" style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-dark)' }}>TRAJECTORY</h3>
               <div style={{ padding: '0.75rem', background: 'white', border: '2px solid black', fontFamily: 'Inter', fontSize: '0.95rem', lineHeight: '1.5', fontWeight: 600, boxShadow: '3px 3px 0 0 rgba(0,0,0,1)' }}>
                 {aiInsights}
               </div>
            </div>

            <div>
               <h3 className="brutalist-font" style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-dark)' }}>URGENT FOCUS AREAS</h3>
               {aiFocusAreas.length === 0 ? (
                 <p style={{ fontFamily: 'Inter', fontSize: '0.85rem', color: 'var(--text-light)' }}>No focus areas determined yet.</p>
               ) : (
                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                   {aiFocusAreas.map((area, idx) => (
                     <div key={idx} style={{ padding: '0.4rem 0.75rem', background: 'var(--accent-red)', color: 'white', border: '2px solid black', fontFamily: 'Inter', fontWeight: 800, fontSize: '0.85rem', boxShadow: '2px 2px 0 0 rgba(0,0,0,0.5)' }}>
                       {area}
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>

      {/* ACTIVITY SYNC ROW */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 1rem' }}>
        <div className="calendar-widget card" style={{ padding: '2rem', maxWidth: '750px', width: '100%', marginBottom: '2rem', boxSizing: 'border-box' }}>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Space Grotesk', fontSize: '1.5rem', fontWeight: 900, fontStyle: 'italic', color: 'var(--text-dark)' }}>
              <CalendarIcon size={28} strokeWidth={2.5} /> LOG
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontFamily: 'Space Grotesk', fontWeight: 800 }}>
              <div style={{ background: 'var(--text-dark)', color: 'var(--card-bg)', padding: '0.5rem 1rem', fontSize: '1rem' }}>{currentMonth}</div>
              <div style={{ background: 'var(--accent-yellow)', color: 'black', border: '3px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '1rem' }}>{activeCount} DAYS ACTIVE</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div style={{ border: '4px solid var(--border-color)', padding: 'clamp(0.5rem, 3vw, 2rem)', width: '100%', maxWidth: '420px', background: 'var(--card-bg)', boxSizing: 'border-box' }}>
              
              {/* Header Row S M T ... */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'clamp(4px, 1.5vw, 8px)', marginBottom: '12px' }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} style={{ textAlign: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, color: 'var(--accent-blue)', fontSize: 'clamp(0.8rem, 2.5vw, 1rem)' }}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Grid Rows */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'clamp(4px, 1.5vw, 8px)' }}>
                {calendarDays.flat().map((d, dIdx) => {
                  if (!d) return <div key={`empty-${dIdx}`} style={{ aspectRatio: '1/1' }} />;
                  let bg = 'var(--card-bg)';
                  let textColor = 'var(--text-dark)';
                  
                  if (d.isActive) {
                    bg = 'var(--accent-yellow)';
                    textColor = 'black';
                  }
                  if (d.isToday) {
                    bg = 'var(--accent-green)';
                    textColor = 'black';
                  }
                  
                  return (
                    <div key={dIdx} style={{ 
                      aspectRatio: '1/1',
                      border: '2px solid var(--border-color)', 
                      background: bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 'clamp(0.8rem, 2.5vw, 1rem)',
                      color: textColor,
                      position: 'relative',
                      width: '100%'
                    }}>
                      {d.day}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(1rem, 3vw, 2rem)', marginTop: '2rem', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-dark)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: '16px', height: '16px', background: 'var(--accent-yellow)', border: '2px solid var(--border-color)' }} /> ACTIVE
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: '16px', height: '16px', background: 'var(--accent-green)', border: '2px solid var(--border-color)' }} /> TODAY
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: '16px', height: '16px', background: 'var(--card-bg)', border: '2px solid var(--border-color)' }} /> INACTIVE
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { 
  SiJavascript, 
  SiPython, 
  SiDocker, 
  SiGit, 
  SiCplusplus, 
  SiMysql 
} from 'react-icons/si';
import { FaJava, FaAws, FaArrowLeft, FaChevronRight, FaLightbulb, FaLockOpen, FaLock } from 'react-icons/fa';
import QuizContent from './QuizContent';

const PRIMARY_UNLOCK_KEY = 'bodha_primary_unlock_state';

const TOPIC_DATA = {
  'Java': {
    icon: <FaJava size={56} />, color: '#E76F00',
    subtopics: [
      { id: 'j1', name: 'OOP Fundamentals', desc: 'Classes, Objects, Inheritance, Polymorphism' },
      { id: 'j2', name: 'Collections Framework', desc: 'Lists, Sets, Maps, Queues and Iterators' },
      { id: 'j3', name: 'Java Multithreading', desc: 'Thread life-cycle, Synchronized, Executors' },
      { id: 'j4', name: 'Exception Architecture', desc: 'Try-catch, Throws, Custom Exceptions' },
      { id: 'j5', name: 'JVM Internals', desc: 'Heap, Stack, GC, Bytecode execution' }
    ]
  },
  'Python': {
    icon: <SiPython size={56} />, color: '#3776AB',
    subtopics: [
      { id: 'p1', name: 'Basic Syntax', desc: 'Variables, Loops, Dictionaries and Lists' },
      { id: 'p2', name: 'Functional Python', desc: 'Lambda functions, Decorators, Map/Filter' },
      { id: 'p3', name: 'Python OOP', desc: 'Self, Init, Class vs Static Methods' },
      { id: 'p4', name: 'I/O & File Handling', desc: 'Reading/Writing files, OS module integration' },
      { id: 'p5', name: 'Data Stack (Pandas)', desc: 'DataFrames, Series, Vectorized operations' }
    ]
  },
  'C / C++': {
    icon: <SiCplusplus size={56} />, color: '#00599C',
    subtopics: [
      { id: 'c1', name: 'Pointers & Memory', desc: 'Heap, Stack, Malloc, New/Delete' },
      { id: 'c2', name: 'STL Mastery', desc: 'Vectors, Maps, Sorting Algorithms' },
      { id: 'c3', name: 'Templates & Generic', desc: 'Constructors, Destructors, Templates' },
      { id: 'c4', name: 'C++ Data Structures', desc: 'Linked Lists, Trees, Graphs' }
    ]
  },
  'SQL': {
    icon: <SiMysql size={56} />, color: '#4479A1',
    subtopics: [
      { id: 's1', name: 'DDL & DML', desc: 'Create, Alter, Insert, Update, Delete queries' },
      { id: 's2', name: 'Join Operations', desc: 'Inner, Left, Right, Full, Self Joins' },
      { id: 's3', name: 'DB Logic (Triggers)', desc: 'Automated DB logic and procedures' },
      { id: 's4', name: 'DB Normalization', desc: '1NF to 3NF and BCNF principles' },
      { id: 's5', name: 'Query Optimization', desc: 'Indexing, Explain plans, execution cost' }
    ]
  },
  'Git': {
    icon: <SiGit size={56} />, color: '#F05032',
    subtopics: [
      { id: 'g1', name: 'Core Commands', desc: 'Add, Status, Log, Push/Pull flows' },
      { id: 'g2', name: 'Branching Strategy', desc: 'Feature branches, conflict resolution' },
      { id: 'g3', name: 'Rebase & Stash', desc: 'Linear history management and savepoints' },
      { id: 'g4', name: 'Modern Workflows', desc: 'GitFlow vs Trunk-based development' }
    ]
  },
  'Docker': {
    icon: <SiDocker size={56} />, color: '#2496ED',
    subtopics: [
      { id: 'd1', name: 'Containerization', desc: 'Kernel sharing vs VM abstraction' },
      { id: 'd2', name: 'Image Optimization', desc: 'Building layered, optimized manifests' },
      { id: 'd3', name: 'Docker Compose', desc: 'Multi-container orchestration flows' },
      { id: 'd4', name: 'Network & Volumes', desc: 'Data persistence and inter-container comms' }
    ]
  },
  'JavaScript': {
    icon: <SiJavascript size={56} />, color: '#F7DF1E',
    subtopics: [
      { id: 'js1', name: 'Modern ES6+', desc: 'Closures, Scope, Destructuring, Modules' },
      { id: 'js2', name: 'Asynchronous JS', desc: 'Promises, Async/Await and non-blocking I/O' },
      { id: 'js3', name: 'The Event Loop', desc: 'Call stack, microtasks vs macrotasks' },
      { id: 'js4', name: 'React Foundations', desc: 'Hooks, Virtual DOM, Component cycles' }
    ]
  },
  'AWS': {
    icon: <FaAws size={56} />, color: '#FF9900',
    subtopics: [
      { id: 'a1', name: 'Compute Strategy', desc: 'EC2, Lambda and serverless scaling' },
      { id: 'a2', name: 'Data (S3/RDS)', desc: 'Object vs Relational data persistence' },
      { id: 'a3', name: 'Security (IAM)', desc: 'Roles, Policies and Security groups' },
      { id: 'a4', name: 'Cloud Networking', desc: 'Subnets, VPC, peering and CDNs' }
    ]
  }
};

export default function TopicsContent({ onStartSubtopicQuiz, onStartPrimaryQuiz }) {
  const [selectedTopic, setSelectedTopic] = useState(() => {
    const focus = localStorage.getItem('bodha_active_focus_topic');
    if (focus) {
       localStorage.removeItem('bodha_active_focus_topic');
       return focus;
    }
    return null;
  });
  const [inlineSubtopicQuizSelection, setInlineSubtopicQuizSelection] = useState(null);

  const getUserKey = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      return user?.id || user?.email || 'guest';
    } catch {
      return 'guest';
    }
  };

  const getUnlockState = () => {
    try {
      const all = JSON.parse(localStorage.getItem(PRIMARY_UNLOCK_KEY) || '{}');
      return all[getUserKey()] || {};
    } catch {
      return {};
    }
  };

  if (!selectedTopic) {
    return (
      <div className="center-content">
        <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <h1 className="student-name brutalist-font" style={{ fontSize: '3.5rem', marginBottom: '1rem', color: 'var(--text-dark)' }}>Curriculum</h1>
          <p style={{ fontFamily: 'Inter', fontSize: '1.2rem', color: 'var(--text-light)', fontWeight: '600' }}>Select a topic to reveal your learning path</p>
        </div>
        
        <div className="topics-list tut-cards-grid">
          {Object.keys(TOPIC_DATA).map(name => (
            <div 
              key={name}
              className="card"
              onClick={() => { 
                setSelectedTopic(name); 
                window.scrollTo(0, 0); 
                const recents = JSON.parse(localStorage.getItem('bodha_recent_topics') || '[]');
                const newRecents = [{ name, date: new Date().toISOString() }, ...recents.filter(r => r.name !== name)].slice(0, 5);
                localStorage.setItem('bodha_recent_topics', JSON.stringify(newRecents));
              }}
              style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', cursor: 'pointer', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
              <div style={{ color: TOPIC_DATA[name].color }}>{TOPIC_DATA[name].icon}</div>
              <h3 className="brutalist-font" style={{ fontSize: '1.5rem', color: 'var(--text-dark)', fontStyle: 'italic', textAlign: 'center' }}>{name}</h3>
              <div style={{ height: '4px', width: '40px', background: TOPIC_DATA[name].color }}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const topic = TOPIC_DATA[selectedTopic];
  const unlockState = getUnlockState();
  const topicUnlock = unlockState[selectedTopic];
  const isUnlocked = !!topicUnlock?.completed;

  const handleSubtopicStart = (subtopic) => {
    if (!isUnlocked) {
      return;
    }

    const selection = {
      type: 'subtopic',
      topicName: selectedTopic,
      subtopicId: subtopic.id,
      subtopicName: subtopic.name,
      subtopicDesc: subtopic.desc,
    };

    setInlineSubtopicQuizSelection(selection);

    if (typeof onStartSubtopicQuiz === 'function') {
      onStartSubtopicQuiz(selection);
    }
  };

  const handlePrimaryStart = () => {
    setInlineSubtopicQuizSelection({
      type: 'primary',
      topicName: selectedTopic,
      subtopics: topic.subtopics,
      totalQuestions: 30,
    });
  };

  return (
    <div className="center-content relative" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {inlineSubtopicQuizSelection && (
        <div style={{ marginBottom: '2rem' }}>
          <div className="card" style={{ marginBottom: '1rem', borderLeft: inlineSubtopicQuizSelection.type === 'primary' ? '10px solid var(--accent-red)' : '10px solid var(--accent-blue)' }}>
            <p style={{ margin: 0, fontFamily: 'Inter', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {inlineSubtopicQuizSelection.type === 'primary' ? 'PRIMARY ASSESSMENT RUNNING:' : 'SUB-TOPIC QUIZ RUNNING:'} {inlineSubtopicQuizSelection.subtopicName || `${selectedTopic} Baseline`}
            </p>
          </div>
          <QuizContent
            onNavigate={(tab) => {
              if (tab === 'topics') {
                setInlineSubtopicQuizSelection(null);
                return;
              }
            }}
            quizSelection={inlineSubtopicQuizSelection}
            onConsumeQuizSelection={() => {}}
          />
        </div>
      )}

      {/* MINIMAL HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4rem', borderBottom: `2px solid var(--border-color)`, paddingBottom: '1.5rem' }}>
        <button 
          onClick={() => setSelectedTopic(null)} 
          style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Space Grotesk', fontWeight: '800', cursor: 'pointer', color: 'var(--text-dark)', textTransform: 'uppercase' }}
        >
          <FaArrowLeft size={14} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
           <span style={{ color: topic.color }}>{topic.icon}</span>
           <h2 className="brutalist-font" style={{ fontSize: '2.5rem', margin: 0, color: 'var(--text-dark)' }}>{selectedTopic}</h2>
        </div>
        <div style={{ background: 'var(--accent-yellow)', color: 'black', padding: '0.25rem 0.75rem', border: '2px solid black', fontFamily: 'Space Grotesk', fontWeight: '800', fontSize: '0.8rem' }}>SYLLABUS</div>
      </div>

      {/* MINIMAL SUBTOPICS LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {topic.subtopics.map((sub, i) => (
          <button
            key={sub.id} 
            className="card" 
            onClick={() => handleSubtopicStart(sub)}
            disabled={!isUnlocked}
            style={{ 
              display: 'grid', 
              gridTemplateColumns: '60px 1fr auto', 
              alignItems: 'center', 
              padding: '1.25rem 2rem', 
              background: 'var(--card-bg)',
              border: '2px solid var(--border-color)',
              boxShadow: '4px 4px 0px 0px var(--border-color)',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              opacity: isUnlocked ? 1 : 0.55,
              outline: inlineSubtopicQuizSelection?.subtopicId === sub.id ? '3px solid var(--accent-blue)' : 'none'
            }}
          >
            <div style={{ fontSize: '1.25rem', fontFamily: 'Barlow Semi Condensed', fontWeight: '900', color: topic.color, opacity: 0.8 }}>0{i+1}</div>
            <div>
              <h4 className="brutalist-font" style={{ fontSize: '1.2rem', weight: '800', margin: 0, color: 'var(--text-dark)', textTransform: 'none', fontStyle: 'normal', letterSpacing: '0' }}>{sub.name}</h4>
              <p style={{ fontFamily: 'Inter', fontSize: '0.9rem', color: 'var(--text-light)', marginTop: '0.2rem', fontWeight: 500 }}>{sub.desc}</p>
            </div>
            <span style={{ color: 'var(--text-dark)', opacity: 0.5, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {!isUnlocked ? <FaLock size={14} /> : null}
              <FaChevronRight size={18} />
            </span>
          </button>
        ))}
      </div>

      {!isUnlocked && (
        <div className="card" style={{ marginTop: '1.25rem', padding: '1rem 1.25rem', borderLeft: '8px solid var(--accent-yellow)' }}>
          <p style={{ margin: 0, fontFamily: 'Inter', fontWeight: 700 }}>
            Sub-topics are locked. Take the Primary Test (30 MCQs) to unlock this topic path.
          </p>
        </div>
      )}

      {isUnlocked && (
        <div className="card" style={{ marginTop: '1.25rem', padding: '1rem 1.25rem', borderLeft: '8px solid var(--accent-green)' }}>
          <p style={{ margin: 0, fontFamily: 'Inter', fontWeight: 700 }}>
            Topic unlocked. Score: {topicUnlock.score}%
          </p>
          {Array.isArray(topicUnlock.weakAreas) && topicUnlock.weakAreas.length > 0 && (
            <p style={{ margin: '0.5rem 0 0 0', fontFamily: 'Inter' }}>
              Focus area: {topicUnlock.weakAreas[0].name}
            </p>
          )}
        </div>
      )}

      {/* MINIMAL FOOTER CALLOUT */}
      <div className="card" style={{ marginTop: '5rem', background: 'var(--text-dark)', color: 'var(--bg-color)', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2rem 3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ color: 'var(--accent-green)' }}><FaLightbulb size={32} /></div>
          <div>
            <h3 className="brutalist-font" style={{ fontSize: '1.5rem', color: 'var(--bg-color)', margin: 0, fontStyle: 'italic' }}>Next Level: Assessment</h3>
            <p style={{ fontFamily: 'Inter', fontSize: '0.9rem', opacity: 0.7, marginTop: '0.2rem' }}>Ready to test your {selectedTopic} skills?</p>
          </div>
        </div>
        <button
          className="btn-primary"
          style={{ width: 'auto', background: 'var(--accent-yellow)', color: 'black', padding: '1rem 2rem' }}
          onClick={handlePrimaryStart}
        >
          {isUnlocked ? <><FaLockOpen size={16} /> RETAKE PRIMARY TEST</> : 'TAKE PRIMARY TEST (30 MCQs)'}
        </button>
      </div>
    </div>
  );
}

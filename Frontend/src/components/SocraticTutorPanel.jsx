import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { HfInference } from '@huggingface/inference';

const HF_TOKEN = import.meta.env.VITE_HUGGINGFACE_API_KEY || '';
const HF_QUIZ_MODEL = import.meta.env.VITE_HF_QUIZ_MODEL || 'meta-llama/Meta-Llama-3-8B-Instruct';
const hf = HF_TOKEN ? new HfInference(HF_TOKEN) : null;

const SUBTOPIC_HISTORY_KEY = 'bodha_subtopic_question_history';

const getUserKey = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user?.id || user?.email || 'guest';
  } catch {
    return 'guest';
  }
};

const getQuestionKey = (text) => (text || '').trim().toLowerCase().replace(/\s+/g, ' ');

const getStore = () => {
  try {
    return JSON.parse(localStorage.getItem(SUBTOPIC_HISTORY_KEY) || '{}');
  } catch {
    return {};
  }
};

const getSubtopicStorageKey = (selection) => `${selection.topicName}::${selection.subtopicId}`;

const getUsedKeys = (selection) => {
  const store = getStore();
  const byUser = store[getUserKey()] || {};
  return new Set(byUser[getSubtopicStorageKey(selection)] || []);
};

const persistUsedKey = (selection, questionText) => {
  const store = getStore();
  const userKey = getUserKey();
  const byUser = store[userKey] || {};
  const key = getSubtopicStorageKey(selection);
  const used = new Set(byUser[key] || []);
  used.add(getQuestionKey(questionText));
  byUser[key] = Array.from(used);
  store[userKey] = byUser;
  localStorage.setItem(SUBTOPIC_HISTORY_KEY, JSON.stringify(store));
};

const extractJsonObject = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
};

const fallbackQuestions = (selection, usedKeys, total = 20) => {
  const base = [
    {
      q: `Explain ${selection.subtopicName} in ${selection.topicName} in simple terms.`,
      a: `${selection.subtopicName} refers to ${selection.subtopicDesc}.`,
      hint: `Use this phrase: ${selection.subtopicDesc.split(',')[0] || selection.subtopicName}`,
      explanation: `${selection.subtopicName} in ${selection.topicName} is defined by ${selection.subtopicDesc}.`
    },
    {
      q: `Give one practical use-case of ${selection.subtopicName}.`,
      a: `It helps structure real-world ${selection.topicName} programs correctly.`,
      hint: 'Think about maintainable and reusable code.',
      explanation: `${selection.subtopicName} improves maintainability and problem-solving in ${selection.topicName}.`
    },
    {
      q: `What mistake should beginners avoid in ${selection.subtopicName}?`,
      a: `Avoid memorizing definitions without understanding how to apply them in code.`,
      hint: 'Focus on application, not just theory.',
      explanation: `Concept mastery means applying ${selection.subtopicName} in coding scenarios, not rote learning.`
    }
  ];

  const out = [];
  for (let i = 0; out.length < total; i += 1) {
    const b = base[i % base.length];
    const q = `${b.q} [Q${i + 1}]`;
    const k = getQuestionKey(q);
    if (usedKeys.has(k)) {
      continue;
    }
    out.push({
      id: `${selection.subtopicId}-fallback-${i + 1}`,
      questionText: q,
      answer: b.a,
      hint: b.hint,
      explanation: b.explanation,
      type: 'mcq',
      options: [
        b.a,
        `It is only for UI design in ${selection.topicName}.`,
        `It is unrelated to ${selection.topicName}.`,
        'It is needed only for hardware setup.'
      ],
      answerIndex: 0,
      keywords: [selection.subtopicName.toLowerCase(), (selection.subtopicDesc.split(',')[0] || '').toLowerCase()]
    });
  }

  return out;
};

const normalizeQuestions = (rawQuestions, selection, usedKeys) => {
  const out = [];
  const seen = new Set();

  (rawQuestions || []).forEach((q, idx) => {
    const questionText = `${q?.questionText || ''}`.trim();
    if (!questionText) {
      return;
    }

    const key = getQuestionKey(questionText);
    if (!key || usedKeys.has(key) || seen.has(key)) {
      return;
    }

    seen.add(key);
    let options = Array.isArray(q?.options) ? q.options.slice(0, 4).map((v) => `${v || ''}`.trim()) : [];
    if (options.length < 4) {
      const answer = `${q?.answer || `${selection.subtopicName}: ${selection.subtopicDesc}.`}`.trim();
      options = [
        answer,
        `It is only a UI concept in ${selection.topicName}.`,
        `It is unrelated to ${selection.subtopicName}.`,
        `It applies only to hardware systems, not ${selection.topicName}.`
      ];
    }
    const answerIndex = Number.isInteger(q?.answerIndex) ? Math.max(0, Math.min(q.answerIndex, 3)) : 0;

    out.push({
      id: `${selection.subtopicId}-hf-${idx + 1}`,
      questionText,
      answer: `${q?.answer || ''}`.trim(),
      hint: `${q?.hint || ''}`.trim() || `Focus on ${selection.subtopicName}.`,
      explanation: `${q?.explanation || ''}`.trim() || `Correct concept: ${selection.subtopicDesc}.`,
      type: 'mcq',
      options,
      answerIndex,
      keywords: Array.isArray(q?.keywords) ? q.keywords.map((k) => `${k}`.toLowerCase()) : [selection.subtopicName.toLowerCase()]
    });
  });

  return out;
};

async function generateQuestions(selection, usedKeys) {
  if (!hf) {
    return fallbackQuestions(selection, usedKeys, 20);
  }

  const avoid = Array.from(usedKeys).slice(0, 100).join('\n- ');
  const prompt = [
    `Generate 20 unique tutor questions for ${selection.topicName} > ${selection.subtopicName}.`,
    `Subtopic description: ${selection.subtopicDesc}.`,
    'All questions must be MCQ format only.',
    'For each question return JSON fields: questionText,type,options,answerIndex,answer,hint,explanation,keywords.',
    'Important: keep learner on this subtopic only and avoid unrelated/diversion prompts.',
    'Return strict JSON only with shape:',
    '{"questions":[{"questionText":"...","type":"mcq","options":["opt1","opt2","opt3","opt4"],"answerIndex":0,"answer":"...","hint":"...","explanation":"...","keywords":["..."]}]}',
    'Do not repeat any previous question keys:',
    `- ${avoid || 'none'}`,
  ].join('\n');

  let text = '';
  const stream = hf.chatCompletionStream({
    model: HF_QUIZ_MODEL,
    messages: [
      { role: 'system', content: 'You are a strict Socratic tutor question generator. Return valid JSON only.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 2500,
    temperature: 0.8,
  });

  for await (const chunk of stream) {
    text += chunk?.choices?.[0]?.delta?.content || '';
  }

  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    return fallbackQuestions(selection, usedKeys, 20);
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return fallbackQuestions(selection, usedKeys, 20);
  }

  const normalized = normalizeQuestions(parsed.questions, selection, usedKeys);
  if (normalized.length < 20) {
    const mergedUsed = new Set([...usedKeys, ...normalized.map((q) => getQuestionKey(q.questionText))]);
    const fallback = fallbackQuestions(selection, mergedUsed, 20 - normalized.length);
    return [...normalized, ...fallback].slice(0, 20);
  }

  return normalized.slice(0, 20);
}

const evaluateAnswerLocally = (question, userText) => {
  if (!question || !userText.trim()) {
    return { isCorrect: false, offTopic: false };
  }

  const t = userText.trim().toUpperCase();
  const letter = ['A', 'B', 'C', 'D'].indexOf(t);
  if (letter >= 0) {
    return { isCorrect: letter === question.answerIndex, offTopic: false };
  }

  const pickedIndex = question.options.findIndex((o) => o.toLowerCase() === userText.trim().toLowerCase());
  if (pickedIndex >= 0) {
    return { isCorrect: pickedIndex === question.answerIndex, offTopic: false };
  }

  return { isCorrect: false, offTopic: true };
};

export default function SocraticTutorPanel({ selection, onBack }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let canceled = false;

    const init = async () => {
      setLoading(true);
      const used = getUsedKeys(selection);
      const generated = await generateQuestions(selection, used);
      if (canceled) {
        return;
      }

      setQuestions(generated);
      setCurrent(0);
      setAttempt(1);
      setReady(false);
      setMessages([
        {
          from: 'bot',
          text: `Hello! I am your AI Socratic Tutor. You selected ${selection.topicName} > ${selection.subtopicName}. I will ask around 20 focused questions and keep this session strictly on this topic. Are you ready?`
        }
      ]);
      setLoading(false);
    };

    init();

    return () => {
      canceled = true;
    };
  }, [selection]);

  const question = questions[current];
  const progress = useMemo(() => `${Math.min(current + 1, questions.length)} / ${questions.length || 20}`, [current, questions.length]);

  const moveNext = () => {
    if (!question) {
      return;
    }

    persistUsedKey(selection, question.questionText);

    if (current >= questions.length - 1) {
      setMessages((prev) => ([
        ...prev,
        { from: 'bot', text: 'Great work. You completed this tutor session. Go back to select another sub-topic.' }
      ]));
      return;
    }

    const next = current + 1;
    setCurrent(next);
    setAttempt(1);
    const nextQ = questions[next];
    const prefix = `${nextQ.questionText}\nOptions:\nA) ${nextQ.options[0]}\nB) ${nextQ.options[1]}\nC) ${nextQ.options[2]}\nD) ${nextQ.options[3]}`;

    setMessages((prev) => ([
      ...prev,
      { from: 'bot', text: `Question ${next + 1}: ${prefix || ''}` }
    ]));
  };

  const startSession = () => {
    if (!questions.length) {
      return;
    }

    setReady(true);
    const q = questions[0];
    const prefix = `${q.questionText}\nOptions:\nA) ${q.options[0]}\nB) ${q.options[1]}\nC) ${q.options[2]}\nD) ${q.options[3]}`;
    setMessages((prev) => ([
      ...prev,
      { from: 'user', text: 'Yes' },
      { from: 'bot', text: `Question 1: ${prefix}` }
    ]));
  };

  const submitAnswer = () => {
    if (!ready || !question || !input.trim()) {
      return;
    }

    const userText = input.trim();
    setInput('');

    setMessages((prev) => [...prev, { from: 'user', text: userText }]);

    const evalResult = evaluateAnswerLocally(question, userText);

    if (evalResult.isCorrect) {
      setMessages((prev) => ([
        ...prev,
        {
          from: 'bot',
          text: `Correct. ${question.explanation} Answer: ${String.fromCharCode(65 + question.answerIndex)}.`
        }
      ]));
      moveNext();
      return;
    }

    if (attempt === 1) {
      setAttempt(2);
      const steer = evalResult.offTopic
        ? `Stay on ${selection.subtopicName}. ${question.hint}`
        : question.hint;
      setMessages((prev) => ([
        ...prev,
        { from: 'bot', text: `Not correct. Hint: ${steer} You have one more chance.` }
      ]));
      return;
    }

    setMessages((prev) => ([
      ...prev,
      {
        from: 'bot',
        text: `Second attempt is incorrect. Correct answer: ${String.fromCharCode(65 + question.answerIndex)}) ${question.options[question.answerIndex]}. ${question.explanation}`
      }
    ]));
    moveNext();
  };

  return (
    <div className="card" style={{ maxWidth: '980px', margin: '0 auto', padding: 0, overflow: 'hidden', border: '2px solid #28354a', background: '#122039' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.2rem', borderBottom: '1px solid #22314b', color: '#e2e8f0' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h3 className="brutalist-font" style={{ margin: 0, color: '#9f67ff', fontSize: '2rem' }}>Socratic AI Tutor</h3>
          <p style={{ margin: 0, color: '#94a3b8', fontFamily: 'Inter' }}>{selection.topicName} - {selection.subtopicName} | Progress {progress}</p>
        </div>
      </div>

      <div style={{ minHeight: '380px', maxHeight: '380px', overflowY: 'auto', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', background: '#16263f' }}>
        {loading ? (
          <div style={{ color: '#cbd5e1', fontFamily: 'Inter', fontWeight: 700 }}>Preparing topic-focused questions...</div>
        ) : (
          messages.map((m, idx) => (
            <div key={idx} style={{ alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              <div
                style={{
                  background: m.from === 'user' ? '#4f46e5' : '#334155',
                  color: '#e2e8f0',
                  borderRadius: '16px',
                  padding: '0.9rem 1rem',
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  whiteSpace: 'pre-wrap'
                }}
              >
                {m.text}
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && !ready && (
        <div style={{ padding: '1rem 1.2rem', borderTop: '1px solid #22314b', background: '#16263f' }}>
          <button onClick={startSession} className="btn-primary" style={{ width: '140px', background: '#4f46e5' }}>Start</button>
        </div>
      )}

      {!loading && ready && (
        <div style={{ display: 'flex', gap: '0.6rem', padding: '1rem 1.2rem', borderTop: '1px solid #22314b', background: '#16263f' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type A, B, C or D"
            className="form-input"
            style={{ flex: 1, margin: 0, background: '#27364f', border: '1px solid #31445f', color: '#e2e8f0' }}
          />
          <button onClick={submitAnswer} className="btn-primary" style={{ width: '64px', padding: 0, background: '#6d4aff' }}>
            <Send size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

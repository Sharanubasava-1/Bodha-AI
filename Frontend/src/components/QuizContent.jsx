import React, { useEffect, useMemo, useState } from 'react';
import { BookA, CheckCircle2, AlertTriangle, FileText, ArrowRight, ArrowLeft, Bot } from 'lucide-react';
import { HfInference } from '@huggingface/inference';
import { addUserReport } from '../utils/reportStorage';

const PRIMARY_UNLOCK_KEY = 'bodha_primary_unlock_state';
const SUBTOPIC_HISTORY_KEY = 'bodha_subtopic_question_history';
const HF_TOKEN = import.meta.env.VITE_HUGGINGFACE_API_KEY || '';
const HF_QUIZ_MODEL = import.meta.env.VITE_HF_QUIZ_MODEL || 'meta-llama/Meta-Llama-3-8B-Instruct';
const hf = HF_TOKEN ? new HfInference(HF_TOKEN) : null;

const RESOURCE_LINKS = {
  Java: {
    'OOP Fundamentals': 'https://www.geeksforgeeks.org/object-oriented-programming-oops-concept-in-java/',
    'Collections Framework': 'https://www.geeksforgeeks.org/collections-in-java-2/',
    'Java Multithreading': 'https://www.geeksforgeeks.org/multithreading-in-java/',
    'Exception Architecture': 'https://www.geeksforgeeks.org/exceptions-in-java/',
    'JVM Internals': 'https://www.baeldung.com/jvm-overview'
  },
  Python: {
    'Basic Syntax': 'https://www.w3schools.com/python/python_syntax.asp',
    'Functional Python': 'https://realpython.com/python-functional-programming/',
    'Python OOP': 'https://realpython.com/python3-object-oriented-programming/',
    'I/O & File Handling': 'https://www.geeksforgeeks.org/file-handling-python/',
    'Data Stack (Pandas)': 'https://pandas.pydata.org/docs/getting_started/index.html'
  }
};

const buildDefaultResourceLink = (topicName, areaName, queryHint = '') => {
  const topicLinks = RESOURCE_LINKS[topicName] || {};
  if (topicLinks[areaName]) {
    return topicLinks[areaName];
  }

  const query = queryHint || `${topicName} ${areaName} tutorial with examples`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
};

const buildFallbackResultInsights = ({ topicName, weakAreas, scorePercent, flaggedWrongCount }) => {
  const weaknessInsights = weakAreas.map((area) => {
    const severity = area.score <= 50 ? 'high' : area.score <= 75 ? 'medium' : 'low';
    const reason =
      severity === 'high'
        ? `Accuracy is low in ${area.name}. Revisit fundamentals, solve beginner problems, and then move to mixed-level questions.`
        : severity === 'medium'
          ? `You understand parts of ${area.name}, but consistency is missing. Focus on edge cases and pattern-based practice.`
          : `Minor gaps detected in ${area.name}. A quick revision and timed practice should improve retention.`;

    return {
      area: area.name,
      reason,
      resourceTitle: `${area.name} interview-focused learning path`,
      resourceLink: buildDefaultResourceLink(topicName, area.name),
    };
  });

  const aiSummary =
    weakAreas.length > 0
      ? `You scored ${scorePercent}%. Your top improvement area is ${weakAreas[0].name}. Prioritize weak concepts first, then retest with mixed questions. ${flaggedWrongCount} question(s) were incorrect on first attempt.`
      : `Strong performance with ${scorePercent}%. Keep practicing mixed-difficulty sets to maintain speed and accuracy.`;

  return {
    aiSummary,
    weaknessInsights,
    resources: weaknessInsights.map((item) => ({
      area: item.area,
      title: item.resourceTitle,
      why: item.reason,
      link: item.resourceLink,
    })),
  };
};

const optionTemplates = [
  'It is a foundational concept used to solve real-world problems in this subject.',
  'It is only used for UI styling and has no role in core logic.',
  'It applies only to hardware setup, not software design.',
  'It is unrelated to this topic and not needed for interviews.'
];

const getUserKey = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user?.id || user?.email || 'guest';
  } catch {
    return 'guest';
  }
};

const getSubtopicHistoryStore = () => {
  try {
    return JSON.parse(localStorage.getItem(SUBTOPIC_HISTORY_KEY) || '{}');
  } catch {
    return {};
  }
};

const getSubtopicStorageKey = (selection) => `${selection.topicName}::${selection.subtopicId}`;

const getQuestionKey = (questionText) => (questionText || '').trim().toLowerCase().replace(/\s+/g, ' ');

const getUsedSubtopicQuestionKeys = (selection) => {
  const store = getSubtopicHistoryStore();
  const byUser = store[getUserKey()] || {};
  return new Set(byUser[getSubtopicStorageKey(selection)] || []);
};

const persistUsedSubtopicQuestionKey = (selection, questionText) => {
  const store = getSubtopicHistoryStore();
  const userKey = getUserKey();
  const byUser = store[userKey] || {};
  const key = getSubtopicStorageKey(selection);
  const used = new Set(byUser[key] || []);
  used.add(getQuestionKey(questionText));

  byUser[key] = Array.from(used);
  store[userKey] = byUser;
  localStorage.setItem(SUBTOPIC_HISTORY_KEY, JSON.stringify(store));
};

const buildSubtopicQuestionPool = (selection) => {
  const prompts = [
    'Which option best defines this sub-topic?',
    'Which statement is technically correct for interview context?',
    'Which choice is the most accurate conceptual description?',
    'Which option would be accepted as correct in an MCQ test?',
    'Which option matches the core idea of this sub-topic?',
    'Which statement is valid for practical implementation?',
    'Which option correctly reflects the fundamentals?',
    'Which explanation is aligned with this sub-topic?',
    'Which statement is correct from a software design perspective?',
    'Which answer best summarizes the concept?'
  ];

  return Array.from({ length: 20 }).map((_, idx) => {
    const prompt = prompts[idx % prompts.length];
    const correct = `${selection.subtopicName}: ${selection.subtopicDesc}.`;
    const distractors = [
      'It is mostly a UI styling concept and not related to programming logic.',
      'It belongs to hardware architecture and not application development.',
      `It is optional and not important for mastering ${selection.topicName}.`,
    ];

    const seed = idx % 4;
    const options = [correct, ...distractors];
    const rotated = [...options.slice(seed), ...options.slice(0, seed)];
    const answerIndex = (4 - seed) % 4;

    return {
      id: `${selection.subtopicId}-q-${idx + 1}`,
      topicName: selection.topicName,
      subtopicName: selection.subtopicName,
      questionText: `${prompt} (${selection.topicName} - ${selection.subtopicName})`,
      options: rotated,
      answerIndex,
      hint: `Focus on the words "${selection.subtopicName}" and "${selection.subtopicDesc.split(',')[0] || selection.subtopicDesc}".`,
      explanation: `Correct answer: ${correct}`,
      whyCorrect: `Why: ${selection.subtopicName} in ${selection.topicName} is defined by ${selection.subtopicDesc}.`,
    };
  });
};

const extractJsonObject = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return text.slice(start, end + 1);
};

const generateResultInsightsWithAI = async ({
  topicName,
  subtopicName,
  weakAreas,
  scorePercent,
  flaggedWrongCount,
  questionReview,
}) => {
  const fallback = buildFallbackResultInsights({
    topicName,
    weakAreas,
    scorePercent,
    flaggedWrongCount,
  });

  if (!hf || weakAreas.length === 0) {
    return fallback;
  }

  const weakAreaNames = weakAreas.map((area) => area.name);
  const incorrectQuestions = (questionReview || [])
    .filter((item) => !item.isCorrect)
    .slice(0, 5)
    .map((item) => item.questionText);

  const prompt = [
    'You are an AI study coach. Analyze quiz performance and output strict JSON only.',
    `Topic: ${topicName}`,
    `Subtopic: ${subtopicName || 'N/A'}`,
    `Overall score: ${scorePercent}%`,
    `Wrong-on-first-attempt count: ${flaggedWrongCount}`,
    `Weak areas: ${weakAreaNames.join(', ')}`,
    'Incorrect question samples:',
    ...(incorrectQuestions.length > 0 ? incorrectQuestions.map((q) => `- ${q}`) : ['- none']),
    'Output schema exactly:',
    '{"summary":"...","focus":[{"area":"...","reason":"...","resourceTitle":"...","resourceQuery":"..."}]}',
    'Rules:',
    '- summary: 2 to 3 concise sentences.',
    '- focus: one item for each weak area in same names.',
    '- reason: explain why this area needs improvement based on the score context.',
    '- resourceQuery: specific search query to find high-quality tutorial content.',
    '- Do not include markdown or extra text.',
  ].join('\n');

  try {
    let generatedText = '';
    const stream = hf.chatCompletionStream({
      model: HF_QUIZ_MODEL,
      messages: [
        { role: 'system', content: 'Return valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1200,
      temperature: 0.35,
    });

    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta?.content || '';
      generatedText += delta;
    }

    const jsonText = extractJsonObject(generatedText);
    if (!jsonText) {
      return fallback;
    }

    const parsed = JSON.parse(jsonText);
    const summary = `${parsed?.summary || ''}`.trim() || fallback.aiSummary;
    const focusList = Array.isArray(parsed?.focus) ? parsed.focus : [];

    const weaknessInsights = weakAreas.map((area) => {
      const matched = focusList.find((item) => `${item?.area || ''}`.trim().toLowerCase() === area.name.toLowerCase());
      const reason = `${matched?.reason || ''}`.trim() || `Improve ${area.name} through focused concept revision and targeted practice.`;
      const resourceTitle = `${matched?.resourceTitle || ''}`.trim() || `${area.name} learning resource`;
      const resourceQuery = `${matched?.resourceQuery || ''}`.trim();

      return {
        area: area.name,
        reason,
        resourceTitle,
        resourceLink: buildDefaultResourceLink(topicName, area.name, resourceQuery),
      };
    });

    return {
      aiSummary: summary,
      weaknessInsights,
      resources: weaknessInsights.map((item) => ({
        area: item.area,
        title: item.resourceTitle,
        why: item.reason,
        link: item.resourceLink,
      })),
    };
  } catch {
    return fallback;
  }
};

const normalizeGeneratedQuestion = (raw, selection, indexHint) => {
  const options = Array.isArray(raw?.options) ? raw.options.slice(0, 4).map((v) => `${v || ''}`.trim()) : [];
  if (options.length < 4) {
    return null;
  }

  const answerIndex = Number.isInteger(raw?.answerIndex) && raw.answerIndex >= 0 && raw.answerIndex <= 3
    ? raw.answerIndex
    : 0;

  const questionText = `${raw?.questionText || ''}`.trim();
  if (!questionText) {
    return null;
  }

  return {
    id: `${selection.subtopicId}-gen-${indexHint}`,
    topicName: selection.topicName,
    subtopicName: selection.subtopicName,
    questionText,
    options,
    answerIndex,
    hint: `${raw?.hint || ''}`.trim() || `Focus on the core definition of ${selection.subtopicName}.`,
    explanation: `${raw?.explanation || ''}`.trim() || `Correct answer: ${options[answerIndex]}`,
    whyCorrect: `${raw?.whyCorrect || ''}`.trim() || `Why: This option correctly reflects ${selection.subtopicName} in ${selection.topicName}.`,
  };
};

const generateSubtopicQuestionsWithHF = async (selection, usedKeys, count = 10) => {
  if (!hf) {
    return [];
  }

  const avoidList = Array.from(usedKeys).slice(0, 60).join('\n- ');
  const prompt = [
    `Generate ${count} unique MCQ questions for ${selection.topicName} subtopic: ${selection.subtopicName}.`,
    `Subtopic details: ${selection.subtopicDesc}.`,
    'Rules:',
    '- Exactly 4 options per question.',
    '- Exactly one correct option.',
    '- Return strict JSON only with this shape:',
    '{"questions":[{"questionText":"...","options":["A","B","C","D"],"answerIndex":0,"hint":"...","explanation":"...","whyCorrect":"..."}]}',
    '- Keep questions interview-relevant and non-repetitive.',
    '- Do not reuse or paraphrase these previously used question keys:',
    `- ${avoidList || 'none'}`,
  ].join('\n');

  let generatedText = '';
  const stream = hf.chatCompletionStream({
    model: HF_QUIZ_MODEL,
    messages: [
      { role: 'system', content: 'You are a strict quiz generator. Return valid JSON only.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 2200,
    temperature: 0.8,
  });

  for await (const chunk of stream) {
    const delta = chunk?.choices?.[0]?.delta?.content || '';
    generatedText += delta;
  }

  const jsonText = extractJsonObject(generatedText);
  if (!jsonText) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }

  const out = [];
  const seen = new Set();
  const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
  questions.forEach((q, idx) => {
    const normalized = normalizeGeneratedQuestion(q, selection, idx + 1);
    if (!normalized) {
      return;
    }

    const key = getQuestionKey(normalized.questionText);
    if (!key || usedKeys.has(key) || seen.has(key)) {
      return;
    }

    seen.add(key);
    out.push(normalized);
  });

  return out;
};

const fillWithFallbackSubtopicQuestions = (selection, usedKeys, requiredCount, seedOffset = 0) => {
  const fallback = buildSubtopicQuestionPool(selection);
  const list = [];
  const seen = new Set();

  for (let i = 0; i < fallback.length && list.length < requiredCount; i += 1) {
    const base = fallback[(i + seedOffset) % fallback.length];
    const variant = {
      ...base,
      id: `${base.id}-v${seedOffset + i + 1}`,
      questionText: `${base.questionText} [Variant ${seedOffset + i + 1}]`,
      hint: `${base.hint} (variant ${seedOffset + i + 1})`,
    };
    const key = getQuestionKey(variant.questionText);
    if (usedKeys.has(key) || seen.has(key)) {
      continue;
    }

    seen.add(key);
    list.push(variant);
  }

  return list;
};

const buildQuestionSet = (selection) => {
  if (!selection) {
    return [];
  }

  if (selection.type === 'subtopic') {
    return Array.from({ length: 10 }).map((_, idx) => ({
      id: `${selection.subtopicId}-${idx + 1}`,
      topicName: selection.topicName,
      subtopicName: selection.subtopicName,
      questionText: `In ${selection.topicName}, which statement correctly describes ${selection.subtopicName}?`,
      options: [
        `${selection.subtopicName}: ${selection.subtopicDesc}.`,
        optionTemplates[1],
        optionTemplates[2],
        optionTemplates[3],
      ],
      answerIndex: 0,
    }));
  }

  const subtopics = selection.subtopics || [];
  const total = selection.totalQuestions || 30;
  if (subtopics.length === 0) {
    return [];
  }

  return Array.from({ length: total }).map((_, idx) => {
    const sub = subtopics[idx % subtopics.length];
    const correctIndex = idx % 4;
    const options = [
      `${sub.name}: ${sub.desc}.`,
      optionTemplates[1],
      optionTemplates[2],
      optionTemplates[3],
    ];

    // Rotate which option is correct so users cannot guess pattern.
    const rotated = [...options.slice(correctIndex), ...options.slice(0, correctIndex)];

    return {
      id: `${selection.topicName}-${sub.id}-${idx + 1}`,
      topicName: selection.topicName,
      subtopicName: sub.name,
      questionText: `Q${idx + 1}. Which option best reflects ${sub.name} in ${selection.topicName}?`,
      options: rotated,
      answerIndex: 4 - correctIndex === 4 ? 0 : 4 - correctIndex,
    };
  });
};

export default function QuizContent({ onNavigate, quizSelection, onConsumeQuizSelection }) {
  const [step, setStep] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [activeSelection, setActiveSelection] = useState(null);
  const [subtopicExhausted, setSubtopicExhausted] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isAnalyzingResult, setIsAnalyzingResult] = useState(false);
  const [quizGenerationError, setQuizGenerationError] = useState('');

  useEffect(() => {
    if (!quizSelection) {
      return;
    }

    let canceled = false;

    const prepareQuiz = async () => {
      setIsGeneratingQuiz(true);
      setQuizGenerationError('');

      let generated = buildQuestionSet(quizSelection);
      let exhausted = false;

      if (quizSelection.type === 'subtopic') {
        const usedKeys = getUsedSubtopicQuestionKeys(quizSelection);

        try {
          const aiGenerated = await generateSubtopicQuestionsWithHF(quizSelection, usedKeys, 10);
          const aiKeys = new Set(aiGenerated.map((q) => getQuestionKey(q.questionText)));
          const need = Math.max(0, 10 - aiGenerated.length);
          const fallbackGenerated = need > 0
            ? fillWithFallbackSubtopicQuestions(quizSelection, new Set([...usedKeys, ...aiKeys]), need, usedKeys.size)
            : [];
          generated = [...aiGenerated, ...fallbackGenerated].slice(0, 10);
        } catch {
          setQuizGenerationError('AI generation failed. Using fallback quiz questions.');
          generated = fillWithFallbackSubtopicQuestions(quizSelection, usedKeys, 10, usedKeys.size);
        }

        exhausted = generated.length === 0;
      }

      if (canceled) {
        return;
      }

      setQuestions(generated);
      setAnswers({});
      setCurrentIndex(0);
      setResult(null);
      setActiveSelection(quizSelection);
      setSubtopicExhausted(exhausted);
      setStep(generated.length > 0 ? 2 : 1);
      setIsGeneratingQuiz(false);

      if (typeof onConsumeQuizSelection === 'function') {
        onConsumeQuizSelection();
      }
    };

    prepareQuiz();

    return () => {
      canceled = true;
    };
  }, [onConsumeQuizSelection, quizSelection]);

  const currentQuestion = questions[currentIndex] || null;
  const totalQuestions = questions.length;

  const sourceLabel = useMemo(() => {
    if (!activeSelection) {
      return 'No topic selected';
    }

    if (activeSelection.type === 'subtopic') {
      return `${activeSelection.topicName} - ${activeSelection.subtopicName}`;
    }

    return `${activeSelection.topicName} - Primary Test`;
  }, [activeSelection]);

  const handleAnswer = (optionIndex) => {
    setAnswers((prev) => ({ ...prev, [currentIndex]: optionIndex }));
  };

  const goNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, totalQuestions - 1));
  };

  const goPrevious = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const finalizeQuiz = async () => {
    if (isAnalyzingResult) {
      return;
    }

    setIsAnalyzingResult(true);
    try {
      let correct = 0;
      const bySubtopic = {};
      const questionReview = [];

      questions.forEach((q, idx) => {
        const selectedIndex = answers[idx];
        const isCorrect = selectedIndex === q.answerIndex;
        if (isCorrect) {
          correct += 1;
        }

        questionReview.push({
          id: q.id,
          questionText: q.questionText,
          options: q.options,
          selectedIndex,
          correctIndex: q.answerIndex,
          isCorrect,
          explanation: q.explanation || 'Review the core concept and the correct option.',
          whyCorrect: q.whyCorrect || '',
        });

        if (!bySubtopic[q.subtopicName]) {
          bySubtopic[q.subtopicName] = { total: 0, correct: 0 };
        }
        bySubtopic[q.subtopicName].total += 1;
        if (isCorrect) {
          bySubtopic[q.subtopicName].correct += 1;
        }
      });

      const weakAreas = Object.entries(bySubtopic)
        .map(([name, stat]) => {
          const score = Math.round((stat.correct / stat.total) * 100);
          return { name, score };
        })
        .sort((a, b) => a.score - b.score)
        .slice(0, 3);

      const topicName = activeSelection?.topicName || 'General';

      const scorePercent = Math.round((correct / Math.max(totalQuestions, 1)) * 100);
      const flaggedWrongCount = questionReview.filter((r) => r.selectedIndex !== undefined && !r.isCorrect).length;

      const insights = await generateResultInsightsWithAI({
        topicName,
        subtopicName: activeSelection?.subtopicName || null,
        weakAreas,
        scorePercent,
        flaggedWrongCount,
        questionReview,
      });

      const resources = insights.resources;
      const aiSummary = insights.aiSummary;
      const weaknessInsights = insights.weaknessInsights;

      const payload = {
        total: totalQuestions,
        correct,
        score: scorePercent,
        flaggedWrongCount,
        weakAreas,
        resources,
        aiSummary,
        weaknessInsights,
        questionReview,
      };

      addUserReport({
        mode: activeSelection?.type === 'primary' ? 'Primary Topic Quiz' : 'Sub-topic Quiz',
        sourceLabel,
        topicName: activeSelection?.topicName || 'General',
        subtopicName: activeSelection?.subtopicName || null,
        score: scorePercent,
        total: totalQuestions,
        correct,
        weakAreas,
        resources,
        flaggedWrongCount,
        aiSummary,
        weaknessInsights,
        questionReview,
      });

      if (activeSelection?.type === 'subtopic') {
        questions.forEach((q) => {
          persistUsedSubtopicQuestionKey(activeSelection, q.questionText);
        });
      }

      if (activeSelection?.type === 'primary') {
        const userKey = getUserKey();
        const all = JSON.parse(localStorage.getItem(PRIMARY_UNLOCK_KEY) || '{}');
        const perUser = all[userKey] || {};

        perUser[topicName] = {
          completed: true,
          score: scorePercent,
          weakAreas,
          resources,
          completedAt: new Date().toISOString(),
        };

        all[userKey] = perUser;
        localStorage.setItem(PRIMARY_UNLOCK_KEY, JSON.stringify(all));
      }

      setResult(payload);
      setStep(3);
    } finally {
      setIsAnalyzingResult(false);
    }
  };

  return (
    <div className="center-content">
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
        <button
          onClick={() => onNavigate('topics')}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontFamily: 'Space Grotesk',
            fontWeight: '800',
            cursor: 'pointer',
            color: 'var(--text-dark)',
            textTransform: 'uppercase'
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>
      <h1 className="student-name brutalist-font" style={{ color: 'var(--accent-yellow)', textShadow: '2px 2px 0px #000' }}>Assessment Hub</h1>

      {isGeneratingQuiz && (
        <div className="card" style={{ maxWidth: '760px', margin: '0 auto 1rem auto', background: '#f8fafc', borderLeft: '10px solid var(--accent-blue)' }}>
          <p style={{ margin: 0, fontFamily: 'Inter', fontWeight: 700 }}>
            AI model is generating fresh quiz questions for this topic/sub-topic...
          </p>
        </div>
      )}

      {quizGenerationError && (
        <div className="card" style={{ maxWidth: '760px', margin: '0 auto 1rem auto', background: '#fff7ed', borderLeft: '10px solid var(--accent-yellow)' }}>
          <p style={{ margin: 0, fontFamily: 'Inter', fontWeight: 700 }}>{quizGenerationError}</p>
        </div>
      )}

      {isAnalyzingResult && (
        <div className="card" style={{ maxWidth: '760px', margin: '0 auto 1rem auto', background: '#ecfeff', borderLeft: '10px solid var(--accent-blue)' }}>
          <p style={{ margin: 0, fontFamily: 'Inter', fontWeight: 700 }}>
            AI is analyzing your quiz report and preparing personalized weakness-focused resources...
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="card" style={{ maxWidth: '760px', margin: '0 auto', background: '#f8fafc' }}>
          <h2 className="brutalist-font" style={{ fontSize: '2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <BookA size={36} /> Assessment
          </h2>
          {subtopicExhausted ? (
            <p style={{ fontFamily: 'Inter', fontWeight: 600, marginBottom: '1.5rem' }}>
              You already attempted all available questions for this sub-topic. No repeated questions will be shown, even after re-login.
            </p>
          ) : (
            <p style={{ fontFamily: 'Inter', fontWeight: 600, marginBottom: '1.5rem' }}>
              Select a topic first, then start the primary test. The test contains 30 MCQs and covers all sub-topics in the selected subject.
            </p>
          )}
          <button onClick={() => onNavigate('topics')} className="btn-primary" style={{ background: 'black' }}>
            GO TO TOPICS <ArrowRight size={20} />
          </button>
        </div>
      )}

      {step === 2 && currentQuestion && activeSelection?.type !== 'subtopic' && (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'black', color: 'white' }}>
            <h2 className="brutalist-font" style={{ margin: 0 }}>Question {currentIndex + 1} of {totalQuestions}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} />
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 'bold', fontSize: '0.9rem' }}>SRC: {sourceLabel}</span>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '10px solid var(--accent-yellow)' }}>
            <p style={{ fontSize: '1.3rem', fontFamily: 'Inter', fontWeight: '700', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              {currentQuestion.questionText}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {currentQuestion.options.map((opt, i) => (
                <label key={i} className="card" style={{ display: 'flex', gap: '1rem', cursor: 'pointer', padding: '1rem', background: '#fff', border: '3px solid black' }}>
                  <input
                    type="radio"
                    name={`quiz-opt-${currentIndex}`}
                    checked={answers[currentIndex] === i}
                    onChange={() => handleAnswer(i)}
                    style={{ transform: 'scale(1.5)' }}
                  />
                  <span style={{ fontSize: '1.05rem', fontWeight: '600' }}>{opt}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <button
              className="btn-primary"
              style={{ background: '#111827' }}
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
            >
              PREVIOUS
            </button>

            {currentIndex < totalQuestions - 1 ? (
              <button
                className="btn-primary"
                style={{ background: 'var(--accent-blue)' }}
                onClick={() => setCurrentIndex((prev) => prev + 1)}
              >
                NEXT
              </button>
            ) : (
              <button
                className="btn-primary"
                style={{ background: 'var(--accent-green)' }}
                onClick={finalizeQuiz}
                disabled={isAnalyzingResult}
              >
                {isAnalyzingResult ? 'ANALYZING...' : 'SUBMIT TEST'} <CheckCircle2 size={20} />
              </button>
            )}
          </div>
        </div>
      )}

      {step === 2 && currentQuestion && activeSelection?.type === 'subtopic' && (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'black', color: 'white' }}>
            <h2 className="brutalist-font" style={{ margin: 0 }}>Question {currentIndex + 1} of {totalQuestions}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} />
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 'bold', fontSize: '0.9rem' }}>SRC: {sourceLabel}</span>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '10px solid var(--accent-yellow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <Bot size={24} />
              <strong style={{ fontFamily: 'Space Grotesk' }}>AI Bot</strong>
            </div>
            <p style={{ fontSize: '1.25rem', fontFamily: 'Inter', fontWeight: '700', marginBottom: '1rem', lineHeight: '1.4' }}>
              {currentQuestion.questionText}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {currentQuestion.options.map((opt, i) => (
                <label key={i} className="card" style={{ display: 'flex', gap: '0.9rem', cursor: 'pointer', padding: '0.9rem', background: '#fff', border: '3px solid black' }}>
                  <input
                    type="radio"
                    name={`bot-quiz-opt-${currentIndex}`}
                    checked={answers[currentIndex] === i}
                    onChange={() => handleAnswer(i)}
                    style={{ transform: 'scale(1.4)' }}
                  />
                  <span style={{ fontSize: '1rem', fontWeight: '600' }}>{opt}</span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1rem' }}>
              <button
                className="btn-primary"
                style={{ background: '#111827' }}
                disabled={currentIndex === 0}
                onClick={goPrevious}
              >
                PREVIOUS
              </button>

              {currentIndex < totalQuestions - 1 ? (
                <button
                  className="btn-primary"
                  style={{ background: 'var(--accent-blue)' }}
                  onClick={goNext}
                >
                  NEXT
                </button>
              ) : (
                <button
                  className="btn-primary"
                  style={{ background: 'var(--accent-green)' }}
                  onClick={finalizeQuiz}
                  disabled={isAnalyzingResult}
                >
                  {isAnalyzingResult ? 'ANALYZING...' : 'SUBMIT TEST'} <CheckCircle2 size={20} />
                </button>
              )}
            </div>

            <div style={{ marginTop: '1rem', fontFamily: 'Inter', fontWeight: 600, color: '#374151' }}>
              Answers are evaluated only after final submission.
            </div>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <h2 className="brutalist-font" style={{ fontSize: '3rem', marginBottom: '1.5rem', textAlign: 'center', fontStyle: 'italic' }}>AI DIAGNOSTIC REPORT</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <div className="card" style={{ textAlign: 'center', background: 'var(--accent-green)', minHeight: '220px' }}>
              <h3 className="brutalist-font" style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>SCORE</h3>
              <div className="brutalist-font" style={{ fontSize: '4.2rem', lineHeight: 1 }}>{result.score}%</div>
              <p style={{ fontFamily: 'Space Grotesk', fontWeight: 800, marginTop: '0.5rem' }}>{result.correct} / {result.total} correct</p>
            </div>

            <div className="card" style={{ borderLeft: '10px solid var(--accent-red)' }}>
              <h3 className="brutalist-font" style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertTriangle color="var(--accent-red)" size={28} /> WEAK AREAS
              </h3>
              {result.weakAreas.length === 0 ? (
                <p style={{ fontFamily: 'Inter', fontWeight: 700 }}>No weak areas detected. Great work.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {result.weakAreas.map((item) => (
                    <li key={item.name} style={{ border: '2px solid black', padding: '0.75rem', fontFamily: 'Inter', fontWeight: 700 }}>
                      {item.name} - {item.score}%
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: '2rem', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', opacity: 0.1 }}>
              <Bot size={72} />
            </div>
            <h3 className="brutalist-font" style={{ fontSize: '1.9rem', marginBottom: '1rem', fontStyle: 'italic' }}>AI Feedback</h3>
            <p style={{ fontFamily: 'Inter', lineHeight: '1.7', fontSize: '1.05rem', fontWeight: '500' }}>{result.aiSummary}</p>

            {typeof result.flaggedWrongCount === 'number' && (
              <p style={{ fontFamily: 'Inter', fontWeight: 700, marginTop: '0.75rem' }}>
                Flagged wrong on first attempt: {result.flaggedWrongCount}
              </p>
            )}

            {Array.isArray(result.weaknessInsights) && result.weaknessInsights.length > 0 && (
              <div style={{ marginTop: '1.25rem' }}>
                <h4 className="brutalist-font" style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>AI Weakness Analysis</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {result.weaknessInsights.map((item) => (
                    <div key={item.area} style={{ border: '2px solid black', padding: '0.75rem', background: '#f8fafc' }}>
                      <p style={{ margin: 0, fontFamily: 'Inter', fontWeight: 800 }}>{item.area}</p>
                      <p style={{ margin: '0.35rem 0 0 0', fontFamily: 'Inter', fontWeight: 600 }}>{item.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h4 className="brutalist-font" style={{ fontSize: '1.2rem', marginTop: '1.5rem', marginBottom: '0.75rem' }}>Suggested Resources</h4>
            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
              {result.resources.map((item) => (
                <li key={item.area} style={{ marginBottom: '0.5rem' }}>
                  <a href={item.link} target="_blank" rel="noreferrer" style={{ fontFamily: 'Inter', fontWeight: 700 }}>
                    {item.title || `${item.area} learning resource`}
                  </a>
                  {item.why && (
                    <p style={{ margin: '0.25rem 0 0 0', fontFamily: 'Inter', fontWeight: 600 }}>
                      {item.why}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            {activeSelection?.type === 'primary' && (
              <p style={{ marginTop: '1rem', fontFamily: 'Inter', fontWeight: 700, color: '#166534' }}>
                Primary test submitted. Sub-topics for this subject are now unlocked.
              </p>
            )}

            <div style={{ marginTop: '2rem' }}>
              <h4 className="brutalist-font" style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>Question-wise Review</h4>
              <p style={{ fontFamily: 'Inter', fontWeight: 600, marginTop: 0, marginBottom: '1rem' }}>
                Green shows a correct selected option. Red shows an incorrect selected option.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {(result.questionReview || []).map((item, qIdx) => (
                  <div key={item.id || qIdx} className="card" style={{ borderLeft: item.isCorrect ? '10px solid var(--accent-green)' : '10px solid var(--accent-red)' }}>
                    <p style={{ margin: 0, marginBottom: '0.75rem', fontFamily: 'Inter', fontWeight: 800 }}>
                      Q{qIdx + 1}. {item.questionText}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(item.options || []).map((opt, optIdx) => {
                        const isSelected = item.selectedIndex === optIdx;
                        const isCorrectOption = item.correctIndex === optIdx;
                        let background = '#ffffff';

                        if (isSelected && isCorrectOption) {
                          background = '#dcfce7';
                        } else if (isSelected && !isCorrectOption) {
                          background = '#fee2e2';
                        }

                        return (
                          <div
                            key={`${item.id || qIdx}-opt-${optIdx}`}
                            style={{
                              border: '2px solid black',
                              padding: '0.65rem 0.75rem',
                              background,
                              fontFamily: 'Inter',
                              fontWeight: isSelected ? 800 : 600,
                            }}
                          >
                            {opt}
                            {isSelected ? ' (your answer)' : ''}
                            {!isSelected && isCorrectOption ? ' (correct answer)' : ''}
                          </div>
                        );
                      })}
                    </div>

                    <p style={{ marginTop: '0.8rem', marginBottom: '0.4rem', fontFamily: 'Inter', fontWeight: 700 }}>
                      {item.isCorrect ? 'Correct' : 'Incorrect'}
                    </p>
                    <p style={{ margin: 0, fontFamily: 'Inter', fontWeight: 600 }}>
                      {item.explanation}
                    </p>
                    {item.whyCorrect && (
                      <p style={{ marginTop: '0.4rem', marginBottom: 0, fontFamily: 'Inter', fontWeight: 600 }}>
                        {item.whyCorrect}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button onClick={() => onNavigate('topics')} className="btn-primary" style={{ flex: 1 }}>
                BACK TO TOPICS
              </button>
              <button onClick={() => onNavigate('tutorials')} className="btn-primary" style={{ flex: 1, background: 'var(--accent-blue)' }}>
                VIEW TUTORIALS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

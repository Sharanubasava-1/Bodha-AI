import React, { useMemo, useState } from 'react';
import { Upload, FileText, Loader2, ArrowLeft, CheckCircle2, Bot } from 'lucide-react';
import { HfInference } from '@huggingface/inference';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import { addUserReport } from '../utils/reportStorage';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const HF_TOKEN = import.meta.env.VITE_HUGGINGFACE_API_KEY || '';
const HF_QUIZ_MODEL = import.meta.env.VITE_HF_QUIZ_MODEL || 'meta-llama/Meta-Llama-3-8B-Instruct';
const hf = HF_TOKEN ? new HfInference(HF_TOKEN) : null;

const PDF_QUIZ_HISTORY_KEY = 'bodha_pdf_quiz_history';
const LIBRARY_STORAGE_KEY = 'bodha_library_docs';

const getUserKey = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user?.id || user?.email || 'guest';
  } catch {
    return 'guest';
  }
};

const normalizeQuestionKey = (text) => (text || '').trim().toLowerCase().replace(/\s+/g, ' ');

const hashText = (text) => {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i);
  }
  return `pdf-${Math.abs(hash)}`;
};

const getStore = () => {
  try {
    return JSON.parse(localStorage.getItem(PDF_QUIZ_HISTORY_KEY) || '{}');
  } catch {
    return {};
  }
};

const getLibraryDocs = () => {
  try {
    const docs = JSON.parse(localStorage.getItem(LIBRARY_STORAGE_KEY) || '[]');
    return Array.isArray(docs) ? docs : [];
  } catch {
    return [];
  }
};

const getUsedQuestionKeys = (docKey) => {
  const store = getStore();
  const byUser = store[getUserKey()] || {};
  return new Set(byUser[docKey] || []);
};

const persistUsedQuestionKeys = (docKey, questions) => {
  const store = getStore();
  const userKey = getUserKey();
  const byUser = store[userKey] || {};
  const used = new Set(byUser[docKey] || []);

  questions.forEach((q) => {
    used.add(normalizeQuestionKey(q.questionText));
  });

  byUser[docKey] = Array.from(used);
  store[userKey] = byUser;
  localStorage.setItem(PDF_QUIZ_HISTORY_KEY, JSON.stringify(store));
};

const extractJsonObject = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
};

const splitSentences = (text) => text
  .split(/(?<=[.!?])\s+/)
  .map((s) => s.trim())
  .filter((s) => s.length > 40);

const buildFallbackQuestions = (pdfText, usedKeys, count) => {
  const sentences = splitSentences(pdfText);
  const out = [];
  const seen = new Set();

  for (let i = 0; i < sentences.length && out.length < count; i += 1) {
    const base = sentences[i];
    const key = normalizeQuestionKey(base);
    if (!key || usedKeys.has(key) || seen.has(key)) {
      continue;
    }

    seen.add(key);
    const wrongA = sentences[(i + 1) % sentences.length] || 'Not present in the uploaded PDF.';
    const wrongB = sentences[(i + 2) % sentences.length] || 'Not present in the uploaded PDF.';
    const wrongC = sentences[(i + 3) % sentences.length] || 'Not present in the uploaded PDF.';

    const options = [base, wrongA, wrongB, wrongC].map((v) => v.slice(0, 220));
    const shift = i % 4;
    const rotated = [...options.slice(shift), ...options.slice(0, shift)];
    const answerIndex = (4 - shift) % 4;

    out.push({
      id: `fallback-${i + 1}`,
      questionText: `Which statement is directly supported by the uploaded PDF notes?`,
      options: rotated,
      answerIndex,
      explanation: `The correct option is directly quoted/paraphrased from the uploaded PDF content.`,
      whyCorrect: base.slice(0, 220),
    });
  }

  return out;
};

const normalizeGeneratedQuestions = (raw, usedKeys) => {
  const out = [];
  const seen = new Set();

  (raw || []).forEach((q, idx) => {
    const questionText = `${q?.questionText || ''}`.trim();
    const options = Array.isArray(q?.options) ? q.options.slice(0, 4).map((v) => `${v || ''}`.trim()) : [];
    if (!questionText || options.length < 4) {
      return;
    }

    const key = normalizeQuestionKey(questionText);
    if (!key || usedKeys.has(key) || seen.has(key)) {
      return;
    }

    seen.add(key);

    const answerIndex = Number.isInteger(q?.answerIndex) ? Math.max(0, Math.min(q.answerIndex, 3)) : 0;

    out.push({
      id: `hf-${idx + 1}`,
      questionText,
      options,
      answerIndex,
      explanation: `${q?.explanation || ''}`.trim() || 'Answer chosen from uploaded PDF notes.',
      whyCorrect: `${q?.whyCorrect || ''}`.trim() || '',
    });
  });

  return out;
};

const generateQuestionsFromPdf = async ({ pdfText, coachPrompt, usedKeys, count = 10 }) => {
  if (!hf) {
    return buildFallbackQuestions(pdfText, usedKeys, count);
  }

  // Heavily restrict to prevent HF Token length limit / timeout crashes causing fallback
  const clippedText = pdfText.slice(0, 5000); 
  const avoid = Array.from(usedKeys).slice(0, 30).join('\n- ');
  
  const prompt = `You are a strict JSON quiz generator. Rule 1: Read the PDF notes. Rule 2: Output exactly ${count} Multiple Choice Questions based SOLELY on the notes. Rule 3: Output valid JSON exclusively.

AVOID REPEATING THESE PAST QUESTIONS:
${avoid || 'None yet.'}

PDF NOTES:
"""
${clippedText}
"""

OUTPUT FORMAT (Valid JSON, NO markdown, NO code block wrappers):
{
  "questions": [
    {
      "questionText": "Clear question derived exactly from notes?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "answerIndex": 0,
      "explanation": "Short logic explanation",
      "whyCorrect": "Reference quote from text"
    }
  ]
}`;

  try {
    const res = await hf.chatCompletion({
      model: HF_QUIZ_MODEL,
      messages: [
        { role: 'system', content: 'You are an expert programming tutor AI. Output nothing but strict, raw, unformatted JSON arrays. No backticks, no explanations.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1500,
      temperature: 0.6,
    });

    const output = res.choices[0].message.content;
    const jsonText = extractJsonObject(output);
    if (!jsonText) {
      throw new Error("No JSON blocks matched");
    }

    const parsed = JSON.parse(jsonText);
    const normalized = normalizeGeneratedQuestions(parsed.questions, usedKeys);
    
    if (normalized.length > 0) {
      // If we got at least some real questions from AI, fill the rest with safe fallback
      const mergedUsed = new Set([...usedKeys, ...normalized.map((q) => normalizeQuestionKey(q.questionText))]);
      const fallback = buildFallbackQuestions(pdfText, mergedUsed, count - normalized.length);
      return [...normalized, ...fallback].slice(0, count);
    }
    
    throw new Error("Parsed but no valid questions");
  } catch (error) {
    console.error("AI inference error falling back:", error);
    return buildFallbackQuestions(pdfText, usedKeys, count);
  }
};

const extractPdfText = async (file) => {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => item.str || '')
      .join(' ')
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF\uF0B7]/g, '') // Strip unicode blocks, bullets, control chars
      .replace(/\s+/g, ' ')
      .trim();
    if (text) {
      pages.push(text);
    }
  }

  return pages.join('. ');
};

export default function NotesQuizContent() {
  const [fileName, setFileName] = useState('');
  const [pdfText, setPdfText] = useState('');
  const [docKey, setDocKey] = useState('');
  const [coachPrompt, setCoachPrompt] = useState('Conduct a balanced revision quiz from my notes.');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [selectedLibraryDocId, setSelectedLibraryDocId] = useState('');

  const currentQuestion = questions[currentIndex] || null;
  const totalQuestions = questions.length;

  const usedCount = useMemo(() => {
    if (!docKey) {
      return 0;
    }
    return getUsedQuestionKeys(docKey).size;
  }, [docKey]);

  const syncedLibraryDocs = useMemo(
    () => getLibraryDocs().filter((doc) => doc.syncedForQuiz && typeof doc.extractedText === 'string' && doc.extractedText.length >= 200),
    []
  );

  const handleSelectLibraryDoc = (docId) => {
    setSelectedLibraryDocId(docId);

    if (!docId) {
      return;
    }

    const picked = syncedLibraryDocs.find((doc) => `${doc.id}` === `${docId}`);
    if (!picked) {
      return;
    }

    setError('');
    setResult(null);
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setPdfText(picked.extractedText || '');
    setFileName(picked.filename || picked.label || 'Library PDF');
    setDocKey(picked.docKey || hashText(`${picked.filename || picked.label}::${(picked.extractedText || '').slice(0, 2000)}`));
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file only.');
      return;
    }

    setIsExtracting(true);
    setError('');
    setResult(null);
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);

    try {
      const text = await extractPdfText(file);
      if (!text || text.length < 200) {
        setError('PDF text is too short or unreadable. Upload a richer notes PDF.');
      }
      setPdfText(text);
      setFileName(file.name);
      setDocKey(hashText(`${file.name}::${text.slice(0, 2000)}`));
    } catch {
      setError('Failed to parse PDF. Try another PDF file.');
    } finally {
      setIsExtracting(false);
    }
  };

  const generateQuiz = async () => {
    if (!pdfText || !docKey) {
      setError('Upload a valid PDF notes file first.');
      return;
    }

    setError('');
    setIsGenerating(true);
    setResult(null);

    try {
      const usedKeys = getUsedQuestionKeys(docKey);
      const generated = await generateQuestionsFromPdf({
        pdfText,
        coachPrompt,
        usedKeys,
        count: 10,
      });

      if (!generated.length) {
        setError('No fresh questions available from this PDF.');
        setQuestions([]);
        return;
      }

      setQuestions(generated);
      setAnswers({});
      setCurrentIndex(0);
    } catch {
      setError('Could not generate quiz from this PDF right now.');
    } finally {
      setIsGenerating(false);
    }
  };

  const finalizeQuiz = () => {
    let correct = 0;
    const review = questions.map((q, idx) => {
      const selectedIndex = answers[idx];
      const isCorrect = selectedIndex === q.answerIndex;
      if (isCorrect) {
        correct += 1;
      }

      return {
        ...q,
        selectedIndex,
        correctIndex: q.answerIndex,
        isCorrect,
      };
    });

    persistUsedQuestionKeys(docKey, questions);

    const score = Math.round((correct / Math.max(1, questions.length)) * 100);

    addUserReport({
      mode: 'PDF Notes Quiz',
      sourceLabel: fileName ? `Uploaded PDF - ${fileName}` : 'Uploaded PDF',
      topicName: 'Notes',
      subtopicName: null,
      score,
      total: questions.length,
      correct,
      weakAreas: [],
      resources: [],
      flaggedWrongCount: review.filter((r) => r.selectedIndex !== undefined && !r.isCorrect).length,
      aiSummary: `Quiz generated from ${fileName || 'uploaded PDF notes'}. Focus on questions marked incorrect and regenerate a fresh quiz for reinforcement.`,
      questionReview: review,
    });

    setResult({
      total: questions.length,
      correct,
      score,
      review,
    });
  };

  return (
    <div className="center-content">
      <h1 className="student-name brutalist-font" style={{ color: 'var(--accent-blue)' }}>PDF Notes Quiz Bot</h1>

      <div className="card" style={{ maxWidth: '980px', margin: '0 auto 1rem auto', borderLeft: '10px solid var(--accent-blue)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <Bot size={24} />
          <h2 className="brutalist-font" style={{ margin: 0, fontSize: '1.5rem' }}>AI Quiz Conductor</h2>
        </div>
        <p style={{ marginTop: 0, fontFamily: 'Inter', fontWeight: 600 }}>
          Select a synced file from Library or upload a new PDF. Quiz questions are generated only from selected PDF text and old questions are not repeated for the same PDF.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontFamily: 'Space Grotesk', fontWeight: 800, marginBottom: '0.4rem' }}>
            Synced Library Files
          </label>
          <select
            className="form-input"
            value={selectedLibraryDocId}
            onChange={(e) => handleSelectLibraryDoc(e.target.value)}
          >
            <option value="">Select a synced file from Library</option>
            {syncedLibraryDocs.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.label} ({doc.filename})
              </option>
            ))}
          </select>
          <p style={{ margin: '0.4rem 0 0 0', fontFamily: 'Inter', fontSize: '0.9rem', color: '#4b5563' }}>
            {syncedLibraryDocs.length} synced file(s) available from Library.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'Space Grotesk', fontWeight: 800, marginBottom: '0.4rem' }}>PDF Notes</label>
            <input type="file" accept="application/pdf" onChange={handleFileUpload} className="form-input" />
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: 'Space Grotesk', fontWeight: 800, marginBottom: '0.4rem' }}>Ask Quiz Bot</label>
            <input
              type="text"
              className="form-input"
              value={coachPrompt}
              onChange={(e) => setCoachPrompt(e.target.value)}
              placeholder="Example: Ask interview-level conceptual questions from this PDF only"
            />
          </div>
          <button className="btn-primary" onClick={generateQuiz} disabled={!pdfText || isExtracting || isGenerating}>
            {isGenerating ? <><Loader2 className="animate-spin" size={18} /> GENERATING</> : 'START QUIZ'}
          </button>
        </div>

        <div style={{ marginTop: '0.75rem', fontFamily: 'Inter', fontWeight: 600 }}>
          {isExtracting ? 'Extracting PDF text...' : fileName ? `Loaded: ${fileName}` : 'No PDF uploaded yet.'}
        </div>
        {docKey && (
          <div style={{ marginTop: '0.35rem', fontFamily: 'Inter', color: '#374151', fontWeight: 600 }}>
            Previous used questions for this PDF: {usedCount}
          </div>
        )}
        {error && <div style={{ marginTop: '0.75rem', color: '#b91c1c', fontFamily: 'Inter', fontWeight: 700 }}>{error}</div>}
      </div>

      {currentQuestion && !result && (
        <div style={{ maxWidth: '980px', margin: '0 auto' }}>
          <div className="card" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'black', color: 'white' }}>
            <h2 className="brutalist-font" style={{ margin: 0 }}>Question {currentIndex + 1} of {totalQuestions}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} />
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 'bold', fontSize: '0.9rem' }}>SOURCE: Uploaded PDF</span>
            </div>
          </div>

          <div className="card" style={{ borderLeft: '10px solid var(--accent-yellow)' }}>
            <p style={{ fontSize: '1.2rem', fontFamily: 'Inter', fontWeight: 700 }}>{currentQuestion.questionText}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {currentQuestion.options.map((opt, i) => (
                <label key={i} className="card" style={{ display: 'flex', gap: '0.75rem', cursor: 'pointer', border: '3px solid black' }}>
                  <input
                    type="radio"
                    name={`pdf-quiz-${currentIndex}`}
                    checked={answers[currentIndex] === i}
                    onChange={() => setAnswers((prev) => ({ ...prev, [currentIndex]: i }))}
                    style={{ transform: 'scale(1.4)' }}
                  />
                  <span style={{ fontFamily: 'Inter', fontWeight: 600 }}>{opt}</span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <button className="btn-primary" style={{ background: '#111827' }} disabled={currentIndex === 0} onClick={() => setCurrentIndex((v) => Math.max(0, v - 1))}>
                PREVIOUS
              </button>

              {currentIndex < totalQuestions - 1 ? (
                <button className="btn-primary" style={{ background: 'var(--accent-blue)' }} onClick={() => setCurrentIndex((v) => Math.min(totalQuestions - 1, v + 1))}>
                  NEXT
                </button>
              ) : (
                <button className="btn-primary" style={{ background: 'var(--accent-green)' }} onClick={finalizeQuiz}>
                  SUBMIT TEST <CheckCircle2 size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {result && (
        <div style={{ maxWidth: '980px', margin: '0 auto' }}>
          <div className="card" style={{ marginBottom: '1rem', textAlign: 'center', background: 'var(--accent-green)' }}>
            <h2 className="brutalist-font" style={{ marginBottom: '0.5rem' }}>RESULT</h2>
            <div className="brutalist-font" style={{ fontSize: '3rem' }}>{result.score}%</div>
            <p style={{ fontFamily: 'Inter', fontWeight: 700, marginTop: 0 }}>{result.correct} / {result.total} correct</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {result.review.map((item, idx) => (
              <div key={item.id || idx} className="card" style={{ borderLeft: item.isCorrect ? '10px solid var(--accent-green)' : '10px solid var(--accent-red)' }}>
                <p style={{ margin: 0, marginBottom: '0.7rem', fontFamily: 'Inter', fontWeight: 800 }}>Q{idx + 1}. {item.questionText}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {item.options.map((opt, optIdx) => {
                    const isSelected = item.selectedIndex === optIdx;
                    const isCorrect = item.correctIndex === optIdx;
                    let background = '#fff';
                    if (isSelected && isCorrect) {
                      background = '#dcfce7';
                    } else if (isSelected && !isCorrect) {
                      background = '#fee2e2';
                    }

                    return (
                      <div key={`${item.id}-opt-${optIdx}`} style={{ border: '2px solid black', padding: '0.5rem 0.65rem', background, fontFamily: 'Inter', fontWeight: isSelected ? 800 : 600 }}>
                        {opt}
                        {isSelected ? ' (your answer)' : ''}
                        {!isSelected && isCorrect ? ' (correct answer)' : ''}
                      </div>
                    );
                  })}
                </div>
                <p style={{ marginBottom: '0.35rem', fontFamily: 'Inter', fontWeight: 700 }}>{item.isCorrect ? 'Correct' : 'Incorrect'}</p>
                <p style={{ margin: 0, fontFamily: 'Inter', fontWeight: 600 }}>{item.explanation}</p>
                {item.whyCorrect && <p style={{ marginTop: '0.35rem', marginBottom: 0, fontFamily: 'Inter', fontWeight: 600 }}>{item.whyCorrect}</p>}
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn-primary"
              style={{ background: '#111827' }}
              onClick={() => {
                setResult(null);
                setAnswers({});
                setCurrentIndex(0);
              }}
            >
              <ArrowLeft size={16} /> REVIEW AGAIN
            </button>
            <button className="btn-primary" onClick={generateQuiz} disabled={isGenerating || !pdfText}>
              {isGenerating ? <><Loader2 className="animate-spin" size={18} /> GENERATING</> : <><Upload size={16} /> NEW NON-REPEATING QUIZ</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

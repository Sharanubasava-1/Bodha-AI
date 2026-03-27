import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "./api/client";
import type {
  ActivityResponse,
  AuthUser,
  GapItem,
  NoteItem,
  PieResponse,
  QuestionPayload,
  TestAnswerResponse,
  Topic,
} from "./types/api";

type NavView = "HOME" | "TOPICS" | "LIBRARY" | "QUIZ" | "TUTORIALS";

interface ChatItem {
  id: number;
  from: "bot" | "user";
  text: string;
}

const navItems: NavView[] = ["HOME", "TOPICS", "LIBRARY", "QUIZ", "TUTORIALS"];

const emptyPie: PieResponse = {
  labels: ["Weak", "Average", "Strong"],
  values: [0, 0, 0],
  percentages: [0, 0, 0],
};

const today = new Date();
const nowMonth = today.getMonth() + 1;
const nowYear = today.getFullYear();
const allowedTextExtensions = [
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".log",
  ".py",
  ".js",
  ".ts",
  ".html",
  ".css",
  ".java",
  ".sql",
  ".xml",
  ".yaml",
  ".yml",
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
];

const isSupportedUploadFile = (file: File) => {
  const lower = file.name.toLowerCase();
  const hasAllowedExtension = allowedTextExtensions.some((ext) =>
    lower.endsWith(ext),
  );
  return (
    hasAllowedExtension ||
    file.type.startsWith("text/") ||
    file.type === "application/pdf" ||
    file.type.startsWith("image/")
  );
};

function App() {
  const [token, setToken] = useState<string>("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [view, setView] = useState<NavView>("HOME");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const [topics, setTopics] = useState<Topic[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [pie, setPie] = useState<PieResponse>(emptyPie);
  const [gaps, setGaps] = useState<GapItem[]>([]);

  const [chatInput, setChatInput] = useState<string>("");
  const [chatLog, setChatLog] = useState<ChatItem[]>([
    { id: 1, from: "bot", text: "Hi, I'm your AI tutor. How can I help you?" },
  ]);

  const [noteForm, setNoteForm] = useState({ title: "", content: "" });
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState<number>(0);
  const [noteStatus, setNoteStatus] = useState<string>("");
  const [quizSource, setQuizSource] = useState<{
    type: "note" | "topic";
    id: number | "";
  }>({
    type: "note",
    id: "",
  });
  const [currentQuestion, setCurrentQuestion] =
    useState<QuestionPayload | null>(null);
  const [quizSessionId, setQuizSessionId] = useState<number | null>(null);
  const [quizMessage, setQuizMessage] = useState<string>(
    "Start a test from your note or a topic.",
  );
  const [quizResult, setQuizResult] = useState<{
    score: number;
    correct: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser) as AuthUser);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    const fetchAll = async () => {
      setLoading(true);
      setError("");
      try {
        const [topicsData, notesData, activityData, pieData, gapsData] =
          await Promise.all([
            api.getTopics(),
            api.getNotes(token),
            api.getActivity(token, nowMonth, nowYear),
            api.getQuizPie(token),
            api.getGaps(token),
          ]);

        setTopics(topicsData);
        setNotes(notesData);
        setActivity(activityData);
        setPie(pieData);
        setGaps(gapsData.gaps ?? []);
      } catch (err) {
        if (err instanceof ApiError && [401, 403, 422].includes(err.status)) {
          setToken("");
          setUser(null);
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setError("Session expired. Please login again.");
          return;
        }

        setError(
          err instanceof Error ? err.message : "Could not fetch dashboard data",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAll().catch(() => {
      setError("Failed to initialize dashboard");
    });
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const sendHeartbeat = async () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        await api.sendHeartbeat(token);
      } catch {
        // Ignore heartbeat failures so UI is not interrupted.
      }
    };

    sendHeartbeat().catch(() => {
      // Ignore startup heartbeat failure.
    });

    intervalId = setInterval(() => {
      sendHeartbeat().catch(() => {
        // Ignore periodic heartbeat failure.
      });
    }, 60_000);

    const onVisible = () => {
      sendHeartbeat().catch(() => {
        // Ignore visibility-trigger heartbeat failure.
      });
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token]);

  const pieGradient = useMemo(() => {
    const [weak, average, strong] = pie.percentages;
    const weakEnd = weak;
    const avgEnd = weak + average;
    const strongEnd = weak + average + strong;
    return `conic-gradient(#f26d5b 0% ${weakEnd}%, #f5d66f ${weakEnd}% ${avgEnd}%, #4bbf8a ${avgEnd}% ${strongEnd}%, #e8ebef ${strongEnd}% 100%)`;
  }, [pie.percentages]);

  const login = async (username: string, password: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.login({ username, password });
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
  ) => {
    setLoading(true);
    setError("");
    try {
      await api.register({ username, email, password, role: "Student" });
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setLoading(false);
    }
  };

  const logout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const handleSendChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !token) {
      return;
    }

    const nextId = chatLog.length + 1;
    const userText = chatInput.trim();
    setChatLog((prev) => [
      ...prev,
      { id: nextId, from: "user", text: userText },
    ]);
    setChatInput("");

    try {
      const response = await api.askChat(token, { message: userText });
      setChatLog((prev) => [
        ...prev,
        { id: nextId + 1, from: "bot", text: response.reply },
      ]);
    } catch (err) {
      setChatLog((prev) => [
        ...prev,
        {
          id: nextId + 1,
          from: "bot",
          text: err instanceof Error ? err.message : "Chat service unavailable",
        },
      ]);
    }
  };

  const saveNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Your session expired. Please login again.");
      setNoteStatus("");
      return;
    }

    if (!noteForm.title.trim()) {
      setError("Please enter a note title before uploading.");
      setNoteStatus("");
      return;
    }

    if (!noteForm.content.trim() && !noteFile) {
      setError("Please add note text or choose a file before uploading.");
      setNoteStatus("");
      return;
    }

    setLoading(true);
    setError("");
    setNoteStatus("");

    try {
      const upload = noteFile
        ? await api.uploadNoteFile(token, {
            title: noteForm.title.trim(),
            file: noteFile,
          })
        : await api.uploadNote(token, {
            title: noteForm.title.trim(),
            content: noteForm.content.trim(),
          });

      const preview = noteFile
        ? `Uploaded file: ${noteFile.name}`
        : noteForm.content.trim().slice(0, 200);
      const created = {
        id: upload.note.id,
        title: upload.note.title,
        created_at: upload.note.created_at,
        content_preview: preview,
      };

      setNotes((prev) => [created, ...prev]);
      setNoteForm({ title: "", content: "" });
      setNoteFile(null);
      setFileInputKey((prev) => prev + 1);
      setNoteStatus("Note uploaded successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note");
      setNoteStatus(
        "Upload failed. Please check backend is running and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const canUploadNote =
    Boolean(token) &&
    noteForm.title.trim().length > 0 &&
    (noteForm.content.trim().length > 0 || Boolean(noteFile)) &&
    !loading;

  const createMcq = async (noteId: number) => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await api.generateMcq(token, noteId, 10);
      setQuizMessage(
        `${res.questions_count} MCQs generated from note #${noteId}.`,
      );
      setView("QUIZ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "MCQ generation failed");
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = async () => {
    if (!token || !quizSource.id) {
      return;
    }

    setLoading(true);
    setError("");
    setQuizResult(null);

    try {
      const payload =
        quizSource.type === "note"
          ? { note_id: Number(quizSource.id), count: 10 }
          : { topic_id: Number(quizSource.id), count: 10 };
      const data = await api.startTest(token, payload);
      setQuizSessionId(data.quiz_session_id);
      setCurrentQuestion(data.current_question);
      setQuizMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quiz start failed");
    } finally {
      setLoading(false);
    }
  };

  const answerQuestion = async (selected: "A" | "B" | "C" | "D") => {
    if (!token || !quizSessionId || !currentQuestion) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response: TestAnswerResponse = await api.answerTest(token, {
        quiz_session_id: quizSessionId,
        question_id: currentQuestion.id,
        selected_option: selected,
      });

      setQuizMessage(
        [response.message, response.feedback, response.hint]
          .filter(Boolean)
          .join(" "),
      );

      if (response.next_question) {
        setCurrentQuestion(response.next_question);
      } else if (response.question) {
        setCurrentQuestion(response.question);
      } else {
        setCurrentQuestion(null);
      }

      if (response.quiz_completed) {
        setQuizResult({
          score: response.score ?? 0,
          correct: response.correct ?? 0,
          total: response.total ?? 0,
        });
        setQuizSessionId(null);

        const [activityData, pieData, gapsData] = await Promise.all([
          api.getActivity(token, nowMonth, nowYear),
          api.getQuizPie(token),
          api.getGaps(token),
        ]);

        setActivity(activityData);
        setPie(pieData);
        setGaps(gapsData.gaps ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit answer");
    } finally {
      setLoading(false);
    }
  };

  const refreshGapAnalysis = async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.analyzeGaps(token);
      const latest = await api.getGaps(token);
      setGaps(latest.gaps ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gap analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const renderCalendar = () => {
    if (!activity) {
      return null;
    }

    const byDay = new Map(activity.activity_by_day.map((d) => [d.day, d]));
    const daysInMonth = new Date(activity.year, activity.month, 0).getDate();

    const items = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const meta = byDay.get(day);
      const shade =
        meta?.shade && meta.shade !== "none"
          ? meta.shade
          : meta?.count
            ? "green"
            : "none";

      items.push(
        <div
          key={day}
          className={`cal-cell ${shade}`}
          title={
            meta
              ? `Activities: ${meta.count}, Worked minutes: ${meta.worked_minutes ?? 0}`
              : "No activity"
          }
        >
          {day}
        </div>,
      );
    }

    return <div className="calendar-grid">{items}</div>;
  };

  const renderHome = () => (
    <div className="home-stack">
      <h1 className="student-title">{user?.username ?? "Student Name"}</h1>

      <div className="cards-row">
        <article className="panel-card">
          <h3>Activity</h3>
          <ul className="simple-list">
            <li>Topics learned: {topics.length}</li>
            <li>Notes uploaded: {notes.length}</li>
            <li>Days active: {activity?.days_active ?? 0}</li>
          </ul>
        </article>

        <article className="panel-card">
          <h3>Result</h3>
          <div className="pie-wrap">
            <div className="pie" style={{ background: pieGradient }} />
            <div className="legend">
              <p>
                <span className="dot weak" /> Weak {pie.percentages[0]}%
              </p>
              <p>
                <span className="dot average" /> Average {pie.percentages[1]}%
              </p>
              <p>
                <span className="dot strong" /> Strong {pie.percentages[2]}%
              </p>
            </div>
          </div>
        </article>
      </div>

      <article className="panel-card">
        <div className="calendar-head">
          <h3>Days active: {activity?.days_active ?? 0}</h3>
          <p>
            {new Date(nowYear, nowMonth - 1).toLocaleString("en-US", {
              month: "long",
            })}{" "}
            {nowYear}
          </p>
        </div>
        {renderCalendar()}
        <div className="calendar-legend">
          <span>
            <i className="legend-dot green" /> Login / Active
          </span>
          <span>
            <i className="legend-dot light_green" /> 1 hour
          </span>
          <span>
            <i className="legend-dot dark_green" /> More than 1 hour
          </span>
        </div>
      </article>
    </div>
  );

  const renderTopics = () => (
    <div className="section-stack">
      <div className="section-head">
        <h2>Topics</h2>
        <button
          className="btn btn-alt"
          onClick={refreshGapAnalysis}
          type="button"
        >
          Analyze Gaps
        </button>
      </div>

      <div className="panel-card">
        {topics.length === 0 ? (
          <p>No topics yet.</p>
        ) : (
          topics.map((t) => (
            <p key={t.id}>
              • {t.name} - {t.description || "No description"}
            </p>
          ))
        )}
      </div>

      <div className="panel-card">
        <h3>Knowledge Gaps</h3>
        {gaps.length === 0 ? (
          <p>No gaps yet. Keep taking tests.</p>
        ) : (
          gaps.map((g) => (
            <p key={`${g.topic_id}-${g.created_at}`}>
              • {g.topic_name}: score {g.gap_score.toFixed(2)}.{" "}
              {g.suggested_revision}
            </p>
          ))
        )}
      </div>
    </div>
  );

  const renderLibrary = () => (
    <div className="section-stack">
      <h2>Library</h2>
      <form className="note-form panel-card" onSubmit={saveNote}>
        <input
          type="text"
          placeholder="Note title"
          required
          value={noteForm.title}
          onChange={(e) => {
            setNoteStatus("");
            setNoteForm((p) => ({ ...p, title: e.target.value }));
          }}
        />
        <textarea
          rows={6}
          placeholder="Paste your study note text here (optional if file selected)"
          value={noteForm.content}
          onChange={(e) => {
            setNoteStatus("");
            setNoteForm((p) => ({ ...p, content: e.target.value }));
          }}
        />
        <div className="file-row">
          <label htmlFor="note-file">Upload text file</label>
          <input
            key={fileInputKey}
            id="note-file"
            type="file"
            accept="*/*"
            onChange={(e) => {
              setNoteStatus("");
              const chosen = e.target.files?.[0] ?? null;
              if (!chosen) {
                setNoteFile(null);
                return;
              }

              if (!isSupportedUploadFile(chosen)) {
                setNoteFile(null);
                setError(
                  "Supported files: txt, md, csv, json, code files, pdf, jpg, jpeg, png.",
                );
                return;
              }

              setError("");
              setNoteFile(chosen);
            }}
          />
          <p className="file-help">
            You can select files (not folders). Supported: text/code files, PDF,
            JPG, JPEG, PNG.
          </p>
          {noteFile && <p className="file-name">Selected: {noteFile.name}</p>}
        </div>
        <button className="btn" type="submit" disabled={!canUploadNote}>
          Upload Note
        </button>
        {noteStatus && <p>{noteStatus}</p>}
      </form>

      <div className="panel-card">
        <h3>My Notes</h3>
        {notes.length === 0 && <p>No notes uploaded.</p>}
        {notes.map((n) => (
          <div key={n.id} className="note-item">
            <div>
              <strong>{n.title}</strong>
              <p>{n.content_preview}</p>
            </div>
            <button
              className="btn btn-alt"
              type="button"
              onClick={() => createMcq(n.id)}
            >
              Generate MCQ
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderQuiz = () => (
    <div className="section-stack">
      <h2>Quiz</h2>
      <div className="panel-card quiz-start">
        <div className="inline-row">
          <select
            value={quizSource.type}
            onChange={(e) =>
              setQuizSource({
                type: e.target.value as "note" | "topic",
                id: "",
              })
            }
          >
            <option value="note">From Note</option>
            <option value="topic">From Topic</option>
          </select>

          <select
            value={quizSource.id}
            onChange={(e) =>
              setQuizSource((p) => ({
                ...p,
                id: e.target.value ? Number(e.target.value) : "",
              }))
            }
          >
            <option value="">Select source</option>
            {(quizSource.type === "note" ? notes : topics).map((item) => (
              <option key={item.id} value={item.id}>
                {"title" in item ? item.title : item.name}
              </option>
            ))}
          </select>

          <button className="btn" type="button" onClick={startQuiz}>
            Start Test
          </button>
        </div>
      </div>

      <div className="panel-card">
        <p>{quizMessage}</p>
        {currentQuestion && (
          <div className="question-box">
            <h3>{currentQuestion.question_text}</h3>
            <div className="option-grid">
              {(
                Object.keys(currentQuestion.options) as Array<
                  "A" | "B" | "C" | "D"
                >
              ).map((key) => (
                <button
                  key={key}
                  className="option-btn"
                  type="button"
                  onClick={() => answerQuestion(key)}
                >
                  {key}. {currentQuestion.options[key]}
                </button>
              ))}
            </div>
          </div>
        )}

        {quizResult && (
          <div className="result-box">
            <h3>Quiz Complete</h3>
            <p>Score: {(quizResult.score * 100).toFixed(2)}%</p>
            <p>
              Correct: {quizResult.correct}/{quizResult.total}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderTutorials = () => (
    <div className="section-stack">
      <h2>Tutorials</h2>
      <div className="panel-card">
        <p>Use your weak-topic list to plan tutorials for revision.</p>
        {gaps.length === 0 && <p>No weak topics available yet.</p>}
        {gaps.map((g) => (
          <div
            key={`tutorial-${g.topic_id}-${g.created_at}`}
            className="tutorial-item"
          >
            <strong>{g.topic_name}</strong>
            <p>{g.suggested_revision}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderView = () => {
    switch (view) {
      case "TOPICS":
        return renderTopics();
      case "LIBRARY":
        return renderLibrary();
      case "QUIZ":
        return renderQuiz();
      case "TUTORIALS":
        return renderTutorials();
      case "HOME":
      default:
        return renderHome();
    }
  };

  if (!user || !token) {
    return (
      <AuthPage
        loading={loading}
        error={error}
        onLogin={login}
        onRegister={register}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="left-rail">
        <div className="logo-box">Logo</div>
        <button className="menu-button" type="button">
          Menu
        </button>
        {navItems.map((item) => (
          <button
            key={item}
            className={`rail-link ${view === item ? "active" : ""}`}
            type="button"
            onClick={() => setView(item)}
          >
            {item}
          </button>
        ))}
        <button className="settings-link" type="button" onClick={logout}>
          Logout
        </button>
      </aside>

      <main className="main-board">
        {loading && <div className="state-banner">Loading...</div>}
        {error && <div className="state-banner error">{error}</div>}

        <section className="content-grid">
          <div className="content-area">{renderView()}</div>

          <aside className="chat-area">
            <h3>AI Chat Tutor</h3>
            <div className="chat-stream">
              {chatLog.map((msg) => (
                <div key={msg.id} className={`chat-msg ${msg.from}`}>
                  {msg.text}
                </div>
              ))}
            </div>

            <form className="chat-form" onSubmit={handleSendChat}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type your message"
                type="text"
              />
              <button className="btn" type="submit">
                Send
              </button>
            </form>

            <div className="chat-badge">AI</div>
          </aside>
        </section>
      </main>
    </div>
  );
}

interface AuthProps {
  loading: boolean;
  error: string;
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (
    username: string,
    email: string,
    password: string,
  ) => Promise<void>;
}

function AuthPage({ loading, error, onLogin, onRegister }: AuthProps) {
  const [isSignup, setIsSignup] = useState<boolean>(true);
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirm, setConfirm] = useState<string>("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      return;
    }

    if (isSignup) {
      if (!email.trim() || password !== confirm) {
        return;
      }
      await onRegister(username.trim(), email.trim(), password.trim());
      return;
    }

    await onLogin(username.trim(), password.trim());
  };

  return (
    <div className="auth-shell">
      <section className="auth-art">
        <div className="orb">LOAD</div>
        <div className="line" />
        <div className="line" />
        <div className="line" />
        <div className="line" />
      </section>

      <section className="auth-form-wrap">
        <h1>Welcome To</h1>
        <h2>{isSignup ? "Sign Up" : "Sign In"}</h2>

        <form className="auth-form" onSubmit={submit}>
          {isSignup && (
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {isSignup && (
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}

          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Please wait..." : isSignup ? "Create Account" : "Login"}
          </button>
        </form>

        <p className="switch-row">
          {isSignup ? "Already have an account?" : "Need an account?"}
          <button
            className="text-btn"
            type="button"
            onClick={() => setIsSignup((p) => !p)}
          >
            {isSignup ? "Sign In" : "Sign Up"}
          </button>
        </p>

        {error && <p className="auth-error">{error}</p>}
      </section>
    </div>
  );
}

export default App;

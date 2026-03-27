import React, { useMemo, useState } from 'react';
import { Trophy, AlertOctagon, Clock3, FileText, Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { getUserReports } from '../utils/reportStorage';

export default function ReportContent() {
  const [selectedId, setSelectedId] = useState(null);

  const handleDownloadPDF = () => {
    if (!selectedReport) return;
    const element = document.getElementById('report-print-area');
    const opt = {
      margin:       0.5,
      filename:     `Bodha_Report_${selectedReport.mode}_${new Date().toISOString().split('T')[0]}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const reports = useMemo(() => getUserReports(), []);
  const selectedReport = useMemo(() => {
    if (!reports.length) {
      return null;
    }
    if (!selectedId) {
      return reports[0];
    }
    return reports.find((r) => r.id === selectedId) || reports[0];
  }, [reports, selectedId]);

  const stats = useMemo(() => {
    if (!reports.length) {
      return {
        quizzesTaken: 0,
        avgScore: 0,
        bestScore: 0,
      };
    }

    const totalScore = reports.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
    const bestScore = reports.reduce((max, r) => Math.max(max, Number(r.score) || 0), 0);

    return {
      quizzesTaken: reports.length,
      avgScore: Math.round(totalScore / reports.length),
      bestScore,
    };
  }, [reports]);

  const needsAttention = useMemo(() => {
    const map = new Map();
    reports.forEach((r) => {
      (r.weakAreas || []).forEach((area) => {
        if (!map.has(area.name)) {
          map.set(area.name, []);
        }
        map.get(area.name).push(area.score);
      });
    });

    return Array.from(map.entries())
      .map(([name, scores]) => ({
        name,
        score: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);
  }, [reports]);

  return (
    <div className="center-content">
      <h1 className="student-name brutalist-font">Full Report</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
        <div className="card">
          <h2 className="card-title brutalist-font"><Trophy size={20} style={{marginRight: '0.5rem'}}/> Performance</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontFamily: 'Space Grotesk', fontWeight: 'bold' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid black', paddingBottom: '0.5rem' }}>
              <span>Quizzes Taken</span>
              <span>{stats.quizzesTaken}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid black', paddingBottom: '0.5rem' }}>
              <span>Average Score</span>
              <span style={{ color: 'var(--accent-green)' }}>{stats.avgScore}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid black', paddingBottom: '0.5rem' }}>
              <span>Best Score</span>
              <span>{stats.bestScore}%</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ background: '#f8fafc' }}>
          <h2 className="card-title brutalist-font" style={{ background: 'var(--accent-red)', color: 'white' }}><AlertOctagon size={20} style={{marginRight: '0.5rem'}}/> Needs Attention</h2>
          {needsAttention.length === 0 ? (
            <p style={{ fontFamily: 'Inter', fontWeight: 700 }}>No weak-area data yet. Complete at least one quiz to generate report insights.</p>
          ) : (
            <ul style={{ listStyle: 'none', fontFamily: 'Inter', fontWeight: '600', padding: 0, margin: 0 }}>
              {needsAttention.map((item) => (
                <li key={item.name} style={{ padding: '0.5rem', borderLeft: '4px solid var(--accent-red)', marginBottom: '1rem' }}>
                  {item.name} ({item.score}%)
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2 className="card-title brutalist-font"><Clock3 size={20} style={{marginRight: '0.5rem'}}/> Previous Reports</h2>
        {reports.length === 0 ? (
          <p style={{ fontFamily: 'Inter', fontWeight: 700 }}>
            No reports found for this account. Once a quiz is submitted, reports will appear here and remain available on next login.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
            <div style={{ maxHeight: '420px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {reports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setSelectedId(report.id)}
                  className="card"
                  style={{
                    textAlign: 'left',
                    borderLeft: report.id === selectedReport?.id ? '8px solid var(--accent-blue)' : '4px solid black',
                    background: report.id === selectedReport?.id ? '#eff6ff' : 'white',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontFamily: 'Inter', fontWeight: 800 }}>{report.mode}</div>
                  <div style={{ fontFamily: 'Inter', fontSize: '0.9rem' }}>{report.sourceLabel}</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, marginTop: '0.35rem' }}>
                    Score: {report.score}%
                  </div>
                  <div style={{ fontFamily: 'Inter', fontSize: '0.8rem', marginTop: '0.25rem', color: '#4b5563' }}>
                    {new Date(report.createdAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>

            {selectedReport && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card" id="report-print-area" style={{ borderLeft: '6px solid var(--accent-green)', padding: '1.5rem', background: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid black', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <h3 className="brutalist-font" style={{ marginTop: 0, fontSize: '1.75rem', color: 'var(--text-dark)', lineHeight: '1.1' }}>{selectedReport.mode}</h3>
                      <p style={{ fontFamily: 'Inter', fontWeight: 700, margin: 0, color: 'var(--text-light)', fontSize: '0.9rem' }}>{selectedReport.sourceLabel}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="brutalist-font" style={{ fontSize: '2.5rem', color: selectedReport.score > 70 ? 'var(--accent-green)' : 'var(--accent-red)', lineHeight: 0.9 }}>
                        {selectedReport.score}%
                      </div>
                      <p style={{ fontFamily: 'Inter', fontWeight: 800, margin: '0.25rem 0 0 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.8rem' }}>Accuracy</p>
                    </div>
                  </div>

                  <p style={{ fontFamily: 'Inter', fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.5, background: '#f8fafc', padding: '1rem', border: '2px solid black', borderRadius: '4px' }}>
                    {selectedReport.aiSummary || `You answered ${selectedReport.correct} out of ${selectedReport.total} questions correctly.`}
                  </p>

                  {Array.isArray(selectedReport.weaknessInsights) && selectedReport.weaknessInsights.length > 0 && (
                    <div style={{ marginTop: '1rem', border: '2px solid black', padding: '0.9rem', background: '#fff7ed' }}>
                      <h4 className="brutalist-font" style={{ margin: 0, marginBottom: '0.6rem', fontSize: '1rem' }}>AI WEAKNESS ANALYSIS</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {selectedReport.weaknessInsights.map((item) => (
                          <div key={`${selectedReport.id}-${item.area}`} style={{ borderLeft: '4px solid var(--accent-red)', paddingLeft: '0.5rem' }}>
                            <div style={{ fontFamily: 'Inter', fontWeight: 800, fontSize: '0.9rem' }}>{item.area}</div>
                            <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: '0.82rem' }}>{item.reason}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(selectedReport.resources) && selectedReport.resources.length > 0 && (
                    <div style={{ marginTop: '1rem', border: '2px solid black', padding: '0.9rem', background: '#eff6ff' }}>
                      <h4 className="brutalist-font" style={{ margin: 0, marginBottom: '0.6rem', fontSize: '1rem' }}>AI SUGGESTED RESOURCES</h4>
                      <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                        {selectedReport.resources.map((item) => (
                          <li key={`${selectedReport.id}-${item.area}-res`} style={{ marginBottom: '0.55rem' }}>
                            <a href={item.link} target="_blank" rel="noreferrer" style={{ fontFamily: 'Inter', fontWeight: 700 }}>
                              {item.title || `${item.area} learning resource`}
                            </a>
                            {item.why && (
                              <div style={{ fontFamily: 'Inter', fontSize: '0.82rem', fontWeight: 600, marginTop: '0.2rem' }}>
                                {item.why}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(selectedReport.questionReview) && selectedReport.questionReview.length > 0 && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <h4 className="brutalist-font" style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '2px solid black', paddingBottom: '0.25rem' }}>
                        <FileText size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                        DIAGNOSTIC BREAKDOWN
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {selectedReport.questionReview.map((q, idx) => (
                          <div key={`${selectedReport.id}-q-${idx}`} style={{ border: '2px solid black', padding: '0.75rem', background: q.isCorrect ? '#f0fdf4' : '#fef2f2', borderRadius: '4px' }}>
                            <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-dark)' }}>Q{idx + 1}. {q.questionText}</div>
                            <div style={{ fontFamily: 'Inter', fontSize: '0.8rem', marginTop: '0.25rem', fontWeight: 700, color: q.isCorrect ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                              {q.isCorrect ? '✓ Correct Answer' : '✗ Logic Gap Detected'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <button onClick={handleDownloadPDF} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', width: '100%', padding: '1rem', fontSize: '1rem', background: 'var(--text-dark)', color: 'white', border: '3px solid black' }}>
                  <Download size={20} /> DOWNLOAD TO DEVICE
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

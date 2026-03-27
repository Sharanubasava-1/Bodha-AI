import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Download, Trash2, CheckCircle, Loader2, BookOpen, X, Maximize2, Minimize2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const STORAGE_KEY = 'bodha_library_docs';

const hashText = (text) => {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i);
  }
  return `pdf-${Math.abs(hash)}`;
};

const extractPdfText = async (file) => {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str || '').join(' ').replace(/\s+/g, ' ').trim();
    if (text) {
      pages.push(text);
    }
  }

  return pages.join('\n');
};

export default function LibraryContent() {
  const [files, setFiles] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [newLabel, setNewLabel] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null); // Document Viewer State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerContainerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  }, [files]);

  const handleUpload = async (e) => {
    e.preventDefault();
    const fileInput = e.target.querySelector('input[type="file"]');
    const selectedFile = fileInput?.files[0];

    if (newLabel.trim() && selectedFile) {
      setIsUploading(true);

      try {
        const fileUrl = URL.createObjectURL(selectedFile);
        const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
        let extractedText = '';
        let docKey = '';

        if (isPdf) {
          extractedText = await extractPdfText(selectedFile);
          docKey = hashText(`${selectedFile.name}::${extractedText.slice(0, 2000)}`);
        }

        const newFile = {
          id: Date.now(),
          label: newLabel,
          filename: selectedFile.name,
          date: new Date().toISOString().split('T')[0],
          url: fileUrl,
          syncedForQuiz: isPdf && extractedText.length >= 200,
          extractedText: isPdf ? extractedText : '',
          docKey: isPdf ? docKey : '',
        };

        setFiles([newFile, ...files]);
        setNewLabel('');
        fileInput.value = '';
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const deleteFile = (id) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const toggleFullscreen = async () => {
    const container = viewerContainerRef.current;
    if (!container) {
      return;
    }

    if (!document.fullscreenElement) {
      await container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  return (
    <div className="center-content relative">
      <h1 className="student-name brutalist-font" style={{ color: 'var(--accent-green)' }}>Library</h1>
      
      {/* DOCUMENT VIEWER MODAL */}
      {viewingDoc && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', zIndex: 3000,
          display: 'flex', flexDirection: 'column', padding: isFullscreen ? '0' : '1rem'
        }}>
          <div
            ref={viewerContainerRef}
            style={{
              background: 'white',
              border: isFullscreen ? 'none' : '2px solid black',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: isFullscreen ? 'none' : '8px 8px 0px 0px black'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '2px solid #e5e7eb', background: '#ffffff' }}>
              <h2 className="brutalist-font" style={{ fontSize: '1.3rem', margin: 0, color: '#111827' }}>{viewingDoc.label}</h2>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button onClick={toggleFullscreen} className="btn-primary" style={{ padding: '0.5rem 0.8rem', background: '#111827' }}>
                  {isFullscreen ? <><Minimize2 size={18} /> EXIT FULL SCREEN</> : <><Maximize2 size={18} /> FULL SCREEN</>}
                </button>
                <button onClick={() => setViewingDoc(null)} className="btn-primary" style={{ padding: '0.5rem 0.8rem', background: 'var(--accent-red)' }}>
                  CLOSE <X size={18} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, padding: isFullscreen ? '0' : '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', overflow: 'hidden' }}>
              {viewingDoc.url ? (
                <iframe src={viewingDoc.url} style={{ width: '100%', height: '100%', border: '1px solid #d1d5db', background: '#fff' }} title="Document Viewer" allowFullScreen />
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <FileText size={100} style={{ opacity: 0.2 }} />
                  <h3 className="brutalist-font" style={{ fontSize: '2rem', marginTop: '1rem' }}>MOCK DOCUMENT</h3>
                  <p style={{ fontFamily: 'Inter', fontSize: '1.2rem', color: '#666' }}>Upload a real PDF to view its contents interactively here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD FORM */}
      <div className="card" style={{ marginBottom: '3rem', background: '#f8fafc' }}>
        <h2 className="brutalist-font" style={{ fontSize:'1.75rem', marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <Upload size={32} /> 
          Upload Document
        </h2>
        
        <form onSubmit={handleUpload} style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems:'flex-end' }}>
          <div style={{ flex: '1 1 250px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight:'800', fontFamily:'Barlow Semi Condensed', fontStyle: 'italic', fontSize: '1.1rem' }}>LABEL / TITLE</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Advanced Java Structures..."
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              required
              disabled={isUploading}
            />
          </div>
          <div style={{ flex: '1 1 250px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight:'800', fontFamily:'Barlow Semi Condensed', fontStyle: 'italic', fontSize: '1.1rem' }}>FILE (PDF/DOCX)</label>
            <input 
              type="file" 
              className="form-input" 
              accept=".pdf,.doc,.docx"
              style={{ padding: '0.65rem' }}
              required
              disabled={isUploading}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ height: '54px', flex: '1 1 200px', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            {isUploading ? <><Loader2 className="animate-spin" /> UPLOADING</> : 'UPLOAD'}
          </button>
        </form>

        {uploadSuccess && (
          <div style={{ marginTop: '1rem', color: 'var(--accent-green)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={18} /> File uploaded & indexed successfully!
          </div>
        )}
      </div>

      {/* DOCUMENT LIST */}
      <h2 className="brutalist-font" style={{ fontSize:'2.5rem', marginBottom:'1.5rem' }}>Your Vault</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {files.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
            <p className="brutalist-font" style={{ fontSize: '1.5rem' }}>Your vault is empty. Upload your first document!</p>
          </div>
        ) : (
          files.map(file => (
            <div key={file.id} className="card library-item" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.5rem 2.5rem', borderLeft: '10px solid black', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div className="library-item-left" style={{ display:'flex', alignItems:'center', gap:'2rem', flexWrap: 'wrap' }}>
                <FileText size={48} color="black" />
                <div>
                  <h3 className="brutalist-font" style={{ fontSize:'1.5rem', margin:0, fontStyle: 'italic' }}>{file.label}</h3>
                  <p style={{ fontSize:'0.9rem', color:'#666', fontFamily:'Space Grotesk', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    {file.filename} • <span style={{ color: 'var(--accent-blue)' }}>INDEXED ON {file.date}</span>
                  </p>
                  <p style={{ margin: '0.3rem 0 0 0', fontFamily: 'Inter', fontWeight: 700, color: file.syncedForQuiz ? '#166534' : '#b45309' }}>
                    {file.syncedForQuiz ? 'Synced to Quiz section' : 'Not synced for Quiz (upload readable PDF)'}
                  </p>
                </div>
              </div>
              <div className="library-item-right" style={{ display:'flex', gap:'1rem', flexWrap: 'wrap' }}>
                {/* STUDY BUTTON */}
                <button 
                  onClick={() => setViewingDoc(file)}
                  className="btn-primary" 
                  style={{ padding:'0.75rem 1.5rem', width:'auto', background:'var(--accent-yellow)', color:'black', border:'3px solid black', display: 'flex', gap: '0.5rem' }}
                >
                  STUDY NOW <BookOpen size={20} />
                </button>
                <button className="btn-primary" style={{ padding:'0.75rem', width:'auto', background:'white', color:'black', border:'3px solid black' }}>
                  <Download size={20} />
                </button>
                <button 
                  onClick={() => deleteFile(file.id)}
                  className="btn-primary" 
                  style={{ padding:'0.75rem', width:'auto', background:'var(--accent-red)', border:'3px solid black' }}
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

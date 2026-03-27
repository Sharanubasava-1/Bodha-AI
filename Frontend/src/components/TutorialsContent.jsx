import React, { useState, useEffect, useRef } from 'react';
import { MonitorPlay, Clock, Trash2, TrendingUp, X, Search, Loader2 } from 'lucide-react';
import YouTube from 'react-youtube';
import { searchVideos } from '../utils/youtubeApi';

// Official Curated Course List (Provided by User)
const COURSE_LIBRARY = [
  { id: 'eIrMbAQSU34', title: 'Java Full Course for Beginners', channel: 'Programming with Mosh', duration: '12:00:00', tags: ['Java'], views: '5M', thumbnail: 'https://img.youtube.com/vi/eIrMbAQSU34/maxresdefault.jpg' },
  { id: 'UrsmFxEIp5k', title: 'Python Tutorial for Beginners', channel: 'Code with Harry', duration: '6:14:07', tags: ['Python'], views: '42M', thumbnail: 'https://img.youtube.com/vi/UrsmFxEIp5k/maxresdefault.jpg' },
  { id: 'vLnPwxZdW4Y', title: 'C++ Full Course for Beginners', channel: 'FreeCodeCamp', duration: '4:00:00', tags: ['C++'], views: '8M', thumbnail: 'https://img.youtube.com/vi/vLnPwxZdW4Y/maxresdefault.jpg' },
  { id: 'hlGoQC332VM', title: 'SQL Full Course for Beginners', channel: 'Programming with Mosh', duration: '4:20:00', tags: ['SQL'], views: '15M', thumbnail: 'https://img.youtube.com/vi/hlGoQC332VM/maxresdefault.jpg' },
  { id: 'Ez8F0nW6S-w', title: 'Docker Tutorial for Beginners', channel: 'Programming with Mosh', duration: '2:10:00', tags: ['Docker'], views: '3M', thumbnail: 'https://img.youtube.com/vi/Ez8F0nW6S-w/maxresdefault.jpg' },
  { id: 'pg19Z8LL06w', title: 'Git & GitHub Full Course', channel: 'Amigoscode', duration: '1:30:00', tags: ['Git'], views: '2M', thumbnail: 'https://img.youtube.com/vi/pg19Z8LL06w/maxresdefault.jpg' },
  { id: 'EerdGm-ehJQ', title: 'JavaScript Full Course', channel: 'SuperSimpleDev', duration: '11:57:00', tags: ['JavaScript'], views: '12M', thumbnail: 'https://img.youtube.com/vi/EerdGm-ehJQ/maxresdefault.jpg' },
  { id: 'k1RI5locZE4', title: 'AWS Cloud Practitioner Full Course', channel: 'FreeCodeCamp', duration: '14:00:00', tags: ['AWS'], views: '4M', thumbnail: 'https://img.youtube.com/vi/k1RI5locZE4/maxresdefault.jpg' },
];

export default function TutorialsContent() {
  const [recommended, setRecommended] = useState(COURSE_LIBRARY);
  const [recent, setRecent] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const playerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const USER_ID = 'guest'; 

  useEffect(() => {
    const savedRecent = localStorage.getItem(`recently_viewed_videos_${USER_ID}`);
    if (savedRecent) setRecent(JSON.parse(savedRecent));
    
    const savedSelected = localStorage.getItem(`yt_recent_video_${USER_ID}`);
    if (savedSelected) setSelectedVideo(JSON.parse(savedSelected));
  }, []);

  const formatVideos = (data) => {
    return data.map(v => ({
      id: v.id, title: v.title, channel: v.channel, duration: v.duration,
      tags: ['Tutorial'], views: v.views || '1M', thumbnail: v.thumbnail
    }));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setRecommended(COURSE_LIBRARY);
      return;
    }
    setIsSearching(true);
    try {
      const ytMatch = searchQuery.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i);
      if (ytMatch && ytMatch[1]) {
        handleVideoSelect({ id: ytMatch[1], title: 'Linked Video', channel: 'External', duration: '0:00', thumbnail: `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg` });
      } else {
        const data = await searchVideos(searchQuery);
        if (data && data.length > 0) setRecommended(formatVideos(data));
      }
    } catch {
      setRecommended(COURSE_LIBRARY.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase())));
    } finally {
      setIsSearching(false);
    }
  };

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    localStorage.setItem(`yt_recent_video_${USER_ID}`, JSON.stringify(video));
    setRecent(prev => {
      const filtered = prev.filter(v => v.id !== video.id);
      const nextRecent = [video, ...filtered].slice(0, 10);
      localStorage.setItem(`recently_viewed_videos_${USER_ID}`, JSON.stringify(nextRecent));
      return nextRecent;
    });
  };

  const handleStateChange = (event) => {
    if (event.data === 1 && selectedVideo) {
      progressIntervalRef.current = setInterval(() => {
        if (playerRef.current) {
          const time = playerRef.current.getCurrentTime();
          localStorage.setItem(`yt_progress_${USER_ID}_${selectedVideo.id}`, time.toString());
        }
      }, 5000);
    } else if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  };

  return (
    <div className="center-content" style={{ padding: '3rem 4rem' }}>
      <h1 className="student-name brutalist-font" style={{ color: 'var(--accent-red)' }}>Tutorial Hub</h1>

      <form onSubmit={handleSearch} style={{ maxWidth: '100%', marginBottom: '4rem', position: 'relative' }}>
        <input 
          type="text" 
          className="form-input brutalist-font"
          style={{ width: '100%', height: '5rem', padding: '0 4rem', fontSize: '1.5rem', border: '4px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-dark)', boxShadow: '8px 8px 0px 0px rgba(0,0,0,0.5)' }}
          placeholder="Search topics or paste Youtube URL..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="submit" className="btn-primary" style={{ position: 'absolute', right: '10px', top: '10px', height: 'calc(5rem - 20px)', width: '120px' }}>
          {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
        </button>
      </form>

      {selectedVideo && (
        <div className="card" style={{ marginBottom: '4rem', padding: '1.5rem', background: '#000', position: 'relative', border: '5px solid var(--border-color)', boxShadow: '15px 15px 0px 0px var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 className="brutalist-font" style={{ color: 'white', fontSize: '1.75rem', margin: 0 }}>{selectedVideo.title}</h2>
            <button onClick={() => setSelectedVideo(null)} style={{ background: 'var(--accent-red)', border: '2px solid white', color: 'white', cursor: 'pointer', padding: '0.5rem' }}>
              <X size={24} />
            </button>
          </div>
          <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', border: '2px solid white' }}>
            <YouTube
                videoId={selectedVideo.id}
                opts={{ width: '100%', height: '100%', playerVars: { autoplay: 0, rel: 0, modestbranding: 1 } }}
                onReady={(e) => {
                    playerRef.current = e.target;
                    const savedTime = localStorage.getItem(`yt_progress_${USER_ID}_${selectedVideo.id}`);
                    if (savedTime) e.target.seekTo(parseFloat(savedTime));
                }}
                onStateChange={handleStateChange}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            />
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div style={{ marginBottom: '4rem' }}>
          <h2 className="section-title brutalist-font" style={{ fontSize: '2.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-dark)' }}>
            <Clock size={36} color="var(--accent-blue)" strokeWidth={3} /> HISTORY
          </h2>
          <div style={{ display: 'flex', gap: '2rem', overflowX: 'auto', paddingBottom: '2rem' }}>
            {recent.map((vid) => (
              <div key={vid.id} onClick={() => handleVideoSelect(vid)} className="card" style={{ cursor: 'pointer', padding: 0, overflow: 'hidden', minWidth: '350px', border: '4px solid var(--border-color)' }}>
                <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderBottom: '4px solid var(--border-color)', background: 'black' }}>
                  <img src={vid.thumbnail} alt={vid.title} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={(e) => { e.stopPropagation(); setRecent(recent.filter(r => r.id !== vid.id)); }} style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'var(--accent-red)', color: 'white', border: '3px solid black', padding: '0.5rem' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <div style={{ padding: '1.25rem' }}>
                  <h3 className="brutalist-font" style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-dark)' }}>{vid.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="section-title brutalist-font" style={{ fontSize: '3rem', marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-dark)' }}>
          <TrendingUp size={48} color="var(--accent-green)" strokeWidth={3} /> RECOMMENDED
        </h2>
        <div className="tut-cards-grid">
          {recommended.map((vid, idx) => (
            <div key={idx} onClick={() => handleVideoSelect(vid)} className="card" style={{ cursor: 'pointer', padding: 0, overflow: 'hidden', border: '5px solid var(--border-color)', boxShadow: 'var(--box-shadow)' }}>
              <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderBottom: '5px solid var(--border-color)' }}>
                <img src={vid.thumbnail} alt={vid.title} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'var(--accent-yellow)', color: 'black', padding: '0.5rem 1rem', border: '3px solid black', fontFamily: 'Barlow Semi Condensed', fontWeight: '900' }}>
                  {(vid.tags && vid.tags[0]) || 'COURSE'}
                </div>
                <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', background: 'black', color: 'white', padding: '0.5rem', fontSize: '0.8rem' }}>{vid.duration}</div>
              </div>
              <div style={{ padding: '2rem' }}>
                <h3 className="brutalist-font" style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-dark)' }}>{vid.title}</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid rgba(0,0,0,0.1)', paddingTop: '1rem' }}>
                  <span style={{ fontWeight: '800', color: 'var(--accent-blue)' }}>{vid.channel}</span>
                  <span style={{ fontWeight: '800', color: 'var(--text-dark)' }}>{vid.views} VIEWS</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

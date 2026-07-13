import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, setDoc, deleteDoc, doc, orderBy, limit } from 'firebase/firestore';
import { UserPreferences } from '../../types';
import { 
  Gamepad2, Volume2, VolumeX, Award, ArrowLeft, RotateCcw, Play, Pause, 
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Check, CircleAlert, HelpCircle,
  Flame, Sparkles, Target, Zap, Trophy, ShieldAlert, Plus, Edit2, Trash2, Settings, Shield
} from 'lucide-react';

interface GamesAppProps {
  userId: string;
  preferences: UserPreferences;
}

interface HighScore {
  id?: string;
  gameId: string;
  userName: string;
  score: number;
  date: number;
}

type GameType = 'snake' | 'space' | 'breaker' | 'mines' | '2048';

// Sound Synth Engine utilizing Web Audio API for zero-asset retro beep boops
const playSound = (type: 'shoot' | 'explosion' | 'coin' | 'powerup' | 'gameover' | 'click', enabled: boolean) => {
  if (!enabled) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'shoot') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(130.81, ctx.currentTime + 0.12); // C3
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } else if (type === 'explosion') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.46);
    } else if (type === 'coin') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.setValueAtTime(987.77, ctx.currentTime + 0.08); // B5
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.23);
    } else if (type === 'powerup') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(329.63, ctx.currentTime); // E4
      osc.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + 0.3); // E6
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.31);
    } else if (type === 'gameover') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(55, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.61);
    } else if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    }
  } catch (err) {
    // Cross-origin audio security fallback
  }
};

export default function GamesApp({ userId, preferences }: GamesAppProps) {
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [leaderboard, setLeaderboard] = useState<HighScore[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);
  const [userHighScores, setUserHighScores] = useState<Record<string, number>>({});

  // Firestore Custom Games state
  const [customGames, setCustomGames] = useState<any[]>([]);
  const [gameList, setGameList] = useState<any[]>([]);

  // Admin controls
  const isAdmin = preferences.isAdmin === true || userId === 'quaver-admin-id' || preferences.userName === 'Quaver' || preferences.userName === 'quaver';
  const [adminTab, setAdminTab] = useState<'lobby' | 'admin'>('lobby');

  // Admin Form states
  const [formGameId, setFormGameId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formIcon, setFormIcon] = useState('👾');
  const [formBg, setFormBg] = useState('from-indigo-500/10 to-violet-500/5');
  const [formColor, setFormColor] = useState('text-indigo-400');
  const [formHtml, setFormHtml] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');

  const defaultGames = [
    { id: 'snake', title: 'Retro Snake', desc: 'Slick neon-grid snake run. Speed increments on food collection.', icon: '🐍', bg: 'from-emerald-500/10 to-teal-500/5', color: 'text-emerald-400' },
    { id: 'space', title: 'Space Defender', desc: 'Arcade laser shooter. Move, blast aliens, dodge incoming fire.', icon: '🚀', bg: 'from-indigo-500/10 to-violet-500/5', color: 'text-indigo-400' },
    { id: 'breaker', title: 'Brick Breaker Pro', desc: 'Dynamic pad bounce, brick clusters, powerups, & speed increase.', icon: '🧱', bg: 'from-rose-500/10 to-orange-500/5', color: 'text-rose-400' },
    { id: '2048', title: '2048 Master', desc: 'Slide adjacent numbered cards. Reach the legendary 2048 crown.', icon: '🔢', bg: 'from-amber-500/10 to-yellow-500/5', color: 'text-amber-400' },
    { id: 'mines', title: 'Minesweeper Tactical', desc: 'Logical sweeper grids. Flag danger and safe squares under pressure.', icon: '💣', bg: 'from-slate-500/10 to-zinc-500/5', color: 'text-slate-400' }
  ];

  // Fetch High Scores & Leaderboard
  useEffect(() => {
    fetchLeaderboard();
    loadLocalUserHighScores();
    fetchCustomGames();
  }, [userId]);

  const loadLocalUserHighScores = () => {
    const local = localStorage.getItem(`aether_highscores_${userId}`);
    if (local) {
      setUserHighScores(JSON.parse(local));
    }
  };

  const fetchCustomGames = async () => {
    try {
      const snap = await getDocs(collection(db, 'custom_games'));
      const fetched: any[] = [];
      snap.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...docSnap.data() });
      });
      setCustomGames(fetched);
    } catch (err) {
      console.error('Error fetching custom games:', err);
    }
  };

  useEffect(() => {
    // Merge defaultGames and customGames (customGames can override defaults if id matches, or add new ones)
    const merged = defaultGames.map(def => {
      const override = customGames.find(c => c.id === def.id);
      if (override) {
        return { ...def, ...override };
      }
      return def;
    });

    // Add entirely new custom games
    const newGames = customGames.filter(c => !defaultGames.some(def => def.id === c.id));
    setGameList([...merged, ...newGames]);
  }, [customGames]);

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      if (userId !== 'guest') {
        const scoresSnap = await getDocs(
          query(collection(db, 'scores'), orderBy('score', 'desc'), limit(15))
        );
        const scores: HighScore[] = [];
        scoresSnap.forEach((docSnap) => {
          scores.push({ id: docSnap.id, ...docSnap.data() } as HighScore);
        });
        setLeaderboard(scores);
      } else {
        // Build mock visual leaderboard for guest
        setLeaderboard([
          { gameId: 'space', userName: 'RetroKing', score: 15400, date: Date.now() - 3600000 },
          { gameId: 'snake', userName: 'CobraCommander', score: 380, date: Date.now() - 7200000 },
          { gameId: 'breaker', userName: 'BrickMaster', score: 8900, date: Date.now() - 14400000 },
          { gameId: '2048', userName: 'TileWizard', score: 24512, date: Date.now() - 86400000 },
          { gameId: 'mines', userName: 'SweepMaster', score: 48, date: Date.now() - 172800000 },
        ]);
      }
    } catch (err) {
      console.error('Leaderboard fetch failed:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const handleNewHighScore = async (gameId: string, score: number) => {
    const currentHigh = userHighScores[gameId] || 0;
    if (score > currentHigh) {
      // Save locally
      const updated = { ...userHighScores, [gameId]: score };
      setUserHighScores(updated);
      localStorage.setItem(`aether_highscores_${userId}`, JSON.stringify(updated));

      // Save to cloud if not guest
      if (userId !== 'guest') {
        try {
          await addDoc(collection(db, 'scores'), {
            gameId,
            userName: preferences.userName || 'AetherOS User',
            score,
            ownerId: userId,
            date: Date.now()
          });
          fetchLeaderboard();
        } catch (err) {
          console.error('Error uploading high score:', err);
        }
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#07080e] text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Arcade Bar */}
      <div className="h-12 bg-slate-950 border-b border-slate-900 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-indigo-400" />
          <span className="font-extrabold tracking-wider text-xs uppercase text-indigo-300">AETHER RECREATION HUB</span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              playSound('click', !soundEnabled);
            }}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${soundEnabled ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}
            title="Toggle Retro Audio Beeps"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {activeGame && (
            <button
              onClick={() => {
                setActiveGame(null);
                playSound('click', soundEnabled);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 h-8 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs rounded-lg font-semibold text-slate-300 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Lobby</span>
            </button>
          )}
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 flex min-h-0">
        {activeGame ? (
          /* Active Cabinet Stage */
          <div className="flex-1 flex flex-col items-center justify-center p-4 bg-[#0a0c14] relative overflow-y-auto">
            <div className="absolute inset-0 bg-radial-gradient from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
            
            {(() => {
              const selectedGame = gameList.find(g => g.id === activeGame);
              if (selectedGame?.htmlCode) {
                return (
                  <div className="w-full max-w-4xl h-[550px] flex flex-col bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden p-1 shadow-2xl relative">
                    <iframe
                      srcDoc={selectedGame.htmlCode}
                      sandbox="allow-scripts"
                      className="w-full h-full bg-slate-950 rounded-xl"
                      title={selectedGame.title}
                    />
                  </div>
                );
              }
              
              return (
                <>
                  {activeGame === 'snake' && (
                    <SnakeGame 
                      soundEnabled={soundEnabled} 
                      onGameOver={(score) => handleNewHighScore('snake', score)} 
                      highScore={userHighScores['snake'] || 0}
                    />
                  )}
                  {activeGame === 'space' && (
                    <SpaceDefender 
                      soundEnabled={soundEnabled} 
                      onGameOver={(score) => handleNewHighScore('space', score)} 
                      highScore={userHighScores['space'] || 0}
                    />
                  )}
                  {activeGame === 'breaker' && (
                    <BrickBreaker 
                      soundEnabled={soundEnabled} 
                      onGameOver={(score) => handleNewHighScore('breaker', score)} 
                      highScore={userHighScores['breaker'] || 0}
                    />
                  )}
                  {activeGame === '2048' && (
                    <Game2048 
                      soundEnabled={soundEnabled} 
                      onGameOver={(score) => handleNewHighScore('2048', score)} 
                      highScore={userHighScores['2048'] || 0}
                    />
                  )}
                  {activeGame === 'mines' && (
                    <Minesweeper 
                      soundEnabled={soundEnabled} 
                      onGameOver={(score) => handleNewHighScore('mines', score)} 
                      highScore={userHighScores['mines'] || 0}
                    />
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          /* Dashboard / Selection Hub */
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto">
            {/* Game Selector List */}
            <div className="flex-1 p-6 space-y-6 overflow-y-auto max-w-4xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">AETHER SYSTEMS GAME CENTER</h1>
                  <p className="text-[11px] text-slate-500 uppercase tracking-widest mt-1 font-mono">High-Fidelity Client-Rendered System Simulations</p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-900 rounded-xl p-1 shrink-0 self-start sm:self-center shadow-inner">
                    <button
                      type="button"
                      onClick={() => setAdminTab('lobby')}
                      className={`px-3.5 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded-lg transition-all cursor-pointer ${adminTab === 'lobby' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}
                    >
                      Lobby
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminTab('admin')}
                      className={`px-3.5 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${adminTab === 'admin' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}
                    >
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      <span>Admin Tools</span>
                    </button>
                  </div>
                )}
              </div>

              {adminTab === 'admin' && isAdmin ? (
                /* Admin Portal Panel */
                <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-6 space-y-6 animate-in fade-in duration-200 text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-900 pb-4">
                    <div>
                      <h2 className="text-sm font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-amber-400" />
                        <span>Recreation Console & Game Uploader</span>
                      </h2>
                      <p className="text-[11px] text-slate-500 mt-0.5">Add entirely new games or edit existing ones via custom HTML/JS uploads. Changes apply globally to all accounts.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setFormGameId('');
                        setFormTitle('');
                        setFormDesc('');
                        setFormIcon('👾');
                        setFormBg('from-indigo-500/10 to-violet-500/5');
                        setFormColor('text-indigo-400');
                        setFormHtml('');
                        setAdminError('');
                        setAdminSuccess('');
                      }}
                      className="px-2.5 py-1 text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold rounded uppercase border border-slate-800 transition-colors cursor-pointer shrink-0 align-self-start"
                    >
                      Clear Form
                    </button>
                  </div>

                  {adminError && <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-400 text-xs rounded-xl">{adminError}</div>}
                  {adminSuccess && <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-xs rounded-xl">{adminSuccess}</div>}

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setAdminError('');
                    setAdminSuccess('');

                    if (!formGameId.trim() || !formTitle.trim() || !formDesc.trim() || !formHtml.trim()) {
                      setAdminError('Please fill in all required fields (Game ID, Title, Description, and HTML/JS Code).');
                      return;
                    }

                    const gameIdClean = formGameId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
                    if (!gameIdClean) {
                      setAdminError('Invalid Game ID format.');
                      return;
                    }

                    try {
                      const gameDocRef = doc(db, 'custom_games', gameIdClean);
                      await setDoc(gameDocRef, {
                        id: gameIdClean,
                        title: formTitle.trim(),
                        desc: formDesc.trim(),
                        icon: formIcon.trim(),
                        bg: formBg.trim(),
                        color: formColor.trim(),
                        htmlCode: formHtml.trim(),
                        updatedAt: Date.now()
                      });
                      setAdminSuccess(`Game "${formTitle.trim()}" successfully deployed!`);
                      
                      // Refresh list
                      fetchCustomGames();
                      
                      // Reset form
                      setFormGameId('');
                      setFormTitle('');
                      setFormDesc('');
                      setFormIcon('👾');
                      setFormHtml('');
                      setIsEditing(false);
                    } catch (err: any) {
                      setAdminError(`Database write failed: ${err.message || err}`);
                    }
                  }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Game ID / Overwrite Key *</label>
                        <input
                          type="text"
                          disabled={isEditing}
                          value={formGameId}
                          onChange={(e) => setFormGameId(e.target.value)}
                          placeholder="e.g. snake, flappy-bird, pong"
                          className="w-full bg-slate-900 border border-slate-850 focus:border-indigo-500 rounded-lg p-2 text-xs text-white"
                        />
                        <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">
                          Use <code className="text-amber-400 bg-slate-950 px-1 py-0.5 rounded font-mono">snake</code>, <code className="text-amber-400 bg-slate-950 px-1 py-0.5 rounded font-mono">space</code>, <code className="text-amber-400 bg-slate-950 px-1 py-0.5 rounded font-mono">breaker</code>, <code className="text-amber-400 bg-slate-950 px-1 py-0.5 rounded font-mono">2048</code>, or <code className="text-amber-400 bg-slate-950 px-1 py-0.5 rounded font-mono">mines</code> to override a default game, or enter a unique ID for a new game.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Game Display Name *</label>
                          <input
                            type="text"
                            value={formTitle}
                            onChange={(e) => setFormTitle(e.target.value)}
                            placeholder="e.g. Pong Classic"
                            className="w-full bg-slate-900 border border-slate-850 focus:border-indigo-500 rounded-lg p-2 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Launcher Icon</label>
                          <input
                            type="text"
                            value={formIcon}
                            onChange={(e) => setFormIcon(e.target.value)}
                            placeholder="e.g. 🏓"
                            className="w-full bg-slate-900 border border-slate-850 focus:border-indigo-500 rounded-lg p-2 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Brief Description *</label>
                        <textarea
                          rows={2}
                          value={formDesc}
                          onChange={(e) => setFormDesc(e.target.value)}
                          placeholder="Short tagline explaining controls & objective..."
                          className="w-full bg-slate-900 border border-slate-850 focus:border-indigo-500 rounded-lg p-2 text-xs text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Tailwind Card BG</label>
                          <input
                            type="text"
                            value={formBg}
                            onChange={(e) => setFormBg(e.target.value)}
                            placeholder="from-blue-500/10 to-indigo-500/5"
                            className="w-full bg-slate-900 border border-slate-850 focus:border-indigo-500 rounded-lg p-2 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Accent Text Color</label>
                          <input
                            type="text"
                            value={formColor}
                            onChange={(e) => setFormColor(e.target.value)}
                            placeholder="text-blue-400"
                            className="w-full bg-slate-900 border border-slate-850 focus:border-indigo-500 rounded-lg p-2 text-xs text-white font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">HTML, CSS, and JS Code *</label>
                      <textarea
                        rows={11}
                        value={formHtml}
                        onChange={(e) => setFormHtml(e.target.value)}
                        placeholder="<!DOCTYPE html><html><head><style>body { background: #000; color: #fff; }</style></head><body><h1>My Custom Game</h1><script>// Add game logic here</script></body></html>"
                        className="w-full flex-1 bg-slate-900 border border-slate-850 focus:border-indigo-500 rounded-lg p-2 text-[11px] text-slate-300 font-mono resize-none"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-2 pt-3 border-t border-slate-900 flex justify-end gap-3">
                      <button
                        type="submit"
                        className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-extrabold uppercase tracking-wider text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-orange-950/20"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{isEditing ? 'Save Overrides' : 'Deploy Game'}</span>
                      </button>
                    </div>
                  </form>

                  {/* Configured Overrides List */}
                  {customGames.length > 0 && (
                    <div className="pt-6 border-t border-slate-900 space-y-3">
                      <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active Custom Deployments ({customGames.length})</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {customGames.map((g) => (
                          <div
                            key={g.id}
                            className="p-3.5 rounded-xl border border-slate-900/60 bg-slate-900/20 flex items-center justify-between"
                          >
                            <div className="min-w-0 pr-3">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{g.icon}</span>
                                <p className="text-xs font-bold text-white truncate">{g.title}</p>
                              </div>
                              <p className="text-[9px] text-slate-500 font-mono uppercase mt-1">ID: {g.id}</p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsEditing(true);
                                  setFormGameId(g.id);
                                  setFormTitle(g.title);
                                  setFormDesc(g.desc);
                                  setFormIcon(g.icon || '👾');
                                  setFormBg(g.bg || 'from-indigo-500/10 to-violet-500/5');
                                  setFormColor(g.color || 'text-indigo-400');
                                  setFormHtml(g.htmlCode || '');
                                  setAdminError('');
                                  setAdminSuccess('');
                                }}
                                className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800 cursor-pointer"
                                title="Edit game code"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (window.confirm(`Delete the custom deployment for "${g.title}"?`)) {
                                    try {
                                      await deleteDoc(doc(db, 'custom_games', g.id));
                                      setAdminSuccess(`Deleted game "${g.title}".`);
                                      fetchCustomGames();
                                    } catch (err: any) {
                                      setAdminError(`Failed to delete: ${err.message || err}`);
                                    }
                                  }
                                }}
                                className="p-1.5 rounded bg-slate-900 hover:bg-red-950/20 text-slate-400 hover:text-red-400 transition-colors border border-slate-800 cursor-pointer"
                                title="Remove game deployment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Standard Games Lobby Card Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {gameList.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => {
                        setActiveGame(g.id);
                        playSound('click', soundEnabled);
                      }}
                      className={`p-4 rounded-xl border border-slate-900 bg-gradient-to-b ${g.bg} hover:border-indigo-500/30 transition-all hover:-translate-y-0.5 cursor-pointer group flex flex-col justify-between`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">{g.icon}</span>
                          <div className="flex items-center gap-1">
                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-xs font-bold text-slate-300 font-mono">
                              HI: {userHighScores[g.id] || 0}
                            </span>
                          </div>
                        </div>
                        <h3 className="text-sm font-bold text-slate-100 group-hover:text-indigo-400 transition-colors mt-3">{g.title}</h3>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{g.desc}</p>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-900">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">
                          {g.htmlCode ? 'Custom Web Deployment' : 'Interactive Arcade Cabinet'}
                        </span>
                        <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${g.color}`}>
                          Play Now
                          <Play className="w-3 h-3 fill-current" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Highscore & Leaderboard Sidecar */}
            <div className="w-full md:w-80 bg-slate-950 border-t md:border-t-0 md:border-l border-slate-900 p-6 flex flex-col shrink-0">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-300">Global Hall of Fame</h3>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {loadingLeaderboard ? (
                  <div className="text-center py-10 text-xs text-slate-600">Loading Leaderboard...</div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-600">No score records found. Be the first!</div>
                ) : (
                  leaderboard.map((item, i) => (
                    <div
                      key={item.id || i}
                      className="p-2.5 rounded-lg bg-slate-900/30 border border-slate-900/60 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-5 h-5 rounded flex items-center justify-center font-mono text-xs font-black ${
                          i === 0 ? 'bg-amber-500/15 text-amber-400' :
                          i === 1 ? 'bg-slate-300/15 text-slate-300' :
                          i === 2 ? 'bg-amber-700/15 text-amber-600' : 'text-slate-500 bg-slate-950'
                        }`}>
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-200 truncate">{item.userName}</p>
                          <p className="text-[10px] text-slate-500 font-mono uppercase">{item.gameId}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-xs font-black text-slate-100 font-mono">{item.score.toLocaleString()}</p>
                        <p className="text-[9px] text-slate-600">{new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {userId === 'guest' && (
                <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-xl text-[10px] text-indigo-300/80 leading-relaxed mt-4 flex gap-1.5 items-start">
                  <CircleAlert className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Logged in as <strong>Guest</strong>. Highscores will save to your local machine, but won't sync to the Cloud Hall of Fame.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   1. RETRO SNAKE COMPONENT
   ============================================================================ */
function SnakeGame({ soundEnabled, onGameOver, highScore }: { soundEnabled: boolean, onGameOver: (score: number) => void, highScore: number }) {
  const CANVAS_SIZE = 400;
  const GRID_COUNT = 20;
  const CELL_SIZE = CANVAS_SIZE / GRID_COUNT;

  const [score, setScore] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snakeRef = useRef<{ x: number, y: number }[]>([{ x: 10, y: 10 }]);
  const foodRef = useRef<{ x: number, y: number }>({ x: 5, y: 5 });
  const dirRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    resetGame();
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    drawCanvas();
  }, [score, gameOver, isPlaying]);

  const resetGame = () => {
    setScore(0);
    setGameOver(false);
    setIsPlaying(false);
    snakeRef.current = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
    dirRef.current = { x: 0, y: -1 };
    generateFood();
    clearInterval(intervalRef.current);
  };

  const generateFood = () => {
    let newFood;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_COUNT),
        y: Math.floor(Math.random() * GRID_COUNT)
      };
      // Check collision with snake
      if (!snakeRef.current.some(segment => segment.x === newFood.x && segment.y === newFood.y)) {
        break;
      }
    }
    foodRef.current = newFood;
  };

  const handleStart = () => {
    if (gameOver) {
      resetGame();
    }
    setIsPlaying(true);
    playSound('click', soundEnabled);
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(gameLoop, 110);
  };

  const gameLoop = () => {
    const head = snakeRef.current[0];
    const newHead = {
      x: head.x + dirRef.current.x,
      y: head.y + dirRef.current.y
    };

    // Border Collision
    if (newHead.x < 0 || newHead.x >= GRID_COUNT || newHead.y < 0 || newHead.y >= GRID_COUNT) {
      triggerGameOver();
      return;
    }

    // Body Collision
    if (snakeRef.current.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      triggerGameOver();
      return;
    }

    // Move
    snakeRef.current.unshift(newHead);

    // Food Collision
    if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
      setScore(prev => prev + 10);
      generateFood();
      playSound('coin', soundEnabled);
    } else {
      snakeRef.current.pop();
    }

    drawCanvas();
  };

  const triggerGameOver = () => {
    setGameOver(true);
    setIsPlaying(false);
    clearInterval(intervalRef.current);
    playSound('gameover', soundEnabled);
    onGameOver(score);
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill BG
    ctx.fillStyle = '#090a10';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Grid lines (subtle)
    ctx.strokeStyle = '#121422';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_COUNT; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    // Draw Food
    ctx.fillStyle = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ef4444';
    ctx.fillRect(
      foodRef.current.x * CELL_SIZE + 2,
      foodRef.current.y * CELL_SIZE + 2,
      CELL_SIZE - 4,
      CELL_SIZE - 4
    );

    // Draw Snake
    ctx.shadowBlur = 0; // reset
    snakeRef.current.forEach((seg, index) => {
      ctx.fillStyle = index === 0 ? '#10b981' : '#34d399';
      if (index === 0) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#10b981';
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(
        seg.x * CELL_SIZE + 1.5,
        seg.y * CELL_SIZE + 1.5,
        CELL_SIZE - 3,
        CELL_SIZE - 3
      );
    });
    ctx.shadowBlur = 0; // reset again
  };

  // Keyboard Handlers
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      
      const key = e.key.toLowerCase();
      if ((key === 'arrowup' || key === 'w') && dirRef.current.y === 0) {
        dirRef.current = { x: 0, y: -1 };
      } else if ((key === 'arrowdown' || key === 's') && dirRef.current.y === 0) {
        dirRef.current = { x: 0, y: 1 };
      } else if ((key === 'arrowleft' || key === 'a') && dirRef.current.x === 0) {
        dirRef.current = { x: -1, y: 0 };
      } else if ((key === 'arrowright' || key === 'd') && dirRef.current.x === 0) {
        dirRef.current = { x: 1, y: 0 };
      }
    };

    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [isPlaying]);

  const changeDirection = (x: number, y: number) => {
    if (!isPlaying) return;
    if (x !== 0 && dirRef.current.x === 0) dirRef.current = { x, y: 0 };
    if (y !== 0 && dirRef.current.y === 0) dirRef.current = { x: 0, y };
  };

  return (
    <div className="flex flex-col items-center gap-4 max-w-sm w-full">
      {/* Game Header Metrics */}
      <div className="w-full flex justify-between bg-slate-950 p-3 rounded-xl border border-slate-900 font-mono text-xs">
        <div>SCORE: <span className="text-emerald-400 font-bold">{score}</span></div>
        <div>HIGH SCORE: <span className="text-indigo-400 font-bold">{highScore}</span></div>
      </div>

      {/* Screen Canvas Container */}
      <div className="relative border-4 border-slate-900 bg-black rounded-lg overflow-hidden shadow-2xl">
        <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} className="w-full h-auto aspect-square" />

        {/* Start Game/Game Over Modals */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-4">
            {gameOver ? (
              <div className="space-y-4">
                <Trophy className="w-10 h-10 text-amber-500 mx-auto animate-bounce" />
                <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm">Snake Crashed!</h3>
                <p className="text-slate-400 text-[11px]">Final Score: <strong className="text-emerald-400">{score}</strong></p>
                <button
                  onClick={handleStart}
                  className="px-4 py-2 bg-indigo-600 text-xs text-white font-bold rounded-lg cursor-pointer hover:bg-indigo-500 transition-colors"
                >
                  Insert Coin / Retry
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">Navigate using <strong>WASD / ARROW KEYS</strong>. Collect red dots to increment and lengthen.</p>
                <button
                  onClick={handleStart}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 font-bold text-xs rounded-xl flex items-center gap-1.5 mx-auto cursor-pointer transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Insert Coin / Start</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* D-Pad Virtual controllers for mobile/convenience */}
      <div className="grid grid-cols-3 gap-2 w-36 py-2">
        <div />
        <button
          onClick={() => changeDirection(0, -1)}
          className="h-10 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer active:scale-95"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <div />

        <button
          onClick={() => changeDirection(-1, 0)}
          className="h-10 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer active:scale-95"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="h-10 bg-slate-950/40 rounded-lg border border-slate-900 flex items-center justify-center text-[10px] text-slate-600 font-mono">D</div>
        <button
          onClick={() => changeDirection(1, 0)}
          className="h-10 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer active:scale-95"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div />
        <button
          onClick={() => changeDirection(0, 1)}
          className="h-10 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer active:scale-95"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
        <div />
      </div>
    </div>
  );
}

/* ============================================================================
   2. SPACE DEFENDER COMPONENT
   ============================================================================ */
interface Alien {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface Bullet {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  fromEnemy: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
}

function SpaceDefender({ soundEnabled, onGameOver, highScore }: { soundEnabled: boolean, onGameOver: (score: number) => void, highScore: number }) {
  const WIDTH = 480;
  const HEIGHT = 400;

  const [score, setScore] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [lives, setLives] = useState<number>(3);
  const [level, setLevel] = useState<number>(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef({ x: WIDTH / 2 - 20, y: HEIGHT - 35, width: 32, height: 16, speed: 6 });
  const aliensRef = useRef<Alien[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const animationFrameId = useRef<number | null>(null);

  // Spawning variables
  const alienDirectionRef = useRef<number>(1);
  const lastAlienShootRef = useRef<number>(0);

  const spawnAliens = (currentLevel: number) => {
    const rows = 4;
    const cols = 7;
    const aliensList: Alien[] = [];
    const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        aliensList.push({
          x: 40 + c * 50,
          y: 40 + r * 35,
          width: 24,
          height: 18,
          color: colors[r % colors.length]
        });
      }
    }
    aliensRef.current = aliensList;
    alienDirectionRef.current = 1 + (currentLevel * 0.15); // incrementally faster aliens
  };

  const startNewGame = () => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setGameOver(false);
    setIsPlaying(true);
    bulletsRef.current = [];
    particlesRef.current = [];
    playerRef.current.x = WIDTH / 2 - 20;
    spawnAliens(1);
    playSound('click', soundEnabled);
  };

  const handleShoot = () => {
    if (!isPlaying) return;
    // Max 4 player bullets on screen at a time
    const playerBulletsCount = bulletsRef.current.filter(b => !b.fromEnemy).length;
    if (playerBulletsCount >= 4) return;

    bulletsRef.current.push({
      x: playerRef.current.x + playerRef.current.width / 2 - 2,
      y: playerRef.current.y - 8,
      width: 4,
      height: 8,
      speed: -8,
      fromEnemy: false
    });
    playSound('shoot', soundEnabled);
  };

  const addExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 12; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        size: Math.random() * 3 + 1,
        color,
        alpha: 1
      });
    }
  };

  const updateGame = () => {
    if (!isPlaying) return;

    // 1. Move Player
    if (keysRef.current['arrowleft'] || keysRef.current['a']) {
      playerRef.current.x = Math.max(0, playerRef.current.x - playerRef.current.speed);
    }
    if (keysRef.current['arrowright'] || keysRef.current['d']) {
      playerRef.current.x = Math.min(WIDTH - playerRef.current.width, playerRef.current.x + playerRef.current.speed);
    }

    // 2. Move Bullets
    bulletsRef.current.forEach((bullet) => {
      bullet.y += bullet.speed;
    });

    // Remove off-screen bullets
    bulletsRef.current = bulletsRef.current.filter(b => b.y > 0 && b.y < HEIGHT);

    // 3. Move Aliens
    let shiftDown = false;
    const margin = 20;
    aliensRef.current.forEach((alien) => {
      alien.x += alienDirectionRef.current;
      if (alien.x + alien.width > WIDTH - margin || alien.x < margin) {
        shiftDown = true;
      }
    });

    if (shiftDown) {
      alienDirectionRef.current = -alienDirectionRef.current;
      aliensRef.current.forEach((alien) => {
        alien.y += 12;
        // Game Over if alien hits ship level
        if (alien.y + alien.height >= playerRef.current.y) {
          triggerGameOver();
        }
      });
    }

    // 4. Enemy firing loop
    const now = Date.now();
    if (now - lastAlienShootRef.current > Math.max(600, 1500 - level * 100)) {
      if (aliensRef.current.length > 0) {
        // Pick random alien
        const shooter = aliensRef.current[Math.floor(Math.random() * aliensRef.current.length)];
        bulletsRef.current.push({
          x: shooter.x + shooter.width / 2,
          y: shooter.y + shooter.height,
          width: 4,
          height: 8,
          speed: 4 + level * 0.3,
          fromEnemy: true
        });
        lastAlienShootRef.current = now;
      }
    }

    // 5. Collisions - Player Laser hitting Aliens
    bulletsRef.current.forEach((bullet) => {
      if (!bullet.fromEnemy) {
        aliensRef.current.forEach((alien, index) => {
          if (
            bullet.x < alien.x + alien.width &&
            bullet.x + bullet.width > alien.x &&
            bullet.y < alien.y + alien.height &&
            bullet.y + bullet.height > alien.y
          ) {
            // Hit!
            addExplosion(alien.x + alien.width/2, alien.y + alien.height/2, alien.color);
            playSound('explosion', soundEnabled);
            setScore(prev => prev + 100);
            
            // Remove alien & bullet
            aliensRef.current.splice(index, 1);
            bullet.y = -999; // trigger filter deletion
          }
        });
      } else {
        // Enemy Laser hitting Player
        const p = playerRef.current;
        if (
          bullet.x < p.x + p.width &&
          bullet.x + bullet.width > p.x &&
          bullet.y < p.y + p.height &&
          bullet.y + bullet.height > p.y
        ) {
          // Hit player!
          addExplosion(p.x + p.width/2, p.y + p.height/2, '#ef4444');
          playSound('explosion', soundEnabled);
          setLives(prev => {
            const next = prev - 1;
            if (next <= 0) {
              triggerGameOver();
            }
            return next;
          });
          bullet.y = 999; // delete bullet
        }
      }
    });

    // Clear dead bullets
    bulletsRef.current = bulletsRef.current.filter(b => b.y > 0 && b.y < HEIGHT);

    // 6. Check Level Victory
    if (aliensRef.current.length === 0 && isPlaying) {
      playSound('powerup', soundEnabled);
      setLevel(prev => {
        const next = prev + 1;
        spawnAliens(next);
        return next;
      });
    }

    // 7. Update Particles
    particlesRef.current.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.02;
    });
    particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas Background
    ctx.fillStyle = '#060713';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Stars Background effect
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 20; i++) {
      const starX = (Math.sin(i * 123) * 0.5 + 0.5) * WIDTH;
      const starY = ((Date.now() / 40 + i * 35) % HEIGHT);
      ctx.fillRect(starX, starY, 1, 1);
    }

    // Draw Player Ship
    if (isPlaying && lives > 0) {
      const p = playerRef.current;
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.moveTo(p.x + p.width / 2, p.y);
      ctx.lineTo(p.x, p.y + p.height);
      ctx.lineTo(p.x + p.width, p.y + p.height);
      ctx.closePath();
      ctx.fill();

      // Wing glow
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#6366f1';
      ctx.fillStyle = '#818cf8';
      ctx.fillRect(p.x + 3, p.y + p.height - 4, 4, 4);
      ctx.fillRect(p.x + p.width - 7, p.y + p.height - 4, 4, 4);
      ctx.shadowBlur = 0;
    }

    // Draw Aliens
    aliensRef.current.forEach((alien) => {
      ctx.fillStyle = alien.color;
      ctx.shadowBlur = 4;
      ctx.shadowColor = alien.color;
      // Draw retro space block alien
      ctx.fillRect(alien.x, alien.y, alien.width, alien.height);
      ctx.fillStyle = '#000000';
      ctx.fillRect(alien.x + 4, alien.y + 4, 3, 3);
      ctx.fillRect(alien.x + alien.width - 7, alien.y + 4, 3, 3);
    });
    ctx.shadowBlur = 0;

    // Draw Bullets
    bulletsRef.current.forEach((b) => {
      ctx.fillStyle = b.fromEnemy ? '#f43f5e' : '#38bdf8';
      ctx.shadowBlur = 6;
      ctx.shadowColor = b.fromEnemy ? '#f43f5e' : '#38bdf8';
      ctx.fillRect(b.x, b.y, b.width, b.height);
    });
    ctx.shadowBlur = 0;

    // Draw Particles
    particlesRef.current.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1.0; // reset
  };

  const triggerGameOver = () => {
    setGameOver(true);
    setIsPlaying(false);
    playSound('gameover', soundEnabled);
    onGameOver(score);
  };

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = true;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault(); // prevent scroll
        handleShoot();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPlaying]);

  // Main tick loop
  useEffect(() => {
    const loop = () => {
      updateGame();
      draw();
      animationFrameId.current = requestAnimationFrame(loop);
    };
    
    animationFrameId.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [isPlaying, level]);

  return (
    <div className="flex flex-col items-center gap-4 max-w-lg w-full">
      {/* Metrics Row */}
      <div className="w-full grid grid-cols-4 bg-slate-950 p-2.5 rounded-xl border border-slate-900 font-mono text-xs text-center">
        <div>SCORE: <span className="text-indigo-400 font-bold">{score}</span></div>
        <div>LIVES: <span className="text-red-400 font-bold">{'❤️'.repeat(lives)}</span></div>
        <div>LEVEL: <span className="text-cyan-400 font-bold">{level}</span></div>
        <div>HI: <span className="text-amber-500 font-bold">{highScore}</span></div>
      </div>

      {/* Screen Canvas Container */}
      <div className="relative border-4 border-slate-900 bg-black rounded-lg overflow-hidden shadow-2xl w-full">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full h-auto aspect-[4.8/4]" />

        {/* Start Game / Game Over Overlays */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-4">
            {gameOver ? (
              <div className="space-y-4">
                <Trophy className="w-10 h-10 text-amber-500 mx-auto animate-bounce" />
                <h3 className="text-rose-500 font-bold uppercase tracking-wider text-sm">Ship Destroyed!</h3>
                <p className="text-slate-400 text-xs">Reach Score: <strong className="text-indigo-400">{score}</strong> at Wave {level}</p>
                <button
                  onClick={startNewGame}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Insert Coin / Respawn
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Steer using <strong>A / D or Arrow Keys</strong>. Blast aliens with <strong>SPACEBAR</strong>. Prevent aliens from crashing down.
                </p>
                <button
                  onClick={startNewGame}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-bold text-xs rounded-xl flex items-center gap-1.5 mx-auto cursor-pointer transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Insert Coin / Launch Ship</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action triggers below the screen */}
      {isPlaying && (
        <div className="flex gap-4 w-full items-center justify-between px-2">
          <div className="flex gap-2">
            <button
              onMouseDown={() => { keysRef.current['arrowleft'] = true; }}
              onMouseUp={() => { keysRef.current['arrowleft'] = false; }}
              onTouchStart={() => { keysRef.current['arrowleft'] = true; }}
              onTouchEnd={() => { keysRef.current['arrowleft'] = false; }}
              className="w-14 h-11 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 flex items-center justify-center font-bold active:bg-slate-800"
            >
              ◀
            </button>
            <button
              onMouseDown={() => { keysRef.current['arrowright'] = true; }}
              onMouseUp={() => { keysRef.current['arrowright'] = false; }}
              onTouchStart={() => { keysRef.current['arrowright'] = true; }}
              onTouchEnd={() => { keysRef.current['arrowright'] = false; }}
              className="w-14 h-11 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 flex items-center justify-center font-bold active:bg-slate-800"
            >
              ▶
            </button>
          </div>

          <button
            onClick={handleShoot}
            className="flex-1 max-w-[160px] h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase rounded-lg shadow-lg active:scale-95 transition-transform cursor-pointer flex items-center justify-center gap-1"
          >
            <Zap className="w-4 h-4 fill-current animate-pulse text-yellow-300" />
            <span>FIRE BLAST</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   3. BRICK BREAKER COMPONENT
   ============================================================================ */
interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  status: number;
  color: string;
}

function BrickBreaker({ soundEnabled, onGameOver, highScore }: { soundEnabled: boolean, onGameOver: (score: number) => void, highScore: number }) {
  const WIDTH = 480;
  const HEIGHT = 400;

  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Game elements
  const paddleRef = useRef({ x: WIDTH / 2 - 40, y: HEIGHT - 20, w: 80, h: 10, speed: 7 });
  const ballRef = useRef({ x: WIDTH / 2, y: HEIGHT - 30, vx: 4, vy: -4, radius: 6 });
  const bricksRef = useRef<Brick[]>([]);
  const keysRef = useRef<Record<string, boolean>>({});

  const initBricks = () => {
    const rows = 5;
    const cols = 8;
    const padding = 6;
    const brickW = (WIDTH - padding * (cols + 1)) / cols;
    const brickH = 15;
    const offsetTop = 40;
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

    const items: Brick[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        items.push({
          x: padding + c * (brickW + padding),
          y: offsetTop + r * (brickH + padding),
          w: brickW,
          h: brickH,
          status: 1,
          color: colors[r % colors.length]
        });
      }
    }
    bricksRef.current = items;
  };

  const startNewGame = () => {
    setScore(0);
    setLives(3);
    setGameOver(false);
    setIsPlaying(true);
    
    // Paddle reset
    paddleRef.current.x = WIDTH / 2 - 40;
    paddleRef.current.w = 80;

    // Ball reset
    ballRef.current.x = WIDTH / 2;
    ballRef.current.y = HEIGHT - 35;
    ballRef.current.vx = (Math.random() > 0.5 ? 4 : -4);
    ballRef.current.vy = -4;

    initBricks();
    playSound('click', soundEnabled);
  };

  const update = () => {
    if (!isPlaying) return;

    // Move Paddle
    if (keysRef.current['arrowleft'] || keysRef.current['a']) {
      paddleRef.current.x = Math.max(0, paddleRef.current.x - paddleRef.current.speed);
    }
    if (keysRef.current['arrowright'] || keysRef.current['d']) {
      paddleRef.current.x = Math.min(WIDTH - paddleRef.current.w, paddleRef.current.x + paddleRef.current.speed);
    }

    const ball = ballRef.current;
    const pad = paddleRef.current;

    // Move Ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Boundary Collisions - Left/Right Wall
    if (ball.x + ball.radius > WIDTH || ball.x - ball.radius < 0) {
      ball.vx = -ball.vx;
      playSound('click', soundEnabled);
    }

    // Boundary Collision - Top Wall
    if (ball.y - ball.radius < 0) {
      ball.vy = -ball.vy;
      playSound('click', soundEnabled);
    }

    // Boundary Collision - Bottom Wall (Miss paddle)
    if (ball.y + ball.radius > HEIGHT) {
      playSound('explosion', soundEnabled);
      setLives(prev => {
        const next = prev - 1;
        if (next <= 0) {
          triggerGameOver();
        } else {
          // Reset ball to player
          ball.x = pad.x + pad.w / 2;
          ball.y = HEIGHT - 35;
          ball.vx = (Math.random() > 0.5 ? 4 : -4);
          ball.vy = -4;
        }
        return next;
      });
    }

    // Paddle Collision
    if (
      ball.y + ball.radius >= pad.y &&
      ball.y - ball.radius <= pad.y + pad.h &&
      ball.x + ball.radius >= pad.x &&
      ball.x - ball.radius <= pad.x + pad.w
    ) {
      // Calculate dynamic bounce angle depending on where the ball hits the paddle
      const relativeHitPoint = (ball.x - (pad.x + pad.w / 2)) / (pad.w / 2);
      const angle = relativeHitPoint * (Math.PI / 3); // max 60 degree bounce
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

      ball.vx = speed * Math.sin(angle);
      ball.vy = -speed * Math.cos(angle);

      // Prevent getting stuck on paddle side
      ball.y = pad.y - ball.radius - 1;
      playSound('shoot', soundEnabled);
    }

    // Bricks collision
    bricksRef.current.forEach((brick) => {
      if (brick.status === 1) {
        if (
          ball.x + ball.radius >= brick.x &&
          ball.x - ball.radius <= brick.x + brick.w &&
          ball.y + ball.radius >= brick.y &&
          ball.y - ball.radius <= brick.y + brick.h
        ) {
          // Brick destruction
          brick.status = 0;
          ball.vy = -ball.vy;
          setScore(prev => prev + 50);
          playSound('coin', soundEnabled);

          // Add a minor speed increase to keep tension high
          ball.vx *= 1.01;
          ball.vy *= 1.01;
        }
      }
    });

    // Check Victory
    const activeBricks = bricksRef.current.filter(b => b.status === 1).length;
    if (activeBricks === 0 && isPlaying) {
      // Re-initialize a fresh grid!
      playSound('powerup', soundEnabled);
      setScore(prev => prev + 1000); // clear bonus
      initBricks();
      ball.x = pad.x + pad.w / 2;
      ball.y = HEIGHT - 35;
      ball.vx = 4;
      ball.vy = -4;
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill Backdrop
    ctx.fillStyle = '#060713';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const pad = paddleRef.current;
    const ball = ballRef.current;

    // Draw Paddle
    ctx.fillStyle = '#f43f5e';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#f43f5e';
    ctx.fillRect(pad.x, pad.y, pad.w, pad.h);
    ctx.shadowBlur = 0;

    // Draw Ball
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw Bricks
    bricksRef.current.forEach((b) => {
      if (b.status === 1) {
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        // Bevel look
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(b.x, b.y, b.w, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(b.x, b.y + b.h - 2, b.w, 2);
      }
    });
  };

  const triggerGameOver = () => {
    setGameOver(true);
    setIsPlaying(false);
    playSound('gameover', soundEnabled);
    onGameOver(score);
  };

  // Keyboard hooks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPlaying]);

  // Framerate ticker loop
  useEffect(() => {
    const loop = () => {
      update();
      draw();
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  return (
    <div className="flex flex-col items-center gap-4 max-w-lg w-full">
      {/* Score and metrics */}
      <div className="w-full grid grid-cols-3 bg-slate-950 p-2.5 rounded-xl border border-slate-900 font-mono text-xs text-center">
        <div>SCORE: <span className="text-rose-400 font-bold">{score}</span></div>
        <div>LIVES: <span className="text-red-400 font-bold">{'❤️'.repeat(lives)}</span></div>
        <div>HI: <span className="text-amber-500 font-bold">{highScore}</span></div>
      </div>

      {/* Frame Screen */}
      <div className="relative border-4 border-slate-900 bg-black rounded-lg overflow-hidden shadow-2xl w-full">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full h-auto aspect-[4.8/4]" />

        {!isPlaying && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-4">
            {gameOver ? (
              <div className="space-y-4">
                <Trophy className="w-10 h-10 text-amber-500 mx-auto animate-bounce" />
                <h3 className="text-rose-500 font-bold uppercase tracking-wider text-sm">Game Over!</h3>
                <p className="text-slate-400 text-xs">Score Earned: <strong className="text-rose-400">{score}</strong></p>
                <button
                  onClick={startNewGame}
                  className="px-4 py-2 bg-rose-600 text-xs text-white font-bold rounded-lg cursor-pointer transition-colors hover:bg-rose-500"
                >
                  Insert Coin / Respawn
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Bounce the ball to crush the colored blocks! Move using <strong>WASD / Arrow Keys</strong>.
                </p>
                <button
                  onClick={startNewGame}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 font-bold text-xs rounded-xl flex items-center gap-1.5 mx-auto cursor-pointer transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Insert Coin / Launch Paddle</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visual buttons on screen */}
      {isPlaying && (
        <div className="flex gap-4 w-full justify-center">
          <button
            onMouseDown={() => { keysRef.current['arrowleft'] = true; }}
            onMouseUp={() => { keysRef.current['arrowleft'] = false; }}
            onTouchStart={() => { keysRef.current['arrowleft'] = true; }}
            onTouchEnd={() => { keysRef.current['arrowleft'] = false; }}
            className="w-20 h-12 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 flex items-center justify-center font-black active:bg-slate-800"
          >
            ◀
          </button>
          <button
            onMouseDown={() => { keysRef.current['arrowright'] = true; }}
            onMouseUp={() => { keysRef.current['arrowright'] = false; }}
            onTouchStart={() => { keysRef.current['arrowright'] = true; }}
            onTouchEnd={() => { keysRef.current['arrowright'] = false; }}
            className="w-20 h-12 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 flex items-center justify-center font-black active:bg-slate-800"
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   4. 2048 MASTER GAME COMPONENT
   ============================================================================ */
function Game2048({ soundEnabled, onGameOver, highScore }: { soundEnabled: boolean, onGameOver: (score: number) => void, highScore: number }) {
  const [board, setBoard] = useState<number[][]>([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const [score, setScore] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [hasStarted, setHasStarted] = useState<boolean>(false);

  useEffect(() => {
    if (hasStarted) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [board, hasStarted]);

  const initGame = () => {
    let fresh = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    fresh = spawnRandomTile(fresh);
    fresh = spawnRandomTile(fresh);
    setBoard(fresh);
    setScore(0);
    setGameOver(false);
    setHasStarted(true);
    playSound('coin', soundEnabled);
  };

  const spawnRandomTile = (grid: number[][]) => {
    const empty: { r: number, c: number }[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (grid[r][c] === 0) empty.push({ r, c });
      }
    }
    if (empty.length > 0) {
      const pick = empty[Math.floor(Math.random() * empty.length)];
      const updated = grid.map(row => [...row]);
      updated[pick.r][pick.c] = Math.random() > 0.9 ? 4 : 2;
      return updated;
    }
    return grid;
  };

  const checkGameOver = (grid: number[][]) => {
    // Check if any empty spots
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (grid[r][c] === 0) return false;
      }
    }
    // Check adjacent matches
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const val = grid[r][c];
        if (r < 3 && grid[r + 1][c] === val) return false;
        if (c < 3 && grid[r][c + 1] === val) return false;
      }
    }
    return true;
  };

  // 2048 mathematical matrix shifts
  const slideLeft = (grid: number[][], updateScoreFlag: boolean) => {
    let currentScoreAdd = 0;
    const nextGrid = grid.map((row) => {
      // Filter out zeros
      let filtered = row.filter((val) => val !== 0);
      const nextRow = [];
      
      // Combine adjacents
      for (let i = 0; i < filtered.length; i++) {
        if (i < filtered.length - 1 && filtered[i] === filtered[i + 1]) {
          const combo = filtered[i] * 2;
          nextRow.push(combo);
          currentScoreAdd += combo;
          i++; // skip next
        } else {
          nextRow.push(filtered[i]);
        }
      }

      // Pad with zeros
      while (nextRow.length < 4) {
        nextRow.push(0);
      }
      return nextRow;
    });

    if (updateScoreFlag && currentScoreAdd > 0) {
      setScore(prev => prev + currentScoreAdd);
    }
    return nextGrid;
  };

  const rotate90 = (grid: number[][]) => {
    const rotated = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        rotated[c][3 - r] = grid[r][c];
      }
    }
    return rotated;
  };

  const moveBoard = (dir: 'left' | 'right' | 'up' | 'down') => {
    let next = [...board];
    
    // Rotate to always compute as a "slideLeft"
    if (dir === 'up') {
      next = rotate90(rotate90(rotate90(next)));
      next = slideLeft(next, true);
      next = rotate90(next);
    } else if (dir === 'right') {
      next = rotate90(rotate90(next));
      next = slideLeft(next, true);
      next = rotate90(rotate90(next));
    } else if (dir === 'down') {
      next = rotate90(next);
      next = slideLeft(next, true);
      next = rotate90(rotate90(rotate90(next)));
    } else {
      next = slideLeft(next, true);
    }

    // Check if board actually mutated/moved
    const changed = JSON.stringify(board) !== JSON.stringify(next);
    if (changed) {
      const finalGrid = spawnRandomTile(next);
      setBoard(finalGrid);
      playSound('click', soundEnabled);

      if (checkGameOver(finalGrid)) {
        setGameOver(true);
        playSound('gameover', soundEnabled);
        onGameOver(score);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') {
      e.preventDefault();
      moveBoard('left');
    } else if (key === 'arrowright' || key === 'd') {
      e.preventDefault();
      moveBoard('right');
    } else if (key === 'arrowup' || key === 'w') {
      e.preventDefault();
      moveBoard('up');
    } else if (key === 'arrowdown' || key === 's') {
      e.preventDefault();
      moveBoard('down');
    }
  };

  const getTileStyles = (val: number) => {
    switch(val) {
      case 2: return 'bg-slate-800 text-slate-100 border-slate-700';
      case 4: return 'bg-indigo-950 text-indigo-200 border-indigo-900';
      case 8: return 'bg-indigo-900 text-indigo-100 border-indigo-800';
      case 16: return 'bg-violet-900 text-violet-100 border-violet-800 animate-pulse';
      case 32: return 'bg-purple-900 text-purple-100 border-purple-800';
      case 64: return 'bg-pink-900 text-pink-100 border-pink-800';
      case 128: return 'bg-rose-900 text-rose-100 border-rose-800 shadow-lg shadow-rose-500/10';
      case 256: return 'bg-red-900 text-red-100 border-red-800 shadow-lg shadow-red-500/20';
      case 512: return 'bg-amber-950 text-amber-100 border-amber-900';
      case 1024: return 'bg-yellow-950 text-yellow-100 border-yellow-900';
      case 2048: return 'bg-amber-500 text-black border-amber-400 font-extrabold animate-bounce shadow-2xl';
      default: return 'bg-slate-900/30 text-slate-600 border-slate-950/20';
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 max-w-sm w-full select-none">
      <div className="w-full flex justify-between bg-slate-950 p-3 rounded-xl border border-slate-900 font-mono text-xs">
        <div>SCORE: <span className="text-amber-400 font-bold">{score}</span></div>
        <div>HI SCORE: <span className="text-indigo-400 font-bold">{highScore}</span></div>
      </div>

      <div className="relative w-full aspect-square bg-[#0c0d16] border border-slate-900 p-4 rounded-2xl flex flex-col justify-between shadow-2xl">
        {/* The 4x4 Grid Board */}
        <div className="grid grid-cols-4 gap-3 w-full h-full">
          {board.map((row, r) =>
            row.map((val, c) => (
              <div
                key={`${r}-${c}`}
                className={`aspect-square border rounded-xl flex items-center justify-center font-black transition-all duration-150 text-sm md:text-base ${getTileStyles(val)}`}
              >
                {val > 0 ? val : ''}
              </div>
            ))
          )}
        </div>

        {/* Not Started Overlay */}
        {!hasStarted && (
          <div className="absolute inset-0 bg-black/85 rounded-2xl flex flex-col items-center justify-center text-center p-4">
            <Sparkles className="w-10 h-10 text-amber-400 mx-auto animate-pulse mb-2" />
            <p className="text-xs text-slate-400 max-w-xs mb-4 leading-relaxed">
              Use your <strong>WASD / Arrow Keys</strong> to merge cards of identical numeric strength.
            </p>
            <button
              onClick={initGame}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Insert Coin / Slide</span>
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameOver && (
          <div className="absolute inset-0 bg-black/90 rounded-2xl flex flex-col items-center justify-center text-center p-4">
            <Trophy className="w-10 h-10 text-amber-500 mx-auto animate-bounce mb-2" />
            <h3 className="text-red-500 font-extrabold uppercase text-sm tracking-wider">Board Locked!</h3>
            <p className="text-xs text-slate-400 mt-1">Final Score tally: <strong className="text-amber-400">{score}</strong></p>
            <button
              onClick={initGame}
              className="mt-4 px-4 py-2 bg-indigo-600 text-xs font-bold text-white rounded-lg cursor-pointer transition-colors"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      {/* Control Indicators */}
      {hasStarted && (
        <div className="grid grid-cols-3 gap-2 w-36 py-1 text-slate-500">
          <div />
          <button onClick={() => moveBoard('up')} className="h-9 rounded bg-slate-900 border border-slate-800 hover:bg-slate-850 flex items-center justify-center cursor-pointer active:scale-95 text-slate-300">
            <ChevronUp className="w-4 h-4" />
          </button>
          <div />
          <button onClick={() => moveBoard('left')} className="h-9 rounded bg-slate-900 border border-slate-800 hover:bg-slate-850 flex items-center justify-center cursor-pointer active:scale-95 text-slate-300">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div />
          <button onClick={() => moveBoard('right')} className="h-9 rounded bg-slate-900 border border-slate-800 hover:bg-slate-850 flex items-center justify-center cursor-pointer active:scale-95 text-slate-300">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div />
          <button onClick={() => moveBoard('down')} className="h-9 rounded bg-slate-900 border border-slate-800 hover:bg-slate-850 flex items-center justify-center cursor-pointer active:scale-95 text-slate-300">
            <ChevronDown className="w-4 h-4" />
          </button>
          <div />
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   5. CLASSIC MINESWEEPER COMPONENT
   ============================================================================ */
interface MineCell {
  r: number;
  c: number;
  hasMine: boolean;
  revealed: boolean;
  flagged: boolean;
  neighborMines: number;
}

function Minesweeper({ soundEnabled, onGameOver, highScore }: { soundEnabled: boolean, onGameOver: (score: number) => void, highScore: number }) {
  // Preset 9x9 easy beginner layout to fit inside the workstation perfectly
  const ROWS = 9;
  const COLS = 9;
  const MINE_COUNT = 10;

  const [grid, setGrid] = useState<MineCell[][]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [win, setWin] = useState<boolean>(false);
  const [minesRemaining, setMinesRemaining] = useState<number>(MINE_COUNT);
  const [timer, setTimer] = useState<number>(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    initGrid();
    return () => clearInterval(timerRef.current);
  }, []);

  const initGrid = () => {
    // Fill empty cells
    const initial: MineCell[][] = [];
    for (let r = 0; r < ROWS; r++) {
      const row: MineCell[] = [];
      for (let c = 0; c < COLS; c++) {
        row.push({
          r,
          c,
          hasMine: false,
          revealed: false,
          flagged: false,
          neighborMines: 0
        });
      }
      initial.push(row);
    }

    // Place mines randomly
    let minesPlaced = 0;
    while (minesPlaced < MINE_COUNT) {
      const targetR = Math.floor(Math.random() * ROWS);
      const targetC = Math.floor(Math.random() * COLS);
      if (!initial[targetR][targetC].hasMine) {
        initial[targetR][targetC].hasMine = true;
        minesPlaced++;
      }
    }

    // Calculate neighbors
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!initial[r][c].hasMine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                if (initial[nr][nc].hasMine) count++;
              }
            }
          }
          initial[r][c].neighborMines = count;
        }
      }
    }

    setGrid(initial);
    setIsPlaying(false);
    setGameOver(false);
    setWin(false);
    setMinesRemaining(MINE_COUNT);
    setTimer(0);
    clearInterval(timerRef.current);
  };

  const startTimer = () => {
    if (!isPlaying && !gameOver && !win) {
      setIsPlaying(true);
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
  };

  const revealCell = (r: number, c: number) => {
    if (gameOver || win) return;
    startTimer();

    const currentCell = grid[r][c];
    if (currentCell.revealed || currentCell.flagged) return;

    const nextGrid = grid.map(row => row.map(cell => ({ ...cell })));
    
    // Hit a mine! Game Over
    if (currentCell.hasMine) {
      // Reveal all mines
      nextGrid.forEach(row => row.forEach(cell => {
        if (cell.hasMine) cell.revealed = true;
      }));
      setGrid(nextGrid);
      setGameOver(true);
      setIsPlaying(false);
      clearInterval(timerRef.current);
      playSound('explosion', soundEnabled);
      return;
    }

    // Clean safe cell reveal
    playSound('click', soundEnabled);
    const floodFill = (targetR: number, targetC: number) => {
      const target = nextGrid[targetR][targetC];
      if (target.revealed || target.flagged) return;

      target.revealed = true;

      if (target.neighborMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = targetR + dr;
            const nc = targetC + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
              floodFill(nr, nc);
            }
          }
        }
      }
    };

    floodFill(r, c);
    setGrid(nextGrid);

    // Check Win
    let safeCount = 0;
    let revealedCount = 0;
    nextGrid.forEach(row => row.forEach(cell => {
      if (!cell.hasMine) safeCount++;
      if (!cell.hasMine && cell.revealed) revealedCount++;
    }));

    if (revealedCount === safeCount) {
      setWin(true);
      setIsPlaying(false);
      clearInterval(timerRef.current);
      playSound('powerup', soundEnabled);
      // Winner high score translates as remaining seconds speed logic
      const calculatedScore = Math.max(10, 1000 - timer);
      onGameOver(calculatedScore);
    }
  };

  const flagCell = (r: number, c: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (gameOver || win) return;
    startTimer();

    const current = grid[r][c];
    if (current.revealed) return;

    const nextGrid = grid.map(row => row.map(cell => {
      if (cell.r === r && cell.c === c) {
        const nextFlagged = !cell.flagged;
        setMinesRemaining(prev => prev + (nextFlagged ? -1 : 1));
        return { ...cell, flagged: nextFlagged };
      }
      return cell;
    }));

    setGrid(nextGrid);
    playSound('click', soundEnabled);
  };

  const getCellLabelColor = (count: number) => {
    switch (count) {
      case 1: return 'text-blue-400 font-semibold';
      case 2: return 'text-emerald-400 font-semibold';
      case 3: return 'text-red-400 font-semibold';
      case 4: return 'text-indigo-400 font-semibold';
      case 5: return 'text-amber-500 font-semibold';
      default: return 'text-pink-400 font-semibold';
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 max-w-sm w-full font-mono text-xs select-none">
      {/* Board parameters and triggers */}
      <div className="w-full flex justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-900 items-center">
        <div>💣 <span className="text-red-400 font-bold">{minesRemaining}</span></div>
        
        <button
          onClick={initGrid}
          className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 font-bold text-[11px] cursor-pointer flex items-center gap-1"
          title="Reset Minefield"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{gameOver ? '😵 RETRY' : win ? '😎 WIN!' : '😊 RESET'}</span>
        </button>

        <div>⏱️ <span className="text-cyan-400 font-bold">{timer}s</span></div>
      </div>

      {/* Grid Canvas Frame container */}
      <div className="p-3 bg-[#0c0d16] border border-slate-900 rounded-2xl shadow-2xl w-full aspect-square flex flex-col justify-between">
        <div className="grid grid-cols-9 gap-1.5 w-full h-full">
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                onClick={() => revealCell(r, c)}
                onContextMenu={(e) => flagCell(r, c, e)}
                className={`aspect-square border rounded-md flex items-center justify-center font-bold text-xs cursor-pointer transition-colors ${
                  cell.revealed 
                    ? cell.hasMine 
                      ? 'bg-red-500 text-black border-red-600 shadow-inner' 
                      : 'bg-[#131523] border-slate-900/50' 
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 active:bg-slate-600'
                }`}
              >
                {cell.revealed ? (
                  cell.hasMine ? '💣' : cell.neighborMines > 0 ? (
                    <span className={getCellLabelColor(cell.neighborMines)}>{cell.neighborMines}</span>
                  ) : ''
                ) : cell.flagged ? '🚩' : ''}
              </div>
            ))
          )}
        </div>
      </div>

      <p className="text-[10px] text-slate-500 text-center leading-relaxed max-w-[280px]">
        Left-Click to clear squares. <br /><strong>Right-Click (or long press)</strong> to plant flags on mine locations.
      </p>
    </div>
  );
}

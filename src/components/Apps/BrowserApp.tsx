import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { UserPreferences } from '../../types';
import { 
  Globe, ArrowLeft, ArrowRight, RotateCw, Home, Bookmark, BookmarkCheck, History, Search, 
  Shield, ShieldCheck, ExternalLink, Trash2, HelpCircle, Star, Maximize2, Minimize2
} from 'lucide-react';

interface BrowserAppProps {
  userId: string;
  preferences: UserPreferences;
}

interface WebBookmark {
  id: string;
  title: string;
  url: string;
  createdAt: number;
}

interface WebHistoryItem {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
}

interface SavedSearch {
  id: string;
  query: string;
  createdAt: number;
}

// Preset default bookmarks for a rich landing page experience
const DEFAULT_BOOKMARKS = [
  { id: 'def-1', title: 'DuckDuckGo', url: 'https://html.duckduckgo.com/html/' },
  { id: 'def-2', title: 'Wikipedia', url: 'https://en.m.wikipedia.org/wiki/Main_Page' },
  { id: 'def-3', title: 'Hacker News', url: 'https://news.ycombinator.com/' },
  { id: 'def-4', title: 'Dev.to', url: 'https://dev.to/' },
  { id: 'def-5', title: 'Open Library', url: 'https://openlibrary.org/' },
  { id: 'def-6', title: 'NASA Image of the Day', url: 'https://www.nasa.gov/image-of-the-day/' }
];

export default function BrowserApp({ userId, preferences }: BrowserAppProps) {
  const [currentUrl, setCurrentUrl] = useState<string>('home');
  const [inputUrl, setInputUrl] = useState<string>('');
  const [proxyEnabled, setProxyEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [bookmarks, setBookmarks] = useState<WebBookmark[]>([]);
  const [history, setHistory] = useState<WebHistoryItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isBrowserFullScreen, setIsBrowserFullScreen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sidebarTab, setSidebarTab] = useState<'bookmarks' | 'history' | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load Bookmarks, History, and Saved Searches
  useEffect(() => {
    if (userId === 'guest') {
      // In guest mode, load default bookmarks, history and saved searches from local storage
      const savedHistory = localStorage.getItem('aether_browser_history');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
      const savedS = localStorage.getItem('aether_browser_searches');
      if (savedS) {
        setSavedSearches(JSON.parse(savedS));
      }
      return;
    }

    const fetchUserData = async () => {
      try {
        // Fetch bookmarks
        const bookmarksSnap = await getDocs(
          query(collection(db, 'bookmarks'), where('ownerId', '==', userId), orderBy('createdAt', 'desc'))
        );
        const fetchedBookmarks: WebBookmark[] = [];
        bookmarksSnap.forEach((docSnap) => {
          fetchedBookmarks.push({ id: docSnap.id, ...docSnap.data() } as WebBookmark);
        });
        setBookmarks(fetchedBookmarks);

        // Fetch history
        const historySnap = await getDocs(
          query(collection(db, 'history'), where('ownerId', '==', userId), orderBy('visitedAt', 'desc'))
        );
        const fetchedHistory: WebHistoryItem[] = [];
        historySnap.forEach((docSnap) => {
          fetchedHistory.push({ id: docSnap.id, ...docSnap.data() } as WebHistoryItem);
        });
        setHistory(fetchedHistory);

        // Fetch saved searches
        const searchesSnap = await getDocs(
          query(collection(db, 'searches'), where('ownerId', '==', userId), orderBy('createdAt', 'desc'))
        );
        const fetchedSearches: SavedSearch[] = [];
        searchesSnap.forEach((docSnap) => {
          fetchedSearches.push({ id: docSnap.id, ...docSnap.data() } as SavedSearch);
        });
        setSavedSearches(fetchedSearches);
      } catch (err) {
        console.error('Error fetching browser logs:', err);
      }
    };

    fetchUserData();
  }, [userId]);

  const addToHistory = async (url: string) => {
    if (url === 'home') return;
    const title = getHostName(url);
    const visitedAt = Date.now();

    // Prevent duplicate adjacent entries
    if (history.length > 0 && history[0].url === url) return;

    if (userId === 'guest') {
      const newItem: WebHistoryItem = {
        id: `guest-hist-${Date.now()}`,
        title,
        url,
        visitedAt
      };
      const updatedHistory = [newItem, ...history].slice(0, 50);
      setHistory(updatedHistory);
      localStorage.setItem('aether_browser_history', JSON.stringify(updatedHistory));
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'history'), {
        ownerId: userId,
        title,
        url,
        visitedAt
      });
      setHistory(prev => [{ id: docRef.id, title, url, visitedAt }, ...prev].slice(0, 50));
    } catch (err) {
      console.error('Error writing browser history:', err);
    }
  };

  const toggleBookmark = async () => {
    if (currentUrl === 'home') return;
    
    const existing = bookmarks.find(b => b.url === currentUrl);
    if (existing) {
      // Remove bookmark
      if (userId === 'guest') {
        setBookmarks(prev => prev.filter(b => b.id !== existing.id));
        return;
      }
      try {
        await deleteDoc(doc(db, 'bookmarks', existing.id));
        setBookmarks(prev => prev.filter(b => b.id !== existing.id));
      } catch (err) {
        console.error('Error deleting bookmark:', err);
      }
    } else {
      // Add bookmark
      const title = getHostName(currentUrl);
      const createdAt = Date.now();

      if (userId === 'guest') {
        const newB: WebBookmark = {
          id: `guest-b-${Date.now()}`,
          title,
          url: currentUrl,
          createdAt
        };
        setBookmarks(prev => [newB, ...prev]);
        return;
      }

      try {
        const docRef = await addDoc(collection(db, 'bookmarks'), {
          ownerId: userId,
          title,
          url: currentUrl,
          createdAt
        });
        setBookmarks(prev => [{ id: docRef.id, title, url: currentUrl, createdAt }, ...prev]);
      } catch (err) {
        console.error('Error creating bookmark:', err);
      }
    }
  };

  const deleteHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (userId === 'guest') {
      const updated = history.filter(h => h.id !== id);
      setHistory(updated);
      localStorage.setItem('aether_browser_history', JSON.stringify(updated));
      return;
    }
    try {
      await deleteDoc(doc(db, 'history', id));
      setHistory(prev => prev.filter(h => h.id !== id));
    } catch (err) {
      console.error('Error deleting history item:', err);
    }
  };

  const clearAllHistory = async () => {
    if (window.confirm('Are you sure you want to clear your entire browsing history?')) {
      if (userId === 'guest') {
        setHistory([]);
        localStorage.removeItem('aether_browser_history');
        return;
      }
      try {
        // Fetch all history entries
        const q = query(collection(db, 'history'), where('ownerId', '==', userId));
        const snap = await getDocs(q);
        for (const historyDoc of snap.docs) {
          await deleteDoc(doc(db, 'history', historyDoc.id));
        }
        setHistory([]);
      } catch (err) {
        console.error('Failed to clear history:', err);
      }
    }
  };

  const saveSearch = async (queryStr: string) => {
    if (!queryStr || !queryStr.trim()) return;
    const cleanQ = queryStr.trim();
    
    // Check if duplicate exists
    if (savedSearches.some(s => s.query.toLowerCase() === cleanQ.toLowerCase())) return;

    const createdAt = Date.now();
    if (userId === 'guest') {
      const newS: SavedSearch = {
        id: `guest-search-${Date.now()}`,
        query: cleanQ,
        createdAt
      };
      const updated = [newS, ...savedSearches].slice(0, 30);
      setSavedSearches(updated);
      localStorage.setItem('aether_browser_searches', JSON.stringify(updated));
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'searches'), {
        ownerId: userId,
        query: cleanQ,
        createdAt
      });
      setSavedSearches(prev => [{ id: docRef.id, query: cleanQ, createdAt }, ...prev].slice(0, 30));
    } catch (err) {
      console.error('Error saving search query:', err);
    }
  };

  const deleteSearch = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (userId === 'guest') {
      const updated = savedSearches.filter(s => s.id !== id);
      setSavedSearches(updated);
      localStorage.setItem('aether_browser_searches', JSON.stringify(updated));
      return;
    }
    try {
      await deleteDoc(doc(db, 'searches', id));
      setSavedSearches(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Error deleting search:', err);
    }
  };

  const navigateTo = (url: string) => {
    if (!url.trim()) return;

    let target = url.trim();
    // Support typing domain directly or treating as search query
    if (target.includes('.') && !target.includes(' ')) {
      if (!/^https?:\/\//i.test(target)) {
        target = 'https://' + target;
      }
    } else {
      // Save search query
      saveSearch(target);
      // Translate to search
      target = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(target)}`;
    }

    setCurrentUrl(target);
    setInputUrl(target);
    setLoading(true);
    addToHistory(target);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigateTo(searchQuery);
      setSearchQuery('');
    }
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateTo(inputUrl);
  };

  const handleIframeLoad = () => {
    setLoading(false);
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        const currentIframeUrl = iframeRef.current.contentWindow.location.href;
        
        // Extract real target URL from the proxy URL if applicable
        if (currentIframeUrl.includes('/api/proxy')) {
          const urlObj = new URL(currentIframeUrl);
          const proxyUrlParam = urlObj.searchParams.get('url');
          if (proxyUrlParam && proxyUrlParam !== currentUrl) {
            setInputUrl(proxyUrlParam);
            setCurrentUrl(proxyUrlParam);
            addToHistory(proxyUrlParam);
          }
        }
      }
    } catch (e) {
      // Cross-origin fallback safety if standard iframe loading fails same-origin checks
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      setLoading(true);
      // Reload iframe content
      const src = iframeRef.current.src;
      iframeRef.current.src = src;
    }
  };

  const handleHome = () => {
    setCurrentUrl('home');
    setInputUrl('');
    setLoading(false);
  };

  const getHostName = (urlStr: string) => {
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname.replace('www.', '');
    } catch {
      return urlStr;
    }
  };

  const isCurrentBookmarked = bookmarks.some(b => b.url === currentUrl);
  const activeFrameSrc = proxyEnabled 
    ? `/api/proxy?url=${encodeURIComponent(currentUrl)}`
    : currentUrl;

  return (
    <div className={isBrowserFullScreen 
      ? "fixed inset-0 w-screen h-screen z-[9999] bg-[#0b0c11] text-slate-100 font-sans flex flex-col overflow-hidden animate-in fade-in duration-300"
      : "w-full h-full flex flex-col bg-[#0b0c11] text-slate-100 font-sans overflow-hidden relative"
    }>
      {/* Browser Navigation Toolbar */}
      <div className="h-11 bg-slate-900 border-b border-slate-950 flex items-center justify-between px-3 gap-2 shrink-0 select-none">
        <div className="flex items-center gap-1">
          <button
            onClick={handleHome}
            disabled={currentUrl === 'home'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 disabled:opacity-40 hover:bg-slate-800/50 transition-colors cursor-pointer"
            title="Go Home"
          >
            <Home className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleRefresh}
            disabled={currentUrl === 'home'}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-100 disabled:opacity-40 hover:bg-slate-800/50 transition-colors cursor-pointer ${loading ? 'animate-spin' : ''}`}
            title="Refresh Page"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Address bar input form */}
        <form onSubmit={handleAddressSubmit} className="flex-1 max-w-xl">
          <div className="relative flex items-center h-7 bg-slate-950 border border-slate-800 rounded-md focus-within:border-indigo-500/80 transition-colors pl-8 pr-16">
            <Globe className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 shrink-0" />
            <input
              type="text"
              value={currentUrl === 'home' ? inputUrl : inputUrl || currentUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Search DuckDuckGo or enter web address..."
              className="w-full h-full bg-transparent border-none outline-none text-xs text-slate-200 placeholder-slate-600 focus:ring-0 px-0"
              onFocus={(e) => e.target.select()}
            />
            
            {/* Action inside address bar */}
            {currentUrl !== 'home' && (
              <div className="absolute right-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleBookmark}
                  className={`p-1 rounded hover:bg-slate-800 shrink-0 cursor-pointer ${isCurrentBookmarked ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                  title={isCurrentBookmarked ? 'Remove Bookmark' : 'Bookmark Page'}
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                </button>
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 shrink-0 cursor-pointer"
                  title="Open in Native New Tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </form>

        {/* Proxy configuration settings toggle */}
        <div className="flex items-center gap-2">
          {/* Sidebar drawer toggle buttons */}
          <button
            onClick={() => setSidebarTab(sidebarTab === 'bookmarks' ? null : 'bookmarks')}
            className={`px-2 py-1 h-7 rounded text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${sidebarTab === 'bookmarks' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/80'}`}
          >
            <Bookmark className="w-3 h-3" />
            <span>Bookmarks</span>
          </button>
          <button
            onClick={() => setSidebarTab(sidebarTab === 'history' ? null : 'history')}
            className={`px-2 py-1 h-7 rounded text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${sidebarTab === 'history' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/80'}`}
          >
            <History className="w-3 h-3" />
            <span>History</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-800" />

          <button
            onClick={() => setProxyEnabled(!proxyEnabled)}
            className={`flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-[10px] font-semibold cursor-pointer border transition-colors ${
              proxyEnabled 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
                : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
            }`}
            title={proxyEnabled ? "Secure Proxy bypasses CORS/X-Frame blocks (Active)" : "Secure Proxy is inactive (Loading directly)"}
          >
            {proxyEnabled ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">Secure Proxy: Active</span>
                <span className="sm:hidden">Proxy</span>
              </>
            ) : (
              <>
                <Shield className="w-3.5 h-3.5 text-red-400 shrink-0 animate-pulse" />
                <span className="hidden sm:inline">Direct Mode</span>
                <span className="sm:hidden">Direct</span>
              </>
            )}
          </button>

          <div className="h-4 w-[1px] bg-slate-800" />

          <button
            onClick={() => setIsBrowserFullScreen(!isBrowserFullScreen)}
            className={`flex items-center gap-1 px-2.5 h-7 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer ${
              isBrowserFullScreen 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' 
                : 'bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700'
            }`}
            title={isBrowserFullScreen ? "Exit Full Screen Browser" : "Go Full Screen Browser"}
          >
            {isBrowserFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isBrowserFullScreen ? "Normal Window" : "Full Screen"}</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout (Sidebar + Browsing Stage) */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Navigation/Resource Sidebar Drawer */}
        {sidebarTab && (
          <div className="w-64 bg-slate-950 border-r border-slate-900 flex flex-col shrink-0 z-10 animate-in slide-in-from-left duration-200">
            <div className="h-9 px-3 border-b border-slate-900/60 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                {sidebarTab === 'bookmarks' ? <Bookmark className="w-3 h-3 text-indigo-400" /> : <History className="w-3 h-3 text-indigo-400" />}
                <span>{sidebarTab === 'bookmarks' ? 'Bookmarks Vault' : 'Browsing History'}</span>
              </span>
              {sidebarTab === 'history' && history.length > 0 && (
                <button
                  onClick={clearAllHistory}
                  className="text-[9px] text-red-400 hover:text-red-300 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* List entries */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sidebarTab === 'bookmarks' ? (
                <>
                  {bookmarks.length === 0 && (
                    <div className="text-center py-6 text-slate-500 text-[11px] italic">
                      No custom bookmarks yet. Use the star icon on any website.
                    </div>
                  )}
                  {/* Preset defaults */}
                  {bookmarks.length > 0 && <div className="text-[9px] uppercase font-bold text-slate-600 px-2 py-1 select-none">Saved Bookmarks</div>}
                  {bookmarks.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => navigateTo(b.url)}
                      className="group flex items-center justify-between p-2 rounded-lg bg-slate-900/30 hover:bg-slate-900/90 border border-transparent hover:border-slate-800 cursor-pointer transition-colors"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-xs font-medium text-slate-200 truncate">{b.title}</p>
                        <p className="text-[9px] text-slate-500 truncate">{b.url}</p>
                      </div>
                      <BookmarkCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}

                  <div className="text-[9px] uppercase font-bold text-slate-600 px-2 pt-3 pb-1 select-none">Default Presets</div>
                  {DEFAULT_BOOKMARKS.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => navigateTo(b.url)}
                      className="group flex items-center justify-between p-2 rounded-lg bg-slate-900/10 hover:bg-slate-900/90 border border-transparent hover:border-slate-800 cursor-pointer transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-300 truncate">{b.title}</p>
                        <p className="text-[9px] text-slate-600 truncate">{b.url}</p>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-slate-400 shrink-0 ml-1.5 transition-colors" />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {history.length === 0 && (
                    <div className="text-center py-6 text-slate-500 text-[11px] italic">
                      Browsing history is empty.
                    </div>
                  )}
                  {history.map((h) => (
                    <div
                      key={h.id}
                      onClick={() => navigateTo(h.url)}
                      className="group flex items-center justify-between p-2 rounded-lg bg-slate-900/30 hover:bg-slate-900/90 border border-transparent hover:border-slate-800 cursor-pointer transition-all"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-xs font-medium text-slate-300 truncate">{h.title}</p>
                        <p className="text-[9px] text-slate-500 truncate font-mono leading-none mt-0.5">{getHostName(h.url)}</p>
                        <p className="text-[8px] text-slate-600 mt-1">{new Date(h.visitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <button
                        onClick={(e) => deleteHistoryItem(h.id, e)}
                        className="p-1 rounded hover:bg-red-500/10 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
                        title="Delete from history"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* Viewport content */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0f111a]">
          {currentUrl === 'home' ? (
            /* Gorgeous Search Dashboard / Home Screen */
            <div className="flex-1 overflow-y-auto p-6 sm:p-12 flex flex-col items-center justify-center relative">
              <div className="absolute inset-0 bg-radial-gradient from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
              
              <div className="max-w-2xl w-full text-center space-y-8 relative">
                {/* Visual Header */}
                <div className="space-y-2 select-none">
                  <div className="mx-auto w-12 h-12 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-3 animate-pulse">
                    <Globe className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-3xl font-extrabold tracking-tight text-white font-display">AETHER SURF</h1>
                  <p className="text-xs text-indigo-300/60 uppercase tracking-widest font-semibold font-mono">Secure Cloud-Proxied Workstation Web Browser</p>
                </div>

                {/* Main Search Bar Form */}
                <form onSubmit={handleSearchSubmit} className="max-w-lg mx-auto relative group">
                  <div className="absolute inset-0 bg-indigo-500/10 rounded-2xl blur-lg group-focus-within:bg-indigo-500/20 transition-all duration-300" />
                  <div className="relative flex items-center bg-slate-900 border border-slate-800 rounded-xl focus-within:border-indigo-500/80 shadow-2xl shadow-indigo-950/40 p-1">
                    <Search className="w-4 h-4 text-slate-500 ml-3.5 shrink-0" />
                    <input
                      type="text"
                      placeholder="Type a web address (e.g. news.ycombinator.com) or search DuckDuckGo..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-xs text-white placeholder-slate-500 focus:ring-0 px-3.5"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
                    >
                      Search
                    </button>
                  </div>
                </form>

                {/* Helpful Proxy Banner info */}
                <div className="max-w-md mx-auto p-3.5 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-left text-[11px] leading-relaxed text-emerald-400/80 flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white/90">AetherOS High-Fidelity Proxy Protection</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Websites usually block frame integration using `SAMEORIGIN` headers or CORS policies. Surf automatically tunnels requests via the OS Cloud container server to safely strip headers, allowing Wikipedia, news, and dev resources to render seamlessly.
                    </p>
                  </div>
                </div>

                {/* Recent Saved Searches */}
                {savedSearches.length > 0 && (
                  <div className="space-y-2.5 max-w-xl mx-auto pt-2 text-left animate-in fade-in duration-200">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recent Saved Searches</h3>
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm('Clear all saved search queries?')) {
                            if (userId === 'guest') {
                              setSavedSearches([]);
                              localStorage.removeItem('aether_browser_searches');
                              return;
                            }
                            try {
                              const q = query(collection(db, 'searches'), where('ownerId', '==', userId));
                              const snap = await getDocs(q);
                              for (const d of snap.docs) {
                                await deleteDoc(doc(db, 'searches', d.id));
                              }
                              setSavedSearches([]);
                            } catch (err) {
                              console.error('Failed to clear searches:', err);
                            }
                          }
                        }}
                        className="text-[9px] text-slate-500 hover:text-red-400 hover:underline cursor-pointer bg-transparent border-none"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {savedSearches.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => navigateTo(s.query)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-slate-700/80 cursor-pointer transition-all text-xs text-slate-300 hover:text-indigo-300 group"
                        >
                          <span>{s.query}</span>
                          <button
                            type="button"
                            onClick={(e) => deleteSearch(s.id, e)}
                            className="p-0.5 rounded text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-transparent border-none ml-1 shrink-0"
                            title="Delete Search"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Link Launcher Grid */}
                <div className="space-y-2.5 max-w-xl mx-auto pt-4 text-left">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Quick Launch Resources</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {DEFAULT_BOOKMARKS.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => navigateTo(item.url)}
                        className="p-3.5 rounded-xl border border-slate-800/60 bg-slate-900/30 hover:bg-slate-900/90 hover:border-slate-700/80 hover:-translate-y-0.5 transition-all cursor-pointer group flex flex-col justify-between"
                      >
                        <p className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">{item.title}</p>
                        <div className="flex items-center gap-1 mt-2">
                          <span className="text-[9px] text-slate-500 font-mono truncate flex-1">{getHostName(item.url)}</span>
                          <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-indigo-400 transition-all group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Sandboxed Frame Window Rendering Page content */
            <div className="flex-1 flex flex-col relative min-h-0 bg-white">
              {/* Spinner loader indicator */}
              {loading && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-950 overflow-hidden z-20">
                  <div className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500 animate-pulse" style={{ width: '100%' }} />
                </div>
              )}

              {/* Sandboxed Interactive Iframe Browser stage */}
              <iframe
                ref={iframeRef}
                src={activeFrameSrc}
                title="Aether Browser Active Tab"
                onLoad={handleIframeLoad}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                className="w-full h-full border-none bg-white"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { AppID, AppWindow, UserPreferences } from './types';

// Background Cleanup Routine for Inactive Accounts (inactive for over 1 month / 30 days)
async function performInactiveAccountsCleanup(currentUserId?: string) {
  try {
    const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days in ms
    console.log('[Security Cleanup] Running inactive accounts sweep...');
    
    // 1. Fetch all user profile documents
    const usersSnap = await getDocs(collection(db, 'users'));
    let deletedCount = 0;

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;

      // Skip the guest account and the currently active logged-in user
      if (userId === 'guest' || userId === currentUserId) {
        continue;
      }

      const lastAccessed = userData.lastAccessed || userData.createdAt || 0;

      if (lastAccessed < oneMonthAgo) {
        console.log(`[Security Cleanup] Found inactive account: ${userId} (${userData.userName || 'Unknown'}), last active: ${new Date(lastAccessed).toLocaleDateString()}`);

        // Delete related notes
        const notesQuery = query(collection(db, 'notes'), where('ownerId', '==', userId));
        const notesSnap = await getDocs(notesQuery);
        for (const noteDoc of notesSnap.docs) {
          await deleteDoc(doc(db, 'notes', noteDoc.id));
        }

        // Delete related code projects
        const codesQuery = query(collection(db, 'codes'), where('ownerId', '==', userId));
        const codesSnap = await getDocs(codesQuery);
        for (const codeDoc of codesSnap.docs) {
          await deleteDoc(doc(db, 'codes', codeDoc.id));
        }

        // Delete related files & folders
        const filesQuery = query(collection(db, 'files'), where('ownerId', '==', userId));
        const filesSnap = await getDocs(filesQuery);
        for (const fileDoc of filesSnap.docs) {
          await deleteDoc(doc(db, 'files', fileDoc.id));
        }

        // Delete user preference/profile doc itself
        await deleteDoc(doc(db, 'users', userId));
        deletedCount++;
        console.log(`[Security Cleanup] Successfully wiped and deleted inactive account: ${userId}`);
      }
    }

    if (deletedCount > 0) {
      console.log(`[Security Cleanup] Sweep complete. Permanently deleted ${deletedCount} inactive account(s) and wiped their data.`);
    } else {
      console.log('[Security Cleanup] Sweep complete. No inactive accounts found.');
    }
  } catch (error) {
    console.error('[Security Cleanup] Error executing inactive accounts sweep:', error);
  }
}

// Importing Custom Components
import LoginScreen from './components/LoginScreen';
import Window from './components/Window';
import Taskbar from './components/Taskbar';
import StartMenu from './components/StartMenu';
import WidgetsPanel from './components/WidgetsPanel';

// Importing App Pages
import NotepadApp from './components/Apps/NotepadApp';
import CodeApp from './components/Apps/CodeApp';
import AiApp from './components/Apps/AiApp';
import FileStorageApp from './components/Apps/FileStorageApp';
import SettingsApp from './components/Apps/SettingsApp';
import BrowserApp from './components/Apps/BrowserApp';
import GamesApp from './components/Apps/GamesApp';

// Icons for Desktop Shortcuts
import { FileText, Code, Bot, HardDrive, Settings, Globe, Gamepad2 } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    userName: 'Developer',
    desktopWallpaper: 'dark',
    glassBlur: 20,
    customApiKey: ''
  });
  const [loading, setLoading] = useState(true);

  // Desktop OS State
  const [openWindows, setOpenWindows] = useState<AppWindow[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isWidgetsOpen, setIsWidgetsOpen] = useState(false);
  const [maxZIndex, setMaxZIndex] = useState(10);

  // Monitor Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Fetch user preferences from Firestore
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setPreferences(docSnap.data() as UserPreferences);
            // Update lastAccessed timestamp for active session
            await updateDoc(docRef, { lastAccessed: Date.now() });
          }
          // Trigger the inactive account cleanup run in background
          performInactiveAccountsCleanup(user.uid);
        } catch (err) {
          console.error('Error fetching user preferences / updating lastAccessed:', err);
        }
      } else {
        // Only set to null if not currently a guest
        setCurrentUser((prev: any) => {
          if (prev?.uid === 'guest') return prev;
          setOpenWindows([]);
          setActiveWindowId(null);
          return null;
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (userId: string) => {
    // Auth observer handles the fetching automatically
    setIsWidgetsOpen(true); // Open widgets as a friendly greeting!
  };

  const handleGuestLogin = () => {
    setCurrentUser({ uid: 'guest', isGuest: true, email: 'guest@aetheros.com' });
    setPreferences({
      userName: 'Guest User',
      desktopWallpaper: 'dark',
      glassBlur: 20,
      customApiKey: ''
    });
    setIsWidgetsOpen(true); // Open widgets as a friendly greeting!
  };

  const handleLogout = async () => {
    try {
      if (currentUser?.uid === 'guest') {
        setCurrentUser(null);
        setOpenWindows([]);
        setActiveWindowId(null);
      } else {
        await signOut(auth);
        setCurrentUser(null);
        setOpenWindows([]);
        setActiveWindowId(null);
      }
      setIsStartMenuOpen(false);
      setIsWidgetsOpen(false);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Open an App window
  const handleOpenApp = (appType: AppID) => {
    // Check if window is already open
    const existing = openWindows.find((w) => w.appType === appType);
    if (existing) {
      // If minimized, restore it
      if (existing.isMinimized) {
        handleToggleMinimize(existing.id);
      } else {
        // Bring to front
        handleFocusWindow(existing.id);
      }
      return;
    }

    // Spawn coordinate calculations (offset cascade slightly)
    const offset = openWindows.length * 25;
    const initialX = Math.min(window.innerWidth - 600, 150 + offset);
    const initialY = Math.min(window.innerHeight - 450, 120 + offset);

    const titleMap: Record<AppID, string> = {
      notepad: 'Personal Notes Workspace',
      coding: 'CodePad IDE Playground',
      ai: 'AI System Core',
      files: 'Aether Crypt File Storage',
      settings: 'System Settings Panel',
      browser: 'Aether Surf Web Browser',
      games: 'Aether Recreation Hub & Arcade'
    };

    const newZ = maxZIndex + 1;
    setMaxZIndex(newZ);

    const newWindow: AppWindow = {
      id: `${appType}-${Date.now()}`,
      title: titleMap[appType],
      appType,
      isMinimized: false,
      isMaximized: false,
      x: initialX,
      y: initialY,
      w: 650,
      h: 460,
      zIndex: newZ
    };

    setOpenWindows([...openWindows, newWindow]);
    setActiveWindowId(newWindow.id);
  };

  // Focus Window (bring to top)
  const handleFocusWindow = (id: string) => {
    const nextZ = maxZIndex + 1;
    setMaxZIndex(nextZ);
    setOpenWindows(openWindows.map(w => w.id === id ? { ...w, isMinimized: false, zIndex: nextZ } : w));
    setActiveWindowId(id);
  };

  // Close App window
  const handleCloseWindow = (id: string) => {
    setOpenWindows(openWindows.filter(w => w.id !== id));
    if (activeWindowId === id) {
      const remaining = openWindows.filter(w => w.id !== id && !w.isMinimized);
      if (remaining.length > 0) {
        // Focus latest opened
        const sorted = [...remaining].sort((a, b) => b.zIndex - a.zIndex);
        setActiveWindowId(sorted[0].id);
      } else {
        setActiveWindowId(null);
      }
    }
  };

  // Toggle Minimize
  const handleToggleMinimize = (id: string) => {
    const target = openWindows.find(w => w.id === id);
    if (!target) return;

    if (target.isMinimized) {
      // Restore
      const nextZ = maxZIndex + 1;
      setMaxZIndex(nextZ);
      setOpenWindows(openWindows.map(w => w.id === id ? { ...w, isMinimized: false, zIndex: nextZ } : w));
      setActiveWindowId(id);
    } else {
      // Minimize
      setOpenWindows(openWindows.map(w => w.id === id ? { ...w, isMinimized: true } : w));
      if (activeWindowId === id) {
        const remaining = openWindows.filter(w => w.id !== id && !w.isMinimized);
        if (remaining.length > 0) {
          const sorted = [...remaining].sort((a, b) => b.zIndex - a.zIndex);
          setActiveWindowId(sorted[0].id);
        } else {
          setActiveWindowId(null);
        }
      }
    }
  };

  // Toggle Maximize
  const handleToggleMaximize = (id: string) => {
    setOpenWindows(openWindows.map(w => w.id === id ? { ...w, isMaximized: !w.isMaximized } : w));
  };

  // Handle Window Movement
  const handleMoveWindow = (id: string, x: number, y: number) => {
    setOpenWindows(openWindows.map(w => w.id === id ? { ...w, x, y } : w));
  };

  // Handle Window Resizing
  const handleResizeWindow = (id: string, w: number, h: number) => {
    setOpenWindows(openWindows.map(w => w.id === id ? { ...w, w, h } : w));
  };

  // Helper Wallpaper background matching user preference
  const getBackgroundClass = () => {
    switch (preferences.desktopWallpaper) {
      case 'light':
        return 'bg-slate-100 bg-gradient-to-br from-slate-200 via-slate-100 to-white';
      case 'dark':
      default:
        return 'bg-[#0b0c10] bg-gradient-to-br from-[#0c0d12] via-[#101216] to-[#08090a]';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center font-sans">
        <span className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs text-white/40 tracking-wider">Loading secure workstation...</span>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} onGuestLogin={handleGuestLogin} />;
  }

  // Desktop shortcuts
  const desktopApps = [
    { id: 'notepad' as AppID, name: 'Cloud Notes', icon: <FileText className="w-6 h-6 text-cyan-400" /> },
    { id: 'coding' as AppID, name: 'Code IDE', icon: <Code className="w-6 h-6 text-purple-400" /> },
    { id: 'ai' as AppID, name: 'AI System', icon: <Bot className="w-6 h-6 text-indigo-400" /> },
    { id: 'files' as AppID, name: 'File Vault', icon: <HardDrive className="w-6 h-6 text-emerald-400" /> },
    { id: 'browser' as AppID, name: 'Web Browser', icon: <Globe className="w-6 h-6 text-indigo-400" /> },
    { id: 'games' as AppID, name: 'Arcade Hub', icon: <Gamepad2 className="w-6 h-6 text-rose-400 animate-pulse" /> },
    { id: 'settings' as AppID, name: 'Settings', icon: <Settings className="w-6 h-6 text-slate-400" /> }
  ];

  const userInitials = (preferences.userName || 'AR')
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isLight = preferences.desktopWallpaper === 'light';

  return (
    <div
      id="desktop-os-wrapper"
      className={`fixed inset-0 w-full h-full select-none overflow-hidden font-sans sm:p-6 p-3 ${getBackgroundClass()} ${isLight ? 'theme-light text-slate-800' : 'theme-dark text-white'}`}
    >
      {/* Background Atmospheric Glows */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-50px] right-[-50px] w-[400px] h-[400px] bg-cyan-900/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Subtle Grid Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />

      {/* Top Bar / System Info */}
      <div className="flex justify-between items-center z-10 sm:mb-8 mb-4 relative">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h1 className="text-sm sm:text-lg font-semibold tracking-tight text-white font-display leading-tight">AetherOS</h1>
            <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-slate-500 font-bold leading-none">v.2.4 Alpha</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 sm:space-x-6">
          <div className="bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 hidden md:flex items-center space-x-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="text-xs font-medium text-slate-300">Encrypted Storage: 84% Free</span>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="text-right">
              <p className="text-[10px] sm:text-xs font-bold text-white leading-none">{preferences.userName || 'Developer'}</p>
              <p className="text-[8px] sm:text-[10px] text-slate-500 leading-tight font-medium">
                {currentUser?.uid === 'guest' ? 'Guest Mode' : 'Standard'}
              </p>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-indigo-500/50 p-0.5 shrink-0">
              {preferences.avatarUrl ? (
                <img src={preferences.avatarUrl} alt="User Profile" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-[10px] sm:text-xs font-bold text-slate-200">
                  {userInitials}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Pinned Desktop Icon Shortcuts */}
      <div className="flex sm:flex-col flex-row flex-wrap sm:gap-6 gap-4 items-start absolute sm:top-28 top-20 sm:left-6 left-3 right-3 sm:right-auto z-0 justify-start sm:justify-items-start">
        {desktopApps.map((app) => (
          <div
            key={app.id}
            onDoubleClick={() => handleOpenApp(app.id)}
            onClick={() => handleOpenApp(app.id)} // Support single tap click since mobile / single click is fast
            className="flex flex-col items-center text-center group cursor-pointer w-16 sm:w-20"
          >
            <div className="w-11 h-11 sm:w-14 sm:h-14 bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 flex items-center justify-center mb-1 group-hover:bg-white/10 transition-all shadow-lg group-hover:scale-105">
              {app.icon}
            </div>
            <span className="text-[9px] sm:text-[11px] font-medium text-slate-400 group-hover:text-slate-200 transition-colors truncate w-full">
              {app.name}
            </span>
          </div>
        ))}
      </div>

      {/* Render Dynamic Open Windows */}
      <AnimatePresence>
        {openWindows.map((win) => {
          const isActive = activeWindowId === win.id;

          return (
            <Window
              key={win.id}
              window={win}
              isActive={isActive}
              onFocus={() => handleFocusWindow(win.id)}
              onClose={() => handleCloseWindow(win.id)}
              onMinimize={() => handleToggleMinimize(win.id)}
              onMaximize={() => handleToggleMaximize(win.id)}
              onMove={(x, y) => handleMoveWindow(win.id, x, y)}
              onResize={(w, h) => handleResizeWindow(win.id, w, h)}
            >
              {win.appType === 'notepad' && (
                <NotepadApp userId={currentUser.uid} preferences={preferences} />
              )}
              {win.appType === 'coding' && (
                <CodeApp userId={currentUser.uid} preferences={preferences} />
              )}
              {win.appType === 'ai' && (
                <AiApp
                  userId={currentUser.uid}
                  preferences={preferences}
                  onUpdatePreferences={(updated) => setPreferences({ ...preferences, ...updated })}
                />
              )}
              {win.appType === 'files' && (
                <FileStorageApp userId={currentUser.uid} preferences={preferences} />
              )}
              {win.appType === 'browser' && (
                <BrowserApp userId={currentUser.uid} preferences={preferences} />
              )}
              {win.appType === 'games' && (
                <GamesApp userId={currentUser.uid} preferences={preferences} />
              )}
              {win.appType === 'settings' && (
                <SettingsApp
                  userId={currentUser.uid}
                  preferences={preferences}
                  onUpdatePreferences={(updated) => setPreferences({ ...preferences, ...updated })}
                  onLogout={handleLogout}
                />
              )}
            </Window>
          );
        })}
      </AnimatePresence>

      {/* Sliding Widgets Overlay Sidebar */}
      <AnimatePresence>
        {isWidgetsOpen && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-[96px] right-6 bottom-28 w-[350px] max-w-[90%] z-[998] pointer-events-auto rounded-[2rem] border border-white/10 p-5 overflow-y-auto shadow-2xl shadow-black/80"
          >
            {/* Ambient sliding panel background */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xl -z-10" />
            <div className="absolute inset-0 bg-gradient-to-tr from-white/2 via-white/5 to-transparent pointer-events-none -z-10" />

            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <h3 className="font-display font-semibold text-cyan-200 tracking-wide text-xs">Aether Live Desk</h3>
              <button
                onClick={() => setIsWidgetsOpen(false)}
                className="text-[10px] text-white/40 hover:text-white"
              >
                Hide
              </button>
            </div>

            <WidgetsPanel
              userName={preferences.userName}
              totalStorageUsed={0} // Dynamically handled inside storage app, simple visual placeholder here
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sliding Start Menu Container */}
      <AnimatePresence>
        {isStartMenuOpen && (
          <StartMenu
            userName={preferences.userName}
            avatarUrl={preferences.avatarUrl}
            onOpenApp={handleOpenApp}
            onLogout={handleLogout}
            onClose={() => setIsStartMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Dynamic bottom task tray */}
      <Taskbar
        openWindows={openWindows}
        activeWindowId={activeWindowId}
        onOpenApp={handleOpenApp}
        onToggleMinimize={handleToggleMinimize}
        onToggleStartMenu={() => {
          setIsStartMenuOpen(!isStartMenuOpen);
          setIsWidgetsOpen(false); // Close widgets to space out
        }}
        onToggleWidgets={() => {
          setIsWidgetsOpen(!isWidgetsOpen);
          setIsStartMenuOpen(false); // Close start menu
        }}
        isStartMenuOpen={isStartMenuOpen}
        isWidgetsOpen={isWidgetsOpen}
      />
    </div>
  );
}

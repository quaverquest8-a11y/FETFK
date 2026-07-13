/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppID } from '../types';
import { Search, Bot, FileText, Code, HardDrive, Sliders, LogOut, SearchIcon, Globe, Gamepad2 } from 'lucide-react';

interface StartMenuProps {
  userName: string;
  avatarUrl?: string;
  onOpenApp: (appId: AppID) => void;
  onLogout: () => void;
  onClose: () => void;
}

export default function StartMenu({
  userName,
  avatarUrl,
  onOpenApp,
  onLogout,
  onClose
}: StartMenuProps) {
  const [search, setSearch] = useState('');

  const appShortcuts = [
    { id: 'notepad' as AppID, name: 'Personal Notepad', icon: <FileText className="w-5 h-5 text-cyan-400" />, desc: 'Draft cloud synced notes' },
    { id: 'coding' as AppID, name: 'CodePad Studio', icon: <Code className="w-5 h-5 text-purple-400" />, desc: 'Compile JS, HTML, Python' },
    { id: 'ai' as AppID, name: 'Gemini Chatbot', icon: <Bot className="w-5 h-5 text-indigo-400" />, desc: 'Custom parameter smart bot' },
    { id: 'files' as AppID, name: 'File Storage', icon: <HardDrive className="w-5 h-5 text-emerald-400" />, desc: 'Base64 document locker' },
    { id: 'browser' as AppID, name: 'Aether Surf', icon: <Globe className="w-5 h-5 text-indigo-400" />, desc: 'Secure cloud proxy web browser' },
    { id: 'games' as AppID, name: 'Aether Arcade', icon: <Gamepad2 className="w-5 h-5 text-rose-400" />, desc: 'Snake, Space Defender, Bricks, 2048, Mines' },
    { id: 'settings' as AppID, name: 'System Settings', icon: <Sliders className="w-5 h-5 text-slate-400" />, desc: 'Aesthetics, blur, backgrounds' }
  ];

  const filteredShortcuts = appShortcuts.filter(app =>
    app.name.toLowerCase().includes(search.toLowerCase()) ||
    app.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md p-6 rounded-[2rem] border border-white/10 shadow-2xl shadow-black/80 font-sans text-white z-[999] overflow-hidden select-none"
    >
      {/* Real Glassmorphism backing */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xl -z-10" />
      {/* Glossy sheen */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/2 via-white/5 to-transparent pointer-events-none -z-10" />

      {/* Futuristic search input */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type="text"
          placeholder="Search workspace apps..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md text-white placeholder-white/35 focus:border-cyan-400/50 focus:bg-white/10 outline-none text-xs transition-all"
        />
      </div>

      {/* Grid listing */}
      <div className="space-y-4">
        <div>
          <h4 className="text-[10px] text-white/35 uppercase font-mono tracking-wider mb-2 pl-1">Pinned Workstation Apps</h4>
          {filteredShortcuts.length === 0 ? (
            <div className="text-center py-6 text-white/20 text-xs italic">
              No matching applications located
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {filteredShortcuts.map((app) => (
                <div
                  key={app.id}
                  onClick={() => {
                    onOpenApp(app.id);
                    onClose();
                  }}
                  className="group p-3 rounded-2xl border border-white/5 bg-white/3 hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer flex items-center gap-3"
                >
                  <div className="p-2.5 rounded-xl bg-slate-900/40 group-hover:scale-105 transition-all shrink-0">
                    {app.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-100">{app.name}</p>
                    <p className="text-[10px] text-white/40 truncate mt-0.5">{app.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer profile panel */}
      <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20 shrink-0 bg-slate-800">
            {avatarUrl ? (
              <img src={avatarUrl} alt="profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-xs bg-gradient-to-tr from-cyan-500 to-purple-600 text-white">
                {userName ? userName.slice(0, 2).toUpperCase() : 'ME'}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-white">{userName || 'Developer'}</p>
            <p className="text-[9px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span>Workspace Connected</span>
            </p>
          </div>
        </div>

        {/* Action logoff shutdown */}
        <button
          onClick={() => {
            onLogout();
            onClose();
          }}
          className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 transition-all cursor-pointer"
          title="Sign off workstation"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

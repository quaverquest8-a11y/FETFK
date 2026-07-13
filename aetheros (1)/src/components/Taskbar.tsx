/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppID, AppWindow } from '../types';
import { Bot, FileText, Code, HardDrive, Sliders, Layout, Calendar, Clock, Terminal } from 'lucide-react';

interface TaskbarProps {
  openWindows: AppWindow[];
  activeWindowId: string | null;
  onOpenApp: (appId: AppID) => void;
  onToggleMinimize: (id: string) => void;
  onToggleStartMenu: () => void;
  onToggleWidgets: () => void;
  isStartMenuOpen: boolean;
  isWidgetsOpen: boolean;
}

export default function Taskbar({
  openWindows,
  activeWindowId,
  onOpenApp,
  onToggleMinimize,
  onToggleStartMenu,
  onToggleWidgets,
  isStartMenuOpen,
  isWidgetsOpen
}: TaskbarProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000); // refresh every minute
    return () => clearInterval(timer);
  }, []);

  const apps = [
    { id: 'notepad' as AppID, name: 'Notepad', icon: <FileText className="w-4.5 h-4.5 text-cyan-400" /> },
    { id: 'coding' as AppID, name: 'CodePad', icon: <Code className="w-4.5 h-4.5 text-purple-400" /> },
    { id: 'ai' as AppID, name: 'Gemini', icon: <Bot className="w-4.5 h-4.5 text-indigo-400" /> },
    { id: 'files' as AppID, name: 'Files', icon: <HardDrive className="w-4.5 h-4.5 text-emerald-400" /> },
    { id: 'settings' as AppID, name: 'Settings', icon: <Sliders className="w-4.5 h-4.5 text-slate-400" /> }
  ];

  const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div className="fixed sm:bottom-6 sm:left-6 sm:right-6 bottom-0 left-0 right-0 sm:h-16 h-14 flex items-center justify-between z-[9999] select-none font-sans sm:px-6 px-3">
      {/* Real Glassmorphism panel */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xl border-t sm:border border-white/10 sm:rounded-[2rem] rounded-none -z-10 shadow-2xl shadow-black/60" />
      <div className="absolute inset-0 bg-gradient-to-tr from-white/2 to-white/5 sm:rounded-[2rem] rounded-none pointer-events-none -z-10" />

      {/* Left Tray: Widgets Toggle and System Indicator */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggleWidgets}
          className={`p-2 sm:p-2.5 rounded-xl border hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 ${
            isWidgetsOpen ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300' : 'bg-white/3 border-white/5'
          }`}
          title="Toggle system widgets panel"
        >
          <Layout className="w-4 h-4" />
          <span className="text-[10px] font-semibold hidden sm:inline-block">System Widgets</span>
        </button>
      </div>

      {/* Center Anchor: App list launch tray */}
      <div className="flex items-center gap-0.5 sm:gap-1 bg-white/2 border border-white/5 rounded-2xl p-0.5 sm:p-1 shrink-0">
        
        {/* Core launcher / Start button */}
        <button
          onClick={onToggleStartMenu}
          className={`p-2 sm:p-2.5 rounded-xl border hover:scale-105 hover:bg-white/10 text-cyan-400 transition-all cursor-pointer ${
            isStartMenuOpen ? 'bg-cyan-500/25 border-cyan-500/30 shadow-inner' : 'bg-transparent border-transparent'
          }`}
          title="Aether Workspace Menu"
        >
          {/* Custom logo icon built from scratch */}
          <div className="w-5 h-5 flex flex-wrap gap-0.5 relative justify-center items-center">
            <span className="w-2 h-2 rounded-sm bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
            <span className="w-2 h-2 rounded-sm bg-purple-500" />
            <span className="w-2 h-2 rounded-sm bg-indigo-500" />
            <span className="w-2 h-2 rounded-sm bg-emerald-400" />
          </div>
        </button>

        <div className="w-[1px] h-6 bg-white/10 mx-0.5 sm:mx-1" />

        {/* Dynamic Shortcut keys and Open instances lists */}
        {apps.map((app) => {
          // Check if this app has open window(s)
          const openInstance = openWindows.find(w => w.appType === app.id);
          const isOpen = !!openInstance;
          const isFocused = openInstance && activeWindowId === openInstance.id;

          return (
            <button
              key={app.id}
              onClick={() => {
                if (isOpen) {
                  onToggleMinimize(openInstance.id);
                } else {
                  onOpenApp(app.id);
                }
              }}
              className={`p-2 sm:p-2.5 rounded-xl relative group transition-all duration-300 flex flex-col items-center cursor-pointer ${
                isFocused
                  ? 'bg-white/10 text-white scale-105'
                  : isOpen
                    ? 'hover:bg-white/5 text-slate-300'
                    : 'hover:bg-white/5 text-slate-400 hover:text-white hover:scale-105'
              }`}
              title={app.name}
            >
              <div className="group-hover:scale-110 transition-all">
                {app.icon}
              </div>

              {/* Pill status indicators under shortcuts */}
              {isOpen && (
                <span className={`absolute bottom-0.5 w-1 h-0.5 sm:bottom-1 sm:w-1.5 sm:h-1 rounded-full transition-all ${
                  isFocused
                    ? 'bg-cyan-400 w-2.5 sm:w-3 shadow-[0_0_5px_#22d3ee]'
                    : 'bg-white/30'
                }`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Right Tray: Network Status, Time, and Clock */}
      <div className="flex items-center gap-1.5">
        <div
          onClick={onToggleWidgets}
          className="flex flex-col items-end border border-white/5 bg-white/2 hover:bg-white/5 transition-all p-1.5 rounded-xl cursor-pointer"
        >
          <span className="text-[10px] sm:text-[11px] font-semibold text-white/90 leading-none">{formattedTime}</span>
          <span className="text-[7px] sm:text-[8px] text-white/35 font-mono mt-0.5 tracking-wider uppercase hidden xs:inline-block">Tray Widgets</span>
        </div>
      </div>
    </div>
  );
}

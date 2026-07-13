/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { UserPreferences } from '../../types';
import { Sliders, Palette, Shield, Info, Check, RefreshCw, LogOut, Trash2, Settings, Sparkles, Cpu, Key } from 'lucide-react';
import { motion } from 'motion/react';

interface SettingsAppProps {
  userId: string;
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: Partial<UserPreferences>) => void;
  onLogout: () => void;
}

export default function SettingsApp({ userId, preferences, onUpdatePreferences, onLogout }: SettingsAppProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'personalization' | 'security' | 'info' | 'ai'>('profile');
  const [userNameInput, setUserNameInput] = useState(preferences.userName);
  const [updating, setUpdating] = useState(false);
  const [success, setSuccess] = useState(false);

  // AI System preferences state
  const [aiEnabled, setAiEnabled] = useState(preferences.aiEnabled !== false);
  const [aiProvider, setAiProvider] = useState(preferences.aiProvider || 'gemini');
  const [aiModel, setAiModel] = useState(preferences.aiModel || '');
  const [geminiKey, setGeminiKey] = useState(preferences.geminiApiKey || preferences.customApiKey || '');
  const [openaiKey, setOpenaiKey] = useState(preferences.openaiApiKey || '');
  const [claudeKey, setClaudeKey] = useState(preferences.claudeApiKey || '');
  const [openrouterKey, setOpenrouterKey] = useState(preferences.openrouterApiKey || '');
  const [aiUpdating, setAiUpdating] = useState(false);
  const [aiSuccess, setAiSuccess] = useState(false);

  useEffect(() => {
    setAiEnabled(preferences.aiEnabled !== false);
    setAiProvider(preferences.aiProvider || 'gemini');
    setAiModel(preferences.aiModel || '');
    setGeminiKey(preferences.geminiApiKey || preferences.customApiKey || '');
    setOpenaiKey(preferences.openaiApiKey || '');
    setClaudeKey(preferences.claudeApiKey || '');
    setOpenrouterKey(preferences.openrouterApiKey || '');
  }, [preferences]);

  const handleSaveAiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiUpdating(true);
    setAiSuccess(false);

    const updatedData: Partial<UserPreferences> = {
      aiEnabled,
      aiProvider: aiProvider as any,
      aiModel: aiModel.trim() || undefined,
      geminiApiKey: geminiKey.trim(),
      openaiApiKey: openaiKey.trim(),
      claudeApiKey: claudeKey.trim(),
      openrouterApiKey: openrouterKey.trim(),
      customApiKey: geminiKey.trim() // Maintain sync with customApiKey for older code
    };

    if (userId === 'guest') {
      onUpdatePreferences(updatedData);
      setAiSuccess(true);
      setAiUpdating(false);
      setTimeout(() => setAiSuccess(false), 2000);
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, updatedData);
      onUpdatePreferences(updatedData);
      setAiSuccess(true);
      setTimeout(() => setAiSuccess(false), 2000);
    } catch (err) {
      console.error('Error saving AI configurations:', err);
    } finally {
      setAiUpdating(false);
    }
  };

  // Available color themes (Still, light and dark)
  const themes = [
    { id: 'dark', name: 'Dark Mode', style: 'from-slate-950 via-slate-900 to-slate-950 border-white/10 text-white' },
    { id: 'light', name: 'Light Mode', style: 'from-slate-200 via-slate-50 to-slate-100 border-black/10 text-slate-800' }
  ];

  const avatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80'
  ];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userNameInput.trim()) return;

    setUpdating(true);
    setSuccess(false);

    if (userId === 'guest') {
      onUpdatePreferences({ userName: userNameInput.trim() });
      setSuccess(true);
      setUpdating(false);
      setTimeout(() => setSuccess(false), 2000);
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { userName: userNameInput.trim() });
      onUpdatePreferences({ userName: userNameInput.trim() });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error('Error updating username:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleSelectWallpaper = async (id: string) => {
    onUpdatePreferences({ desktopWallpaper: id });
    if (userId === 'guest') return;
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { desktopWallpaper: id });
    } catch (err) {
      console.error('Error saving wallpaper preference:', err);
    }
  };

  const handleSelectAvatar = async (url: string) => {
    onUpdatePreferences({ avatarUrl: url });
    if (userId === 'guest') return;
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { avatarUrl: url });
    } catch (err) {
      console.error('Error saving avatar preference:', err);
    }
  };

  const handleBlurChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    onUpdatePreferences({ glassBlur: val });
    if (userId === 'guest') return;
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { glassBlur: val });
    } catch (err) {
      console.error('Error saving blur preference:', err);
    }
  };

  return (
    <div id="settings-app-container" className="flex h-full gap-4 text-white font-sans text-sm select-text">
      {/* Sidebar options */}
      <div className="w-52 border-r border-white/10 pr-4 flex flex-col gap-2 shrink-0">
        <h2 className="font-display font-semibold text-sm text-cyan-200 tracking-wide mb-2 flex items-center gap-1.5">
          <Settings className="w-4 h-4 text-cyan-400" />
          <span>System Config</span>
        </h2>
        
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
            activeTab === 'profile' ? 'bg-cyan-500/15 border border-cyan-500/25 text-cyan-200' : 'hover:bg-white/5 text-slate-300'
          }`}
        >
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span>User Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('personalization')}
          className={`px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
            activeTab === 'personalization' ? 'bg-cyan-500/15 border border-cyan-500/25 text-cyan-200' : 'hover:bg-white/5 text-slate-300'
          }`}
        >
          <Palette className="w-4 h-4 text-cyan-400" />
          <span>Personalization</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
            activeTab === 'security' ? 'bg-cyan-500/15 border border-cyan-500/25 text-cyan-200' : 'hover:bg-white/5 text-slate-300'
          }`}
        >
          <Shield className="w-4 h-4 text-cyan-400" />
          <span>Workstation Security</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
            activeTab === 'ai' ? 'bg-cyan-500/15 border border-cyan-500/25 text-cyan-200' : 'hover:bg-white/5 text-slate-300'
          }`}
        >
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>AI System Co-Pilot</span>
        </button>

        <button
          onClick={() => setActiveTab('info')}
          className={`px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
            activeTab === 'info' ? 'bg-cyan-500/15 border border-cyan-500/25 text-cyan-200' : 'hover:bg-white/5 text-slate-300'
          }`}
        >
          <Info className="w-4 h-4 text-cyan-400" />
          <span>System Information</span>
        </button>

        {/* Global actions */}
        <div className="mt-auto pt-4 border-t border-white/5">
          <button
            onClick={onLogout}
            className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 hover:text-white hover:bg-red-500 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock Workstation</span>
          </button>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 overflow-y-auto pl-2">
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-display font-semibold text-base mb-1">User Settings</h3>
              <p className="text-xs text-white/40 leading-relaxed">Customize your personal display values and workspace identities.</p>
            </div>

            {/* Avatar customization */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-white/75">Choose Workspace Avatar</label>
              <div className="flex gap-3">
                {avatars.map((url, i) => (
                  <div
                    key={i}
                    onClick={() => handleSelectAvatar(url)}
                    className={`w-12 h-12 rounded-full overflow-hidden border-2 cursor-pointer transition-all hover:scale-105 ${
                      preferences.avatarUrl === url ? 'border-cyan-400 scale-105 shadow-[0_0_10px_rgba(34,211,238,0.4)]' : 'border-transparent opacity-60'
                    }`}
                  >
                    <img src={url} alt={`avatar-${i}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 max-w-sm">
              <div className="relative">
                <label className="block text-xs font-semibold text-white/75 mb-1.5">Workspace Display Name</label>
                <input
                  type="text"
                  value={userNameInput}
                  onChange={(e) => setUserNameInput(e.target.value)}
                  placeholder="Workspace Name"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-slate-950/60 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-500/30 to-purple-500/30 hover:from-cyan-500/40 hover:to-purple-500/40 border border-white/15 text-cyan-200 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {updating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : success ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : null}
                  <span>Update Profile</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'personalization' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-display font-semibold text-base mb-1">Desktop Aesthetics</h3>
              <p className="text-xs text-white/40 leading-relaxed">Customize wallpaper blends and glassmorphism transparency parameters.</p>
            </div>

            {/* Wallpaper options */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-white/75">System Theme Mode</label>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                {themes.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleSelectWallpaper(t.id)}
                    className={`p-4 rounded-2xl border bg-gradient-to-br ${t.style} cursor-pointer transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-end min-h-[75px] ${
                      preferences.desktopWallpaper === t.id ? 'ring-2 ring-cyan-400 shadow-lg' : ''
                    }`}
                  >
                    <span className="text-xs font-semibold">{t.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Blur transparency parameters */}
            <div className="space-y-3 max-w-sm">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-white/75">Glass Panel Blur Intensity</span>
                <span className="text-cyan-300 font-mono">{preferences.glassBlur}px</span>
              </div>
              <input
                type="range"
                min="5"
                max="40"
                value={preferences.glassBlur}
                onChange={handleBlurChange}
                className="w-full accent-cyan-400 bg-white/10 rounded-lg h-1.5 cursor-pointer"
              />
              <p className="text-[10px] text-white/30 leading-relaxed">
                Adjust the backdrop blur filter level to find the perfect equilibrium between aesthetics and legibility.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-display font-semibold text-base mb-1">Workstation Security</h3>
              <p className="text-xs text-white/40 leading-relaxed">Secure cloud integration logs and personal asset protection policies.</p>
            </div>

            {/* Info panel */}
            <div className="p-4 rounded-2xl border border-white/5 bg-white/3 max-w-md text-xs space-y-3 leading-relaxed">
              <p className="text-cyan-200 font-semibold">
                {userId === 'guest' ? 'Guest Workstation Environment' : 'Workspace Integrity Verified'}
              </p>
              <p className="text-white/60 text-[11px]">
                {userId === 'guest' 
                  ? 'You are running in Guest Mode. All notepad drafts, uploaded files, and IDE code snippets reside in-memory for this session only and will be discarded when you exit.'
                  : 'Aether OS uses encrypted cloud synchronization protocols to secure your notepad drafts, files, and snippets. Auth tokens expire after 2 hours. Use "Lock Workstation" to safely log off.'}
              </p>
            </div>

            {/* Automatic Inactivity Account Wipe Policy */}
            {userId !== 'guest' && (
              <div className="p-4 rounded-2xl border border-red-500/15 bg-red-500/5 max-w-md text-xs space-y-2">
                <p className="text-red-400 font-semibold flex items-center gap-1.5">
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>Account Inactivity Policy</span>
                </p>
                <p className="text-white/60 text-[11px] leading-relaxed">
                  To protect user privacy and conserve cloud database resources, accounts that are not accessed for <strong className="text-red-300 font-medium">one month (30 days)</strong> are automatically flagged as inactive, wiped of all data (including your cloud notepad logs, virtual code snippets, and storage files), and completely deleted.
                </p>
                <p className="text-[10px] text-cyan-300/60">
                  Your last session access: {preferences.lastAccessed ? new Date(preferences.lastAccessed).toLocaleString() : 'Just now'}
                </p>
              </div>
            )}

            {/* System Reset options */}
            <div className="space-y-2 max-w-md">
              <label className="block text-xs font-semibold text-red-400">Workstation Actions</label>
              <p className="text-[11px] text-white/30 leading-relaxed mb-3">
                {userId === 'guest' 
                  ? 'Lock your workstation or sign out to instantly flush all in-memory workspace session caches.'
                  : 'If your workspace is experiencing synchronization conflicts, you can sign off to refresh system caches.'}
              </p>
              <button
                onClick={onLogout}
                className="px-4 py-2 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                {userId === 'guest' ? 'Exit Guest Session' : 'Sign Off & Flush Caches'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-display font-semibold text-base mb-1">Aether OS Information</h3>
              <p className="text-xs text-white/40 leading-relaxed">Full system metadata and build configurations.</p>
            </div>

            <div className="border border-white/10 bg-slate-950/45 rounded-2xl p-4 font-mono text-[11px] max-w-md space-y-2.5">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/40">Architecture Version:</span>
                <span className="text-cyan-300 font-semibold">AetherOS Core v2.1.0</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/40">Database Engine:</span>
                <span className="text-white/80">
                  {userId === 'guest' ? 'In-Memory Local Sandbox' : 'Google Cloud Firestore v1'}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/40">Auth Provider:</span>
                <span className="text-white/80">
                  {userId === 'guest' ? 'Guest Session Token' : 'Firebase Identity Manager'}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/40">Vite Build Runtime:</span>
                <span className="text-white/80">Node 22 Production Container</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Client Status:</span>
                <span className={userId === 'guest' ? 'text-amber-400 font-semibold flex items-center gap-1' : 'text-emerald-400 font-semibold flex items-center gap-1'}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${userId === 'guest' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  {userId === 'guest' ? 'Guest Mode (No Cloud Save)' : 'Synced'}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-white/30 leading-relaxed max-w-md">
              Aether OS is built entirely from scratch with no copyrighted assets, utilizing custom high-contrast CSS gradients, Inter, and Outfit typefaces.
            </p>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-display font-semibold text-base mb-1">AI System Core</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Configure your multi-provider artificial intelligence backend. Co-pilot co-ordination functions span across Cloud Notes, Code IDE, and File Vault.
              </p>
            </div>

            <form onSubmit={handleSaveAiSettings} className="space-y-5 max-w-lg pb-6">
              {/* Global On/Off toggle */}
              <div className="p-4 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="block text-xs font-semibold text-white">Enable AI System Co-Pilots</span>
                  <span className="block text-[11px] text-white/40">Toggle artificial intelligence context support inside Notepad, Code, and File viewer widgets globally.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={aiEnabled}
                    onChange={(e) => setAiEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {aiEnabled && (
                <div className="space-y-4 animate-fade-in">
                  {/* Select active provider */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-white/75">Active AI Provider</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                      {[
                        { id: 'gemini', name: 'Google Gemini' },
                        { id: 'openai', name: 'OpenAI GPT' },
                        { id: 'claude', name: 'Anthropic Claude' },
                        { id: 'openrouter', name: 'OpenRouter' }
                      ].map((prov) => (
                        <div
                          key={prov.id}
                          onClick={() => setAiProvider(prov.id as any)}
                          className={`p-3 rounded-xl border text-center cursor-pointer transition-all duration-150 ${
                            aiProvider === prov.id
                              ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200 font-semibold shadow-md'
                              : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-300 text-xs'
                          }`}
                        >
                          {prov.name}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Model Name Input */}
                  <div>
                    <label className="block text-xs font-semibold text-white/75 mb-1.5">Model ID Override (Optional)</label>
                    <input
                      type="text"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      placeholder={
                        aiProvider === 'gemini' ? 'gemini-2.5-flash (default)' :
                        aiProvider === 'openai' ? 'gpt-4o-mini (default)' :
                        aiProvider === 'claude' ? 'claude-3-5-haiku-20241022 (default)' :
                        'google/gemini-2.5-flash (default)'
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-white/10 bg-slate-950/60 text-white outline-none focus:border-cyan-400 text-xs font-mono"
                    />
                    <div className="text-[10px] text-white/30 mt-1 leading-relaxed">
                      Leave empty to utilize standard high-speed recommended model endpoints. Custom endpoints are supported natively.
                    </div>
                  </div>

                  {/* API Keys grid */}
                  <div className="space-y-3.5 pt-2">
                    <label className="block text-xs font-semibold text-white/75">Workspace Provider API Keys</label>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-white/60">Google Gemini API Key</span>
                          {aiProvider === 'gemini' && <span className="text-cyan-400 font-semibold text-[10px]">Active</span>}
                        </div>
                        <input
                          type="password"
                          value={geminiKey}
                          onChange={(e) => setGeminiKey(e.target.value)}
                          placeholder="AIzaSy..."
                          className={`w-full px-3.5 py-2 rounded-xl border bg-slate-950/60 text-white outline-none focus:border-cyan-400 text-xs font-mono ${
                            aiProvider === 'gemini' ? 'border-cyan-500/30' : 'border-white/10'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-white/60">OpenAI API Key</span>
                          {aiProvider === 'openai' && <span className="text-cyan-400 font-semibold text-[10px]">Active</span>}
                        </div>
                        <input
                          type="password"
                          value={openaiKey}
                          onChange={(e) => setOpenaiKey(e.target.value)}
                          placeholder="sk-..."
                          className={`w-full px-3.5 py-2 rounded-xl border bg-slate-950/60 text-white outline-none focus:border-cyan-400 text-xs font-mono ${
                            aiProvider === 'openai' ? 'border-cyan-500/30' : 'border-white/10'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-white/60">Anthropic Claude API Key</span>
                          {aiProvider === 'claude' && <span className="text-cyan-400 font-semibold text-[10px]">Active</span>}
                        </div>
                        <input
                          type="password"
                          value={claudeKey}
                          onChange={(e) => setClaudeKey(e.target.value)}
                          placeholder="sk-ant-..."
                          className={`w-full px-3.5 py-2 rounded-xl border bg-slate-950/60 text-white outline-none focus:border-cyan-400 text-xs font-mono ${
                            aiProvider === 'claude' ? 'border-cyan-500/30' : 'border-white/10'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-white/60">OpenRouter API Key</span>
                          {aiProvider === 'openrouter' && <span className="text-cyan-400 font-semibold text-[10px]">Active</span>}
                        </div>
                        <input
                          type="password"
                          value={openrouterKey}
                          onChange={(e) => setOpenrouterKey(e.target.value)}
                          placeholder="sk-or-..."
                          className={`w-full px-3.5 py-2 rounded-xl border bg-slate-950/60 text-white outline-none focus:border-cyan-400 text-xs font-mono ${
                            aiProvider === 'openrouter' ? 'border-cyan-500/30' : 'border-white/10'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                <button
                  type="submit"
                  disabled={aiUpdating}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-500/30 to-purple-500/30 hover:from-cyan-500/40 hover:to-purple-500/40 border border-white/15 text-cyan-200 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {aiUpdating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : aiSuccess ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Cpu className="w-3.5 h-3.5" />
                  )}
                  <span>Save AI Core Config</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { UserPreferences } from '../../types';
import {
  Send,
  Bot,
  User,
  Key,
  Sliders,
  Trash2,
  Download,
  Sparkles,
  Check,
  Cpu,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  callAiSystem,
  isAiSystemActive,
  getActiveProvider,
  getActiveModel,
  getActiveApiKey
} from '../../lib/aiSystem';

interface AiAppProps {
  userId: string;
  preferences: UserPreferences;
  onUpdatePreferences: (updated: Partial<UserPreferences>) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  provider: string;
}

export default function AiApp({ userId, preferences, onUpdatePreferences }: AiAppProps) {
  const activeProvider = getActiveProvider(preferences);
  const activeModel = getActiveModel(preferences);
  const activeKey = getActiveApiKey(preferences);
  const isEnabled = isAiSystemActive(preferences);

  const [apiKeyInput, setApiKeyInput] = useState(activeKey);
  const [isKeyEditing, setIsKeyEditing] = useState(!activeKey);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  
  // Local state for model parameters
  const [selectedModelOverride, setSelectedModelOverride] = useState(preferences.aiModel || '');
  const [systemInstruction, setSystemInstruction] = useState('You are an elegant, friendly assistant living inside Aether OS.');

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Welcome to the Aether OS AI System.
I am configured to operate as your intelligent workspace core.

Current Configuration:
• Active Provider: ${activeProvider.toUpperCase()}
• Active Model: ${activeModel}

You can also use this AI System natively inside Cloud Notes, Code IDE, and the File Storage Viewer. Open the sliders panel on the right or System Settings to manage providers and API credentials.`,
      timestamp: Date.now(),
      provider: activeProvider
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Keep api input sync when provider changes
  useEffect(() => {
    const currentKey = getActiveApiKey(preferences);
    setApiKeyInput(currentKey);
    setIsKeyEditing(!currentKey);
  }, [preferences, preferences.aiProvider]);

  const handleEnableAi = async () => {
    onUpdatePreferences({ aiEnabled: true });
    if (userId !== 'guest') {
      try {
        await updateDoc(doc(db, 'users', userId), { aiEnabled: true });
      } catch (err) {
        console.error('Error enabling AI:', err);
      }
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    
    // Determine which key field to update based on the active provider
    const keyField = 
      activeProvider === 'openai' ? 'openaiApiKey' :
      activeProvider === 'claude' ? 'claudeApiKey' :
      activeProvider === 'openrouter' ? 'openrouterApiKey' : 'geminiApiKey';

    const updatedData: Partial<UserPreferences> = {
      [keyField]: apiKeyInput.trim(),
    };

    // If gemini, also update legacy customApiKey for safety
    if (activeProvider === 'gemini') {
      updatedData.customApiKey = apiKeyInput.trim();
    }

    onUpdatePreferences(updatedData);
    setIsKeyEditing(false);

    if (userId !== 'guest') {
      try {
        await updateDoc(doc(db, 'users', userId), updatedData);
      } catch (err) {
        console.error('Error saving API Key:', err);
      }
    }
  };

  const handleProviderChange = async (provider: 'gemini' | 'openai' | 'claude' | 'openrouter') => {
    const updatedData: Partial<UserPreferences> = { aiProvider: provider, aiModel: '' };
    setSelectedModelOverride('');
    onUpdatePreferences(updatedData);
    
    if (userId !== 'guest') {
      try {
        await updateDoc(doc(db, 'users', userId), updatedData);
      } catch (err) {
        console.error('Error saving provider:', err);
      }
    }
  };

  const handleSaveModelOverride = async () => {
    const updatedData: Partial<UserPreferences> = { aiModel: selectedModelOverride.trim() || undefined };
    onUpdatePreferences(updatedData);
    if (userId !== 'guest') {
      try {
        await updateDoc(doc(db, 'users', userId), updatedData);
      } catch (err) {
        console.error('Error saving model override:', err);
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || loading) return;
    if (!activeKey) {
      setIsKeyEditing(true);
      return;
    }

    const newUserMsg: Message = {
      role: 'user',
      content: userInput.trim(),
      timestamp: Date.now(),
      provider: activeProvider
    };

    setMessages(prev => [...prev, newUserMsg]);
    setUserInput('');
    setLoading(true);

    try {
      // Structure chat context
      const chatHistory = messages.map(m => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content
      }));

      // Add system prompt if configured
      const payload = [
        { role: 'system' as const, content: systemInstruction },
        ...chatHistory,
        { role: 'user' as const, content: newUserMsg.content }
      ];

      const responseText = await callAiSystem(payload, preferences);

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
          provider: activeProvider
        }
      ]);
    } catch (err: any) {
      console.error('AI Core execution error:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `❌ Generation Error: ${err.message || 'Failed to complete. Please double-check your API configurations and network connections.'}`,
          timestamp: Date.now(),
          provider: activeProvider
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (!confirm('Flush active chatbot workspace?')) return;
    setMessages([
      {
        role: 'assistant',
        content: `Chat session flushed. Ready for a new sequence using ${activeProvider.toUpperCase()} (${activeModel}).`,
        timestamp: Date.now(),
        provider: activeProvider
      }
    ]);
  };

  const handleExportChat = () => {
    const formattedChat = messages
      .map(m => `[${m.role.toUpperCase()} - ${m.provider.toUpperCase()} - ${new Date(m.timestamp).toLocaleTimeString()}]\n${m.content}\n`)
      .join('\n');

    const element = document.createElement('a');
    const file = new Blob([formattedChat], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `aether-ai-session-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // If globally disabled
  if (!isEnabled) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 h-full text-white font-sans">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="font-display font-semibold text-lg text-slate-200 mb-2">AI System Disabled</h3>
        <p className="text-xs text-white/40 max-w-md leading-relaxed mb-6">
          The artificial intelligence co-pilot is currently deactivated globally. You can activate it instantly using the quick toggle below or by navigating to the System Settings app.
        </p>
        <button
          onClick={handleEnableAi}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/30 to-purple-500/30 hover:from-cyan-500/40 hover:to-purple-500/40 border border-white/10 text-cyan-200 text-xs font-semibold transition-all cursor-pointer flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>Enable AI System Globally</span>
        </button>
      </div>
    );
  }

  return (
    <div id="ai-chat-container" className="flex h-full gap-4 text-white font-sans text-sm select-text">
      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Bot className="w-4.5 h-4.5 text-cyan-400" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-sm tracking-wide text-cyan-200 capitalize">
                {activeProvider} Neural Core
              </h2>
              <p className="text-[10px] text-white/40 uppercase font-mono">{activeModel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                showConfig
                  ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
              }`}
              title="Configure AI Parameters"
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportChat}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Export Conversation Log"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleClearHistory}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/10 text-slate-300 hover:text-red-400 transition-all cursor-pointer"
              title="Clear Session"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* API Key Banner if key is missing or editing */}
        {isKeyEditing && (
          <div className="mb-4 p-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-yellow-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-yellow-200">
                  {activeProvider.toUpperCase()} Credentials Required
                </p>
                <p className="text-[11px] text-yellow-100/60 leading-relaxed">
                  Provide your personal {activeProvider.toUpperCase()} API Key. It is encrypted and saved directly within your workspace database.
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input
                type="password"
                placeholder={
                  activeProvider === 'gemini' ? 'AIzaSy...' :
                  activeProvider === 'openai' ? 'sk-...' :
                  activeProvider === 'claude' ? 'sk-ant-...' : 'sk-or-...'
                }
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="flex-1 md:w-48 px-3 py-1.5 text-xs rounded-xl border border-white/10 bg-slate-950/60 text-white placeholder-white/20 focus:border-cyan-400 outline-none"
              />
              <button
                onClick={handleSaveApiKey}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/30 border border-cyan-500/30 hover:bg-cyan-500/40 text-cyan-200 text-xs font-medium transition-all cursor-pointer shrink-0"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Chat message display area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-0 pb-4">
          {messages.map((m, index) => (
            <div
              key={index}
              className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                  m.role === 'user'
                    ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                    : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                }`}
              >
                {m.role === 'user' ? <User className="w-4.5 h-4.5" /> : <Bot className="w-4.5 h-4.5" />}
              </div>

              <div
                className={`p-3.5 rounded-2xl text-xs leading-relaxed border ${
                  m.role === 'user'
                    ? 'bg-purple-600/10 border-purple-500/20 text-slate-100 rounded-tr-none'
                    : 'bg-white/5 border-white/10 text-slate-200 rounded-tl-none shadow-lg'
                }`}
              >
                <div className="space-y-2 select-text font-sans white-space-pre-wrap">
                  {m.content.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
                <div className="text-[9px] text-white/30 text-right mt-1.5 font-mono flex items-center justify-end gap-1.5">
                  <span className="uppercase text-[8px] tracking-wider px-1 bg-white/5 rounded border border-white/5">
                    {m.provider}
                  </span>
                  <span>
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-cyan-500/20 border border-cyan-500/30 text-cyan-300">
                <Bot className="w-4.5 h-4.5" />
              </div>
              <div className="p-4 rounded-2xl rounded-tl-none border border-white/10 bg-white/5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input prompt bar */}
        <form onSubmit={handleSendMessage} className="mt-auto pt-3 border-t border-white/5 flex gap-2">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={
              activeKey
                ? `Ask ${activeProvider.toUpperCase()} anything...`
                : "API Key required. Set up credentials to initiate."
            }
            disabled={!activeKey || loading}
            className="flex-1 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/20 focus:border-cyan-400/50 focus:bg-white/10 outline-none text-xs transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!activeKey || loading || !userInput.trim()}
            className="p-3 rounded-xl bg-gradient-to-r from-cyan-500/30 to-purple-500/30 hover:from-cyan-500/40 hover:to-purple-500/40 border border-white/15 text-cyan-300 disabled:opacity-50 transition-all cursor-pointer shrink-0"
          >
            <Send className="w-4.5 h-4.5" />
          </button>
        </form>
      </div>

      {/* Configuration Slider Panel */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ opacity: 0, x: 20, width: 0 }}
            animate={{ opacity: 1, x: 0, width: 230 }}
            exit={{ opacity: 0, x: 20, width: 0 }}
            className="border-l border-white/10 pl-4 flex flex-col gap-4 overflow-y-auto font-sans text-xs shrink-0"
          >
            <div>
              <h3 className="font-display font-semibold text-cyan-200 flex items-center gap-1.5 mb-1 text-xs">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                AI Parameters
              </h3>
              <p className="text-[10px] text-white/40 leading-relaxed mb-3">
                Manage your active provider routing and context instructions.
              </p>
            </div>

            {/* Provider Selector */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-white/60">Active Provider</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['gemini', 'openai', 'claude', 'openrouter'] as const).map((prov) => (
                  <button
                    key={prov}
                    onClick={() => handleProviderChange(prov)}
                    className={`py-1.5 rounded-lg border text-center font-medium transition-all text-[10px] cursor-pointer ${
                      activeProvider === prov
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    {prov === 'openai' ? 'OpenAI' : prov === 'claude' ? 'Claude' : prov === 'openrouter' ? 'OpenRouter' : 'Gemini'}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Model ID */}
            <div>
              <label className="block text-[11px] font-medium text-white/60 mb-1">Model Override ID</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={selectedModelOverride}
                  onChange={(e) => setSelectedModelOverride(e.target.value)}
                  placeholder={
                    activeProvider === 'gemini' ? 'gemini-2.5-flash' :
                    activeProvider === 'openai' ? 'gpt-4o-mini' :
                    activeProvider === 'claude' ? 'claude-3-5-haiku-20241022' : 'google/gemini-2.5-flash'
                  }
                  className="flex-1 px-2 py-1.5 text-[10px] rounded-lg border border-white/10 bg-slate-950/60 text-white placeholder-white/20 outline-none"
                />
                <button
                  onClick={handleSaveModelOverride}
                  className="px-2.5 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/35 border border-cyan-500/30 text-cyan-200 text-[10px] font-semibold transition-all cursor-pointer"
                >
                  Set
                </button>
              </div>
            </div>

            {/* System Directives */}
            <div>
              <label className="block text-[11px] font-medium text-white/60 mb-1">System Directives</label>
              <textarea
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                placeholder="Persona guidelines..."
                className="w-full h-24 p-2 text-[10px] rounded-lg border border-white/10 bg-slate-950/60 text-white placeholder-white/25 outline-none resize-none leading-normal"
              />
            </div>

            {/* API Key management */}
            <div className="mt-auto pt-4 border-t border-white/5 text-center">
              <button
                onClick={() => setIsKeyEditing(!isKeyEditing)}
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5 text-yellow-400" />
                <span>Configure {activeProvider.toUpperCase()} Key</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

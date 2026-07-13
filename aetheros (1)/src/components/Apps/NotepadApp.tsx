/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { NotepadDoc, UserPreferences } from '../../types';
import { Plus, Trash2, FileText, Download, Check, Save, Sparkles, Clock, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { callAiSystem } from '../../lib/aiSystem';

interface NotepadAppProps {
  userId: string;
  preferences: UserPreferences;
}

export default function NotepadApp({ userId, preferences }: NotepadAppProps) {
  const [notes, setNotes] = useState<NotepadDoc[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Mobile View Toggle
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  // Sync mobileView when note is selected
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (selectedNoteId) {
      setMobileView('editor');
    } else {
      setMobileView('list');
    }
  }, [selectedNoteId]);

  // AI Co-pilot state and core execution
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);

  const handleAiAction = async (actionType: string) => {
    if (!content.trim() && actionType !== 'brainstorm') {
      alert('Please enter some text inside the note first to run AI co-pilot actions!');
      return;
    }
    
    setAiLoading(true);
    setShowAiMenu(false);
    
    let promptText = '';
    let sysText = 'You are an elite workspace editor assistant inside AetherOS. Return only the revised/generated text cleanly with no conversational filler or preambles.';
    
    switch (actionType) {
      case 'summarize':
        promptText = `Provide a concise summary of this text with bullet points of key takeaways:\n\n${content}`;
        sysText = 'You are a professional research summary tool. Output a beautiful, bulleted summary.';
        break;
      case 'refine':
        promptText = `Refine and improve this text, enhancing grammar, flow, and elegance while preserving original intent. Here is the text:\n\n${content}`;
        break;
      case 'brainstorm':
        promptText = `Generate a creative brainstorming outline or list of expanded ideas based on this note titled "${title || 'Untitled'}" and its content:\n\n${content || '(No content yet)'}`;
        break;
      case 'translate_es':
        promptText = `Translate this entire text to Spanish elegantly:\n\n${content}`;
        break;
      case 'translate_ja':
        promptText = `Translate this entire text to Japanese elegantly:\n\n${content}`;
        break;
      default:
        setAiLoading(false);
        return;
    }
    
    try {
      const response = await callAiSystem(
        [{ role: 'user', content: promptText }],
        preferences,
        sysText
      );
      
      if (actionType === 'refine' || actionType === 'translate_es' || actionType === 'translate_ja') {
        setContent(response);
      } else {
        setContent(prev => prev + `\n\n---\n### AI Generated Extension (${preferences.aiProvider || 'Gemini'})\n` + response);
      }
    } catch (err: any) {
      console.error('AI action failed:', err);
      alert(`AI System Error: ${err.message || 'Failed to complete co-pilot task. Check credentials.'}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Load notes from Firestore
  useEffect(() => {
    if (userId === 'guest') {
      const defaultGuestNote: NotepadDoc = {
        id: 'guest-note-1',
        title: 'Welcome to AetherOS Guest Mode',
        content: 'Welcome! You are currently using AetherOS in Guest Mode.\n\n⚠️ IMPORTANT: In Guest Mode, all changes are saved in-memory and will NOT persist to the database. Feel free to explore, write notes, generate code, and play around, but make sure to download any important documents or notes using the download button before closing this session!',
        lastModified: Date.now(),
        ownerId: 'guest'
      };
      setNotes([defaultGuestNote]);
      selectNote(defaultGuestNote);
      setLoading(false);
      return;
    }

    const fetchNotes = async () => {
      try {
        const q = query(
          collection(db, 'notes'),
          where('ownerId', '==', userId),
          orderBy('lastModified', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const fetchedNotes: NotepadDoc[] = [];
        querySnapshot.forEach((docSnapshot) => {
          fetchedNotes.push({ id: docSnapshot.id, ...docSnapshot.data() } as NotepadDoc);
        });
        setNotes(fetchedNotes);
        
        if (fetchedNotes.length > 0 && !selectedNoteId) {
          selectNote(fetchedNotes[0]);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching notes:', err);
        setLoading(false);
      }
    };

    fetchNotes();
  }, [userId]);

  const selectNote = (note: NotepadDoc) => {
    setSelectedNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setLoading(false);
  };

  const handleCreateNote = async () => {
    const newNote = {
      title: 'Untitled Note',
      content: '',
      lastModified: Date.now(),
      ownerId: userId
    };

    if (userId === 'guest') {
      const noteId = `guest-note-${Date.now()}`;
      const noteWithId: NotepadDoc = { id: noteId, ...newNote };
      setNotes([noteWithId, ...notes]);
      setSelectedNoteId(noteId);
      setTitle(noteWithId.title);
      setContent(noteWithId.content);
      return;
    }

    try {
      setSaving(true);
      const docRef = await addDoc(collection(db, 'notes'), newNote);
      const noteWithId: NotepadDoc = { id: docRef.id, ...newNote };
      setNotes([noteWithId, ...notes]);
      setSelectedNoteId(docRef.id);
      setTitle(noteWithId.title);
      setContent(noteWithId.content);
    } catch (err) {
      console.error('Error creating note:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedNoteId) return;
    setSaving(true);
    setSaveSuccess(false);

    if (userId === 'guest') {
      const updatedFields = {
        title: title || 'Untitled Note',
        content: content,
        lastModified: Date.now()
      };
      setNotes(notes.map(n => n.id === selectedNoteId ? { ...n, ...updatedFields } : n));
      setSaveSuccess(true);
      setSaving(false);
      setTimeout(() => setSaveSuccess(false), 2000);
      return;
    }

    try {
      const noteRef = doc(db, 'notes', selectedNoteId);
      const updatedFields = {
        title: title || 'Untitled Note',
        content: content,
        lastModified: Date.now()
      };

      await updateDoc(noteRef, updatedFields);
      
      // Update local state
      setNotes(notes.map(n => n.id === selectedNoteId ? { ...n, ...updatedFields } : n));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this note?')) return;

    if (userId === 'guest') {
      const remainingNotes = notes.filter(n => n.id !== id);
      setNotes(remainingNotes);
      
      if (selectedNoteId === id) {
        if (remainingNotes.length > 0) {
          selectNote(remainingNotes[0]);
        } else {
          setSelectedNoteId(null);
          setTitle('');
          setContent('');
        }
      }
      return;
    }

    try {
      await deleteDoc(doc(db, 'notes', id));
      const remainingNotes = notes.filter(n => n.id !== id);
      setNotes(remainingNotes);
      
      if (selectedNoteId === id) {
        if (remainingNotes.length > 0) {
          selectNote(remainingNotes[0]);
        } else {
          setSelectedNoteId(null);
          setTitle('');
          setContent('');
        }
      }
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  // Auto-save on delay
  useEffect(() => {
    if (!selectedNoteId) return;
    const delayDebounce = setTimeout(() => {
      // Find matching note to see if content changed
      const currentNote = notes.find(n => n.id === selectedNoteId);
      if (currentNote && (currentNote.content !== content || currentNote.title !== title)) {
        handleSaveNote();
      }
    }, 1500); // 1.5s auto-save delay

    return () => clearTimeout(delayDebounce);
  }, [content, title, selectedNoteId]);

  // Download Note locally
  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${title || 'note'}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readingTime = Math.ceil(wordCount / 200);

  return (
    <div id="notepad-container" className="flex h-full gap-4 text-white font-sans text-sm select-text">
      {/* Sidebar List */}
      {(!isMobile || mobileView === 'list') && (
        <div className={`${isMobile ? 'w-full' : 'w-64 border-r border-white/10 pr-4'} flex flex-col gap-3 shrink-0`}>
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-base tracking-wide text-cyan-200">Personal Notes</h2>
            <button
              onClick={handleCreateNote}
              className="p-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 transition-all cursor-pointer flex items-center gap-1 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>

          {userId === 'guest' && (
            <div className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-medium leading-relaxed">
              ⚠️ <strong>Guest Session</strong> — changes are in-memory and will not sync to cloud.
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-white/40">
                <span className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-10 text-white/30 text-xs">
                No notes saved. Click "New" to start.
              </div>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => selectNote(note)}
                  className={`group p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedNoteId === note.id
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200 shadow-md shadow-cyan-900/10'
                      : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden mr-2">
                    <FileText className={`w-4 h-4 shrink-0 ${selectedNoteId === note.id ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span className="truncate font-medium text-xs">{note.title || 'Untitled Note'}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteNote(note.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Editor Panel */}
      {(!isMobile || mobileView === 'editor') && (
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {selectedNoteId ? (
            <>
              {/* Header controls */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isMobile && (
                    <button
                      onClick={() => setSelectedNoteId(null)}
                      className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Note Title"
                    className="flex-1 bg-transparent border-b border-transparent focus:border-white/20 text-lg font-display font-medium text-white outline-none py-1 transition-all truncate"
                  />
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Autosave/Status indicators */}
                  <div className="text-[10px] sm:text-xs text-white/40 flex items-center gap-1 sm:gap-1.5 mr-1 sm:mr-2">
                    {saving ? (
                      <>
                        <Clock className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
                        <span className="hidden xs:inline">Saving...</span>
                      </>
                    ) : saveSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-green-400 hidden xs:inline">{userId === 'guest' ? 'Saved Locally' : 'Saved'}</span>
                      </>
                    ) : (
                      <span className="hidden xs:inline">{userId === 'guest' ? 'Autosaved Locally' : 'Autosaved'}</span>
                    )}
                  </div>

                  {preferences.aiEnabled !== false && (
                    <div className="relative">
                      <button
                        onClick={() => setShowAiMenu(!showAiMenu)}
                        disabled={aiLoading}
                        title="AI Co-pilot Actions"
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                          aiLoading
                            ? 'bg-purple-500/20 border-purple-500/30 text-purple-300 animate-pulse'
                            : showAiMenu
                            ? 'bg-purple-500/25 border-purple-500/40 text-purple-200'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-[11px] font-semibold hidden md:inline">AI Co-pilot</span>
                      </button>
                      
                      {showAiMenu && (
                        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-slate-950/95 backdrop-blur-md p-1.5 z-50 shadow-2xl space-y-1">
                          <button
                            type="button"
                            onClick={() => handleAiAction('summarize')}
                            className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-white/5 text-slate-200 transition-colors cursor-pointer"
                          >
                            ✨ Summarize Note
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAiAction('refine')}
                            className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-white/5 text-slate-200 transition-colors cursor-pointer"
                          >
                            ✍️ Refine & Improve Tone
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAiAction('brainstorm')}
                            className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-white/5 text-slate-200 transition-colors cursor-pointer"
                          >
                            💡 Brainstorm Ideas
                          </button>
                          <div className="border-t border-white/5 my-1" />
                          <button
                            type="button"
                            onClick={() => handleAiAction('translate_es')}
                            className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-white/5 text-slate-200 transition-colors cursor-pointer"
                          >
                            🌐 Translate to Spanish
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAiAction('translate_ja')}
                            className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-white/5 text-slate-200 transition-colors cursor-pointer"
                          >
                            🌐 Translate to Japanese
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleDownload}
                    title="Download note locally"
                    className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleSaveNote}
                    className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Note Text area */}
              <div className="flex-1 relative rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Start typing your thoughts here..."
                  className="flex-1 w-full bg-transparent resize-none outline-none text-slate-200 placeholder-white/20 leading-relaxed font-sans text-sm pb-10"
                />

                {/* Bottom statistics bar inside editor */}
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-white/40 border-t border-white/5 pt-2 font-mono">
                  <div className="flex items-center gap-3">
                    <span>{wordCount} words</span>
                    <span className="hidden sm:inline">{content.length} characters</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>Est. {readingTime} min read</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-white/5 bg-white/2 rounded-2xl">
              <FileText className="w-12 h-12 text-white/20 mb-3 animate-pulse" />
              <h3 className="font-display font-medium text-white mb-1">No Active Note</h3>
              <p className="text-xs text-white/40 max-w-xs">
                Select an existing note from the sidebar or create a new one to begin writing.
              </p>
              <button
                onClick={handleCreateNote}
                className="mt-4 py-2 px-5 rounded-xl bg-gradient-to-r from-cyan-500/30 to-purple-500/30 hover:from-cyan-500/40 hover:to-purple-500/40 border border-white/10 text-white text-xs font-medium transition-all cursor-pointer"
              >
                Create Note
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import LZString from 'lz-string';
import { FileDoc, UserPreferences } from '../../types';
import { FolderPlus, FilePlus, ArrowLeft, Folder, FileText, Image as ImageIcon, FileCode, File, Trash2, Download, Eye, HardDrive, Check, UploadCloud, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { callAiSystem } from '../../lib/aiSystem';

interface FileStorageAppProps {
  userId: string;
  preferences: UserPreferences;
}

export default function FileStorageApp({ userId, preferences }: FileStorageAppProps) {
  const [items, setItems] = useState<FileDoc[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Modal / Viewer State
  const [viewingFile, setViewingFile] = useState<FileDoc | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderInput, setShowFolderInput] = useState(false);

  // AI Document Analysis State
  const [aiAnalysing, setAiAnalysing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState('');

  const handleAiAnalyzeFile = async (file: FileDoc) => {
    setAiAnalysing(true);
    setAiAnalysisResult('');
    
    let textToAnalyze = '';
    const decompressed = file.isCompressed ? LZString.decompressFromBase64(file.content) : file.content;
    try {
      const parts = decompressed.split(',');
      if (parts.length > 1 && parts[0].includes('base64')) {
        textToAnalyze = atob(parts[1]);
      } else {
        textToAnalyze = decompressed;
      }
    } catch (e) {
      textToAnalyze = decompressed;
    }
    
    if (!textToAnalyze.trim()) {
      setAiAnalysisResult('The file is empty or cannot be decompressed for analysis.');
      setAiAnalysing(false);
      return;
    }
    
    try {
      const prompt = `Analyze this file named "${file.name}" and provide a concise, high-level summary of its content, key insights, and action items: \n\n${textToAnalyze}`;
      const response = await callAiSystem(
        [{ role: 'user', content: prompt }],
        preferences,
        'You are an expert digital forensic analyst and data summary tool.'
      );
      setAiAnalysisResult(response);
    } catch (err: any) {
      console.error('File analysis failed:', err);
      setAiAnalysisResult(`❌ Analysis failed: ${err.message || err}`);
    } finally {
      setAiAnalysing(false);
    }
  };

  // Fetch files from Firestore
  const fetchItems = async () => {
    if (userId === 'guest') {
      const demoItems: FileDoc[] = [
        {
          id: 'demo-folder-1',
          name: 'Project Assets',
          type: 'folder' as const,
          fileType: 'other' as const,
          content: '',
          parentId: 'root',
          ownerId: 'guest',
          createdAt: Date.now() - 3600000,
          size: 0
        },
        {
          id: 'demo-file-1',
          name: 'AetherOS_Overview.txt',
          type: 'file' as const,
          fileType: 'text' as const,
          content: 'data:text/plain;base64,QWV0aGVyT1MgR3Vlc3QgTW9kZSBPdmVydmlldzoKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KWW91IGFyZSBjdXJyZW50bHkgcnVubmluZyBpbiBhIHNlY3VyZSwgaW4tbWVtb3J5IEd1ZXN0IFdvcmtzdGF0aW9uLiBBbGwgY3JlYXRlZCBmaWxlcywgZm9sZGVycywgYW5kIG5vdGVzIGFyZSBzYXZlZCB0ZW1wb3JhcmlseSBpbiB5b3VyIGJyb3dzZXIncyBtZW1vcnkgYW5kIHdpbGwgbm90IGJlIHBlcnNpc3RlZCB0byBvdXIgRmlyZXN0b3JlIGNsb3VkIGFzc2V0IHZhdWx0Lg==', // Base64 for "AetherOS Guest Mode Overview:..."
          parentId: 'root',
          ownerId: 'guest',
          createdAt: Date.now() - 1800000,
          size: 320
        },
        {
          id: 'demo-file-2',
          name: 'glassmorphic_concept.png',
          type: 'file' as const,
          fileType: 'image' as const,
          content: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
          parentId: 'demo-folder-1',
          ownerId: 'guest',
          createdAt: Date.now() - 900000,
          size: 145000
        }
      ];
      setItems(demoItems);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const q = query(
        collection(db, 'files'),
        where('ownerId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      const fetchedItems: FileDoc[] = [];
      querySnapshot.forEach((docSnapshot) => {
        fetchedItems.push({ id: docSnapshot.id, ...docSnapshot.data() } as FileDoc);
      });
      setItems(fetchedItems);
    } catch (err) {
      console.error('Error fetching file items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [userId]);

  // Navigate folder path breadcrumbs helper
  const getFolderPath = (): { id: string; name: string }[] => {
    const path = [{ id: 'root', name: 'Root Vault' }];
    let currentId = currentFolderId;
    
    // Simple parent tracing loop
    while (currentId !== 'root') {
      const parent = items.find(item => item.id === currentId && item.type === 'folder');
      if (parent) {
        path.splice(1, 0, { id: parent.id, name: parent.name });
        currentId = parent.parentId;
      } else {
        break;
      }
    }
    return path;
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const newFolder = {
      name: newFolderName.trim(),
      type: 'folder' as const,
      fileType: 'other' as const,
      content: '',
      parentId: currentFolderId,
      ownerId: userId,
      createdAt: Date.now(),
      size: 0
    };

    if (userId === 'guest') {
      const localId = `guest-folder-${Date.now()}`;
      setItems(prev => [...prev, { id: localId, ...newFolder }]);
      setNewFolderName('');
      setShowFolderInput(false);
      return;
    }

    try {
      setLoading(true);
      const docRef = await addDoc(collection(db, 'files'), newFolder);
      setItems(prev => [...prev, { id: docRef.id, ...newFolder }]);
      setNewFolderName('');
      setShowFolderInput(false);
    } catch (err) {
      console.error('Error creating folder:', err);
    } finally {
      setLoading(false);
    }
  };

  // Convert File to Base64 String and Compress
  const processFileUpload = async (file: File) => {
    if (file.size > 2.5 * 1024 * 1024) {
      alert('⚠️ Maximum supported upload size for database synchronization is 2.5MB.');
      return;
    }

    setUploadProgress(`Optimizing & Uploading ${file.name}...`);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const base64Data = e.target?.result as string;
      
      // Determine file category
      let fileType: FileDoc['fileType'] = 'other';
      if (file.type.startsWith('image/')) fileType = 'image';
      else if (file.type.startsWith('text/')) fileType = 'text';
      else if (file.name.endsWith('.pdf')) fileType = 'pdf';
      else if (file.name.endsWith('.js') || file.name.endsWith('.html') || file.name.endsWith('.css') || file.name.endsWith('.ts')) fileType = 'code';

      // Perform LZString compression
      const compressed = LZString.compressToBase64(base64Data);
      const isCompressed = compressed.length < base64Data.length;
      const finalContent = isCompressed ? compressed : base64Data;
      const finalSize = isCompressed ? Math.round(compressed.length * 0.75) : file.size; // Char length in base64 is close to binary but slightly lighter, we adjust to represent realistic bytes

      const newFileItem = {
        name: file.name,
        type: 'file' as const,
        fileType: fileType,
        content: finalContent,
        parentId: currentFolderId,
        ownerId: userId,
        createdAt: Date.now(),
        size: finalSize,
        originalSize: file.size,
        isCompressed: isCompressed
      };

      if (userId === 'guest') {
        const localId = `guest-file-${Date.now()}`;
        setItems(prev => [...prev, { id: localId, ...newFileItem }]);
        setUploadProgress(null);
        return;
      }

      try {
        const docRef = await addDoc(collection(db, 'files'), newFileItem);
        setItems(prev => [...prev, { id: docRef.id, ...newFileItem }]);
      } catch (err) {
        console.error('File upload failed:', err);
      } finally {
        setUploadProgress(null);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFileUpload(e.target.files[0]);
    }
  };

  // Drag and Drop hooks
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to permanently delete this file?')) return;

    if (userId === 'guest') {
      setItems(items.filter(item => item.id !== id));
      if (viewingFile?.id === id) setViewingFile(null);
      return;
    }

    try {
      await deleteDoc(doc(db, 'files', id));
      setItems(items.filter(item => item.id !== id));
      if (viewingFile?.id === id) setViewingFile(null);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Download local file representation with decompression on the fly
  const handleDownloadFile = (file: FileDoc) => {
    const link = document.createElement('a');
    const decompressedContent = (file.isCompressed && file.content)
      ? LZString.decompressFromBase64(file.content)
      : file.content;
    link.href = decompressedContent || file.content;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Retroactively compress older files in the file system for space-saving
  const handleCompressAllFiles = async () => {
    const uncompressed = items.filter(item => item.type === 'file' && !item.isCompressed);
    if (uncompressed.length === 0) {
      alert('All files are already compressed and optimized!');
      return;
    }

    setUploadProgress(`Lossless-compressing ${uncompressed.length} older files...`);

    const updatedItems = [...items];
    let compressedCount = 0;
    let savedBytes = 0;

    for (const item of uncompressed) {
      const decompressedContent = item.content;
      const compressed = LZString.compressToBase64(decompressedContent);
      const isCompressed = compressed.length < decompressedContent.length;
      const finalContent = isCompressed ? compressed : decompressedContent;
      const finalSize = isCompressed ? Math.round(compressed.length * 0.75) : item.size;

      const updatedFields = {
        content: finalContent,
        size: finalSize,
        originalSize: item.size,
        isCompressed: isCompressed
      };

      if (userId === 'guest') {
        const index = updatedItems.findIndex(i => i.id === item.id);
        if (index !== -1) {
          updatedItems[index] = { ...updatedItems[index], ...updatedFields };
        }
      } else {
        try {
          await updateDoc(doc(db, 'files', item.id), updatedFields);
          const index = updatedItems.findIndex(i => i.id === item.id);
          if (index !== -1) {
            updatedItems[index] = { ...updatedItems[index], ...updatedFields };
          }
        } catch (err) {
          console.error(`Failed to compress file ${item.name}:`, err);
        }
      }

      compressedCount++;
      savedBytes += Math.max(0, item.size - finalSize);
    }

    setItems(updatedItems);
    setUploadProgress(null);
    alert(`⚡ Storage Optimization Complete!\n\nLossless LZW compression compressed ${compressedCount} file(s) and recovered ${formatBytes(savedBytes)} of storage!`);
  };

  const currentLevelItems = items.filter(item => item.parentId === currentFolderId);
  const totalStorageUsed = items.reduce((acc, curr) => acc + curr.size, 0);
  const storageLimit = 50 * 1024 * 1024; // 50MB virtual storage allowance
  const storagePercentage = Math.min(100, (totalStorageUsed / storageLimit) * 100);

  // File size formatter
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Helper icon selector
  const getItemIcon = (item: FileDoc) => {
    if (item.type === 'folder') return <Folder className="w-10 h-10 text-cyan-400" />;
    switch (item.fileType) {
      case 'image': return <ImageIcon className="w-10 h-10 text-emerald-400" />;
      case 'text': return <FileText className="w-10 h-10 text-cyan-300" />;
      case 'code': return <FileCode className="w-10 h-10 text-purple-400" />;
      default: return <File className="w-10 h-10 text-slate-300" />;
    }
  };

  return (
    <div id="storage-container" className="flex h-full gap-4 text-white font-sans text-sm select-text">
      {/* File Vault browser area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Navigation & Controls header */}
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-white/10 pb-3 mb-4">
          <div className="flex items-center gap-2">
            {currentFolderId !== 'root' && (
              <button
                onClick={() => {
                  const currentFolder = items.find(i => i.id === currentFolderId);
                  if (currentFolder) setCurrentFolderId(currentFolder.parentId);
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              {getFolderPath().map((step, i, arr) => (
                <React.Fragment key={step.id}>
                  <span
                    onClick={() => setCurrentFolderId(step.id)}
                    className={`hover:text-white cursor-pointer transition-colors ${
                      i === arr.length - 1 ? 'text-cyan-300 font-medium' : ''
                    }`}
                  >
                    {step.name}
                  </span>
                  {i < arr.length - 1 && <span className="text-white/20">/</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Create Folder toggler */}
            <button
              onClick={() => setShowFolderInput(!showFolderInput)}
              className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer font-medium"
            >
              <FolderPlus className="w-4 h-4 text-cyan-400" />
              <span>New Folder</span>
            </button>

            {/* Hidden Input File Upload trigger */}
            <label className="px-3 py-1.5 text-xs rounded-lg bg-cyan-500/20 border border-cyan-500/30 hover:bg-cyan-500/30 text-cyan-300 flex items-center gap-1.5 transition-all cursor-pointer font-medium">
              <UploadCloud className="w-4 h-4 text-cyan-400" />
              <span>Upload File</span>
              <input type="file" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
        </div>

        {/* Modal-like Folder naming pop-down */}
        <AnimatePresence>
          {showFolderInput && (
            <motion.form
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleCreateFolder}
              className="mb-4 p-3 rounded-xl border border-white/10 bg-white/5 flex gap-2 items-center"
            >
              <input
                type="text"
                placeholder="Folder Name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                required
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-white/10 bg-slate-950/60 text-white outline-none"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-medium cursor-pointer"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowFolderInput(false)}
                className="px-2 py-1 text-xs text-white/50 hover:text-white"
              >
                Cancel
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Upload overlay Progress banner */}
        {uploadProgress && (
          <div className="mb-4 p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 text-xs text-cyan-200 flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <span>{uploadProgress}</span>
          </div>
        )}

        {/* Directory browser container */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`flex-1 overflow-y-auto rounded-2xl border p-5 relative min-h-[250px] transition-colors ${
            dragActive ? 'bg-cyan-500/5 border-cyan-400 border-dashed' : 'bg-white/3 border-white/5'
          }`}
        >
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : currentLevelItems.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-white/30 pointer-events-none">
              <UploadCloud className="w-12 h-12 mb-3 text-white/15" />
              <p className="text-sm font-medium">This Folder is Empty</p>
              <p className="text-xs text-white/20 mt-1 max-w-[200px]">Drag & drop files directly here or click "Upload File" above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {currentLevelItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.type === 'folder') {
                      setCurrentFolderId(item.id);
                    } else {
                      setViewingFile(item);
                      setAiAnalysisResult('');
                    }
                  }}
                  className="group relative p-4 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 shadow-md transition-all duration-200 cursor-pointer flex flex-col items-center text-center select-none"
                >
                  {/* Delete hovering indicator */}
                  <button
                    onClick={(e) => handleDeleteItem(item.id, e)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white transition-all cursor-pointer shadow"
                    title="Delete item"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>

                  {/* Thumbnail / Icon */}
                  <div className="mb-3">
                    {getItemIcon(item)}
                  </div>

                  {/* Label */}
                  <span className="text-xs text-slate-200 font-medium truncate w-full px-1">
                    {item.name}
                  </span>

                  {/* Byte representation */}
                  {item.type === 'file' && (
                    <span className="text-[9px] text-white/30 font-mono mt-1">
                      {formatBytes(item.size)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Storage info / Selected file view context */}
      <div className="w-64 border-l border-white/10 pl-4 flex flex-col gap-4 shrink-0">
        <div className="space-y-4">
          <div>
            <h3 className="font-display font-semibold text-cyan-200 flex items-center gap-1.5 mb-2 text-xs">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              {userId === 'guest' ? 'Local Session Storage' : 'Cloud Storage Vault'}
            </h3>
            <p className="text-[10px] text-white/40 leading-relaxed mb-4 font-medium">
              {userId === 'guest' 
                ? '⚠️ Guest Session: All uploads and creations are kept in-memory and will not persist to the database.' 
                : 'Cloud synced virtual disk keeping your personal documents locked securely.'}
            </p>

            {/* Allocation progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-white/50">
                <span>{formatBytes(totalStorageUsed)} of {formatBytes(storageLimit)} used</span>
                <span>{storagePercentage.toFixed(0)}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  style={{ width: `${storagePercentage}%` }}
                  className="h-full bg-gradient-to-r from-cyan-400 to-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Disk Compressor Module */}
          {(() => {
            const totalOriginalSize = items.reduce((acc, curr) => acc + (curr.originalSize || curr.size), 0);
            const totalSpaceSaved = Math.max(0, totalOriginalSize - totalStorageUsed);
            const savedPercentage = totalOriginalSize > 0 ? (totalSpaceSaved / totalOriginalSize) * 100 : 0;
            const uncompressedFiles = items.filter(i => i.type === 'file' && !i.isCompressed);

            return (
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-semibold text-cyan-300">
                  <span>⚡ Compression Engine</span>
                  {totalSpaceSaved > 0 && <span>{savedPercentage.toFixed(0)}% Saved</span>}
                </div>
                <p className="text-[9px] text-white/50 leading-relaxed font-medium">
                  Lossless LZW algorithm compresses text, source code, and assets.
                  {totalSpaceSaved > 0 && (
                    <>
                      {' '}Shrunk files from <span className="font-mono text-white/80">{formatBytes(totalOriginalSize)}</span> down to <span className="font-mono text-white/80">{formatBytes(totalStorageUsed)}</span>, recovering <span className="text-cyan-300 font-bold font-mono">{formatBytes(totalSpaceSaved)}</span> of free disk space.
                    </>
                  )}
                </p>
                {uncompressedFiles.length > 0 && (
                  <button
                    onClick={handleCompressAllFiles}
                    className="w-full py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-500/30 text-cyan-200 text-[10px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    ⚡ Optimize {uncompressedFiles.length} Old File{uncompressedFiles.length > 1 ? 's' : ''}
                  </button>
                )}
              </div>
            );
          })()}
        </div>

        {/* Selected File Details / Viewer card */}
        <div className="flex-1 flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            {viewingFile ? (
              <motion.div
                key={viewingFile.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex-1 border border-white/10 bg-white/5 rounded-2xl p-4 flex flex-col gap-4 min-h-0"
              >
                <div className="text-center">
                  <div className="inline-block p-3.5 rounded-2xl bg-white/5 border border-white/10 mb-2">
                    {getItemIcon(viewingFile)}
                  </div>
                  <h4 className="font-medium text-xs text-white truncate px-2">{viewingFile.name}</h4>
                  <p className="text-[10px] text-white/40 font-mono mt-0.5 uppercase">{viewingFile.fileType}</p>
                </div>

                <div className="text-[10px] space-y-2 text-white/60 font-medium">
                  <div className="flex justify-between">
                    <span>Stored Size:</span>
                    <span className="font-mono text-white/95">{formatBytes(viewingFile.size)}</span>
                  </div>
                  {viewingFile.isCompressed && viewingFile.originalSize && (
                    <>
                      <div className="flex justify-between">
                        <span>Original Size:</span>
                        <span className="font-mono text-white/40 line-through">{formatBytes(viewingFile.originalSize)}</span>
                      </div>
                      <div className="flex justify-between text-cyan-300">
                        <span>Space Saved:</span>
                        <span className="font-bold">{((1 - (viewingFile.size / viewingFile.originalSize)) * 100).toFixed(0)}%</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span className="font-mono text-white/95">
                      {new Date(viewingFile.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Built-in glass viewer integrations with decompression */}
                {viewingFile.fileType === 'image' && (
                  <div className="flex-1 min-h-[100px] rounded-xl border border-white/10 overflow-hidden relative group">
                    <img
                      src={viewingFile.isCompressed ? LZString.decompressFromBase64(viewingFile.content) : viewingFile.content}
                      alt={viewingFile.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                {(viewingFile.fileType === 'text' || viewingFile.fileType === 'code') && (
                  <div className="flex-1 min-h-[100px] rounded-xl border border-white/15 bg-slate-950/40 p-2 overflow-auto font-mono text-[10px] text-slate-300 max-h-40">
                    {(() => {
                      const decompressed = viewingFile.isCompressed ? LZString.decompressFromBase64(viewingFile.content) : viewingFile.content;
                      try {
                        const parts = decompressed.split(',');
                        if (parts.length > 1 && parts[0].includes('base64')) {
                          return atob(parts[1]);
                        }
                        return decompressed;
                      } catch (e) {
                        return decompressed;
                      }
                    })()}
                  </div>
                )}

                {preferences?.aiEnabled !== false && (viewingFile.fileType === 'text' || viewingFile.fileType === 'code') && (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleAiAnalyzeFile(viewingFile)}
                      disabled={aiAnalysing}
                      className="w-full py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/35 border border-purple-500/35 text-purple-200 text-[10px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {aiAnalysing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>AI Analyze Document</span>
                    </button>
                    
                    {aiAnalysisResult && (
                      <div className="p-2.5 rounded-xl border border-purple-500/20 bg-purple-950/20 text-[10px] text-purple-200 leading-relaxed max-h-32 overflow-y-auto font-sans">
                        <span className="block font-semibold mb-1 text-purple-300">AI Deep Analysis:</span>
                        {aiAnalysisResult}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-auto flex gap-2">
                  <button
                    onClick={() => handleDownloadFile(viewingFile)}
                    className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>

                  <button
                    onClick={() => handleDeleteItem(viewingFile.id, {} as any)}
                    className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500 border border-red-500/20 text-red-400 hover:text-white transition-all cursor-pointer"
                    title="Delete item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 border border-white/5 bg-white/2 rounded-2xl p-6 flex flex-col items-center justify-center text-center text-white/30 border-dashed">
                <HardDrive className="w-8 h-8 text-white/10 mb-2 animate-pulse" />
                <p className="text-[11px] font-medium leading-relaxed">No File Selected</p>
                <p className="text-[10px] text-white/20 mt-1 max-w-[150px]">
                  Select any file item to inspect details or preview content directly.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

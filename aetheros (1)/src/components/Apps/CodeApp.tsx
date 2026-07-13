/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { CodeProject, UserPreferences } from '../../types';
import {
  Play,
  Save,
  Trash2,
  Plus,
  Terminal,
  Eye,
  Code,
  RefreshCw,
  Cpu,
  Sparkles,
  Check,
  ChevronRight,
  Search,
  FileText,
  Settings,
  Download,
  ChevronDown,
  Folder,
  FolderPlus,
  FilePlus,
  AlertCircle,
  Undo,
  Info,
  X,
  Lock,
  Globe,
  Flame,
  HelpCircle,
  Copy,
  TerminalSquare,
  FileCode,
  Command,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { callAiSystem } from '../../lib/aiSystem';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';

interface CodeAppProps {
  userId: string;
  preferences: UserPreferences;
}

interface VirtualFile {
  name: string;
  content: string;
  language: string;
}

export default function CodeApp({ userId, preferences }: CodeAppProps) {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<'explorer' | 'search' | 'copilot' | 'run' | 'info'>('explorer');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState<number>(13);
  const [splitLayout, setSplitLayout] = useState<'horizontal' | 'vertical'>('vertical');
  const [showConsole, setShowConsole] = useState(true);

  // Mobile Workspace states
  const [isMobile, setIsMobile] = useState(false);
  const [mobileWorkspaceView, setMobileWorkspaceView] = useState<'editor' | 'preview' | 'terminal'>('editor');

  // Sync mobile view on resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarCollapsed(true); // Automatically collapse sidebar on mobile
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Firestore & Storage State
  const [projects, setProjects] = useState<CodeProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [name, setName] = useState('My Workspace');
  const [language, setLanguage] = useState('html');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Active Multi-File Workspace State
  const [files, setFiles] = useState<{ [filename: string]: string }>({});
  const [activeFile, setActiveFile] = useState<string>('');
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [dirtyFiles, setDirtyFiles] = useState<{ [filename: string]: boolean }>({});

  // Search & Replace State
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<number>(0);

  // Sandbox Live execution
  const [consoleLogs, setConsoleLogs] = useState<{ type: 'log' | 'warn' | 'error' | 'system'; text: string; time: string }[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // AI Code Assistant State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [aiSystemInstruction, setAiSystemInstruction] = useState('You are a senior compiler engineer and expert software architect.');

  // Default templates configuration
  const templates: { [key: string]: { [filename: string]: string } } = {
    html: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aether Virtual Canvas</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="main-container">
    <div class="glass-card">
      <div class="logo-area">
        <div class="glowing-orb"></div>
        <h1>Aether Live Engine</h1>
      </div>
      <p class="subtitle">A multi-file sandbox running live in your Aether OS container.</p>
      
      <div class="metric-container">
        <div class="metric-card">
          <span class="metric-title">COMPILER</span>
          <span class="metric-value text-glow">V1.4.0</span>
        </div>
        <div class="metric-card">
          <span class="metric-title">STATUS</span>
          <span class="metric-value text-green">ACTIVE</span>
        </div>
      </div>

      <div class="interactive-demo">
        <button id="btn-count" class="btn-primary">Clicks: <span id="click-val">0</span></button>
        <button id="btn-trigger-log" class="btn-secondary">Emit Debug Log</button>
      </div>
      
      <div class="console-preview">
        <span class="terminal-prompt">></span> <span id="terminal-text">Ready for interaction...</span>
      </div>
    </div>
  </div>

  <script src="script.js"></script>
</body>
</html>`,
      'styles.css': `body {
  background: radial-gradient(circle at 50% 50%, #0c0f1d, #030408);
  color: #f8fafc;
  font-family: system-ui, -apple-system, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  margin: 0;
  overflow: hidden;
}

.main-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
}

.glass-card {
  background: rgba(13, 17, 28, 0.6);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 3rem 2.5rem;
  border-radius: 28px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.6);
  text-align: center;
  max-width: 440px;
  width: 100%;
  position: relative;
}

.logo-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1.5rem;
}

.glowing-orb {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #06b6d4, #8b5cf6);
  border-radius: 50%;
  box-shadow: 0 0 25px rgba(6, 182, 212, 0.6);
  margin-bottom: 1rem;
  animation: float 4s ease-in-out infinite;
}

h1 {
  font-size: 1.85rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  background: linear-gradient(to right, #22d3ee, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.subtitle {
  color: #94a3b8;
  font-size: 0.9rem;
  line-height: 1.6;
  margin-top: 0.5rem;
}

.metric-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 1.5rem 0;
}

.metric-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  padding: 10px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-title {
  font-size: 0.65rem;
  color: #64748b;
  font-weight: 600;
  letter-spacing: 0.05em;
}

.metric-value {
  font-size: 0.95rem;
  font-family: monospace;
  font-weight: bold;
}

.text-glow {
  color: #22d3ee;
  text-shadow: 0 0 10px rgba(34, 211, 238, 0.3);
}

.text-green {
  color: #10b981;
}

.interactive-demo {
  display: flex;
  gap: 12px;
  margin: 1.5rem 0 1rem;
}

.btn-primary {
  flex: 1;
  background: linear-gradient(135deg, #0ea5e9, #0284c7);
  color: #ffffff;
  border: none;
  padding: 12px;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 14px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(14, 165, 233, 0.35);
}

.btn-secondary {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px;
  font-size: 0.85rem;
  font-weight: 500;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.console-preview {
  background: rgba(2, 4, 8, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 10px 14px;
  border-radius: 10px;
  font-family: monospace;
  font-size: 0.75rem;
  text-align: left;
  color: #a78bfa;
}

.terminal-prompt {
  color: #38bdf8;
  margin-right: 6px;
  font-weight: bold;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
}`,
      'script.js': `// Aether Sandboxed JS Live
console.log("🚀 Aether virtual runtime is online.");

let clicks = 0;
const clickVal = document.getElementById("click-val");
const btnCount = document.getElementById("btn-count");
const btnTriggerLog = document.getElementById("btn-trigger-log");
const terminalText = document.getElementById("terminal-text");

if (btnCount && clickVal) {
  btnCount.addEventListener("click", () => {
    clicks++;
    clickVal.textContent = clicks;
    console.log("📈 Click registered. Total click count: " + clicks);
    
    if (terminalText) {
      terminalText.textContent = "Counter incremented to " + clicks;
      terminalText.style.color = "#22d3ee";
    }
  });
}

if (btnTriggerLog) {
  btnTriggerLog.addEventListener("click", () => {
    console.warn("⚠️ User triggered a test warning log!");
    console.error("❌ Sample compilation exception logged successfully.");
    
    if (terminalText) {
      terminalText.textContent = "Warning & error logs output to Terminal.";
      terminalText.style.color = "#ef4444";
    }
  });
}`
    },
    javascript: {
      'main.js': `// Aether JavaScript Scratchpad
// Click 'Run Code' to execute in the secure front-end virtual container.

console.log("⚡ Booting sandboxed JS scratchpad...");

function calcPrimes(limit) {
  console.log("Calculating primes up to " + limit + "...");
  const primes = [];
  for (let i = 2; i <= limit; i++) {
    let isPrime = true;
    for (let j = 2; j <= Math.sqrt(i); j++) {
      if (i % j === 0) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) primes.push(i);
  }
  return primes;
}

const result = calcPrimes(50);
console.log("🏆 Found Primes:", JSON.stringify(result));
`
    },
    python: {
      'main.py': `# Secure Python Kernel Playground
# Aether OS links your code dynamically to the central AI System
# Click 'Run Code' to simulate real compiler output for python scripts.

def main():
    print("🐍 Virtual Python 3.11 Workspace Active")
    
    class CloudNode:
        def __init__(self, node_id, status):
            self.node_id = node_id
            self.status = status
            
        def fetch_telemetry(self):
            return f"Telemetry: Node {self.node_id} is currently {self.status.upper()}."

    # Instantiate nodes
    nodes = [
        CloudNode("Aether-01", "online"),
        CloudNode("Aether-02", "standby"),
        CloudNode("Core-09", "degraded")
    ]
    
    print("\\nFetching Virtual Datacenter status:")
    for node in nodes:
        print(f" -> {node.fetch_telemetry()}")
        
if __name__ == "__main__":
    main()
`
    }
  };

  // Extract files list or fallback to legacy structures
  const getProjectFiles = (projCode: string, lang: string): { [filename: string]: string } => {
    if (projCode && projCode.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(projCode);
        if (parsed && typeof parsed === 'object' && parsed.files) {
          return parsed.files;
        }
      } catch (e) {
        // Fallback
      }
    }

    // Default legacy mapping
    if (lang === 'html') {
      return {
        'index.html': projCode || templates.html['index.html'],
        'styles.css': templates.html['styles.css'],
        'script.js': templates.html['script.js']
      };
    } else if (lang === 'javascript') {
      return {
        'main.js': projCode || templates.javascript['main.js']
      };
    } else if (lang === 'python') {
      return {
        'main.py': projCode || templates.python['main.py']
      };
    } else {
      return {
        [`main.${lang}`]: projCode || ''
      };
    }
  };

  // Fetch projects list from Firestore
  useEffect(() => {
    if (userId === 'guest') {
      const demoProj: CodeProject = {
        id: 'guest-code-1',
        name: 'Aether Web App Canvas',
        code: JSON.stringify({
          files: templates.html,
          activeFile: 'index.html'
        }),
        language: 'html',
        lastModified: Date.now(),
        ownerId: 'guest'
      };
      setProjects([demoProj]);
      selectProject(demoProj);
      setLoading(false);
      return;
    }

    const fetchProjects = async () => {
      try {
        const q = query(
          collection(db, 'codes'),
          where('ownerId', '==', userId),
          orderBy('lastModified', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const fetched: CodeProject[] = [];
        querySnapshot.forEach((docSnapshot) => {
          fetched.push({ id: docSnapshot.id, ...docSnapshot.data() } as CodeProject);
        });
        setProjects(fetched);

        if (fetched.length > 0 && !selectedProjectId) {
          selectProject(fetched[0]);
        } else if (fetched.length === 0) {
          // Initialize with default HTML project
          handleCreateProject('html', 'Aether Sandbox Web');
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching code projects:', err);
        setLoading(false);
      }
    };

    fetchProjects();
  }, [userId]);

  // Select project
  const selectProject = (proj: CodeProject) => {
    setSelectedProjectId(proj.id);
    setName(proj.name);
    setLanguage(proj.language);
    
    const parsedFiles = getProjectFiles(proj.code, proj.language);
    setFiles(parsedFiles);
    
    // Choose active file
    const fileKeys = Object.keys(parsedFiles);
    const firstFile = fileKeys.includes('index.html') ? 'index.html' : fileKeys[0] || '';
    setActiveFile(firstFile);
    setOpenTabs(fileKeys.slice(0, 4));
    setDirtyFiles({});
    setConsoleLogs([]);
    setAiResponse('');
    setLoading(false);
  };

  // Create workspace project
  const handleCreateProject = async (langSelection: string, customName?: string) => {
    const targetLang = langSelection || 'html';
    const projName = customName || `Aether ${targetLang.toUpperCase()} Studio`;
    
    let initialFiles: { [filename: string]: string } = {};
    if (targetLang === 'html') {
      initialFiles = { ...templates.html };
    } else if (targetLang === 'javascript') {
      initialFiles = { ...templates.javascript };
    } else if (targetLang === 'python') {
      initialFiles = { ...templates.python };
    } else {
      initialFiles = { [`main.${targetLang}`]: '// New file' };
    }

    const initialCode = JSON.stringify({
      files: initialFiles,
      activeFile: Object.keys(initialFiles)[0]
    });

    const newProj = {
      name: projName,
      code: initialCode,
      language: targetLang,
      lastModified: Date.now(),
      ownerId: userId
    };

    if (userId === 'guest') {
      const localId = `guest-code-${Date.now()}`;
      const projWithId: CodeProject = { id: localId, ...newProj };
      setProjects([projWithId, ...projects]);
      setSelectedProjectId(localId);
      setName(projWithId.name);
      setLanguage(projWithId.language);
      setFiles(initialFiles);
      const firstF = Object.keys(initialFiles)[0];
      setActiveFile(firstF);
      setOpenTabs(Object.keys(initialFiles));
      setDirtyFiles({});
      return;
    }

    try {
      setSaving(true);
      const docRef = await addDoc(collection(db, 'codes'), newProj);
      const projWithId: CodeProject = { id: docRef.id, ...newProj };
      setProjects([projWithId, ...projects]);
      setSelectedProjectId(docRef.id);
      setName(projWithId.name);
      setLanguage(projWithId.language);
      setFiles(initialFiles);
      const firstF = Object.keys(initialFiles)[0];
      setActiveFile(firstF);
      setOpenTabs(Object.keys(initialFiles));
      setDirtyFiles({});
    } catch (err) {
      console.error('Error creating project:', err);
    } finally {
      setSaving(false);
    }
  };

  // Save Project
  const handleSaveProject = async () => {
    if (!selectedProjectId) {
      handleCreateProject(language, name);
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    // Build JSON data representing entire files workspace
    const serializedCode = JSON.stringify({
      files: files,
      activeFile: activeFile
    });

    const updated = {
      name: name || 'Aether Studio',
      code: serializedCode,
      language: language,
      lastModified: Date.now()
    };

    if (userId === 'guest') {
      setProjects(projects.map(p => p.id === selectedProjectId ? { ...p, ...updated } : p));
      setSaveSuccess(true);
      setSaving(false);
      setDirtyFiles({});
      setTimeout(() => setSaveSuccess(false), 2000);
      return;
    }

    try {
      const projRef = doc(db, 'codes', selectedProjectId);
      await updateDoc(projRef, updated);
      setProjects(projects.map(p => p.id === selectedProjectId ? { ...p, ...updated } : p));
      setSaveSuccess(true);
      setDirtyFiles({});
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Error saving project:', err);
    } finally {
      setSaving(false);
    }
  };

  // Delete Project
  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this Workspace project? All virtual files will be purged.')) return;

    if (userId === 'guest') {
      const remaining = projects.filter(p => p.id !== id);
      setProjects(remaining);
      if (selectedProjectId === id) {
        if (remaining.length > 0) {
          selectProject(remaining[0]);
        } else {
          handleCreateProject('html', 'Aether Web Workspace');
        }
      }
      return;
    }

    try {
      await deleteDoc(doc(db, 'codes', id));
      const remaining = projects.filter(p => p.id !== id);
      setProjects(remaining);
      if (selectedProjectId === id) {
        if (remaining.length > 0) {
          selectProject(remaining[0]);
        } else {
          handleCreateProject('html', 'Aether Web Workspace');
        }
      }
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  // Handle local text edits
  const handleCodeEdit = (val: string) => {
    setFiles(prev => ({ ...prev, [activeFile]: val }));
    setDirtyFiles(prev => ({ ...prev, [activeFile]: true }));
  };

  // Handle Tab keyboard press inside editor
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const currentText = files[activeFile] || '';
      
      const newText = currentText.substring(0, start) + '  ' + currentText.substring(end);
      handleCodeEdit(newText);
      
      // Reset cursor position
      setTimeout(() => {
        if (e.currentTarget) {
          e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  // Add virtual file to workspace
  const handleAddNewVirtualFile = () => {
    const filename = prompt('Enter a new filename (e.g. components.js, main.css, README.md):');
    if (!filename) return;
    
    if (files[filename]) {
      alert('A file with that name already exists in this workspace!');
      return;
    }

    const ext = filename.split('.').pop() || '';
    let defaultFileLang = 'javascript';
    if (ext === 'html') defaultFileLang = 'html';
    else if (ext === 'css') defaultFileLang = 'css';
    else if (ext === 'py') defaultFileLang = 'python';

    setFiles(prev => ({
      ...prev,
      [filename]: `// File: ${filename}\n// Created on ${new Date().toLocaleDateString()}\n`
    }));
    setActiveFile(filename);
    if (!openTabs.includes(filename)) {
      setOpenTabs([...openTabs, filename]);
    }
  };

  // Remove virtual file from workspace
  const handleDeleteVirtualFile = (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const keys = Object.keys(files);
    if (keys.length <= 1) {
      alert('You cannot delete the last remaining file in the workspace!');
      return;
    }
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

    const updatedFiles = { ...files };
    delete updatedFiles[filename];
    setFiles(updatedFiles);

    // Fix active tabs
    const nextTabs = openTabs.filter(t => t !== filename);
    setOpenTabs(nextTabs);

    if (activeFile === filename) {
      const remainingKeys = Object.keys(updatedFiles);
      const fallbackFile = remainingKeys.includes('index.html') ? 'index.html' : remainingKeys[0] || '';
      setActiveFile(fallbackFile);
      if (!nextTabs.includes(fallbackFile) && fallbackFile) {
        setOpenTabs([...nextTabs, fallbackFile]);
      }
    }
  };

  // Bundle multi-file Web Canvas Code
  const compileWorkspaceHtml = () => {
    const htmlContent = files['index.html'] || templates.html['index.html'];
    const cssContent = files['styles.css'] || '';
    const jsContent = files['script.js'] || '';

    let bundled = htmlContent;

    // Inject styles.css
    if (bundled.includes('styles.css') || bundled.includes('href="styles.css"')) {
      bundled = bundled.replace(
        /<link[^>]*href=["']styles\.css["'][^>]*>/gi,
        `<style id="aether-injected-styles">${cssContent}</style>`
      );
    } else {
      if (bundled.includes('</head>')) {
        bundled = bundled.replace('</head>', `<style id="aether-injected-styles">${cssContent}</style></head>`);
      } else {
        bundled = `<style id="aether-injected-styles">${cssContent}</style>\n` + bundled;
      }
    }

    // Embed logs interceptor & script.js
    const consolePolyfill = `
      <script id="aether-terminal-interceptor">
        (function() {
          const _log = console.log;
          const _warn = console.warn;
          const _error = console.error;

          function sendLog(type, args) {
            try {
              const text = args.map(arg => {
                if (arg === null) return 'null';
                if (arg === undefined) return 'undefined';
                if (typeof arg === 'object') {
                  try { return JSON.stringify(arg); } catch (e) { return String(arg); }
                }
                return String(arg);
              }).join(' ');
              
              window.parent.postMessage({
                type: 'AETHER_CONSOLE',
                logType: type,
                text: text
              }, '*');
            } catch(e) {}
          }

          console.log = function(...args) {
            _log.apply(console, args);
            sendLog('log', args);
          };
          console.warn = function(...args) {
            _warn.apply(console, args);
            sendLog('warn', args);
          };
          console.error = function(...args) {
            _error.apply(console, args);
            sendLog('error', args);
          };

          window.onerror = function(message, source, lineno, colno, error) {
            window.parent.postMessage({
              type: 'AETHER_CONSOLE',
              logType: 'error',
              text: 'Uncaught Runtime Error: ' + message + ' (Line ' + lineno + ':' + colno + ')'
            }, '*');
            return false;
          };
        })();
      </script>
    `;

    // Inject script.js
    if (bundled.includes('script.js') || bundled.includes('src="script.js"')) {
      bundled = bundled.replace(
        /<script[^>]*src=["']script\.js["'][^>]*>([\s\S]*?)<\/script>/gi,
        `${consolePolyfill}<script id="aether-injected-scripts">${jsContent}</script>`
      );
    } else {
      if (bundled.includes('</body>')) {
        bundled = bundled.replace('</body>', `${consolePolyfill}<script id="aether-injected-scripts">${jsContent}</script></body>`);
      } else {
        bundled = bundled + `\n${consolePolyfill}<script id="aether-injected-scripts">${jsContent}</script>`;
      }
    }

    // Inject any other supporting .js or .css custom virtual files from files object
    Object.keys(files).forEach(f => {
      if (f !== 'index.html' && f !== 'styles.css' && f !== 'script.js') {
        const fileContent = files[f];
        if (f.endsWith('.css')) {
          bundled = bundled.replace('</head>', `<style id="aether-file-${f.replace('.', '-')}">${fileContent}</style></head>`);
        } else if (f.endsWith('.js')) {
          bundled = bundled.replace('</body>', `<script id="aether-file-${f.replace('.', '-')}">${fileContent}</script></body>`);
        }
      }
    });

    return bundled;
  };

  // Run Project Code
  const handleRunCode = async () => {
    setIsRunning(true);
    setConsoleLogs([{
      type: 'system',
      text: `[Aether Terminal] Compiling Workspace Project: "${name}"...`,
      time: new Date().toLocaleTimeString()
    }]);

    if (language === 'html') {
      // Run Web canvas in sandboxed preview iframe
      if (iframeRef.current) {
        const compiledHtml = compileWorkspaceHtml();
        const iframe = iframeRef.current;
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(compiledHtml);
          iframeDoc.close();
          setConsoleLogs(prev => [...prev, {
            type: 'system',
            text: '🟢 Virtual iframe environment spawned successfully.',
            time: new Date().toLocaleTimeString()
          }]);
        }
      }
      setIsRunning(false);
    } else if (language === 'javascript') {
      // Execute standard ES6 Javascript using safe sandboxed execution
      const mainJs = files['main.js'] || files[Object.keys(files)[0]] || '';
      const customLogs: { type: 'log' | 'warn' | 'error' | 'system'; text: string; time: string }[] = [];
      
      const customConsole = {
        log: (...args: any[]) => {
          customLogs.push({
            type: 'log',
            text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
            time: new Date().toLocaleTimeString()
          });
        },
        warn: (...args: any[]) => {
          customLogs.push({
            type: 'warn',
            text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
            time: new Date().toLocaleTimeString()
          });
        },
        error: (...args: any[]) => {
          customLogs.push({
            type: 'error',
            text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
            time: new Date().toLocaleTimeString()
          });
        }
      };

      try {
        const runner = new Function('console', mainJs);
        runner(customConsole);
        setConsoleLogs(prev => [
          ...prev,
          ...customLogs,
          {
            type: 'system',
            text: `🟢 Process finished with status 0. Outputs: ${customLogs.length} line(s).`,
            time: new Date().toLocaleTimeString()
          }
        ]);
      } catch (err: any) {
        setConsoleLogs(prev => [
          ...prev,
          ...customLogs,
          {
            type: 'error',
            text: `Uncaught Runtime Exception: ${err.message}`,
            time: new Date().toLocaleTimeString()
          }
        ]);
      }
      setIsRunning(false);
    } else if (language === 'python') {
      // Dynamic simulated python execution powered by AI!
      const mainPy = files['main.py'] || files[Object.keys(files)[0]] || '';
      setConsoleLogs(prev => [...prev, {
        type: 'system',
        text: '🐍 Invoking Aether Virtual Python Kernel...',
        time: new Date().toLocaleTimeString()
      }]);

      try {
        const prompt = `You are a Python 3.11 terminal compiler. Execute the following script and return EXACTLY what would print in the console terminal. Include formatting, outputs, and standard tracebacks if there is an error. Do not output markdown code blocks. Just output the clean text output as if from an interactive shell.

Python Code:
${mainPy}`;

        const simulatedOutput = await callAiSystem(
          [{ role: 'user', content: prompt }],
          preferences,
          'You are a high-fidelity Python 3.11 standalone terminal emulator. Output only raw terminal console stdout/stderr.'
        );

        setConsoleLogs(prev => [
          ...prev,
          {
            type: 'log',
            text: simulatedOutput || 'Process finished with no logs output.',
            time: new Date().toLocaleTimeString()
          },
          {
            type: 'system',
            text: '🐍 Local virtual kernel terminated successfully.',
            time: new Date().toLocaleTimeString()
          }
        ]);
      } catch (err: any) {
        setConsoleLogs(prev => [
          ...prev,
          {
            type: 'error',
            text: `Kernel Error: ${err.message || err}`,
            time: new Date().toLocaleTimeString()
          }
        ]);
      } finally {
        setIsRunning(false);
      }
    }
  };

  // Listen to message events from iframe
  useEffect(() => {
    const handleIframeLogs = (e: MessageEvent) => {
      if (e.data && e.data.type === 'AETHER_CONSOLE') {
        setConsoleLogs(prev => [...prev, {
          type: e.data.logType,
          text: e.data.text,
          time: new Date().toLocaleTimeString()
        }]);
      }
    };

    window.addEventListener('message', handleIframeLogs);
    return () => window.removeEventListener('message', handleIframeLogs);
  }, []);

  // Global Search & Replace Implementation
  const handleSearch = () => {
    if (!searchQuery) {
      setSearchMatches(0);
      return;
    }
    const content = files[activeFile] || '';
    const regex = new RegExp(searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
    const matches = content.match(regex);
    setSearchMatches(matches ? matches.length : 0);
  };

  const handleReplaceAll = () => {
    if (!searchQuery) return;
    const content = files[activeFile] || '';
    const regex = new RegExp(searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
    const updatedContent = content.replace(regex, replaceQuery);
    handleCodeEdit(updatedContent);
    setSearchMatches(0);
    alert(`Replaced all occurrences of "${searchQuery}" with "${replaceQuery}" in ${activeFile}`);
  };

  // AI system call handler
  const handleAiCall = async (mode: 'explain' | 'fix' | 'optimize' | 'generate' | 'custom') => {
    const isEnabled = preferences.aiEnabled !== false;
    if (!isEnabled) {
      setAiResponse('⚠️ AI Core is disabled. Enable it in Aether Settings.');
      return;
    }

    setAiLoading(true);
    setAiResponse('');

    const activeCode = files[activeFile] || '';
    let prompt = '';

    if (mode === 'explain') {
      prompt = `Explain the following code snippet from the file "${activeFile}". Outline its algorithm, key functions, and security risks:\n\n\`\`\`${language}\n${activeCode}\n\`\`\``;
    } else if (mode === 'fix') {
      prompt = `Identify any syntax errors, memory leaks, performance bottlenecks, or logical bugs in this code ("${activeFile}"). Return the corrected code with clear explanations of the changes:\n\n\`\`\`${language}\n${activeCode}\n\`\`\``;
    } else if (mode === 'optimize') {
      prompt = `Optimize the performance, memory usage, and legibility of this code block ("${activeFile}"). Ensure compatibility and document your refactoring:\n\n\`\`\`${language}\n${activeCode}\n\`\`\``;
    } else if (mode === 'generate') {
      prompt = `You are a feature developer. Under the context of this workspace, generate a robust feature or code expansion based on: "${aiPrompt}". Here is the existing code for reference:\n\n\`\`\`${language}\n${activeCode}\n\`\`\``;
    } else {
      prompt = `Under the context of file "${activeFile}" in our workspace, answer this developer query: ${aiPrompt}\n\nExisting Code:\n\`\`\`${language}\n${activeCode}\n\`\`\``;
    }

    try {
      const response = await callAiSystem(
        [{ role: 'user', content: prompt }],
        preferences,
        aiSystemInstruction
      );
      setAiResponse(response || 'No feedback returned.');
    } catch (err: any) {
      setAiResponse(`❌ AI request failed: ${err.message || err}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Download project as standalone combined HTML file
  const handleDownloadStandaloneHtml = () => {
    const compiled = language === 'html' ? compileWorkspaceHtml() : files[activeFile] || '';
    const blob = new Blob([compiled], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const element = document.createElement('a');
    element.href = url;
    element.download = `${name.replace(/\s+/g, '-').toLowerCase()}-${activeFile}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Download project as full workspace multi-file ZIP archive
  const handleDownloadZip = async () => {
    const zip = new JSZip();
    
    // Add all files from workspace
    Object.keys(files).forEach(fName => {
      zip.file(fName, files[fName]);
    });

    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const element = document.createElement('a');
      element.href = url;
      element.download = `${name.replace(/\s+/g, '-').toLowerCase()}-workspace.zip`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (err) {
      console.error('Error generating zip file:', err);
      alert('Zip compression failed. Try using standalone file download.');
    }
  };

  // Setup tab state when open file is selected
  const openFileInTab = (fileName: string) => {
    setActiveFile(fileName);
    if (!openTabs.includes(fileName)) {
      setOpenTabs([...openTabs, fileName]);
    }
  };

  const closeTab = (fileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedTabs = openTabs.filter(t => t !== fileName);
    setOpenTabs(updatedTabs);
    if (activeFile === fileName && updatedTabs.length > 0) {
      setActiveFile(updatedTabs[updatedTabs.length - 1]);
    }
  };

  const currentLineCount = (files[activeFile] || '').split('\n').length;

  return (
    <div id="aether-vscode-workspace" className="flex h-full w-full bg-[#0c0d12] text-slate-300 font-sans text-xs select-none overflow-hidden relative">
      {/* 1. ACTIVITY BAR (Far Left Thin Rail) */}
      <div className="w-12 bg-[#080a0e] border-r border-slate-900 flex flex-col justify-between items-center py-3.5 shrink-0 z-10">
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Logo */}
          <div className="p-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-2">
            <Command className="w-4 h-4 animate-pulse" />
          </div>

          {/* Navigation Options */}
          <button
            onClick={() => {
              if (activeTab === 'explorer') setSidebarCollapsed(!sidebarCollapsed);
              else { setActiveTab('explorer'); setSidebarCollapsed(false); }
            }}
            title="Files Explorer"
            className={`p-2.5 rounded-xl transition-all cursor-pointer relative group ${
              activeTab === 'explorer' && !sidebarCollapsed
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <Folder className="w-4 h-4" />
            <div className="absolute left-14 bg-slate-950 px-2 py-1 rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none border border-slate-800">
              Explorer
            </div>
          </button>

          <button
            onClick={() => {
              if (activeTab === 'search') setSidebarCollapsed(!sidebarCollapsed);
              else { setActiveTab('search'); setSidebarCollapsed(false); }
            }}
            title="Search and Replace"
            className={`p-2.5 rounded-xl transition-all cursor-pointer relative group ${
              activeTab === 'search' && !sidebarCollapsed
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <Search className="w-4 h-4" />
            <div className="absolute left-14 bg-slate-950 px-2 py-1 rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none border border-slate-800">
              Search
            </div>
          </button>

          <button
            onClick={() => {
              if (activeTab === 'copilot') setSidebarCollapsed(!sidebarCollapsed);
              else { setActiveTab('copilot'); setSidebarCollapsed(false); }
            }}
            title="AI Co-pilot Studio"
            className={`p-2.5 rounded-xl transition-all cursor-pointer relative group ${
              activeTab === 'copilot' && !sidebarCollapsed
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <div className="absolute left-14 bg-slate-950 px-2 py-1 rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none border border-slate-800">
              AI Co-pilot
            </div>
          </button>

          <button
            onClick={() => {
              if (activeTab === 'run') setSidebarCollapsed(!sidebarCollapsed);
              else { setActiveTab('run'); setSidebarCollapsed(false); }
            }}
            title="Run and Debug Console"
            className={`p-2.5 rounded-xl transition-all cursor-pointer relative group ${
              activeTab === 'run' && !sidebarCollapsed
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <Play className="w-4 h-4 text-emerald-400" />
            <div className="absolute left-14 bg-slate-950 px-2 py-1 rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none border border-slate-800">
              Compiler Config
            </div>
          </button>

          <button
            onClick={() => {
              if (activeTab === 'info') setSidebarCollapsed(!sidebarCollapsed);
              else { setActiveTab('info'); setSidebarCollapsed(false); }
            }}
            title="Workspace Info"
            className={`p-2.5 rounded-xl transition-all cursor-pointer relative group ${
              activeTab === 'info' && !sidebarCollapsed
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <Info className="w-4 h-4 text-amber-400" />
            <div className="absolute left-14 bg-slate-950 px-2 py-1 rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none border border-slate-800">
              IDE Info
            </div>
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          {/* Unsaved indicator badge */}
          {Object.keys(dirtyFiles).length > 0 && (
            <div className="w-2.5 h-2.5 bg-sky-500 rounded-full animate-ping" title="Unsaved changes pending..." />
          )}

          {/* User Tier Shield */}
          <div className="p-1 rounded-full border border-slate-800 text-slate-500">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* 2. COLLAPSIBLE SIDEBAR PANEL */}
      <AnimatePresence initial={false}>
        {!sidebarCollapsed && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full bg-[#0f111a] border-r border-slate-900/60 flex flex-col shrink-0 overflow-hidden"
          >
            {/* Sidebar Explorer Panel */}
            {activeTab === 'explorer' && (
              <div className="flex flex-col h-full">
                {/* Title and control */}
                <div className="px-4 py-3 border-b border-slate-900/80 flex items-center justify-between">
                  <span className="font-semibold text-slate-200 tracking-wider uppercase text-[10px]">Explorer</span>
                  <div className="flex gap-1">
                    <button
                      onClick={handleAddNewVirtualFile}
                      title="New Virtual File"
                      className="p-1 rounded text-slate-400 hover:bg-white/5 hover:text-slate-200 cursor-pointer"
                    >
                      <FilePlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleCreateProject(language)}
                      title="New Project Snippet"
                      className="p-1 rounded text-slate-400 hover:bg-white/5 hover:text-slate-200 cursor-pointer"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Projects Workspace Picker */}
                <div className="p-3 border-b border-slate-900/60 bg-slate-950/20">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase mb-1.5">Aether Workspaces</span>
                  <div className="relative">
                    <select
                      value={selectedProjectId || ''}
                      onChange={(e) => {
                        const proj = projects.find(p => p.id === e.target.value);
                        if (proj) selectProject(proj);
                      }}
                      className="w-full bg-[#161a24] border border-slate-800 text-slate-200 py-1.5 px-2.5 rounded-lg outline-none cursor-pointer focus:border-indigo-500 text-[11px]"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Project metadata */}
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Engine: {language}</span>
                    <button
                      onClick={(e) => selectedProjectId && handleDeleteProject(selectedProjectId, e)}
                      className="text-[10px] text-rose-500 hover:text-rose-400 cursor-pointer flex items-center gap-1 hover:underline"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* Virtual Files list */}
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-[9px] mb-2 tracking-wider">
                    <Folder className="w-3 h-3 text-indigo-400" />
                    <span>Workspace Directory</span>
                  </div>

                  <div className="space-y-0.5">
                    {Object.keys(files).map((fName) => {
                      const isFileActive = activeFile === fName;
                      const isHtml = fName.endsWith('.html');
                      const isCss = fName.endsWith('.css');
                      const isJs = fName.endsWith('.js');
                      const isPy = fName.endsWith('.py');

                      return (
                        <div
                          key={fName}
                          onClick={() => openFileInTab(fName)}
                          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-all ${
                            isFileActive
                              ? 'bg-indigo-500/10 text-indigo-300 font-medium'
                              : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            {isHtml ? (
                              <FileCode className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                            ) : isCss ? (
                              <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            ) : isJs ? (
                              <Code className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            ) : isPy ? (
                              <Cpu className="w-3.5 h-3.5 text-green-400 shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            )}
                            <span className="truncate text-xs">{fName}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {dirtyFiles[fName] && (
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            )}
                            <button
                              onClick={(e) => handleDeleteVirtualFile(fName, e)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 shrink-0 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Templates Selector Footer */}
                <div className="p-3 bg-slate-950/35 border-t border-slate-900/80">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase mb-2">Workspace Presets</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => handleCreateProject('html', 'Interactive Web Portal')}
                      className="py-1 px-1.5 rounded bg-[#161a24] text-center hover:bg-indigo-500/20 hover:text-indigo-300 border border-slate-800 text-[10px] transition-all cursor-pointer font-medium"
                    >
                      Web Canvas
                    </button>
                    <button
                      onClick={() => handleCreateProject('javascript', 'JS Scratchpad')}
                      className="py-1 px-1.5 rounded bg-[#161a24] text-center hover:bg-indigo-500/20 hover:text-indigo-300 border border-slate-800 text-[10px] transition-all cursor-pointer font-medium"
                    >
                      Pure JS
                    </button>
                    <button
                      onClick={() => handleCreateProject('python', 'Python Script')}
                      className="py-1 px-1.5 rounded bg-[#161a24] text-center hover:bg-indigo-500/20 hover:text-indigo-300 border border-slate-800 text-[10px] transition-all cursor-pointer font-medium"
                    >
                      Python
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sidebar Search Panel */}
            {activeTab === 'search' && (
              <div className="flex flex-col h-full p-4">
                <span className="font-semibold text-slate-200 tracking-wider uppercase text-[10px] mb-3 block">Search & Replace</span>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Search For</label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Query string..."
                      className="w-full bg-[#161a24] border border-slate-800 rounded-lg py-1.5 px-2.5 text-slate-200 outline-none focus:border-indigo-500 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Replace With</label>
                    <input
                      type="text"
                      value={replaceQuery}
                      onChange={(e) => setReplaceQuery(e.target.value)}
                      placeholder="Replacement text..."
                      className="w-full bg-[#161a24] border border-slate-800 rounded-lg py-1.5 px-2.5 text-slate-200 outline-none focus:border-indigo-500 text-xs font-mono"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSearch}
                      className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-all cursor-pointer text-center"
                    >
                      Find
                    </button>
                    <button
                      onClick={handleReplaceAll}
                      disabled={!searchQuery}
                      className="flex-1 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 border border-indigo-500/25 text-indigo-300 text-[11px] font-semibold transition-all cursor-pointer text-center disabled:opacity-40"
                    >
                      Replace All
                    </button>
                  </div>

                  {searchQuery && (
                    <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-900 text-[10px] text-slate-400">
                      Matches: <strong className="text-indigo-400">{searchMatches}</strong> found in {activeFile}.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sidebar AI Assistant Panel */}
            {activeTab === 'copilot' && (
              <div className="flex flex-col h-full p-4">
                <span className="font-semibold text-slate-200 tracking-wider uppercase text-[10px] mb-3 block">AI Copilot</span>
                
                <div className="space-y-3 flex-1 flex flex-col min-h-0">
                  <div className="bg-purple-500/5 border border-purple-500/10 p-2 rounded-lg text-[10px] text-purple-200/80 leading-relaxed">
                    🌟 <strong>Active:</strong> {preferences.aiProvider?.toUpperCase() || 'GEMINI'} ({preferences.aiModel || 'Auto'})
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Copilot Prompt</label>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g. Generate a beautiful animated login form, solve Fibonacci sequence..."
                      rows={4}
                      className="w-full bg-[#161a24] border border-slate-800 rounded-lg py-1.5 px-2.5 text-slate-200 outline-none focus:border-indigo-500 text-xs resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Quick Actions</span>
                    <button
                      onClick={() => handleAiCall('explain')}
                      disabled={aiLoading}
                      className="w-full text-left px-2.5 py-1.5 rounded bg-slate-800/55 hover:bg-slate-800 border border-slate-900 text-[10px] text-slate-300 cursor-pointer flex items-center justify-between"
                    >
                      <span>Explain Active File</span>
                      <ChevronRight className="w-3 h-3 text-slate-500" />
                    </button>
                    <button
                      onClick={() => handleAiCall('fix')}
                      disabled={aiLoading}
                      className="w-full text-left px-2.5 py-1.5 rounded bg-slate-800/55 hover:bg-slate-800 border border-slate-900 text-[10px] text-slate-300 cursor-pointer flex items-center justify-between"
                    >
                      <span>Scan & Fix Bugs</span>
                      <ChevronRight className="w-3 h-3 text-slate-500" />
                    </button>
                    <button
                      onClick={() => handleAiCall('optimize')}
                      disabled={aiLoading}
                      className="w-full text-left px-2.5 py-1.5 rounded bg-slate-800/55 hover:bg-slate-800 border border-slate-900 text-[10px] text-slate-300 cursor-pointer flex items-center justify-between"
                    >
                      <span>Optimize Code Efficiency</span>
                      <ChevronRight className="w-3 h-3 text-slate-500" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleAiCall('generate')}
                    disabled={aiLoading || !aiPrompt.trim()}
                    className="w-full py-2 rounded-lg bg-purple-600/30 border border-purple-500/40 hover:bg-purple-600/45 text-purple-200 text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>Generate Code Feature</span>
                  </button>
                </div>
              </div>
            )}

            {/* Sidebar Run & Sandbox Config Panel */}
            {activeTab === 'run' && (
              <div className="flex flex-col h-full p-4">
                <span className="font-semibold text-slate-200 tracking-wider uppercase text-[10px] mb-3 block">Compiler Settings</span>
                
                <div className="space-y-3.5">
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-emerald-300/90 leading-relaxed text-[10px]">
                    🏁 Run web pages with a real-time console logger and secure execution thread inside standard HTML canvases.
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Active File Scope</label>
                    <div className="p-2 rounded bg-slate-950/40 border border-slate-900 font-mono text-xs text-indigo-300">
                      {activeFile}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Compilation Settings</label>
                    <div className="space-y-2 font-sans text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Strict Sandboxing</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold">ON</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Intercept ConsoleLogs</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold">ON</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleRunCode}
                    disabled={isRunning}
                    className="w-full py-2 rounded-lg bg-emerald-600/30 border border-emerald-500/40 hover:bg-emerald-600/45 text-emerald-200 text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Compile & Launch App</span>
                  </button>
                </div>
              </div>
            )}

            {/* Sidebar Info/Documentation Panel */}
            {activeTab === 'info' && (
              <div className="flex flex-col h-full p-4">
                <span className="font-semibold text-slate-200 tracking-wider uppercase text-[10px] mb-3 block">Aether Code IDE</span>
                
                <div className="space-y-3.5 text-slate-400 text-[11px] leading-relaxed overflow-y-auto pr-1">
                  <p>
                    Aether Code Workspace is a responsive, light-speed developer sandbox designed and fully bundled to render inside Aether OS.
                  </p>

                  <div className="border-t border-slate-900/80 pt-3">
                    <span className="block font-semibold text-slate-300 mb-1">Supported Languages</span>
                    <ul className="list-disc list-inside space-y-1 pl-1">
                      <li>HTML Canvas (Multi-file)</li>
                      <li>Javascript ES6 Scripting</li>
                      <li>Python virtual compilation</li>
                    </ul>
                  </div>

                  <div className="border-t border-slate-900/80 pt-3">
                    <span className="block font-semibold text-slate-300 mb-1">Exporting & Downloading</span>
                    <p className="text-[10px] text-slate-500">
                      Download full multi-file workspaces as modular `.zip` bundles using the export controls in the Preview Header.
                    </p>
                  </div>

                  <div className="border-t border-slate-900/80 pt-3">
                    <span className="block font-semibold text-slate-300 mb-1">Quick Shortcuts</span>
                    <div className="space-y-1.5 text-[10px] font-mono">
                      <div className="flex justify-between"><span className="text-slate-500">Add File:</span><span>New File...</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Auto-Save:</span><span>Ctrl+S / Save</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Indent:</span><span>Tab (2 Spaces)</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. CORE INTEGRATED WORKSPACE (EDITOR + PREVIEW SPLIT SCREEN) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Workspace Top Toolbar */}
        <div className="h-11 border-b border-slate-900/80 bg-[#0e1017] px-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* Collapse sidebar button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <Terminal className="w-4 h-4" />
            </button>

            {/* Editable Project Title */}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-transparent border-b border-transparent hover:border-slate-800 focus:border-indigo-500 text-xs font-semibold text-slate-200 outline-none px-1 py-0.5 transition-colors font-sans w-24 sm:w-40 truncate"
              placeholder="Unnamed Project"
            />

            {/* Language Preset Tag */}
            <select
              value={language}
              onChange={(e) => {
                const newLang = e.target.value;
                setLanguage(newLang);
                if (confirm(`Convert workspace layout to ${newLang.toUpperCase()}? This resets virtual workspace files.`)) {
                  handleCreateProject(newLang, name);
                }
              }}
              className="bg-[#151922] border border-slate-800 text-indigo-300 text-[10px] font-semibold py-0.5 px-2 rounded-md outline-none cursor-pointer"
            >
              <option value="html">HTML Canvas</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python 3</option>
            </select>
          </div>

          {/* Quick status & Save/Run buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {saving ? (
              <span className="text-[9px] text-slate-500 animate-pulse hidden sm:inline">Syncing...</span>
            ) : saveSuccess ? (
              <span className="text-[9px] text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span className="hidden sm:inline">{userId === 'guest' ? 'Locally Synced' : 'Cloud Saved'}</span>
              </span>
            ) : null}

            {/* Save Button */}
            <button
              onClick={handleSaveProject}
              title="Save Workspace"
              className="py-1.5 px-2.5 rounded-lg bg-slate-800/50 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer font-medium flex items-center gap-1 text-[11px]"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save</span>
            </button>

            {/* Run Button */}
            <button
              onClick={handleRunCode}
              title="Run Code"
              className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-indigo-100 font-semibold transition-all cursor-pointer flex items-center gap-1 text-[11px] shadow-lg shadow-indigo-600/10"
            >
              <Play className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Run</span>
            </button>
          </div>
        </div>

        {/* Mobile View Switcher segmented control */}
        {isMobile && (
          <div className="h-9 border-b border-slate-900 bg-[#0e1017] flex items-center shrink-0 z-10 text-[11px] font-semibold text-slate-400 select-none">
            <button
              onClick={() => setMobileWorkspaceView('editor')}
              className={`flex-1 h-full text-center hover:text-white transition-all flex items-center justify-center gap-1.5 ${
                mobileWorkspaceView === 'editor' ? 'text-indigo-400 border-b-2 border-indigo-500 font-bold bg-[#141822]' : ''
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Editor</span>
            </button>
            <button
              onClick={() => setMobileWorkspaceView('preview')}
              className={`flex-1 h-full text-center hover:text-white transition-all flex items-center justify-center gap-1.5 ${
                mobileWorkspaceView === 'preview' ? 'text-indigo-400 border-b-2 border-indigo-500 font-bold bg-[#141822]' : ''
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
            <button
              onClick={() => setMobileWorkspaceView('terminal')}
              className={`flex-1 h-full text-center hover:text-white transition-all flex items-center justify-center gap-1.5 ${
                mobileWorkspaceView === 'terminal' ? 'text-indigo-400 border-b-2 border-indigo-500 font-bold bg-[#141822]' : ''
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Terminal</span>
            </button>
          </div>
        )}

        {/* Core Layout Split */}
        <div className={`flex-1 flex min-h-0 ${isMobile ? 'flex-col' : splitLayout === 'horizontal' ? 'flex-col' : 'flex-row'}`}>
          {/* Left/Top Component: SOURCE EDITOR */}
          {(!isMobile || mobileWorkspaceView === 'editor') && (
            <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0e1017]">
              {/* Editor Open Tabs List */}
              <div className="h-9 border-b border-slate-900/60 bg-[#0a0c12] flex items-center justify-between shrink-0 overflow-x-auto select-none">
                <div className="flex items-center h-full">
                  {openTabs.map((tab) => {
                    const isTabActive = activeFile === tab;
                    const isDirty = dirtyFiles[tab];

                    return (
                      <div
                        key={tab}
                        onClick={() => setActiveFile(tab)}
                        className={`h-full px-3.5 flex items-center gap-2 border-r border-slate-900/80 cursor-pointer text-xs transition-colors relative ${
                          isTabActive
                            ? 'bg-[#0e1017] text-slate-200 border-t-2 border-indigo-500 font-semibold'
                            : 'text-slate-500 hover:bg-[#12151f]/40 hover:text-slate-300'
                        }`}
                      >
                        <span className="truncate max-w-[120px]">{tab}</span>
                        {isDirty && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                        )}
                        <button
                          onClick={(e) => closeTab(tab, e)}
                          className="p-0.5 rounded text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Open file tab placeholder */}
                  {openTabs.length === 0 && (
                    <div className="px-4 text-slate-500 italic text-[10px]">No active buffers open</div>
                  )}
                </div>

                {/* Editor Font scaling triggers */}
                <div className="flex items-center gap-2 px-3.5 text-slate-500">
                  <button
                    onClick={() => setEditorFontSize(prev => Math.max(10, prev - 1))}
                    className="p-1 hover:bg-white/5 rounded hover:text-slate-300"
                    title="Zoom Out"
                  >
                    A-
                  </button>
                  <span className="font-mono text-[10px] text-slate-600 select-none">{editorFontSize}px</span>
                  <button
                    onClick={() => setEditorFontSize(prev => Math.min(20, prev + 1))}
                    className="p-1 hover:bg-white/5 rounded hover:text-slate-300"
                    title="Zoom In"
                  >
                    A+
                  </button>
                </div>
              </div>

              {/* Core Code Area */}
              <div className="flex-1 flex overflow-hidden font-mono text-xs leading-relaxed select-text p-2 bg-[#0e1017]">
                {/* Line Numbers Bar */}
                <div className="text-slate-700 text-right pr-3 pl-2 select-none border-r border-slate-900 font-mono font-medium">
                  {Array.from({ length: currentLineCount }).map((_, i) => (
                    <div key={i} className="leading-6 h-6">{i + 1}</div>
                  ))}
                </div>

                {/* Text Input area */}
                <textarea
                  value={files[activeFile] || ''}
                  onChange={(e) => handleCodeEdit(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="// Write code here..."
                  style={{ fontSize: `${editorFontSize}px` }}
                  className="flex-1 bg-transparent border-none outline-none resize-none text-slate-200 font-mono leading-6 pl-4 overflow-auto w-full h-full whitespace-pre"
                />
              </div>

              {/* Editor Bottom Info bar */}
              <div className="h-6 bg-[#08090d] border-t border-slate-900 flex items-center justify-between px-3.5 text-slate-500 text-[10px] shrink-0 font-medium select-none">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Command className="w-3 h-3 text-indigo-400" />
                    <span>Buffer: {activeFile || 'null'}</span>
                  </span>
                  <span>•</span>
                  <span>UTF-8</span>
                </div>
                <div className="flex items-center gap-3.5 font-mono">
                  <span>Tab Size: 2 spaces</span>
                  <span>Lines: {currentLineCount}</span>
                  <span>Chars: {(files[activeFile] || '').length}</span>
                </div>
              </div>
            </div>
          )}

          {/* Right/Bottom Component: LIVE CANVAS PREVIEW & AI PANEL */}
          {(!isMobile || mobileWorkspaceView === 'preview' || mobileWorkspaceView === 'terminal') && (
            <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0f111a] border-l border-slate-900">
              {/* Viewport/AI Panel Options Header */}
              <div className="h-9 border-b border-slate-900 bg-[#0a0c12] px-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[10px] uppercase text-slate-400 mr-2">Sandbox Output</span>
                  
                  {/* Download / Export Dropdown */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleDownloadStandaloneHtml}
                      title="Download current file"
                      className="py-1 px-2.5 rounded-md bg-[#161a24] hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-3 h-3" />
                      <span className="hidden xs:inline">Single File</span>
                    </button>
                    <button
                      onClick={handleDownloadZip}
                      title="Export whole project workspace as ZIP"
                      className="py-1 px-2.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-[10px] text-indigo-300 hover:text-indigo-200 transition-colors cursor-pointer flex items-center gap-1.5 font-semibold"
                    >
                      <Download className="w-3 h-3 text-indigo-400" />
                      <span className="hidden xs:inline">Workspace Zip</span>
                    </button>
                  </div>
                </div>

                {/* Split layout toggles - Hide on mobile */}
                {!isMobile && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSplitLayout(splitLayout === 'vertical' ? 'horizontal' : 'vertical')}
                      title="Toggle Split Layout Orientation"
                      className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {splitLayout === 'vertical' ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => setShowConsole(!showConsole)}
                      title="Toggle Terminal Drawer"
                      className={`p-1 rounded cursor-pointer ${showConsole ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <TerminalSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Preview sandbox execution / AI results split panel */}
              <div className="flex-1 flex flex-col min-h-0 relative">
                {/* Conditional viewport displays */}
                {activeTab === 'copilot' && aiResponse && (!isMobile || mobileWorkspaceView === 'preview') ? (
                  // AI Result Display Panel overlay
                  <div className="absolute inset-0 bg-[#0b0c11] flex flex-col z-20">
                    <div className="h-8 bg-[#0e1017] border-b border-slate-900 px-3 flex items-center justify-between text-slate-400">
                      <span className="font-semibold text-[10px] uppercase flex items-center gap-1.5 text-purple-300">
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        Copilot Generation Output
                      </span>
                      <button
                        onClick={() => setAiResponse('')}
                        className="p-1 hover:bg-white/5 rounded text-slate-500 hover:text-slate-200 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto select-text font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-[#0b0c11]">
                      {aiResponse}
                    </div>
                    <div className="p-2.5 bg-slate-950 border-t border-slate-900 flex justify-end gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(aiResponse);
                          alert('AI Generation copied to clipboard!');
                        }}
                        className="py-1 px-3 rounded bg-slate-800 hover:bg-slate-700 text-xs cursor-pointer flex items-center gap-1 text-slate-300"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy Result</span>
                      </button>
                      <button
                        onClick={() => {
                          // Extract code block from markdown if present
                          let extractedCode = aiResponse;
                          const codeBlockRegex = /```[\s\S]*?\n([\s\S]*?)```/g;
                          const matches = [...aiResponse.matchAll(codeBlockRegex)];
                          if (matches && matches[0] && matches[0][1]) {
                            extractedCode = matches[0][1];
                          }
                          handleCodeEdit(extractedCode);
                          setAiResponse('');
                          alert(`Injected code directly into active file tab: "${activeFile}"!`);
                        }}
                        className="py-1 px-3 rounded bg-purple-600 hover:bg-purple-500 text-xs text-white font-semibold cursor-pointer"
                      >
                        Apply Code to Current File
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Main Interactive Sandboxed Window */}
                {(!isMobile || mobileWorkspaceView === 'preview') && (
                  <div className="flex-1 min-h-0 relative flex flex-col bg-slate-900/30">
                    {language === 'html' ? (
                      <div className="flex-1 bg-white relative rounded-sm overflow-hidden flex flex-col">
                        {/* Sandboxed Interactive Frame */}
                        <iframe
                          ref={iframeRef}
                          title="Sandboxed Execution Canvas"
                          sandbox="allow-scripts allow-modals"
                          className="w-full h-full border-none bg-[#0a0c10]"
                        />
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-600 select-none">
                        <Terminal className="w-12 h-12 mb-2 text-slate-800 animate-pulse" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Output Playground</p>
                        <p className="text-[11px] text-slate-600 max-w-[280px] mt-1.5 leading-relaxed">
                          Output for {language.toUpperCase()} will print instantly into the Terminal Drawer below. Click "Run Code" to execute.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Developer Console Logs drawer */}
                {(showConsole || (isMobile && mobileWorkspaceView === 'terminal')) && (
                  <div className={`${isMobile && mobileWorkspaceView === 'terminal' ? 'flex-1 border-none' : 'h-44 border-t border-slate-900/80'} bg-[#08090d] flex flex-col shrink-0`}>
                    <div className="h-8 border-b border-slate-900/80 px-4 bg-slate-950 flex items-center justify-between select-none">
                      <span className="font-mono text-[9px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Workspace Debug Terminal Drawer</span>
                      </span>
                      <button
                        onClick={() => setConsoleLogs([])}
                        className="text-[9px] text-slate-500 hover:text-slate-300 hover:underline bg-transparent cursor-pointer font-medium"
                      >
                        Clear Logs
                      </button>
                    </div>

                    {/* Terminal stdout display */}
                    <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1.5 bg-[#050608] select-text">
                      {consoleLogs.length === 0 ? (
                        <div className="text-slate-600 italic text-[10px] pl-1 py-1">Terminal is silent. Click "Run Code" to compile project.</div>
                      ) : (
                        consoleLogs.map((log, index) => {
                          let colorClass = 'text-sky-300';
                          let prefix = 'info';
                          if (log.type === 'warn') {
                            colorClass = 'text-amber-300 bg-amber-500/5';
                            prefix = 'warn';
                          } else if (log.type === 'error') {
                            colorClass = 'text-rose-400 bg-rose-500/5';
                            prefix = 'error';
                          } else if (log.type === 'system') {
                            colorClass = 'text-indigo-300 font-bold';
                            prefix = 'system';
                          }

                          return (
                            <div key={index} className={`py-1 px-1.5 rounded flex gap-2 leading-relaxed break-all font-mono border-l-2 ${
                              log.type === 'error' ? 'border-rose-500' :
                              log.type === 'warn' ? 'border-amber-500' :
                              log.type === 'system' ? 'border-indigo-500' : 'border-sky-500'
                            } ${colorClass}`}>
                              <span className="text-slate-600 shrink-0 select-none text-[9px]">{log.time}</span>
                              <span className="font-bold uppercase text-[9px] shrink-0 select-none bg-black/30 px-1 rounded">{prefix}</span>
                              <div className="flex-1 whitespace-pre-wrap">{log.text}</div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

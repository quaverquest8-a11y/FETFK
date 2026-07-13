/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppID = 'notepad' | 'coding' | 'ai' | 'files' | 'settings' | 'browser' | 'games';

export interface AppWindow {
  id: string;
  title: string;
  appType: AppID;
  isMinimized: boolean;
  isMaximized: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex: number;
}

export interface UserPreferences {
  userName: string;
  desktopWallpaper: string;
  glassBlur: number; // 0 to 100
  customApiKey: string;
  isAdmin?: boolean;
  avatarUrl?: string;
  aiEnabled?: boolean;
  aiProvider?: 'gemini' | 'openai' | 'claude' | 'openrouter';
  aiModel?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  claudeApiKey?: string;
  openrouterApiKey?: string;
  lastAccessed?: number;
  createdAt?: number;
}

export interface NotepadDoc {
  id: string;
  title: string;
  content: string;
  lastModified: number;
  ownerId: string;
}

export interface CodeProject {
  id: string;
  name: string;
  code: string;
  language: string;
  lastModified: number;
  ownerId: string;
}

export interface FileDoc {
  id: string;
  name: string;
  type: 'file' | 'folder';
  fileType: 'text' | 'image' | 'code' | 'pdf' | 'other';
  content: string; // Base64 or plain text
  parentId: string; // 'root' or folder ID
  ownerId: string;
  createdAt: number;
  size: number; // in bytes
  originalSize?: number;
  isCompressed?: boolean;
}

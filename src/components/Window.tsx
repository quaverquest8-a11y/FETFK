/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { AppWindow } from '../types';

interface WindowProps {
  key?: React.Key;
  window: AppWindow;
  isActive: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  children: React.ReactNode;
}

export default function Window({
  window,
  isActive,
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  onMove,
  onResize,
  children
}: WindowProps) {
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, winX: 0, winY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, winW: 0, winH: 0 });

  // Handle Mobile Detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(globalThis.window.innerWidth < 768);
    };
    checkMobile();
    globalThis.window.addEventListener('resize', checkMobile);
    return () => globalThis.window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle Dragging
  const handleDragStart = (e: React.MouseEvent) => {
    if (window.isMaximized || isMobile) return;
    onFocus();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      winX: window.x,
      winY: window.y
    };
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.isMaximized || isMobile) return;
    onFocus();
    setIsDragging(true);
    const touch = e.touches[0];
    dragStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      winX: window.x,
      winY: window.y
    };
  };

  // Handle Resizing
  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    if (window.isMaximized || isMobile) return;
    onFocus();
    setIsResizing(direction);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      winW: window.w,
      winH: window.h
    };
    e.stopPropagation();
    e.preventDefault();
  };

  const handleTouchResizeStart = (e: React.TouchEvent, direction: string) => {
    if (window.isMaximized || isMobile) return;
    onFocus();
    setIsResizing(direction);
    const touch = e.touches[0];
    resizeStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      winW: window.w,
      winH: window.h
    };
    e.stopPropagation();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        const newX = Math.max(0, dragStart.current.winX + dx);
        const minTop = isMobile ? 64 : 100;
        const newY = Math.max(minTop, dragStart.current.winY + dy);
        onMove(newX, newY);
      } else if (isResizing) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        
        let newW = resizeStart.current.winW;
        let newH = resizeStart.current.winH;

        if (isResizing.includes('e')) {
          newW = Math.max(350, resizeStart.current.winW + dx);
        }
        if (isResizing.includes('s')) {
          newH = Math.max(250, resizeStart.current.winH + dy);
        }

        onResize(newW, newH);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        const touch = e.touches[0];
        const dx = touch.clientX - dragStart.current.x;
        const dy = touch.clientY - dragStart.current.y;
        const newX = Math.max(0, dragStart.current.winX + dx);
        const minTop = isMobile ? 64 : 100;
        const newY = Math.max(minTop, dragStart.current.winY + dy);
        onMove(newX, newY);
      } else if (isResizing) {
        const touch = e.touches[0];
        const dx = touch.clientX - resizeStart.current.x;
        const dy = touch.clientY - resizeStart.current.y;
        
        let newW = resizeStart.current.winW;
        let newH = resizeStart.current.winH;

        if (isResizing.includes('e')) {
          newW = Math.max(350, resizeStart.current.winW + dx);
        }
        if (isResizing.includes('s')) {
          newH = Math.max(250, resizeStart.current.winH + dy);
        }

        onResize(newW, newH);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: true });
      document.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, isResizing, onMove, onResize]);

  if (window.isMinimized) return null;

  const style: React.CSSProperties = (window.isMaximized || isMobile)
    ? {
        position: 'absolute',
        top: isMobile ? '72px' : '112px', // Adjusted down so upper parts fit well below the system top bar
        left: isMobile ? '8px' : '16px',
        right: isMobile ? '8px' : '16px',
        bottom: isMobile ? '76px' : '96px', // Space above bottom mobile-adapted taskbar
        zIndex: window.zIndex,
      }
    : {
        position: 'absolute',
        left: `${window.x}px`,
        top: `${window.y}px`,
        width: `${window.w}px`,
        height: `${window.h}px`,
        zIndex: window.zIndex,
      };

  return (
    <motion.div
      ref={windowRef}
      style={style}
      onClick={onFocus}
      initial={{ opacity: 0, scale: 0.98, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 4 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
      className={`flex flex-col rounded-2xl overflow-hidden shadow-2xl transition-shadow duration-300 select-none ${
        isActive
          ? 'ring-1 ring-white/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)]'
          : 'ring-1 ring-white/10 shadow-[0_15px_40px_-20px_rgba(0,0,0,0.5)]'
      }`}
    >
      {/* Real Glassmorphism backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-3xl -z-10" />
      {/* Glass overlay with glowing shine */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/2 to-white/5 pointer-events-none -z-10" />

      {/* Window Header / Title Bar */}
      <div
        onMouseDown={handleDragStart}
        onTouchStart={handleTouchStart}
        onDoubleClick={onMaximize}
        className={`flex items-center justify-between px-4 py-3 border-b cursor-default ${
          isActive 
            ? 'bg-white/10 border-white/15 text-white' 
            : 'bg-white/5 border-white/5 text-slate-300'
        } transition-colors duration-200`}
      >
        <div className="flex items-center gap-2.5 font-display font-medium text-sm tracking-wide">
          {/* Subtle logo dot */}
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-slate-500'}`} />
          <span className="truncate max-w-[180px] sm:max-w-[300px]">{window.title}</span>
        </div>

        {/* Title bar buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onMinimize(); }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          {!isMobile && (
            <button
              onClick={(e) => { e.stopPropagation(); onMaximize(); }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
            >
              {window.isMaximized ? (
                <Copy className="w-3.5 h-3.5 rotate-180" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Window Content */}
      <div className="flex-1 overflow-auto p-3 sm:p-5 relative select-text text-white">
        {children}
      </div>

      {/* Resize handles */}
      {!window.isMaximized && !isMobile && (
        <>
          <div
            onMouseDown={(e) => handleResizeStart(e, 'e')}
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/5 transition-colors"
          />
          <div
            onMouseDown={(e) => handleResizeStart(e, 's')}
            className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-white/5 transition-colors"
          />
          <div
            onMouseDown={(e) => handleResizeStart(e, 'se')}
            className="absolute right-0 bottom-0 w-4.5 h-4.5 cursor-se-resize hover:bg-white/10 rounded-br-2xl"
          />
        </>
      )}
    </motion.div>
  );
}

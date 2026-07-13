/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Cpu, HardDrive, Sun, Cloud, CloudRain, Snowflake, Wind, Activity } from 'lucide-react';
import { motion } from 'motion/react';

interface WidgetsPanelProps {
  userName: string;
  totalStorageUsed: number;
}

export default function WidgetsPanel({ userName, totalStorageUsed }: WidgetsPanelProps) {
  const [time, setTime] = useState(new Date());
  const [cpuUsage, setCpuUsage] = useState(12);
  const [ramUsage, setRamUsage] = useState(42);

  useEffect(() => {
    const timeTimer = setInterval(() => setTime(new Date()), 1000);
    
    // Simulate natural looking CPU & RAM changes
    const systemTimer = setInterval(() => {
      setCpuUsage(prev => {
        const delta = Math.floor(Math.random() * 9) - 4; // -4 to +4
        return Math.max(5, Math.min(65, prev + delta));
      });
      setRamUsage(prev => {
        const delta = Math.floor(Math.random() * 3) - 1; // -1 to +1
        return Math.max(30, Math.min(55, prev + delta));
      });
    }, 3000);

    return () => {
      clearInterval(timeTimer);
      clearInterval(systemTimer);
    };
  }, []);

  const getGreeting = () => {
    const hour = time.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getGreetingIcon = () => {
    const hour = time.getHours();
    if (hour >= 6 && hour < 18) return <Sun className="w-5 h-5 text-amber-400 animate-spin-slow" />;
    return <Snowflake className="w-5 h-5 text-cyan-300 animate-pulse" />;
  };

  // Static virtual local weather mock (highly aesthetic)
  const weatherMock = {
    temp: '72°F',
    condition: 'Pleasant Breeze',
    icon: <Wind className="w-6 h-6 text-cyan-300 animate-pulse" />
  };

  const formattedDate = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div id="widgets-panel-container" className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl text-white font-sans text-xs">
      
      {/* Greeting card */}
      <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border border-white/10 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 to-purple-500/5 pointer-events-none" />
        <div className="space-y-1">
          <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider flex items-center gap-1">
            {getGreetingIcon()}
            <span>Active Session</span>
          </span>
          <h3 className="text-base font-display font-semibold tracking-wide text-cyan-100">
            {getGreeting()}, <span className="text-cyan-300">{userName || 'Developer'}</span>
          </h3>
          <p className="text-[10px] text-white/50 leading-relaxed">
            Welcome back to Aether workspace.
          </p>
        </div>
      </div>

      {/* Clock & Weather Combo */}
      <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 to-pink-500/5 pointer-events-none" />
        <div className="space-y-1">
          <h2 className="text-xl font-display font-bold text-white tracking-widest">{formattedTime}</h2>
          <p className="text-[10px] text-white/50 flex items-center gap-1 font-mono uppercase">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>{formattedDate}</span>
          </p>
        </div>
        <div className="text-right flex items-center gap-2.5">
          {weatherMock.icon}
          <div>
            <div className="font-semibold text-white/90 text-sm leading-none">{weatherMock.temp}</div>
            <div className="text-[9px] text-white/40 mt-1 leading-none">{weatherMock.condition}</div>
          </div>
        </div>
      </div>

      {/* CPU Simulator Status widget */}
      <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/40 uppercase font-mono flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>CPU Compute Load</span>
          </span>
          <span className="font-mono text-cyan-300 font-semibold">{cpuUsage}%</span>
        </div>
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            style={{ width: `${cpuUsage}%` }}
            className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-1000"
          />
        </div>
        <div className="flex justify-between items-center text-[9px] text-white/35 font-mono">
          <span>Clock: 3.8 GHz</span>
          <span>Cores: 8 Threads: 16</span>
        </div>
      </div>

      {/* Memory Allocation load widget */}
      <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/40 uppercase font-mono flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Active Memory Usage</span>
          </span>
          <span className="font-mono text-cyan-300 font-semibold">{ramUsage}%</span>
        </div>
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            style={{ width: `${ramUsage}%` }}
            className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-1000"
          />
        </div>
        <div className="flex justify-between items-center text-[9px] text-white/35 font-mono">
          <span>Active: {(ramUsage * 0.16).toFixed(1)} GB</span>
          <span>Virtual limit: 16.0 GB</span>
        </div>
      </div>

    </div>
  );
}

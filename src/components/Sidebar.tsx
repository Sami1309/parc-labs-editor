'use client';

import React from 'react';
import { 
  FlaskConical, 
  Clapperboard, 
  Edit3, 
  ChevronLeft, 
  ChevronRight,
  Magnet
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeView: 'hook' | 'research' | 'storyboard' | 'editor';
  onViewChange: (view: 'hook' | 'research' | 'storyboard' | 'editor') => void;
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

export function Sidebar({ activeView, onViewChange, isCollapsed, toggleCollapse }: SidebarProps) {
  const items = [
    { id: 'hook', label: 'Hook', icon: Magnet },
    { id: 'research', label: 'Research', icon: FlaskConical },
    { id: 'storyboard', label: 'Storyboard', icon: Clapperboard },
    { id: 'editor', label: 'Editor', icon: Edit3 },
  ] as const;

  return (
    <div 
      className={cn(
        "h-screen bg-white border-r border-stone-200 transition-all duration-300 flex flex-col z-20 relative",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header / Toggle */}
      <div className="p-4 flex items-center justify-between border-b border-stone-100 h-16">
        {!isCollapsed && <span className="font-bold text-lg text-stone-800">Studio</span>}
        <button 
          onClick={toggleCollapse}
          className="p-1.5 hover:bg-stone-100 rounded-md text-stone-500 transition-colors ml-auto"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-sm font-medium",
                isActive 
                  ? "bg-stone-900 text-white" 
                  : "text-stone-600 hover:bg-stone-100",
                isCollapsed && "justify-center px-2"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon size={20} />
              {!isCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}


'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import ResearchFlow from './ResearchFlow';
import { Storyboard } from './Storyboard';
import { Editor } from './Editor';

export function AppShell() {
  const [activeView, setActiveView] = useState<'research' | 'storyboard' | 'editor'>('research');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-stone-50">
      <Sidebar 
        activeView={activeView} 
        onViewChange={setActiveView} 
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      
      <main className="flex-1 h-full relative overflow-hidden">
        {activeView === 'research' && <ResearchFlow />}
        {activeView === 'storyboard' && <Storyboard />}
        {activeView === 'editor' && <Editor />}
      </main>
    </div>
  );
}


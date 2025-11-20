'use client';

import React, { useState } from 'react';
import { useNodesState, useEdgesState, Node } from '@xyflow/react';
import { Sidebar } from './Sidebar';
import ResearchFlow from './ResearchFlow';
import { Storyboard } from './Storyboard';
import { Editor } from './Editor';
import { HookGenerator } from './HookGenerator';

const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'start',
    position: { x: 0, y: 0 },
    data: { label: 'Start Research', isLoading: false },
  },
];

export function AppShell() {
  const [activeView, setActiveView] = useState<'hook' | 'research' | 'storyboard' | 'editor'>('hook');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Lifted state for ResearchFlow
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [sessionName, setSessionName] = useState<string | null>(null);

  const handleStartResearch = (hookData: { title: string, hook: string, image?: string }) => {
    const newStartNode: Node = {
        id: 'start',
        type: 'start',
        position: { x: 0, y: 0 },
        data: { 
            label: hookData.title, 
            content: hookData.hook,
            imageUrl: hookData.image,
            isLoading: false 
        },
    };
    
    setNodes([newStartNode]);
    setEdges([]); // Reset edges for fresh start
    setSessionName(hookData.title); // Auto-set session name from hook title
    setActiveView('research');
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-stone-50">
      <Sidebar 
        activeView={activeView} 
        onViewChange={setActiveView} 
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      
      <main className="flex-1 h-full relative overflow-hidden">
        {activeView === 'hook' && <HookGenerator onStartResearch={handleStartResearch} />}
        {activeView === 'research' && (
          <ResearchFlow 
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            setNodes={setNodes}
            setEdges={setEdges}
            sessionName={sessionName}
            setSessionName={setSessionName}
          />
        )}
        {activeView === 'storyboard' && <Storyboard researchNodes={nodes} />}
        {activeView === 'editor' && <Editor />}
      </main>
    </div>
  );
}

'use client';

import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import StartNode from './nodes/StartNode';
import ResultNode from './nodes/ResultNode';
import { PromptBar } from './PromptBar';
import { ResearchDialog } from './ResearchDialog';
import { NodeData } from '@/types';

const nodeTypes = {
  start: StartNode,
  result: ResultNode,
};

const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'start',
    position: { x: 0, y: 0 },
    data: { label: 'Start Research' },
  },
];

export default function ResearchFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // UI State
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Dialog State
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    nodeId: string | null;
    nodeTitle: string;
    suggestedQuestion?: string;
    suggestedPaths?: string[];
  }>({
    isOpen: false,
    nodeId: null,
    nodeTitle: '',
  });

  const updateGraph = (newResults: any[], parentId: string) => {
      if (!newResults) return;

      const parentNode = nodes.find((n) => n.id === parentId);
      const parentX = parentNode?.position.x || 0;
      const parentY = parentNode?.position.y || 0;
      
      const resultNodes: Node[] = newResults.map((result, index) => {
        // Layout logic: Fan out below the parent
        const totalWidth = (newResults.length - 1) * 350;
        const startXOffset = -totalWidth / 2;
        const xOffset = startXOffset + (index * 350);
        
        return {
          id: `result-${Date.now()}-${index}`, // Unique ID
          type: 'result',
          position: { 
            x: parentX + xOffset, 
            y: parentY + 450 + (Math.random() * 50) // Slight vertical stagger
          },
          data: { 
            ...result,
            label: result.title, // Fallback
          },
        };
      });

      const resultEdges: Edge[] = resultNodes.map((node) => ({
        id: `e-${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        animated: true,
        style: { stroke: '#9ca3af' },
      }));

      setNodes((nds) => [...nds, ...resultNodes]);
      setEdges((eds) => [...eds, ...resultEdges]);
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type === 'start') {
      setIsPromptOpen(true);
    } else if (node.type === 'result') {
        // Open Deep Dive Dialog
        setDialogState({
            isOpen: true,
            nodeId: node.id,
            nodeTitle: node.data.title as string,
            suggestedQuestion: node.data.suggestedQuestion as string,
            suggestedPaths: node.data.suggestedPaths as string[],
        });
    }
  }, []);

  const handleInitialSearch = async (prompt: string) => {
    setIsPromptOpen(false);
    setIsLoading(true);
    // Set start node loading? Maybe just global loading for initial search
    
    await performResearch(prompt, 'start');
    setIsLoading(false);
  };

  const handleDeepDive = async (prompt: string) => {
      const { nodeId } = dialogState;
      if (!nodeId) return;

      setDialogState(prev => ({ ...prev, isOpen: false }));
      
      // Set specific node to loading
      setNodes(nds => nds.map(n => 
          n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true } } : n
      ));

      await performResearch(prompt, nodeId);

      // Remove loading state
      setNodes(nds => nds.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, isLoading: false } } : n
      ));
  };

  const performResearch = async (prompt: string, parentId: string) => {
    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, parentNodeId: parentId === 'start' ? undefined : parentId }),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      
      const data = await response.json();
      if (data && data.nodes) {
          updateGraph(data.nodes, parentId);
      }

    } catch (error) {
      console.error('Error researching:', error);
    }
  };

  return (
    <div className="w-full h-screen bg-stone-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-stone-50"
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
      </ReactFlow>
      
      <PromptBar 
        isOpen={isPromptOpen} 
        onClose={() => setIsPromptOpen(false)} 
        onSubmit={handleInitialSearch}
        isLoading={isLoading}
      />

      <ResearchDialog 
        isOpen={dialogState.isOpen}
        onClose={() => setDialogState(prev => ({ ...prev, isOpen: false }))}
        onSubmit={handleDeepDive}
        suggestedQuestion={dialogState.suggestedQuestion}
        suggestedPaths={dialogState.suggestedPaths}
        nodeTitle={dialogState.nodeTitle}
      />
    </div>
  );
}

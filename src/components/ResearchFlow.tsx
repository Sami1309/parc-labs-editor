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

import { Plus } from 'lucide-react';

const nodeTypes = {
  start: StartNode,
  result: ResultNode,
};

const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'start',
    position: { x: 0, y: 0 },
    data: { label: 'Start Research', isLoading: false },
  },
];

export default function ResearchFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // UI State
  const [promptState, setPromptState] = useState<{ isOpen: boolean; nodeId: string | null }>({
    isOpen: false,
    nodeId: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  
  // Dialog State
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    nodeId: string | null;
    nodeTitle: string;
    nodeContent?: string;
    suggestedQuestion?: string;
    suggestedPaths?: string[];
    isAssetMode?: boolean;
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
        const spacing = 450; // Increased spacing to prevent overlap
        const totalWidth = (newResults.length - 1) * spacing;
        const startXOffset = -totalWidth / 2;
        const xOffset = startXOffset + (index * spacing);
        
        return {
          id: `result-${Date.now()}-${index}`, // Unique ID
          type: 'result',
          position: { 
            x: parentX + xOffset, 
            y: parentY + 500 + (Math.random() * 50) // Increased vertical spacing and slight stagger
          },
          data: { 
            ...result,
            label: result.title, // Fallback
            isLoading: false,
            onResearch: handleInNodeResearch // Pass handler to node
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
      setPromptState({ isOpen: true, nodeId: node.id });
    } else if (node.type === 'result') {
        // Standard Deep Dive Dialog for non-asset nodes
        if (node.data.type !== 'asset') {
            setDialogState({
                isOpen: true,
                nodeId: node.id,
                nodeTitle: node.data.title as string,
                nodeContent: node.data.content as string,
                suggestedQuestion: node.data.suggestedQuestion as string,
                suggestedPaths: node.data.suggestedPaths as string[],
                isAssetMode: false
            });
        }
    }
  }, []);

  // New handler for in-node research (Asset nodes)
  const handleInNodeResearch = async (nodeId: string, prompt: string) => {
      // Set specific node to loading
      setNodes(nds => nds.map(n => 
          n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true, loadingText: `Researching "${prompt}"...` } } : n
      ));

      await performResearch(prompt, nodeId);

      // Remove loading state
      setNodes(nds => nds.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, isLoading: false } } : n
      ));
  };

  const handleInitialSearch = async (prompt: string) => {
    const nodeId = promptState.nodeId;
    if (!nodeId) return;

    setPromptState(prev => ({ ...prev, isOpen: false }));
    setIsLoading(true);
    
    // Set start node loading
    setNodes(nds => nds.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true, loadingText: `Researching "${prompt}"...` } } : n
    ));
    
    await performResearch(prompt, nodeId);
    
    setIsLoading(false);
    // Remove start node loading
    setNodes(nds => nds.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, isLoading: false } } : n
    ));
  };

  const handleDeepDive = async (prompt: string) => {
      const { nodeId } = dialogState;
      if (!nodeId) return;

      setDialogState(prev => ({ ...prev, isOpen: false }));
      
      // Set specific node to loading
      setNodes(nds => nds.map(n => 
          n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true, loadingText: `Researching "${prompt}"...` } } : n
      ));

      await performResearch(prompt, nodeId);

      // Remove loading state
      setNodes(nds => nds.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, isLoading: false } } : n
      ));
  };

  const performResearch = async (prompt: string, parentId: string) => {
    try {
      // Get parent context
      const parentNode = nodes.find(n => n.id === parentId);
      const parentContext = parentNode ? {
          title: parentNode.data.label || parentNode.data.title,
          content: parentNode.data.content
      } : undefined;

      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            prompt, 
            parentNodeId: parentNode?.type === 'start' ? undefined : parentId,
            parentContext // Send context to API
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      
      const data = await response.json();
      if (data && data.nodes) {
          // Pass the handler to new nodes
          const nodesWithHandler = data.nodes.map((n: any) => ({
              ...n,
              onResearch: handleInNodeResearch
          }));
          updateGraph(nodesWithHandler, parentId);
      }

    } catch (error) {
      console.error('Error researching:', error);
      alert('Failed to fetch research results. Please try again.');
    }
  };

  const handleNewResearch = () => {
    const newStartNode: Node = {
      id: `start-${Date.now()}`,
      type: 'start',
      position: { x: 0, y: 0 }, // You might want to offset this if there are existing nodes
      data: { label: 'Start Research', isLoading: false },
    };
    // Offset the new node if there are existing nodes to avoid direct overlap
    if (nodes.length > 0) {
        newStartNode.position = { x: nodes.length * 50, y: nodes.length * 50 };
    }
    setNodes((nds) => [...nds, newStartNode]);
  };

  return (
    <div className="w-full h-screen bg-stone-50 relative">
      <div className="absolute top-4 left-4 z-10">
        <button
            onClick={handleNewResearch}
            className="bg-white p-2 rounded-lg shadow-md border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors flex items-center gap-2"
        >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">New Research</span>
        </button>
      </div>
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
        isOpen={promptState.isOpen} 
        onClose={() => setPromptState(prev => ({ ...prev, isOpen: false }))} 
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
        nodeContent={dialogState.nodeContent}
        isAssetMode={dialogState.isAssetMode}
      />
    </div>
  );
}

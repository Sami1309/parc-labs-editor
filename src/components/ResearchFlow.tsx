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
import { SearchResult } from '@/types';

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
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type === 'start') {
      setIsPromptOpen(true);
    }
  }, []);

  const handleSearch = async (prompt: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch research');
      }

      const data = await response.json();
      const results: SearchResult[] = data.results;

      // Calculate positions for new nodes
      // Simple layout: arrange in a semi-circle or grid below the start node
      const startNode = nodes.find((n) => n.id === 'start');
      const startX = startNode?.position.x || 0;
      const startY = startNode?.position.y || 0;
      
      const newNodes: Node[] = results.map((result, index) => {
        const angle = (index / (results.length - 1 || 1)) * Math.PI - Math.PI; // Semi-circle
        const radius = 400;
        // Distribute horizontally below
        const xOffset = (index - (results.length - 1) / 2) * 300;
        
        return {
          id: `result-${Date.now()}-${index}`,
          type: 'result',
          position: { 
            x: startX + xOffset, 
            y: startY + 400 + (Math.abs(index - (results.length - 1) / 2) * 50) // Slight arch
          },
          data: { 
            label: result.title,
            content: result.content,
            url: result.url,
            source: result.url
          },
        };
      });

      const newEdges: Edge[] = newNodes.map((node) => ({
        id: `e-start-${node.id}`,
        source: 'start',
        target: node.id,
        animated: true,
        style: { stroke: '#9ca3af' },
      }));

      setNodes((nds) => [...nds, ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);
      setIsPromptOpen(false);
    } catch (error) {
      console.error('Error researching:', error);
      // Ideally show a toast notification here
    } finally {
      setIsLoading(false);
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
        onSubmit={handleSearch}
        isLoading={isLoading}
      />
    </div>
  );
}


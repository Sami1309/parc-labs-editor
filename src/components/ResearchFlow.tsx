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

  const updateGraph = (newResults: any[]) => {
      if (!newResults) return;

      const startNode = nodes.find((n) => n.id === 'start');
      const startX = startNode?.position.x || 0;
      const startY = startNode?.position.y || 0;
      
      const resultNodes: Node[] = newResults.map((result, index) => {
        // Layout logic
        const angle = (index / (newResults.length - 1 || 1)) * Math.PI - Math.PI;
        const xOffset = (index - (newResults.length - 1) / 2) * 350; // Wider spacing for cards
        
        return {
          id: `result-${index}`, // Stable ID based on index for streaming updates
          type: 'result',
          position: { 
            x: startX + xOffset, 
            y: startY + 400 + (Math.abs(index - (newResults.length - 1) / 2) * 50) 
          },
          data: { 
            label: result.title,
            content: result.content,
            url: result.url,
            source: result.url,
            imageUrl: result.imageUrl
          },
        };
      });

      const resultEdges: Edge[] = resultNodes.map((node) => ({
        id: `e-start-${node.id}`,
        source: 'start',
        target: node.id,
        animated: true,
        style: { stroke: '#9ca3af' },
      }));

      // Merge with initial start node
      setNodes((nds) => {
          const start = nds.find(n => n.id === 'start');
          return start ? [start, ...resultNodes] : [...resultNodes];
      });
      setEdges((eds) => resultEdges);
  };

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
    setIsPromptOpen(false);
    setIsLoading(true);

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedNodes: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // The stream from streamObject returns chunks of the final JSON object.
        // However, parsing partial JSON is tricky. 
        // Since we are using streamObject on the server, it returns a text stream that accumulates the JSON.
        // A simpler approach without useObject is to wait for the full response or use a different streaming strategy.
        // BUT, to keep the "streaming" feel without the library, we can try to parse the buffer if it's valid JSON,
        // or just wait for the final result if we can't easily parse partials.
        
        // Actually, streamObject returns a stream of text parts.
        // Let's try to parse the buffer as it grows.
        // If the server is sending a standard text stream of the JSON object, we might need to be careful.
        
        // ALTERNATIVE: Let's just parse the final result for now to ensure stability without the library,
        // OR try to parse the "nodes" array if possible.
        
        // For a robust manual implementation without ai/react, we'll just read the whole stream and update at the end,
        // OR we can try to parse the accumulating JSON string.
        
        try {
            // Attempt to parse the current buffer as JSON
            // This will likely fail until the very end unless the server sends line-delimited JSON.
            // streamObject sends an accumulating JSON string.
            const parsed = JSON.parse(buffer);
            if (parsed && parsed.nodes) {
                accumulatedNodes = parsed.nodes;
                updateGraph(accumulatedNodes);
            }
        } catch (e) {
            // Expected error while JSON is incomplete
        }
      }
      
      // Final parse to ensure we got everything
      try {
          const parsed = JSON.parse(buffer);
          if (parsed && parsed.nodes) {
              updateGraph(parsed.nodes);
          }
      } catch (e) {
          console.error("Final parse failed", e);
      }

    } catch (error) {
      console.error('Error researching:', error);
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

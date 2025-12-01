'use client';

import React, { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  OnNodesChange,
  OnEdgesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import StartNode from './nodes/StartNode';
import ResultNode from './nodes/ResultNode';
import { PromptBar } from './PromptBar';
import { ResearchDialog } from './ResearchDialog';
import { TutorialOverlay } from './TutorialOverlay';

import { Plus, Save, FolderOpen, ChevronDown, Trash2, RotateCcw } from 'lucide-react';

const nodeTypes = {
  start: StartNode,
  result: ResultNode,
};

interface SavedSession {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  timestamp: number;
}

interface ResearchFlowProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  sessionName: string | null;
  setSessionName: (name: string | null) => void;
  showTutorial?: boolean;
  onNextTutorial?: () => void;
  onCloseTutorial?: () => void;
}

export default function ResearchFlow({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  setNodes,
  setEdges,
  sessionName,
  setSessionName,
  showTutorial,
  onNextTutorial,
  onCloseTutorial
}: ResearchFlowProps) {
  // UI State
  const [promptState, setPromptState] = useState<{ isOpen: boolean; nodeId: string | null }>({
    isOpen: false,
    nodeId: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  
  const nodesRef = React.useRef(nodes);
  nodesRef.current = nodes;
  
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

  // Load saved sessions from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('research_sessions');
    if (saved) {
      try {
        setSavedSessions(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved sessions', e);
      }
    }
  }, []);

  // Handlers need to be defined before they are used
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

      // @ts-ignore - setNodes from props might have slightly different signature but compatible in practice
      setNodes((nds) => [...nds, ...resultNodes]);
      setEdges((eds) => [...eds, ...resultEdges]);
  };

  // Helper to perform research
  const performResearch = async (prompt: string, parentId: string) => {
    try {
      // Get parent context
      const parentNode = nodesRef.current.find(n => n.id === parentId);
      const parentContext = parentNode ? {
          title: parentNode.data.label || parentNode.data.title,
          content: parentNode.data.content,
          imageUrl: parentNode.data.imageUrl
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

  // New handler for in-node research (Asset nodes)
  const handleInNodeResearch = useCallback(async (nodeId: string, prompt: string) => {
      // Set specific node to loading
      // @ts-ignore
      setNodes(nds => nds.map(n => 
          n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true, loadingText: `Researching "${prompt}"...` } } : n
      ));

      await performResearch(prompt, nodeId);

      // Remove loading state
      // @ts-ignore
      setNodes(nds => nds.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, isLoading: false } } : n
      ));
  }, [setNodes]); 

  const handleAutoResearch = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    
    // For hook start nodes, the label is the title.
    const prompt = (node.data.label as string) || "Research this topic"; 
    
    setIsLoading(true);
    
    // Update loading state
    // @ts-ignore
    setNodes(nds => nds.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true, loadingText: `Researching "${prompt}"...` } } : n
    ));

    await performResearch(prompt, nodeId);

    setIsLoading(false);
    // @ts-ignore
    setNodes(nds => nds.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, isLoading: false } } : n
    ));
  }, [setNodes]);

  // Inject handlers into nodes via useMemo to avoid state patching effects
  const nodesWithHandlers = React.useMemo(() => {
      return nodes.map(node => {
          if (node.type === 'start') {
              return {
                  ...node,
                  data: {
                      ...node.data,
                      onStartAutoResearch: handleAutoResearch
                  }
              };
          }
          // Ensure result nodes also have their handler if missing (e.g. from initial load if not handled elsewhere)
          if (node.type === 'result' && !node.data.onResearch) {
              return {
                  ...node,
                  data: {
                      ...node.data,
                      onResearch: handleInNodeResearch
                  }
              };
          }
          return node;
      });
  }, [nodes, handleAutoResearch, handleInNodeResearch]);

  const saveSession = () => {
    let nameToSave = sessionName;
    
    if (!nameToSave) {
        const userInput = prompt('Enter a name for this session:', `Research Session ${new Date().toLocaleDateString()}`);
        if (!userInput) return; // User cancelled
        nameToSave = userInput;
        setSessionName(nameToSave);
    }
    
    const session: SavedSession = {
      id: Date.now().toString(),
      name: nameToSave,
      nodes,
      edges,
      timestamp: Date.now(),
    };

    const newSessions = [...savedSessions.filter(s => s.name !== nameToSave), session];
    setSavedSessions(newSessions);
    localStorage.setItem('research_sessions', JSON.stringify(newSessions));
  };

  const loadSession = (session: SavedSession) => {
    // @ts-ignore
    setNodes(session.nodes.map(n => ({
        ...n,
        data: { ...n.data, onResearch: handleInNodeResearch } // Re-attach handler
    })));
    setEdges(session.edges);
    setSessionName(session.name);
    setShowLoadMenu(false);
  };

  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newSessions = savedSessions.filter(s => s.id !== sessionId);
      setSavedSessions(newSessions);
      localStorage.setItem('research_sessions', JSON.stringify(newSessions));
  };

  const handleClearGraph = () => {
      if (confirm('Are you sure you want to clear the research graph?')) {
          setNodes([]);
          setEdges([]);
          setSessionName(null);
      }
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

  const handleInitialSearch = async (prompt: string) => {
    const nodeId = promptState.nodeId;
    if (!nodeId) return;

    setPromptState(prev => ({ ...prev, isOpen: false }));
    setIsLoading(true);

    // Generate session name if not exists
    if (!sessionName) {
        fetch('/api/session-name', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        })
        .then(res => res.json())
        .then(data => setSessionName(data.name))
        .catch(e => console.error('Error generating name:', e));
    }
    
    // Set start node loading
    // @ts-ignore
    setNodes(nds => nds.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true, loadingText: `Researching "${prompt}"...` } } : n
    ));
    
    await performResearch(prompt, nodeId);
    
    setIsLoading(false);
    // Remove start node loading
    // @ts-ignore
    setNodes(nds => nds.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, isLoading: false } } : n
    ));
  };

  const handleDeepDive = async (prompt: string) => {
      const { nodeId } = dialogState;
      if (!nodeId) return;

      setDialogState(prev => ({ ...prev, isOpen: false }));
      
      // Set specific node to loading
      // @ts-ignore
      setNodes(nds => nds.map(n => 
          n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true, loadingText: `Researching "${prompt}"...` } } : n
      ));

      await performResearch(prompt, nodeId);

      // Remove loading state
      // @ts-ignore
      setNodes(nds => nds.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, isLoading: false } } : n
      ));
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
    // @ts-ignore
    setNodes((nds) => [...nds, newStartNode]);
    setSessionName(null); 
  };

  return (
    <div className="w-full h-screen bg-stone-50 relative">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {showTutorial && (
            <TutorialOverlay
                step={1}
                totalSteps={4}
                onNext={onNextTutorial!}
                onClose={onCloseTutorial!}
                content="Click the 'Start Research' node to begin. Use 'Direct Research' on result nodes to dive deeper into specific topics."
                position="bottom"
                className="top-16 left-4"
            />
        )}
        <button
            onClick={handleNewResearch}
            className="bg-white p-2 rounded-lg shadow-md border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors flex items-center gap-2"
            title="Add new start node"
        >
            <Plus className="w-4 h-4" />
        </button>

        {nodes.length > 0 && (
             <button
                onClick={handleClearGraph}
                className="bg-white p-2 rounded-lg shadow-md border border-stone-200 hover:text-red-500 text-stone-600 transition-colors flex items-center gap-2"
                title="Clear Graph"
            >
                <RotateCcw className="w-4 h-4" />
            </button>
        )}

        <button
            onClick={saveSession}
            disabled={nodes.length === 0}
            className={`bg-white p-2 rounded-lg shadow-md border border-stone-200 transition-colors flex items-center gap-2 ${nodes.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-stone-50 text-stone-600'}`}
            title="Save Session"
        >
            <Save className="w-4 h-4" />
            {sessionName && <span className="text-sm font-medium max-w-[150px] truncate">{sessionName}</span>}
        </button>

        <div className="relative">
            <button
                onClick={() => setShowLoadMenu(!showLoadMenu)}
                className="bg-white p-2 rounded-lg shadow-md border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors flex items-center gap-2"
                title="Load Session"
            >
                <FolderOpen className="w-4 h-4" />
                <ChevronDown className="w-3 h-3" />
            </button>
            
            {showLoadMenu && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-stone-200 py-2 max-h-64 overflow-y-auto">
                    {savedSessions.length === 0 ? (
                        <div className="px-4 py-2 text-sm text-stone-400">No saved sessions</div>
                    ) : (
                        savedSessions.map(session => (
                            <div
                                key={session.id}
                                className="w-full px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 flex items-center justify-between group cursor-pointer"
                                onClick={() => loadSession(session)}
                            >
                                <div className="flex flex-col overflow-hidden">
                                    <span className="truncate font-medium">{session.name}</span>
                                    <span className="text-xs text-stone-400">
                                        {new Date(session.timestamp).toLocaleDateString()}
                                    </span>
                                </div>
                                <button 
                                    onClick={(e) => deleteSession(session.id, e)}
                                    className="p-1 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
      </div>
      <ReactFlow
        nodes={nodesWithHandlers}
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
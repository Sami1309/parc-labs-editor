import React, { useCallback, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  Node, 
  Edge, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  Connection,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Sparkles, Film, Image as ImageIcon, Video, MoveRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface RefineAssetFlowProps {
  onBack: () => void;
  contextBefore?: string;
  contextAfter?: string;
  assetType: 'image' | 'video' | 'text';
  assetFile?: File;
}

const initialNodes: Node[] = [
  { 
    id: '1', 
    position: { x: 250, y: 100 }, 
    data: { label: 'Raw Asset Input' }, 
    type: 'input',
    style: { background: '#1c1917', color: 'white', border: '1px solid #44403c', borderRadius: '8px', padding: '10px', width: 200 }
  },
  { 
    id: '2', 
    position: { x: 250, y: 400 }, 
    data: { label: 'Refinement Process' },
    style: { background: '#1c1917', color: 'white', border: '1px solid #44403c', borderRadius: '8px', padding: '10px' } 
  }
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#a855f7' } }
];

export function RefineAssetFlow({ onBack, contextBefore, contextAfter, assetType, assetFile }: RefineAssetFlowProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
      if (assetFile) {
          const objectUrl = URL.createObjectURL(assetFile);
          setNodes(nds => nds.map(node => {
              if (node.id === '1') {
                  return {
                      ...node,
                      data: {
                          ...node.data,
                          label: (
                              <div className="flex flex-col items-center">
                                  <div className="text-xs font-bold mb-2 text-stone-400">Raw Input</div>
                                  {assetFile.type.startsWith('image') ? (
                                      <img src={objectUrl} alt="Asset" className="w-full rounded-md object-contain max-h-32" />
                                  ) : (
                                      <div className="w-full h-24 bg-black flex items-center justify-center rounded-md">
                                          <Video className="text-stone-500" />
                                      </div>
                                  )}
                                  <div className="mt-2 text-[10px] text-stone-500 truncate w-full text-center">{assetFile.name}</div>
                              </div>
                          )
                      },
                      style: { ...node.style, width: 250, height: 'auto' }
                  };
              }
              return node;
          }));
          
          return () => URL.revokeObjectURL(objectUrl);
      }
  }, [assetFile, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <div className="w-full h-full bg-stone-950 relative flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-stone-800 flex items-center px-4 bg-stone-900/50 z-10">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="text-sm font-medium">Back to Timeline</span>
        </button>
      </div>

      {/* Main Graph Area */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          className="bg-stone-950"
        >
          <Background color="#333" gap={20} variant={BackgroundVariant.Dots} />
          <Controls className="bg-stone-800 border-stone-700 fill-stone-400" />
        </ReactFlow>

        {/* Top Left Modal (Context & Options) */}
        <div className="absolute top-4 left-4 w-80 bg-stone-900/90 backdrop-blur-md border border-stone-700 rounded-xl shadow-2xl p-4 text-white z-20 max-h-[calc(100vh-100px)] overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-sm">Context Analysis</h3>
            </div>

            {/* Context Info */}
            <div className="space-y-3 mb-6">
                <div className="bg-stone-800/50 p-2 rounded border border-stone-700/50">
                    <span className="text-[10px] uppercase text-stone-500 font-bold tracking-wider block mb-1">Previous Context</span>
                    <p className="text-xs text-stone-300 line-clamp-2">{contextBefore || "Start of timeline"}</p>
                </div>
                
                <div className="flex justify-center">
                    <MoveRight className="w-4 h-4 text-stone-600 transform rotate-90" />
                </div>

                <div className="bg-purple-900/20 p-2 rounded border border-purple-500/30">
                    <span className="text-[10px] uppercase text-purple-400 font-bold tracking-wider block mb-1">Current Suggestion</span>
                    <p className="text-xs text-purple-200">
                        This clip serves as a transition. Maintain the high energy but shift focus to the environment.
                    </p>
                </div>

                <div className="flex justify-center">
                    <MoveRight className="w-4 h-4 text-stone-600 transform rotate-90" />
                </div>

                <div className="bg-stone-800/50 p-2 rounded border border-stone-700/50">
                    <span className="text-[10px] uppercase text-stone-500 font-bold tracking-wider block mb-1">Following Context</span>
                    <p className="text-xs text-stone-300 line-clamp-2">{contextAfter || "End of timeline"}</p>
                </div>
            </div>

            {/* Generation Options */}
            <div>
                <h4 className="text-xs font-semibold text-stone-400 mb-2">Generate as...</h4>
                <div className="grid grid-cols-1 gap-2">
                    <button className="flex items-center gap-3 p-2 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 transition-all group text-left">
                        <div className="w-8 h-8 rounded bg-blue-900/30 flex items-center justify-center text-blue-400 group-hover:text-blue-300">
                            <Film size={16} />
                        </div>
                        <div>
                            <span className="block text-xs font-medium text-stone-200">Motion Graphic</span>
                            <span className="block text-[10px] text-stone-500">After Effects style text/shape animation</span>
                        </div>
                    </button>

                    <button className="flex items-center gap-3 p-2 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 transition-all group text-left">
                        <div className="w-8 h-8 rounded bg-purple-900/30 flex items-center justify-center text-purple-400 group-hover:text-purple-300">
                            <Video size={16} />
                        </div>
                        <div>
                            <span className="block text-xs font-medium text-stone-200">AI Video</span>
                            <span className="block text-[10px] text-stone-500">Generative video from reference</span>
                        </div>
                    </button>

                    <button className="flex items-center gap-3 p-2 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 transition-all group text-left">
                        <div className="w-8 h-8 rounded bg-green-900/30 flex items-center justify-center text-green-400 group-hover:text-green-300">
                            <ImageIcon size={16} />
                        </div>
                        <div>
                            <span className="block text-xs font-medium text-stone-200">AI Image</span>
                            <span className="block text-[10px] text-stone-500">High-res still frame generation</span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useState, useRef } from 'react';
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
import { ArrowLeft, Sparkles, Film, Image as ImageIcon, Video, MoveRight, Edit2, Check, RefreshCcw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RefineAssetFlowProps {
  onBack: () => void;
  contextBefore?: string;
  contextAfter?: string;
  globalContext?: string;
  prevImage?: string;
  nextImage?: string;
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

export function RefineAssetFlow({ onBack, contextBefore, contextAfter, globalContext, prevImage, nextImage, assetType, assetFile }: RefineAssetFlowProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  // State for Context & Generation
  const [suggestion, setSuggestion] = useState<string>('');
  const [isEditingSuggestion, setIsEditingSuggestion] = useState(false);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const suggestionRef = useRef<HTMLTextAreaElement>(null);

  // Generate initial suggestion
  useEffect(() => {
    const fetchSuggestion = async () => {
      setIsGeneratingSuggestion(true);
      try {
        const prompt = `
          Context Before: ${contextBefore || "None"}
          Context After: ${contextAfter || "None"}
          Global Context: ${globalContext || "A cinematic sequence"}
          
          Suggest a short visual description for a clip that bridges these two contexts seamlessly. Keep it concise (1-2 sentences).
        `;
        
        const res = await fetch('/api/quick-suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        });
        
        const data = await res.json();
        if (data.text) {
          setSuggestion(data.text.trim());
        }
      } catch (e) {
        console.error("Failed to generate suggestion", e);
        setSuggestion("A transition clip bridging the previous and next scenes.");
      } finally {
        setIsGeneratingSuggestion(false);
      }
    };

    if (!suggestion) {
        fetchSuggestion();
    }
  }, [contextBefore, contextAfter, globalContext]); // Run once on mount or when props change

  // Update Raw Input Node with File
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

  const handleGenerateImage = async () => {
      if (!suggestion) return;
      setIsGeneratingImage(true);
      try {
          const prompt = `
            Create a high quality cinematic image based on this description:
            ${suggestion}
            
            Style/Context: ${globalContext || "Cinematic, photorealistic"}
          `;

          const res = await fetch('/api/generate-visual', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt })
          });

          const data = await res.json();
          if (data.image) {
              setGeneratedImage(data.image);
          }
      } catch (e) {
          console.error("Image generation failed", e);
      } finally {
          setIsGeneratingImage(false);
      }
  };

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
        <div className="absolute top-4 left-4 w-96 bg-stone-900/95 backdrop-blur-md border border-stone-700 rounded-xl shadow-2xl p-5 text-white z-20 max-h-[calc(100vh-100px)] overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-sm text-stone-200">Context & Refinement</h3>
            </div>

            {/* Context Flow Visualization */}
            <div className="flex items-stretch justify-between gap-2 mb-6 text-center">
                <div className="flex-1 flex flex-col items-center">
                    <div className="w-full aspect-video bg-stone-800 rounded border border-stone-700 flex items-center justify-center mb-1 overflow-hidden">
                       {prevImage ? (
                           <img src={prevImage} alt="Previous" className="w-full h-full object-cover" />
                       ) : (
                           <span className="text-[10px] text-stone-500">Last Frame</span>
                       )}
                    </div>
                    <span className="text-[10px] text-stone-500 font-medium truncate max-w-[80px]">Previous</span>
                </div>
                
                <div className="flex flex-col justify-center text-stone-600">
                    <MoveRight size={16} />
                </div>

                <div className="flex-1 flex flex-col items-center relative">
                    <div className="w-full aspect-video bg-purple-900/20 rounded border border-purple-500/50 flex items-center justify-center mb-1 shadow-[0_0_15px_rgba(168,85,247,0.15)] overflow-hidden">
                        {generatedImage ? (
                            <img src={generatedImage} alt="Generated" className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center gap-1">
                                <Sparkles size={12} className="text-purple-400" />
                                <span className="text-[9px] text-purple-300">Target</span>
                            </div>
                        )}
                    </div>
                     <span className="text-[10px] text-purple-400 font-medium">Current</span>
                </div>

                <div className="flex flex-col justify-center text-stone-600">
                    <MoveRight size={16} />
                </div>

                <div className="flex-1 flex flex-col items-center">
                    <div className="w-full aspect-video bg-stone-800 rounded border border-stone-700 flex items-center justify-center mb-1 overflow-hidden">
                        {nextImage ? (
                            <img src={nextImage} alt="Next" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-[10px] text-stone-500">First Frame</span>
                        )}
                    </div>
                    <span className="text-[10px] text-stone-500 font-medium truncate max-w-[80px]">Next</span>
                </div>
            </div>

            {/* Context Description */}
            <div className="mb-6 space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-stone-400">Context Suggestion</label>
                    <button 
                        onClick={() => setIsEditingSuggestion(!isEditingSuggestion)}
                        className="text-stone-500 hover:text-stone-300 transition-colors p-1"
                        title="Edit Context"
                    >
                        {isEditingSuggestion ? <Check size={14} className="text-green-500"/> : <Edit2 size={12} />}
                    </button>
                </div>
                
                <div className="relative group">
                    {isGeneratingSuggestion ? (
                        <div className="p-3 bg-stone-800/50 rounded border border-stone-700 text-xs text-stone-400 flex items-center gap-2">
                            <Loader2 className="animate-spin w-3 h-3" />
                            Thinking...
                        </div>
                    ) : isEditingSuggestion ? (
                        <textarea
                            ref={suggestionRef}
                            value={suggestion}
                            onChange={(e) => setSuggestion(e.target.value)}
                            className="w-full p-3 bg-stone-800 rounded border border-purple-500/50 text-xs text-stone-200 focus:outline-none focus:ring-1 focus:ring-purple-500 min-h-[80px] resize-none"
                            placeholder="Describe the context..."
                        />
                    ) : (
                        <div 
                            className="p-3 bg-stone-800/50 rounded border border-stone-700 text-xs text-stone-300 min-h-[60px] cursor-pointer hover:border-stone-600 transition-colors"
                            onClick={() => setIsEditingSuggestion(true)}
                        >
                            {suggestion || "No context provided."}
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
                <button 
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImage || !suggestion}
                    className={`w-full py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                        isGeneratingImage || !suggestion
                            ? 'bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700'
                            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-900/20'
                    }`}
                >
                    {isGeneratingImage ? (
                        <>
                            <Loader2 className="animate-spin w-4 h-4" />
                            Generating Visual...
                        </>
                    ) : (
                        <>
                            <ImageIcon size={16} />
                            Generate Reference Image
                        </>
                    )}
                </button>
                
                 {/* Visual Style Indicator */}
                 {globalContext && (
                    <div className="mt-4 p-2 rounded bg-stone-800/30 border border-stone-800">
                        <span className="text-[10px] text-stone-500 block mb-1 uppercase tracking-wider font-bold">Global Style</span>
                        <p className="text-[10px] text-stone-400 line-clamp-2">{globalContext}</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}

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
import { ArrowLeft, Sparkles, Film, Image as ImageIcon, Video, MoveRight, Edit2, Check, RefreshCcw, Loader2, Wand2, Code, Save, Layout } from 'lucide-react';
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
  onSave?: (result: string, type: 'image' | 'motion') => void;
}

interface Suggestion {
    label: string;
    prompt: string;
    format: 'image' | 'motion';
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

export function RefineAssetFlow({ onBack, contextBefore, contextAfter, globalContext, prevImage, nextImage, assetType, assetFile, onSave }: RefineAssetFlowProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  // State for Context & Generation
  const [suggestion, setSuggestion] = useState<string>('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isEditingSuggestion, setIsEditingSuggestion] = useState(false);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedMotion, setGeneratedMotion] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [visualType, setVisualType] = useState<'image' | 'motion'>('image');

  const suggestionRef = useRef<HTMLTextAreaElement>(null);

  // Generate initial suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      setIsGeneratingSuggestion(true);
      try {
        const body = {
            contextBefore,
            contextAfter,
            globalContext,
            prompt: suggestion || "Bridge the scene",
        };
        
        const res = await fetch('/api/quick-suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        
        const data = await res.json();
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
          if (!suggestion && data.suggestions.length > 0) {
              setSuggestion(data.suggestions[0].prompt);
              setVisualType(data.suggestions[0].format);
          }
        }
      } catch (e) {
        console.error("Failed to generate suggestion", e);
      } finally {
        setIsGeneratingSuggestion(false);
      }
    };

    if (suggestions.length === 0) {
        fetchSuggestions();
    }
  }, [contextBefore, contextAfter, globalContext]); 

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

  const handleGenerate = async () => {
      if (!suggestion) return;
      setIsGenerating(true);
      setGeneratedImage(null);
      setGeneratedMotion(null);

      try {
          const body: any = {
              prompt: `
                Create a high quality ${visualType === 'motion' ? 'motion graphic SVG animation' : 'cinematic image'} based on this description:
                ${suggestion}
                
                Style/Context: ${globalContext || "Cinematic, photorealistic"}
              `,
              type: visualType
          };

          // Attach image for reference if available
          if (assetFile && assetFile.type.startsWith('image')) {
               const reader = new FileReader();
               reader.readAsDataURL(assetFile);
               await new Promise((resolve) => {
                   reader.onload = () => {
                       body.image = reader.result as string;
                       resolve(null);
                   };
               });
          } else if (prevImage) {
               body.image = prevImage;
          }

          const res = await fetch('/api/generate-visual', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
          });

          const data = await res.json();
          
          if (data.type === 'motion' && data.content) {
              setGeneratedMotion(data.content);
              
              // Update Refinement Node with Playable Graphic
              setNodes(nds => nds.map(node => {
                if (node.id === '2') {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            label: (
                                <div className="flex flex-col items-center w-full">
                                    <div className="text-xs font-bold mb-2 text-purple-400">Generated Motion Graphic</div>
                                    <div 
                                        className="w-full aspect-video bg-black rounded overflow-hidden"
                                        dangerouslySetInnerHTML={{ __html: data.content }}
                                    />
                                </div>
                            )
                        },
                        style: { ...node.style, width: 300, height: 'auto', background: '#0f0f0f', borderColor: '#a855f7' }
                    };
                }
                return node;
              }));

          } else if (data.image) {
              setGeneratedImage(data.image);
              
               // Update Refinement Node with Image
               setNodes(nds => nds.map(node => {
                if (node.id === '2') {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            label: (
                                <div className="flex flex-col items-center w-full">
                                    <div className="text-xs font-bold mb-2 text-blue-400">Generated Image</div>
                                    <img src={data.image} alt="Generated" className="w-full rounded" />
                                </div>
                            )
                        },
                        style: { ...node.style, width: 300, height: 'auto', background: '#0f0f0f', borderColor: '#3b82f6' }
                    };
                }
                return node;
              }));
          }
      } catch (e) {
          console.error("Generation failed", e);
      } finally {
          setIsGenerating(false);
      }
  };

  const applySuggestion = (s: Suggestion) => {
      setSuggestion(s.prompt);
      setVisualType(s.format);
      setIsEditingSuggestion(true);
  };

  const handleSaveToTimeline = () => {
      if (onSave) {
          if (generatedMotion) {
              onSave(generatedMotion, 'motion');
          } else if (generatedImage) {
              onSave(generatedImage, 'image');
          }
      }
  };

  return (
    <div className="w-full h-full bg-stone-950 relative flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-stone-800 flex items-center justify-between px-4 bg-stone-900/50 z-10 relative">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="text-sm font-medium">Back to Timeline</span>
        </button>
        
        {/* Save to Timeline Button - Absolute Positioned to ensure visibility */}
        {(generatedImage || generatedMotion) && onSave && (
            <button
                onClick={handleSaveToTimeline}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 shadow-lg hover:shadow-purple-500/20 transition-all animate-in fade-in slide-in-from-top-2 z-50 ring-1 ring-purple-400"
            >
                <Save size={16} />
                SAVE ASSET TO TIMELINE
            </button>
        )}
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
                <h3 className="font-bold text-sm text-stone-200">Refine Asset with Gemini</h3>
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
                        ) : generatedMotion ? (
                            <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: generatedMotion }} />
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

            {/* Visual Type Toggle */}
            <div className="flex p-1 bg-stone-800 rounded-lg mb-4">
                <button
                    onClick={() => setVisualType('image')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs rounded-md transition-all ${visualType === 'image' ? 'bg-stone-700 text-white shadow-sm' : 'text-stone-400 hover:text-stone-300'}`}
                >
                    <ImageIcon size={12} />
                    AI Image
                </button>
                <button
                    onClick={() => setVisualType('motion')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs rounded-md transition-all ${visualType === 'motion' ? 'bg-stone-700 text-white shadow-sm' : 'text-stone-400 hover:text-stone-300'}`}
                >
                    <Film size={12} />
                    Motion Graphic
                </button>
            </div>

            {/* Context Description */}
            <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-stone-400">Prompt & Context</label>
                    <button 
                        onClick={() => setIsEditingSuggestion(!isEditingSuggestion)}
                        className="text-stone-500 hover:text-stone-300 transition-colors p-1"
                    >
                        {isEditingSuggestion ? <Check size={14} className="text-green-500"/> : <Edit2 size={12} />}
                    </button>
                </div>
                
                <div className="relative group">
                     {isEditingSuggestion ? (
                        <textarea
                            ref={suggestionRef}
                            value={suggestion}
                            onChange={(e) => setSuggestion(e.target.value)}
                            className="w-full p-3 bg-stone-800 rounded border border-purple-500/50 text-xs text-stone-200 focus:outline-none focus:ring-1 focus:ring-purple-500 min-h-[80px] resize-none"
                            placeholder="Describe the desired output..."
                        />
                    ) : (
                        <div 
                            className="p-3 bg-stone-800/50 rounded border border-stone-700 text-xs text-stone-300 min-h-[60px] cursor-pointer hover:border-stone-600 transition-colors"
                            onClick={() => setIsEditingSuggestion(true)}
                        >
                            {suggestion || "No prompt provided."}
                        </div>
                    )}
                </div>

                {/* Auto Suggestions */}
                {isGeneratingSuggestion ? (
                     <div className="flex items-center gap-2 text-xs text-stone-500 py-2">
                        <Loader2 className="animate-spin w-3 h-3" />
                        Generating Auto-Suggestions...
                     </div>
                ) : suggestions.length > 0 && (
                    <div className="space-y-2 mt-2">
                        <div className="flex items-center gap-1 text-[10px] text-stone-500 uppercase tracking-wider font-bold">
                            <Wand2 size={10} />
                            Auto-Suggestions
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {suggestions.map((s, i) => (
                                <button 
                                    key={i}
                                    onClick={() => applySuggestion(s)}
                                    className="text-left p-2 rounded bg-stone-800/50 hover:bg-stone-700 border border-stone-800 hover:border-stone-600 transition-all group"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-medium text-stone-300 group-hover:text-white">{s.label}</span>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-900 text-stone-500 border border-stone-800 uppercase">{s.format}</span>
                                    </div>
                                    <p className="text-[10px] text-stone-500 line-clamp-2">{s.prompt}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2 border-t border-stone-800">
                <button 
                    onClick={handleGenerate}
                    disabled={isGenerating || !suggestion}
                    className={`w-full py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                        isGenerating || !suggestion
                            ? 'bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700'
                            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-900/20'
                    }`}
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="animate-spin w-4 h-4" />
                            Generating...
                        </>
                    ) : (
                        <>
                            {visualType === 'motion' ? <Film size={16} /> : <ImageIcon size={16} />}
                            Generate {visualType === 'motion' ? 'Motion Graphic' : 'Image'}
                        </>
                    )}
                </button>

                 {/* Save Result Button (Also in Header, but helpful here) */}
                {(generatedImage || generatedMotion) && onSave && (
                    <button 
                        onClick={handleSaveToTimeline}
                        className="w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors border border-stone-700"
                    >
                        <Save size={14} />
                        Save Result to Timeline
                    </button>
                )}
            </div>
            
             {/* Preview/Result Indicator in Modal */}
             {(generatedImage || generatedMotion) && (
                <div className="mt-4 p-3 bg-stone-800/50 rounded border border-green-500/30">
                    <div className="flex items-center gap-2 text-green-400 mb-1">
                        <Check size={14} />
                        <span className="text-xs font-bold">Generated Successfully</span>
                    </div>
                    <p className="text-[10px] text-stone-400">
                        The result has been added to the refinement node in the graph.
                    </p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}

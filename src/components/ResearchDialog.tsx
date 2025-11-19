import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ArrowRight, MessageCircleQuestion, Info, Layers } from 'lucide-react';

interface ResearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  suggestedQuestion?: string;
  suggestedPaths?: string[];
  nodeTitle?: string;
  nodeContent?: string;
  isAssetMode?: boolean;
}

export const ResearchDialog: React.FC<ResearchDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  suggestedQuestion,
  suggestedPaths,
  nodeTitle,
  nodeContent,
  isAssetMode
}) => {
  const [customPrompt, setCustomPrompt] = React.useState('');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {/* Positioned at bottom center, above the prompt bar */}
      <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-[110] w-full max-w-2xl px-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`rounded-2xl shadow-2xl overflow-hidden border pointer-events-auto ${isAssetMode ? 'bg-stone-900 border-stone-700' : 'bg-white border-stone-200'}`}
        >
          {/* Header */}
          <div className={`${isAssetMode ? 'bg-stone-800 border-stone-700' : 'bg-stone-50 border-stone-100'} px-5 py-3 border-b flex justify-between items-center`}>
            <div className="flex items-center">
                {isAssetMode ? <Layers className="w-4 h-4 text-purple-400 mr-2" /> : <Sparkles className="w-4 h-4 text-blue-500 mr-2" />}
                <h2 className={`text-sm font-bold ${isAssetMode ? 'text-stone-200' : 'text-stone-700'}`}>
                    {isAssetMode ? 'Asset Discovery' : 'Deep Dive Research'}
                </h2>
            </div>
            <button onClick={onClose} className={`p-1.5 rounded-full transition-colors ${isAssetMode ? 'hover:bg-stone-700 text-stone-400' : 'hover:bg-stone-200 text-stone-500'}`}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 max-h-[60vh] overflow-y-auto">
            {/* Context Section */}
            {!isAssetMode && (
                <div className="mb-5">
                    <h3 className="text-lg font-bold text-stone-800 mb-1">{nodeTitle}</h3>
                    <div className="flex items-start text-stone-600 text-sm bg-stone-50 p-3 rounded-lg border border-stone-100">
                        <Info className="w-4 h-4 text-stone-400 mr-2 mt-0.5 flex-shrink-0" />
                        <p className="leading-relaxed">{nodeContent}</p>
                    </div>
                </div>
            )}

            {/* Suggested Question / Angle */}
            {suggestedQuestion && !isAssetMode && (
                <div className="mb-5">
                    <div className="flex items-center mb-2">
                        <MessageCircleQuestion className="w-4 h-4 text-blue-600 mr-2" />
                        <h4 className="font-bold text-blue-900 text-xs uppercase tracking-wide">Did you know?</h4>
                    </div>
                    <p className="text-blue-800 text-sm leading-relaxed pl-6 border-l-2 border-blue-200">{suggestedQuestion}</p>
                </div>
            )}

            {/* Asset Mode Specific Prompt */}
            {isAssetMode && (
                <div className="mb-5">
                    <h3 className="text-lg font-bold text-white mb-2">Find more assets like this?</h3>
                    <p className="text-stone-400 text-sm mb-4">
                        Would you like to find more images similar to this collection, or explore related visual themes?
                    </p>
                </div>
            )}

            {/* Suggested Paths */}
            <div className="space-y-2 mb-5">
                <label className={`text-xs font-bold uppercase tracking-wider block mb-2 ${isAssetMode ? 'text-stone-500' : 'text-stone-500'}`}>
                    {isAssetMode ? 'Next Steps' : 'Explore further'}
                </label>
                
                {isAssetMode ? (
                    // Asset Mode Options
                    <>
                        <button
                            onClick={() => onSubmit("Find more similar images and visual assets")}
                            className="w-full text-left p-3 rounded-lg border border-stone-700 hover:border-purple-500 hover:bg-purple-900/20 transition-all group flex items-center justify-between bg-stone-800 shadow-sm"
                        >
                            <span className="text-sm text-stone-200 group-hover:text-purple-300 font-medium">Find more similar assets</span>
                            <ArrowRight className="w-4 h-4 text-stone-500 group-hover:text-purple-400 transform group-hover:translate-x-1 transition-all" />
                        </button>
                        <button
                            onClick={() => onSubmit("Find videos related to this topic")}
                            className="w-full text-left p-3 rounded-lg border border-stone-700 hover:border-purple-500 hover:bg-purple-900/20 transition-all group flex items-center justify-between bg-stone-800 shadow-sm"
                        >
                            <span className="text-sm text-stone-200 group-hover:text-purple-300 font-medium">Find related videos</span>
                            <ArrowRight className="w-4 h-4 text-stone-500 group-hover:text-purple-400 transform group-hover:translate-x-1 transition-all" />
                        </button>
                    </>
                ) : (
                    // Standard Mode Options
                    suggestedPaths?.map((path, idx) => (
                        <button
                            key={idx}
                            onClick={() => onSubmit(path)}
                            className="w-full text-left p-3 rounded-lg border border-stone-200 hover:border-blue-500 hover:bg-blue-50 transition-all group flex items-center justify-between bg-white shadow-sm"
                        >
                            <span className="text-sm text-stone-700 group-hover:text-blue-700 font-medium">{path}</span>
                            <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" />
                        </button>
                    ))
                )}
            </div>

            {/* Custom Input */}
            <div className="relative">
                <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={isAssetMode ? "Or describe specific assets to find..." : "Or type your own research question..."}
                    className={`block w-full pl-4 pr-12 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all ${
                        isAssetMode 
                        ? 'bg-stone-800 border-stone-600 text-white placeholder-stone-500 focus:ring-purple-500 focus:border-purple-500' 
                        : 'bg-stone-50 border-stone-300 text-stone-900 placeholder-stone-400 focus:bg-white focus:ring-blue-500 focus:border-blue-500'
                    }`}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && customPrompt.trim()) {
                            onSubmit(customPrompt);
                        }
                    }}
                />
                <button 
                    onClick={() => customPrompt.trim() && onSubmit(customPrompt)}
                    className={`absolute inset-y-1 right-1 px-3 rounded-md text-xs font-bold transition-colors ${
                        isAssetMode 
                        ? 'bg-purple-600 text-white hover:bg-purple-500' 
                        : 'bg-stone-900 text-white hover:bg-stone-700'
                    }`}
                >
                    Go
                </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

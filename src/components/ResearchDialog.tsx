import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ArrowRight, MessageCircleQuestion } from 'lucide-react';

interface ResearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  suggestedQuestion?: string;
  suggestedPaths?: string[];
  nodeTitle?: string;
}

export const ResearchDialog: React.FC<ResearchDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  suggestedQuestion,
  suggestedPaths,
  nodeTitle
}) => {
  const [customPrompt, setCustomPrompt] = React.useState('');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-stone-200"
        >
          {/* Header */}
          <div className="bg-stone-50 px-6 py-4 border-b border-stone-100 flex justify-between items-center">
            <div>
                <h2 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Deep Dive Research</h2>
                <p className="text-lg font-bold text-stone-800 truncate max-w-xs">{nodeTitle}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
              <X className="w-5 h-5 text-stone-500" />
            </button>
          </div>

          <div className="p-6">
            {/* Suggested Question */}
            {suggestedQuestion && (
                <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <div className="flex items-start mb-2">
                        <MessageCircleQuestion className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                        <h3 className="font-bold text-blue-900 text-sm">Suggested Angle</h3>
                    </div>
                    <p className="text-blue-800 text-sm leading-relaxed pl-7">{suggestedQuestion}</p>
                </div>
            )}

            {/* Suggested Paths */}
            <div className="space-y-3 mb-6">
                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-2">
                    Choose a direction
                </label>
                {suggestedPaths?.map((path, idx) => (
                    <button
                        key={idx}
                        onClick={() => onSubmit(path)}
                        className="w-full text-left p-3 rounded-lg border border-stone-200 hover:border-blue-500 hover:bg-blue-50 transition-all group flex items-center justify-between"
                    >
                        <span className="text-sm text-stone-700 group-hover:text-blue-700 font-medium">{path}</span>
                        <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" />
                    </button>
                ))}
            </div>

            {/* Custom Input */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Sparkles className="h-4 w-4 text-stone-400" />
                </div>
                <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Or type your own research question..."
                    className="block w-full pl-10 pr-12 py-3 border border-stone-300 rounded-lg leading-5 bg-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && customPrompt.trim()) {
                            onSubmit(customPrompt);
                        }
                    }}
                />
                <button 
                    onClick={() => customPrompt.trim() && onSubmit(customPrompt)}
                    className="absolute inset-y-1 right-1 px-3 bg-stone-900 text-white rounded-md text-xs font-bold hover:bg-stone-700 transition-colors"
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


import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ChevronRight, CheckCircle2 } from 'lucide-react';

interface AgentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  trace: string; // The streaming text
  options: { id: string; title: string; description: string; preview?: string }[];
  onSelectOption: (optionId: string) => void;
  isProcessing: boolean;
}

export function AgentSidebar({ isOpen, onClose, trace, options, onSelectOption, isProcessing }: AgentSidebarProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          className="h-full bg-stone-900 border-l border-stone-800 flex flex-col shadow-xl z-30 overflow-hidden text-white"
        >
          {/* Header */}
          <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-900">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="font-bold text-stone-200">Agent Trace</h3>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-stone-800 rounded-md text-stone-400 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Trace Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Streaming Output */}
            <div className="bg-stone-950 p-3 rounded-lg border border-stone-800 text-sm font-mono text-stone-400 leading-relaxed whitespace-pre-wrap">
              {trace || "Waiting for input..."}
              {isProcessing && (
                <span className="inline-block w-2 h-4 bg-purple-500 ml-1 animate-pulse align-middle" />
              )}
            </div>

            {/* Options */}
            {options.length > 0 && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h4 className="text-sm font-semibold text-stone-300">Suggested Interpretations</h4>
                {options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => onSelectOption(option.id)}
                    className="w-full text-left p-3 rounded-lg border border-stone-700 hover:border-purple-500 hover:bg-stone-800 transition-all group relative overflow-hidden bg-stone-900"
                  >
                    <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-stone-200 group-hover:text-purple-400">{option.title}</span>
                        <CheckCircle2 className="w-4 h-4 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-stone-500 leading-snug">{option.description}</p>
                    
                    {option.preview && (
                        <div className="mt-2 h-20 bg-black/50 rounded overflow-hidden relative border border-stone-800">
                             {/* Placeholder for visual preview of the option */}
                             <div className="absolute inset-0 flex items-center justify-center text-[10px] text-stone-600">
                                 Visual Preview
                             </div>
                        </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


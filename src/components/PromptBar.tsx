import React, { useState } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PromptBarProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

export const PromptBar: React.FC<PromptBarProps> = ({ isOpen, onClose, onSubmit, isLoading }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt);
      setPrompt('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 z-50"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden">
            <form onSubmit={handleSubmit} className="relative flex items-center p-2">
              <Search className="w-5 h-5 text-stone-400 ml-3" />
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What do you want to research for your video?"
                className="flex-1 px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none text-lg"
                autoFocus
                disabled={isLoading}
              />
              {isLoading ? (
                <div className="mr-3">
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors mr-1"
                >
                  <X className="w-5 h-5 text-stone-400" />
                </button>
              )}
            </form>
            {isLoading && (
                <div className="px-4 py-2 bg-stone-50 text-xs text-stone-500 border-t border-stone-100 flex items-center">
                    <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                    AI Agent is researching...
                </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


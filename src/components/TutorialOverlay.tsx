import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TutorialOverlayProps {
  step: number;
  totalSteps: number;
  onNext: () => void;
  onClose: () => void;
  content: string;
  targetRef?: React.RefObject<HTMLElement>;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  className?: string;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  step,
  totalSteps,
  onNext,
  onClose,
  content,
  position = 'bottom',
  className = ''
}) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`absolute z-50 bg-stone-900/95 text-white p-4 rounded-xl shadow-2xl max-w-xs backdrop-blur-sm border border-stone-800 ${className}`}
        style={{
             // Simple positioning styles if no ref provided (caller handles positioning via className or style)
        }}
      >
        <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                Step {step + 1}/{totalSteps}
            </span>
            <button onClick={onClose} className="text-stone-500 hover:text-white transition-colors">
                <X size={14} />
            </button>
        </div>
        
        <p className="text-sm leading-relaxed text-stone-200 mb-4 font-medium">
            {content}
        </p>
        
        <div className="flex justify-end">
            <Button 
                size="sm" 
                onClick={onNext}
                className="bg-white text-stone-900 hover:bg-stone-200 h-8 text-xs font-bold"
            >
                {step === totalSteps - 1 ? 'Finish' : 'Next'} <ChevronRight size={12} className="ml-1" />
            </Button>
        </div>
        
        {/* Arrow (simplified) */}
        <div className={`absolute w-3 h-3 bg-stone-900/95 transform rotate-45 border-stone-800 ${
            position === 'bottom' ? '-top-1.5 left-4 border-l border-t' : 
            position === 'top' ? '-bottom-1.5 left-4 border-r border-b' :
            position === 'left' ? '-right-1.5 top-4 border-r border-t' :
            '-left-1.5 top-4 border-l border-b'
        }`} />
      </motion.div>
    </AnimatePresence>
  );
};



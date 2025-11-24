import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, ArrowRight, X, Loader2, Sparkles, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ContextInputProps {
  onContextSubmit: (context: { text: string; files: File[] }) => void;
  onRefineAsset: (file?: File) => void;
  className?: string;
  priorContext?: string;
  nextContext?: string;
}

export function ContextInput({ 
  onContextSubmit, 
  onRefineAsset, 
  className,
  priorContext,
  nextContext
}: ContextInputProps) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...newFiles]);
      startAnalysis(newFiles[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files || []);
      setFiles(prev => [...prev, ...newFiles]);
      startAnalysis(newFiles[0]);
    }
  };

  const startAnalysis = async (file: File) => {
      setIsAnalyzing(true);
      setAnalysisText('Initializing analysis...');
      
      try {
          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch('/api/analyze-asset', {
              method: 'POST',
              body: formData,
          });

          if (response.ok) {
              const data = await response.json();
              const fullText = data.analysis || "Analysis complete. No insights returned.";
              setAnalysisText('');
              
              let i = 0;
              const interval = setInterval(() => {
                  setAnalysisText(prev => fullText.slice(0, i + 1));
                  i++;
                  if (i >= fullText.length) {
                      clearInterval(interval);
                  }
              }, 20);
          } else {
              setAnalysisText("Failed to analyze asset. Please try again.");
          }
      } catch (error) {
          console.error(error);
          setAnalysisText("Error during analysis.");
      }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (files.length <= 1) {
        setIsAnalyzing(false);
        setAnalysisText('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() || files.length > 0) {
      onContextSubmit({ text, files });
    }
  };

  return (
    <div className={cn("w-full h-full flex flex-col bg-stone-900/95 backdrop-blur-xl overflow-hidden", className)}>
      {/* Context Headers - Compact */}
      {(priorContext || nextContext) && (
        <div className="flex divide-x divide-stone-800 border-b border-stone-800 bg-stone-950/50 h-12 shrink-0">
           <div className="flex-1 px-4 flex items-center gap-2 overflow-hidden">
               <ChevronLeft className="w-3 h-3 text-stone-500 shrink-0" />
               <div className="flex flex-col justify-center overflow-hidden">
                   <span className="text-[10px] uppercase text-stone-500 font-bold">Prior Scene</span>
                   <span className="text-xs text-stone-400 truncate">{priorContext || "Start of sequence"}</span>
               </div>
           </div>
           <div className="flex-1 px-4 flex items-center justify-end gap-2 overflow-hidden text-right">
               <div className="flex flex-col justify-center items-end overflow-hidden">
                   <span className="text-[10px] uppercase text-stone-500 font-bold">Next Scene</span>
                   <span className="text-xs text-stone-400 truncate">{nextContext || "End of sequence"}</span>
               </div>
               <ChevronRight className="w-3 h-3 text-stone-500 shrink-0" />
           </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
          {/* Left: Input Area */}
          <div className="flex-1 flex flex-col p-4 overflow-y-auto custom-scrollbar relative">
            <h3 className="text-sm font-medium text-white mb-3 shrink-0 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Define Context
            </h3>
            
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-3">
              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border border-dashed rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer transition-all shrink-0 h-24 group",
                  isDragging 
                    ? "border-purple-500 bg-purple-500/10" 
                    : "border-stone-700 hover:border-stone-500 hover:bg-stone-800/50"
                )}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  multiple 
                  onChange={handleFileSelect}
                />
                <Upload className={cn("w-5 h-5 mb-1 transition-colors", isDragging ? "text-purple-400" : "text-stone-500 group-hover:text-stone-400")} />
                <p className="text-stone-400 text-xs font-medium text-center group-hover:text-stone-300">
                  Upload Assets
                </p>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 shrink-0 max-h-[40px] overflow-y-auto custom-scrollbar">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 bg-stone-800 px-2 py-1 rounded text-xs border border-stone-700">
                      <FileText className="w-3 h-3 text-stone-400" />
                      <span className="text-stone-300 max-w-[100px] truncate">{file.name}</span>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                        className="text-stone-500 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Text Input */}
              <div className="relative flex-1 min-h-[80px]">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Describe the scene context..."
                  className="w-full h-full bg-stone-950/30 border border-stone-800 rounded-lg p-3 text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 resize-none text-sm leading-relaxed"
                />
                
                <button
                  type="submit"
                  disabled={!text.trim() && files.length === 0}
                  className="absolute bottom-3 right-3 bg-purple-600 text-white p-1.5 rounded-md hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors shadow-lg"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Right: Analysis & Actions (Persistent) */}
          <div className="w-64 border-l border-stone-800 bg-stone-950/30 flex flex-col shrink-0">
             
             {/* Analysis Content or Placeholder */}
             <div className="flex-1 p-4 overflow-hidden flex flex-col">
                {isAnalyzing || analysisText ? (
                    <div className="flex-1 overflow-y-auto font-mono text-[10px] text-stone-400 leading-relaxed whitespace-pre-wrap">
                        {analysisText}
                        {isAnalyzing && <span className="inline-block w-1.5 h-3 bg-purple-500 ml-1 animate-pulse align-middle"/>}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-stone-700 space-y-2 opacity-50">
                        <Sparkles className="w-8 h-8" />
                        <p className="text-xs text-center px-4">AI analysis will appear here</p>
                    </div>
                )}
             </div>

             {/* Refine Action - Persistent */}
             <div className="p-4 border-t border-stone-800">
                <button
                    onClick={() => onRefineAsset(files[0])}
                    className="w-full group h-10 relative overflow-hidden bg-white text-black rounded-lg font-medium shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-2"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-blue-50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="relative z-10 text-xs">Refine Asset</span>
                    <ArrowUpRight className="relative z-10 w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
             </div>
          </div>
      </div>
    </div>
  );
}

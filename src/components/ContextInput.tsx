import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, ArrowRight, X, Loader2, Sparkles, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ContextInputProps {
  onContextSubmit: (context: { text: string; files: File[] }) => void;
  onRefineAsset: (file: File) => void;
  className?: string;
}

export function ContextInput({ onContextSubmit, onRefineAsset, className }: ContextInputProps) {
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
              // Stream the real text
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
    <div className={cn("w-full h-full flex items-center justify-center bg-stone-900/95 backdrop-blur-xl p-4 md:p-8 overflow-hidden", className)}>
      <div className="w-full max-w-4xl h-full flex gap-6">
          
          {/* Left: Input Area */}
          <div className="flex-1 flex flex-col bg-stone-950 border border-stone-800 rounded-2xl p-6 shadow-2xl overflow-hidden relative">
            <h3 className="text-xl font-medium text-white mb-4 shrink-0 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Define Context
            </h3>
            
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4">
              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all shrink-0 h-32 group",
                  isDragging 
                    ? "border-purple-500 bg-purple-500/10" 
                    : "border-stone-800 hover:border-stone-600 hover:bg-stone-900"
                )}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  multiple 
                  onChange={handleFileSelect}
                />
                <Upload className={cn("w-8 h-8 mb-2 transition-colors", isDragging ? "text-purple-400" : "text-stone-500 group-hover:text-stone-400")} />
                <p className="text-stone-400 text-sm font-medium text-center group-hover:text-stone-300">
                  Upload Assets
                </p>
                <p className="text-stone-600 text-xs mt-1 text-center">
                  Drag & drop files
                </p>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 shrink-0 max-h-[60px] overflow-y-auto custom-scrollbar">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 bg-stone-900 px-3 py-1.5 rounded-lg border border-stone-800">
                      <FileText className="w-3 h-3 text-stone-400" />
                      <span className="text-xs text-stone-300 max-w-[120px] truncate">{file.name}</span>
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
              <div className="relative flex-1 min-h-[100px]">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Describe the scene context..."
                  className="w-full h-full bg-stone-900/50 border border-stone-800 rounded-xl p-4 text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 resize-none text-sm leading-relaxed"
                />
                
                <button
                  type="submit"
                  disabled={!text.trim() && files.length === 0}
                  className="absolute bottom-4 right-4 bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors shadow-lg"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>

          {/* Right: Analysis & Actions (Animates In) */}
          <AnimatePresence>
              {isAnalyzing && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20, width: 0 }}
                    animate={{ opacity: 1, x: 0, width: 320 }}
                    exit={{ opacity: 0, x: 20, width: 0 }}
                    className="h-full flex flex-col gap-4 shrink-0"
                  >
                      {/* Analysis Card */}
                      <div className="flex-1 bg-stone-950/50 border border-stone-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm flex flex-col overflow-hidden">
                          {/* Refined Header (No "Asset Analysis" text as requested, just icon or subtler) */}
                          <div className="flex items-center justify-between mb-4 border-b border-stone-800 pb-3">
                              <div className="flex items-center gap-2 text-purple-400">
                                  <Sparkles className="w-4 h-4" />
                                  <span className="text-xs font-bold uppercase tracking-wider">AI Insights</span>
                              </div>
                              {/* Subtle loader only if text is still generating, hard to track exact end here so skipping or could add state */}
                          </div>
                          
                          <div className="flex-1 overflow-y-auto font-mono text-xs text-stone-300 leading-loose whitespace-pre-wrap">
                              {analysisText}
                              <span className="inline-block w-1.5 h-3 bg-purple-500 ml-1 animate-pulse align-middle"/>
                          </div>
                      </div>

                      {/* Refine Action - More Refined Button */}
                      <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        onClick={() => files.length > 0 && onRefineAsset(files[0])}
                        className="group h-14 relative overflow-hidden bg-white text-black rounded-xl font-semibold shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center justify-between px-6"
                      >
                          <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-blue-50 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="relative z-10">Refine Asset</span>
                          <ArrowUpRight className="relative z-10 w-5 h-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                      </motion.button>
                  </motion.div>
              )}
          </AnimatePresence>

      </div>
    </div>
  );
}

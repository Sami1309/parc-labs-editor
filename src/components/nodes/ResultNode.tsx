import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ExternalLink, Image as ImageIcon, Loader2, Sparkles, Layers, X, Maximize2, ChevronLeft, ChevronRight, Film, Search, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ResultNode = ({ data, isConnectable, id }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [researchInput, setResearchInput] = useState('');

  // Handle Asset Node Display
  if (data.type === 'asset') {
    const images = data.assets || [];
    const currentImage = images[currentImageIndex];

    const handleResearchSubmit = (prompt: string) => {
        if (data.onResearch) {
            data.onResearch(id, prompt);
        }
    };

    return (
      <>
        <motion.div 
          layout // Enable layout animations
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ 
              opacity: 1, 
              scale: 1,
              width: isExpanded ? 500 : 320, // Expand width
              height: isExpanded ? 600 : 'auto', // Expand height (increased for controls)
              zIndex: isExpanded ? 50 : 1 
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={`bg-stone-900 rounded-xl shadow-xl border border-stone-700 overflow-hidden group relative`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={(e) => {
              e.stopPropagation(); // Prevent flow click
              if (!isExpanded) {
                  setIsExpanded(true);
              }
          }}
        >
          <Handle type="target" position={Position.Top} className="w-3 h-3 bg-stone-600 !-top-1.5" />
          
          {/* Header */}
          <div className="p-3 border-b border-stone-800 flex items-center justify-between bg-stone-900/90 backdrop-blur-sm z-10 relative">
              <div className="flex items-center text-stone-200">
                  <Layers className="w-4 h-4 mr-2 text-purple-400" />
                  <span className="text-xs font-bold uppercase tracking-wider">Asset Collection</span>
              </div>
              <div className="flex items-center space-x-2">
                {data.url && (
                    <a 
                        href={data.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-stone-400 hover:text-white transition-colors mr-2"
                        title="View Source"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </a>
                )}
                {data.isLoading && (
                    <div className="flex items-center mr-2">
                        <Loader2 className="w-3 h-3 text-purple-400 animate-spin mr-1" />
                        <span className="text-[10px] text-purple-300">{data.loadingText || 'Researching...'}</span>
                    </div>
                )}
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }}
                    className="text-stone-400 hover:text-white transition-colors"
                >
                    {isExpanded ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
          </div>

          {/* Content Area */}
          <div className="relative bg-stone-800 overflow-hidden flex flex-col h-full">
              
              {/* Expanded View: Main Image + Thumbnails */}
              {isExpanded ? (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="flex-1 flex flex-col p-4 overflow-hidden"
                  >
                      {/* Main Image Stage */}
                      <div className="relative flex-shrink-0 h-64 flex items-center justify-center bg-black/20 rounded-lg mb-4 overflow-hidden">
                          <AnimatePresence mode='wait'>
                              <motion.img 
                                  key={currentImageIndex}
                                  src={currentImage} 
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="max-w-full max-h-full object-contain"
                                  alt=""
                                  onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                              />
                          </AnimatePresence>
                          
                          {/* Nav Arrows */}
                          <button 
                              onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                              }}
                              className="absolute left-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                          >
                              <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button 
                              onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                              }}
                              className="absolute right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                          >
                              <ChevronRight className="w-5 h-5" />
                          </button>
                      </div>

                      {/* Thumbnails */}
                      <div className="flex space-x-2 overflow-x-auto h-16 pb-2 flex-shrink-0">
                          {images.map((img: string, i: number) => (
                              <button 
                                  key={i}
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      setCurrentImageIndex(i);
                                  }}
                                  className={`relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${i === currentImageIndex ? 'border-purple-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
                              >
                                  <img 
                                    src={img} 
                                    className="w-full h-full object-cover" 
                                    alt="" 
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                                    }}
                                  />
                              </button>
                          ))}
                      </div>
                      
                      {/* Text Content in Expanded Mode - Scrollable */}
                      <div className="mt-2 text-stone-300 text-xs leading-relaxed border-t border-stone-700 pt-2 overflow-y-auto flex-1 max-h-32 pr-2">
                          <h3 className="font-bold text-white mb-1">{data.title}</h3>
                          <p>{data.content}</p>
                      </div>

                      {/* In-Node Research Controls */}
                      <div className="mt-4 pt-3 border-t border-stone-700">
                          <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-2">
                              Explore Further
                          </label>
                          <div className="flex space-x-2 mb-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleResearchSubmit("Find more similar images"); }}
                                className="flex-1 bg-stone-700 hover:bg-stone-600 text-stone-300 text-[10px] py-1.5 px-2 rounded flex items-center justify-center transition-colors"
                              >
                                  <ImageIcon className="w-3 h-3 mr-1" /> Similar Images
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleResearchSubmit(`Find related videos about ${data.title || 'this topic'}`); }}
                                className="flex-1 bg-stone-700 hover:bg-stone-600 text-stone-300 text-[10px] py-1.5 px-2 rounded flex items-center justify-center transition-colors"
                              >
                                  <Film className="w-3 h-3 mr-1" /> Related Videos
                              </button>
                          </div>
                          <div className="relative">
                              <input 
                                type="text" 
                                value={researchInput}
                                onChange={(e) => setResearchInput(e.target.value)}
                                placeholder="Or type a specific request..."
                                className="w-full bg-stone-950 border border-stone-700 rounded px-2 py-1.5 text-xs text-stone-300 placeholder-stone-600 focus:outline-none focus:border-purple-500"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && researchInput.trim()) {
                                        handleResearchSubmit(researchInput);
                                        setResearchInput('');
                                    }
                                }}
                              />
                              <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (researchInput.trim()) {
                                        handleResearchSubmit(researchInput);
                                        setResearchInput('');
                                    }
                                }}
                                className="absolute right-1 top-1 p-0.5 bg-purple-600 text-white rounded hover:bg-purple-500"
                              >
                                  <ArrowRight className="w-3 h-3" />
                              </button>
                          </div>
                      </div>
                  </motion.div>
              ) : (
                  /* Collapsed View: Grid */
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-2 gap-0.5 h-48"
                  >
                      {images.slice(0, 4).map((img: string, i: number) => (
                          <div key={i} className="relative overflow-hidden">
                              <img 
                                src={img} 
                                className="w-full h-full object-cover" 
                                alt="" 
                                onError={(e) => {
                                    (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                                }}
                              />
                          </div>
                      ))}
                  </motion.div>
              )}
          </div>

          {/* Footer (Collapsed Only) */}
          {!isExpanded && (
              <div className="p-4 bg-stone-900 relative z-10">
                  <h3 className="text-sm font-bold text-white mb-1">{data.title}</h3>
                  <p className="text-xs text-stone-400 line-clamp-2">{data.content}</p>
              </div>
          )}

          <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-stone-600 !-bottom-1.5" />
        </motion.div>
        
        {/* Backdrop for expanded state */}
        {isExpanded && (
            <div 
                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" 
                onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                }} 
            />
        )}
      </>
    );
  }

  // Standard Finding Node
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`w-72 bg-white rounded-xl shadow-lg border ${data.isLoading ? 'border-blue-400 ring-2 ring-blue-100' : 'border-stone-200'} overflow-hidden hover:shadow-xl transition-all`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-stone-400 !-top-1.5" />
      
      <div className="h-32 bg-stone-100 relative overflow-hidden group">
        {data.imageUrl ? (
          <img 
            src={data.imageUrl} 
            alt={data.label} 
            className="w-full h-full object-cover"
            onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`absolute inset-0 flex items-center justify-center ${data.imageUrl ? 'hidden' : ''}`}>
            <ImageIcon className="w-8 h-8 text-stone-300" />
        </div>
        
        {/* Loading Overlay */}
        {data.isLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                <span className="text-xs font-bold text-blue-600 px-4 text-center">{data.loadingText || 'Researching...'}</span>
            </div>
        )}
      </div>

      <div className="p-4 relative">
        <h3 className="text-sm font-bold text-stone-800 leading-tight line-clamp-2 mb-2">
          {data.title || data.label}
        </h3>
        <p className="text-xs text-stone-600 leading-relaxed mb-3 line-clamp-3">
          {data.content}
        </p>

        {/* Hover Action Hint */}
        <AnimatePresence>
            {isHovered && !data.isLoading && (
                <motion.div 
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 10, opacity: 0 }}
                    className="absolute bottom-2 right-2 flex gap-2"
                >
                    {data.url && (
                        <a 
                            href={data.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center px-2 py-1 rounded-full bg-stone-100 text-stone-600 text-[10px] font-bold shadow-sm border border-stone-200 hover:bg-stone-200 transition-colors"
                        >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Source
                        </a>
                    )}
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold shadow-sm border border-blue-100">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Deep Dive
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
      
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-stone-400 !-bottom-1.5" />
    </motion.div>
  );
};

export default memo(ResultNode);

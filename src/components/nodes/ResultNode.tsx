import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ExternalLink, Image as ImageIcon, Loader2, Sparkles, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ResultNode = ({ data, isConnectable, id }: any) => {
  const [isHovered, setIsHovered] = useState(false);

  // Handle Asset Node Display
  if (data.type === 'asset') {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-80 bg-stone-900 rounded-xl shadow-xl border border-stone-700 overflow-hidden group relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-stone-600 !-top-1.5" />
        
        <div className="p-3 border-b border-stone-800 flex items-center justify-between">
            <div className="flex items-center text-stone-200">
                <Layers className="w-4 h-4 mr-2 text-purple-400" />
                <span className="text-xs font-bold uppercase tracking-wider">Asset Collection</span>
            </div>
            {data.isLoading && <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />}
        </div>

        {/* Grid of images */}
        <div className="grid grid-cols-2 gap-0.5 h-48 bg-stone-800">
            {data.assets?.slice(0, 4).map((img: string, i: number) => (
                <div key={i} className="relative overflow-hidden">
                    <img src={img} className="w-full h-full object-cover" alt="" />
                </div>
            ))}
        </div>

        <div className="p-4">
            <h3 className="text-sm font-bold text-white mb-1">{data.title}</h3>
            <p className="text-xs text-stone-400 line-clamp-2">{data.content}</p>
        </div>

        {/* Expand Overlay */}
        <AnimatePresence>
            {isHovered && !data.isLoading && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"
                >
                    <div className="text-white text-xs font-bold flex items-center">
                        <Sparkles className="w-4 h-4 mr-2 text-purple-400" />
                        Click to Explore
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-stone-600 !-bottom-1.5" />
      </motion.div>
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
          />
        ) : (
            <div className="absolute inset-0 flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-stone-300" />
            </div>
        )}
        
        {/* Loading Overlay */}
        {data.isLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                <span className="text-xs font-bold text-blue-600">Researching...</span>
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
                    className="absolute bottom-2 right-2"
                >
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

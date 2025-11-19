import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ExternalLink, FileText, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';

const ResultNode = ({ data, isConnectable }: any) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="w-72 bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden hover:shadow-xl transition-shadow"
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-stone-400 !-top-1.5"
      />
      
      {/* Image Section */}
      <div className="h-32 bg-stone-100 relative overflow-hidden group">
        {data.imageUrl ? (
          <img 
            src={data.imageUrl} 
            alt={data.label} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`absolute inset-0 flex items-center justify-center bg-stone-100 ${data.imageUrl ? 'hidden' : ''}`}>
          <ImageIcon className="w-8 h-8 text-stone-300" />
        </div>
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-full">
            {new URL(data.source || data.url).hostname.replace('www.', '')}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4">
        <div className="flex items-start mb-2">
          <h3 className="text-sm font-bold text-stone-800 leading-tight line-clamp-2">
            {data.label}
          </h3>
        </div>
        
        <p className="text-xs text-stone-600 leading-relaxed mb-3 line-clamp-4">
          {data.content}
        </p>

        {data.url && (
          <a 
              href={data.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center text-[10px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
              Read Source <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        )}
      </div>
    </motion.div>
  );
};

export default memo(ResultNode);

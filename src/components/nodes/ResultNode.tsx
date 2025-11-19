import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ExternalLink, FileText } from 'lucide-react';

const ResultNode = ({ data, isConnectable }: any) => {
  return (
    <div className="px-4 py-3 shadow-md rounded-lg bg-white border border-stone-200 w-64 hover:shadow-lg transition-shadow">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-2 h-2 bg-stone-400"
      />
      <div className="flex items-start mb-2">
        <div className="rounded-full bg-blue-50 p-1.5 mr-2 mt-0.5">
            <FileText className="w-3 h-3 text-blue-500" />
        </div>
        <div>
            <div className="text-xs font-bold text-stone-800 line-clamp-2">{data.label}</div>
            {data.source && (
                <div className="text-[10px] text-stone-500 mt-0.5">{new URL(data.source).hostname}</div>
            )}
        </div>
      </div>
      
      <div className="text-[10px] text-stone-600 line-clamp-3 mb-2 leading-relaxed">
        {data.content}
      </div>

      {data.url && (
        <a 
            href={data.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center text-[10px] text-blue-600 hover:underline mt-2 pt-2 border-t border-stone-100"
        >
            Visit Source <ExternalLink className="w-3 h-3 ml-1" />
        </a>
      )}
    </div>
  );
};

export default memo(ResultNode);


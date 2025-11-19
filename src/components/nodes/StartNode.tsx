import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Sparkles, Loader2 } from 'lucide-react';

const StartNode = ({ data, isConnectable }: any) => {
  return (
    <div className={`px-4 py-3 shadow-md rounded-lg bg-white border-2 ${data.isLoading ? 'border-blue-500 ring-2 ring-blue-100' : 'border-stone-400'} w-64 cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all group`}>
      <div className="flex items-center">
        <div className={`rounded-full p-2 mr-3 transition-colors flex-shrink-0 ${data.isLoading ? 'bg-blue-100' : 'bg-stone-100 group-hover:bg-blue-50'}`}>
            {data.isLoading ? (
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            ) : (
                <Sparkles className="w-5 h-5 text-stone-600 group-hover:text-blue-500" />
            )}
        </div>
        <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-stone-800 group-hover:text-stone-900 whitespace-normal break-words leading-tight">
                {data.isLoading ? 'Researching...' : 'Start Research'}
            </div>
            {data.isLoading && data.loadingText && (
                <div className="text-xs text-blue-600 animate-pulse mt-1 whitespace-normal break-words leading-tight">
                    {data.loadingText}
                </div>
            )}
            {!data.isLoading && (
                <div className="text-xs text-stone-500 mt-1">
                    Click to begin
                </div>
            )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className={`w-3 h-3 ${data.isLoading ? 'bg-blue-500' : 'bg-stone-500 group-hover:bg-blue-500'}`}
      />
    </div>
  );
};

export default memo(StartNode);

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Sparkles, Loader2, Play } from 'lucide-react';
import { Button } from '../ui/button';

const StartNode = ({ id, data, isConnectable }: any) => {
  const handleAutoStart = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (data.onStartAutoResearch) {
          data.onStartAutoResearch(id);
      }
  };

  return (
    <div className={`px-4 py-3 shadow-md rounded-lg bg-white border-2 ${data.isLoading ? 'border-blue-500 ring-2 ring-blue-100' : 'border-stone-400'} w-72 cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all group`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-lg overflow-hidden flex-shrink-0 border border-stone-200 ${data.imageUrl ? 'w-16 h-16' : 'w-10 h-10 flex items-center justify-center bg-stone-100 group-hover:bg-blue-50'}`}>
            {data.isLoading ? (
                <div className="w-full h-full flex items-center justify-center bg-blue-50">
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                </div>
            ) : data.imageUrl ? (
                <img src={data.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
                <Sparkles className="w-5 h-5 text-stone-600 group-hover:text-blue-500" />
            )}
        </div>
        <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-stone-800 group-hover:text-stone-900 leading-tight mb-1">
                {data.isLoading ? 'Researching...' : (data.label || 'Start Research')}
            </div>
            
            {data.isLoading && data.loadingText && (
                <div className="text-xs text-blue-600 animate-pulse mb-1 leading-tight">
                    {data.loadingText}
                </div>
            )}

            {!data.isLoading && data.content && (
                <div className="text-xs text-stone-500 line-clamp-2 mb-2">
                    {data.content}
                </div>
            )}
            
            {!data.isLoading && (data.imageUrl || data.content) && (
                <Button 
                    size="sm" 
                    className="w-full h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleAutoStart}
                >
                    <Play className="w-3 h-3 mr-1.5 fill-current" />
                    Auto-Research
                </Button>
            )}
            
            {!data.isLoading && !data.imageUrl && !data.content && (
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

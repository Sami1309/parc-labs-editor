import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Sparkles } from 'lucide-react';

const StartNode = ({ data, isConnectable }: any) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-stone-400 w-48 cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all group">
      <div className="flex items-center justify-center">
        <div className="rounded-full bg-stone-100 p-2 mr-2 group-hover:bg-blue-50 transition-colors">
            <Sparkles className="w-4 h-4 text-stone-600 group-hover:text-blue-500 transition-colors" />
        </div>
        <div className="text-sm font-bold text-stone-700 group-hover:text-stone-900">Start Research</div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-stone-500 group-hover:bg-blue-500"
      />
    </div>
  );
};

export default memo(StartNode);

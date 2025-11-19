'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Node } from '@xyflow/react';
import { Send, Sparkles, Image as ImageIcon, FileText, Loader2, Save, Layout } from 'lucide-react';
import { motion } from 'framer-motion';

interface StoryboardProps {
  researchNodes: Node[];
}

interface StoryboardScene {
  id: string;
  text: string;
  image?: string;
  notes?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function Storyboard({ researchNodes }: StoryboardProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [storyboard, setStoryboard] = useState<StoryboardScene[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Manual Chat State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I'm your storyboard assistant. I can help you turn your research into a compelling video narrative.\n\nPlease select a research finding from the right to get started."
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter relevant nodes (exclude start node)
  const relevantNodes = researchNodes.filter(n => n.type === 'result');

  // Context for the chat
  const selectedNode = researchNodes.find(n => n.id === selectedNodeId);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const append = (message: Omit<Message, 'id'>) => {
    const newMessage = { ...message, id: Date.now().toString() };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return;
    
    const userMsgObj = append({ role: 'user', content: userMessage });
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsgObj],
          data: {
            context: selectedNode 
                ? `Selected Research Node: "${selectedNode.data.title as string}"\nContent: ${selectedNode.data.content as string}\n\nUser is refining the storyboard idea.`
                : `Available Research Topics:\n${relevantNodes.map(n => `- ${n.data.title as string}`).join('\n')}`
          }
        })
      });

      if (!response.ok) throw new Error('Failed to fetch response');

      // Handle Streaming Response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) throw new Error('No reader available');

      const assistantMsgId = Date.now().toString();
      setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        
        setMessages(prev => prev.map(m => 
          m.id === assistantMsgId ? { ...m, content: fullContent } : m
        ));
      }

    } catch (error) {
      console.error('Chat error:', error);
      append({ role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    const node = researchNodes.find(n => n.id === nodeId);
    // Trigger a message from user about selection
    sendMessage(`I want to build a storyboard based on: "${node?.data.title as string}". What are some interesting angles or formats for this?`);
  };

  const handleGenerateStoryboard = async () => {
    if (!selectedNodeId) return;
    setIsGenerating(true);

    try {
      const response = await fetch('/api/storyboard-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          selectedNode: researchNodes.find(n => n.id === selectedNodeId)?.data
        })
      });

      if (response.ok) {
        const data = await response.json();
        setStoryboard(data.scenes);
      }
    } catch (e) {
      console.error("Error generating storyboard", e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-stone-50">
      {/* Left Panel: Chat */}
      <div className="w-1/3 min-w-[350px] border-r border-stone-200 flex flex-col bg-white">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <Sparkles className="w-4 h-4 text-purple-600" />
             <h2 className="font-semibold text-stone-800">Assistant</h2>
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user' 
                  ? 'bg-stone-900 text-white rounded-tr-none' 
                  : 'bg-stone-100 text-stone-800 rounded-tl-none'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
             <div className="flex justify-start">
                <div className="bg-stone-100 rounded-2xl px-4 py-3 rounded-tl-none flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin text-stone-400" />
                  <span className="text-xs text-stone-400">Thinking...</span>
                </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-stone-100">
          <form onSubmit={handleSubmit} className="relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
            />
            <button 
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-2 p-1.5 bg-white rounded-lg shadow-sm border border-stone-200 text-stone-400 hover:text-purple-600 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Right Panel: Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-stone-50">
        <div className="p-4 border-b border-stone-200 bg-white flex items-center justify-between">
            <h2 className="font-semibold text-stone-800 flex items-center gap-2">
              <Layout className="w-4 h-4 text-stone-500" />
              {selectedNodeId ? 'Storyboard Workspace' : 'Select Research'}
            </h2>
            {selectedNodeId && (
                <div className="flex items-center gap-2">
                   <button 
                     onClick={() => setSelectedNodeId(null)}
                     className="text-xs text-stone-500 hover:text-stone-800 px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors"
                   >
                     Change Research
                   </button>
                   <button
                     onClick={handleGenerateStoryboard}
                     disabled={isGenerating}
                     className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                   >
                     {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                     Generate Storyboard
                   </button>
                </div>
            )}
        </div>

        <div className="flex-1 overflow-y-auto p-8">
           {!selectedNodeId ? (
             /* Selection Grid */
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
               {relevantNodes.length === 0 ? (
                 <div className="col-span-full text-center py-20 text-stone-400">
                   <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                   <p>No research findings yet. Go back to Research view to discover content.</p>
                 </div>
               ) : (
                 relevantNodes.map(node => (
                   <motion.button
                     key={node.id}
                     onClick={() => handleNodeSelect(node.id)}
                     whileHover={{ y: -2 }}
                     className="text-left bg-white p-5 rounded-xl border border-stone-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all group h-full flex flex-col"
                   >
                     <div className="mb-3">
                       <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500 bg-purple-50 px-2 py-1 rounded-full">
                         {(node.data.type as string) || 'finding'}
                       </span>
                     </div>
                     <h3 className="font-bold text-stone-800 mb-2 line-clamp-2 group-hover:text-purple-700 transition-colors">
                       {node.data.title as string}
                     </h3>
                     <p className="text-sm text-stone-500 line-clamp-3 mb-4 flex-1">
                       {node.data.content as string}
                     </p>
                     {(node.data.imageUrl as string) && (
                       <div className="mt-auto pt-4 border-t border-stone-100">
                         <img src={node.data.imageUrl as string} alt="" className="w-full h-32 object-cover rounded-lg opacity-80 group-hover:opacity-100 transition-opacity" />
                       </div>
                     )}
                   </motion.button>
                 ))
               )}
             </div>
           ) : (
             /* Workspace / Generated Storyboard */
             <div className="max-w-4xl mx-auto">
               {storyboard.length > 0 ? (
                 <div className="space-y-8 pb-20">
                    {storyboard.map((scene, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={scene.id || idx} 
                        className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden flex flex-col md:flex-row"
                      >
                        <div className="md:w-1/3 bg-stone-100 relative min-h-[200px]">
                          {scene.image ? (
                             <img src={scene.image} alt="Scene visual" className="w-full h-full object-cover absolute inset-0" />
                          ) : (
                             <div className="absolute inset-0 flex items-center justify-center text-stone-300">
                               <ImageIcon className="w-8 h-8" />
                             </div>
                          )}
                          <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                            Scene {idx + 1}
                          </div>
                        </div>
                        <div className="md:w-2/3 p-6 flex flex-col justify-center">
                           <div className="prose prose-sm text-stone-600 mb-4">
                             <p className="whitespace-pre-wrap text-base leading-relaxed">{scene.text}</p>
                           </div>
                           {scene.notes && (
                             <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-lg border border-yellow-100 flex items-start gap-2">
                               <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                               {scene.notes}
                             </div>
                           )}
                        </div>
                      </motion.div>
                    ))}
                    
                    <div className="flex justify-end">
                       <button className="bg-stone-900 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-stone-700 transition-colors flex items-center gap-2">
                          <Save className="w-4 h-4" />
                          Save Storyboard
                       </button>
                    </div>
                 </div>
               ) : (
                 <div className="text-center py-20">
                    <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6">
                       <Sparkles className="w-8 h-8 text-purple-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-stone-800 mb-2">Drafting Mode</h3>
                    <p className="text-stone-500 max-w-md mx-auto mb-8">
                      Chat with the assistant to refine the direction for your storyboard. 
                      When you're ready, click "Generate Storyboard" in the top right.
                    </p>
                    
                    {selectedNode && (
                      <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm max-w-2xl mx-auto text-left">
                        <h4 className="font-bold text-stone-800 mb-2">{selectedNode.data.title as string}</h4>
                        <p className="text-stone-600 text-sm">{selectedNode.data.content as string}</p>
                      </div>
                    )}
                 </div>
               )}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

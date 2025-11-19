'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Node } from '@xyflow/react';
import { Send, Sparkles, Image as ImageIcon, FileText, Loader2, Save, Layout, Trash2, FolderOpen, ChevronDown, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { StoryboardScene, Message, SavedStoryboardSession } from '@/types';

interface StoryboardProps {
  researchNodes: Node[];
}

export function Storyboard({ researchNodes }: StoryboardProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [storyboard, setStoryboard] = useState<StoryboardScene[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string | null>(null);
  
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
  
  // Save/Load State
  const [savedSessions, setSavedSessions] = useState<SavedStoryboardSession[]>([]);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [sessionName, setSessionName] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter relevant nodes (exclude start node)
  const relevantNodes = researchNodes.filter(n => n.type === 'result');

  // Context for the chat
  const selectedNode = researchNodes.find(n => n.id === selectedNodeId);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load saved sessions
  useEffect(() => {
    const saved = localStorage.getItem('storyboard_sessions');
    if (saved) {
      try {
        setSavedSessions(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved storyboard sessions', e);
      }
    }
  }, []);

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
    // Generate a default session name based on node title
    if (!sessionName) {
        setSessionName(`Storyboard: ${node?.data.title as string}`.substring(0, 30) + '...');
    }
  };

  const handleGenerateStoryboard = async (mode: 'standard' | 'expand' = 'standard') => {
    if (!selectedNodeId) return;
    setIsGenerating(true);
    setGenerationStep(mode === 'expand' ? 'Expanding narrative...' : 'Initializing generation...');
    
    try {
      setGenerationStep('Analyzing conversation context...');
      await new Promise(r => setTimeout(r, 800));
      
      setGenerationStep('Retrieving visual assets via Exa...');
      
      const response = await fetch('/api/storyboard-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          selectedNode: researchNodes.find(n => n.id === selectedNodeId)?.data,
          mode // Pass the mode to the API
        })
      });

      setGenerationStep('Finalizing scenes...');
      
      if (response.ok) {
        const data = await response.json();
        setStoryboard(data.scenes);
      }
    } catch (e) {
      console.error("Error generating storyboard", e);
    } finally {
      setIsGenerating(false);
      setGenerationStep(null);
    }
  };

  const saveSession = () => {
      const nameToUse = sessionName || `Session ${new Date().toLocaleDateString()}`;
      const newSession: SavedStoryboardSession = {
          id: Date.now().toString(),
          name: nameToUse,
          selectedNodeId,
          messages,
          storyboard,
          timestamp: Date.now()
      };
      
      const updatedSessions = [...savedSessions.filter(s => s.id !== newSession.id), newSession];
      setSavedSessions(updatedSessions);
      localStorage.setItem('storyboard_sessions', JSON.stringify(updatedSessions));
      setSessionName(nameToUse);
      alert('Storyboard session saved!');
  };

  const loadSession = (session: SavedStoryboardSession) => {
      setSelectedNodeId(session.selectedNodeId);
      setMessages(session.messages);
      setStoryboard(session.storyboard);
      setSessionName(session.name);
      setShowLoadMenu(false);
  };

  const clearSession = () => {
      if (confirm('Are you sure you want to clear the current session? Unsaved changes will be lost.')) {
          setSelectedNodeId(null);
          setMessages([{
              id: 'welcome',
              role: 'assistant',
              content: "Hello! I'm your storyboard assistant. I can help you turn your research into a compelling video narrative.\n\nPlease select a research finding from the right to get started."
          }]);
          setStoryboard([]);
          setSessionName(null);
      }
  };

  return (
    <div className="flex h-full w-full bg-stone-50">
      {/* Left Panel: Chat */}
      <div className="w-1/3 min-w-[350px] border-r border-stone-200 flex flex-col bg-white">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
           <div className="flex items-center gap-2">
             <Sparkles className="w-4 h-4 text-purple-600" />
             <h2 className="font-semibold text-stone-800">Assistant</h2>
           </div>
           <div className="flex items-center gap-1">
                <button 
                    onClick={clearSession}
                    className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    title="New Session"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
                
                <div className="relative">
                    <button 
                        onClick={() => setShowLoadMenu(!showLoadMenu)}
                        className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-md transition-colors flex items-center gap-1"
                        title="Load Session"
                    >
                        <FolderOpen className="w-4 h-4" />
                        <ChevronDown className="w-3 h-3" />
                    </button>
                    
                    {showLoadMenu && (
                        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-stone-200 py-2 max-h-64 overflow-y-auto z-20">
                            {savedSessions.length === 0 ? (
                                <div className="px-4 py-2 text-sm text-stone-400">No saved sessions</div>
                            ) : (
                                savedSessions.map(session => (
                                    <button
                                        key={session.id}
                                        onClick={() => loadSession(session)}
                                        className="w-full text-left px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 flex items-center justify-between group"
                                    >
                                        <span className="truncate max-w-[140px]">{session.name}</span>
                                        <span className="text-xs text-stone-400">
                                            {new Date(session.timestamp).toLocaleDateString()}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <button 
                    onClick={saveSession}
                    disabled={!selectedNodeId} // Can't save empty session easily
                    className="p-1.5 text-stone-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors disabled:opacity-30"
                    title="Save Session"
                >
                    <Save className="w-4 h-4" />
                </button>
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/30">
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                m.role === 'user' 
                  ? 'bg-stone-900 text-white rounded-tr-none' 
                  : 'bg-white text-stone-800 rounded-tl-none border border-stone-100'
              }`}>
                <div className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:bg-stone-800 prose-pre:text-stone-100">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
             <div className="flex justify-start">
                <div className="bg-white border border-stone-100 rounded-2xl px-4 py-3 rounded-tl-none flex items-center gap-2 shadow-sm">
                  <Loader2 className="w-3 h-3 animate-spin text-purple-500" />
                  <span className="text-xs text-stone-500 font-medium">Thinking...</span>
                </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-stone-100 bg-white">
          <form onSubmit={handleSubmit} className="relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder-stone-400"
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
        <div className="p-4 border-b border-stone-200 bg-white flex items-center justify-between shadow-sm z-10">
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
                   {storyboard.length > 0 && (
                       <button
                            onClick={() => handleGenerateStoryboard('expand')}
                            disabled={isGenerating}
                            className="bg-stone-100 text-stone-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-stone-200 transition-colors flex items-center gap-2 disabled:opacity-50 border border-stone-200"
                        >
                            <Maximize2 className="w-3 h-3" />
                            Expand Story
                        </button>
                   )}
                   <button
                     onClick={() => handleGenerateStoryboard('standard')}
                     disabled={isGenerating}
                     className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm shadow-purple-200"
                   >
                     {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                     {isGenerating ? 'Generating...' : 'Generate Storyboard'}
                   </button>
                </div>
            )}
        </div>

        <div className="flex-1 overflow-y-auto p-8 relative">
           {/* Generation Overlay */}
           <AnimatePresence>
             {isGenerating && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center"
                >
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-stone-100 flex flex-col items-center max-w-md w-full">
                        <div className="relative w-16 h-16 mb-6">
                            <div className="absolute inset-0 border-4 border-stone-100 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
                            <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-purple-500 animate-pulse" />
                        </div>
                        <h3 className="text-lg font-bold text-stone-800 mb-2">Creating Storyboard</h3>
                        <p className="text-stone-500 text-center text-sm mb-6">
                            {generationStep || 'Processing...'}
                        </p>
                        
                        <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                            <motion.div 
                                className="h-full bg-purple-500"
                                initial={{ width: "0%" }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
                            />
                        </div>
                    </div>
                </motion.div>
             )}
           </AnimatePresence>

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
                        className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden flex flex-col md:flex-row group hover:shadow-md transition-shadow"
                      >
                        <div className="md:w-1/3 bg-stone-100 relative min-h-[200px]">
                          {scene.image ? (
                             <img src={scene.image} alt="Scene visual" className="w-full h-full object-cover absolute inset-0" />
                          ) : (
                             <div className="absolute inset-0 flex items-center justify-center text-stone-300 bg-stone-50">
                               <div className="text-center p-4">
                                   <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                   <span className="text-xs">No image available</span>
                               </div>
                             </div>
                          )}
                          <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm uppercase tracking-wider">
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
                               <span className="leading-relaxed">{scene.notes}</span>
                             </div>
                           )}
                        </div>
                      </motion.div>
                    ))}
                 </div>
               ) : (
                 <div className="text-center py-20">
                    <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                       <Sparkles className="w-8 h-8 text-purple-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-stone-800 mb-2">Drafting Mode</h3>
                    <p className="text-stone-500 max-w-md mx-auto mb-8 leading-relaxed">
                      Chat with the assistant to refine the direction for your storyboard. 
                      When you're ready, click <strong className="text-purple-600 font-medium">Generate Storyboard</strong> in the top right.
                    </p>
                    
                    {selectedNode && (
                      <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm max-w-2xl mx-auto text-left">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 bg-blue-50 px-2 py-1 rounded-full">
                                Active Context
                            </span>
                        </div>
                        <h4 className="font-bold text-stone-800 mb-2 text-lg">{selectedNode.data.title as string}</h4>
                        <p className="text-stone-600 text-sm leading-relaxed">{selectedNode.data.content as string}</p>
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

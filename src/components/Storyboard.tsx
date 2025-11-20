'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Node } from '@xyflow/react';
import { Send, Sparkles, Image as ImageIcon, FileText, Loader2, Save, Layout, Trash2, FolderOpen, ChevronDown, Maximize2, CheckCircle2, PlusCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { StoryboardScene, Message, SavedStoryboardSession } from '@/types';

interface StoryboardProps {
  researchNodes: Node[];
}

export function Storyboard({ researchNodes }: StoryboardProps) {
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [storyboard, setStoryboard] = useState<StoryboardScene[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string | null>(null);
  
  // Manual Chat State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I'm your storyboard assistant. I can help you turn your research into a compelling video narrative.\n\nI've analyzed your research. You can add more findings to the context from the right panel."
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Save/Load State
  const [savedSessions, setSavedSessions] = useState<SavedStoryboardSession[]>([]);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [sessionName, setSessionName] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter relevant nodes (results and start node)
  const relevantNodes = researchNodes.filter(n => n.type === 'result' || n.type === 'start');
  const startNode = researchNodes.find(n => n.type === 'start');

  // Context for the chat
  const selectedNodes = researchNodes.filter(n => selectedNodeIds.includes(n.id));
  
  // Initialize with Start Node if available and no selection made yet
  useEffect(() => {
    if (startNode && selectedNodeIds.length === 0 && messages.length === 1) {
        setSelectedNodeIds([startNode.id]);
        
        // Add the "modal/rectangle" message for the start node
        const initialContextMsg: Message = {
            id: 'initial-context',
            role: 'assistant',
            content: `**Starting Point: ${startNode.data.label || 'Research Topic'}**\n\n${startNode.data.content || 'Initial research hook'}`
        };
        
        // Insert after welcome message
        setMessages(prev => {
            if (prev.find(m => m.id === 'initial-context')) return prev;
            return [prev[0], initialContextMsg, ...prev.slice(1)];
        });

        if (!sessionName) {
            setSessionName(`Storyboard: ${(startNode.data.label as string) || 'Untitled'}`);
        }
    }
  }, [startNode, researchNodes]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // Construct context from all selected nodes
        const contextData = selectedNodes.length > 0 
            ? selectedNodes.map(node => `Node: "${node.data.title || node.data.label}"\nContent: ${node.data.content || ''}`).join('\n\n')
            : "No specific research nodes selected.";

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsgObj],
          data: {
            context: `Current Selected Context:\n${contextData}\n\nUser is refining the storyboard idea.`
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

  const toggleNodeSelection = (nodeId: string) => {
    setSelectedNodeIds(prev => {
        const isSelected = prev.includes(nodeId);
        if (isSelected) {
            return prev.filter(id => id !== nodeId);
        } else {
            return [...prev, nodeId];
        }
    });
  };

  const handleGenerateStoryboard = async (mode: 'standard' | 'expand' = 'standard') => {
    if (selectedNodeIds.length === 0) {
        alert("Please select at least one research node to generate a storyboard.");
        return;
    }
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
          selectedNode: selectedNodes[0]?.data, // Pass the primary node
          additionalContext: selectedNodes.map(n => n.data).slice(1),
          mode 
        })
      });

      setGenerationStep('Finalizing scenes...');
      
      if (response.ok) {
        const data = await response.json();
        if (data.scenes && Array.isArray(data.scenes)) {
             setStoryboard(data.scenes);
        } else {
             throw new Error('Invalid response format: ' + JSON.stringify(data));
        }
      } else {
        throw new Error(`Generation failed with status: ${response.status}`);
      }
    } catch (e: any) {
      console.error("Error generating storyboard", e);
      alert(`Failed to generate storyboard: ${e.message || 'Unknown error'}`);
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
          selectedNodeIds,
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
      // Handle legacy sessions with selectedNodeId
      const legacySession = session as any;
      const nodesToSelect = session.selectedNodeIds || (legacySession.selectedNodeId ? [legacySession.selectedNodeId] : []);
      
      setSelectedNodeIds(nodesToSelect);
      setMessages(session.messages);
      setStoryboard(session.storyboard);
      setSessionName(session.name);
      setShowLoadMenu(false);
  };

  const clearSession = () => {
      if (confirm('Are you sure you want to clear the current session? Unsaved changes will be lost.')) {
          setSelectedNodeIds([]);
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
                    disabled={selectedNodeIds.length === 0}
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
                  : m.id === 'initial-context'
                    ? 'bg-purple-50 text-stone-800 rounded-tl-none border border-purple-100 w-full'
                    : 'bg-white text-stone-800 rounded-tl-none border border-stone-100'
              }`}>
                 {m.id === 'initial-context' ? (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-purple-600 font-medium border-b border-purple-100 pb-2 mb-1">
                            <FileText className="w-4 h-4" />
                            <span>Research Context</span>
                        </div>
                        <div className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:bg-stone-800 prose-pre:text-stone-100">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                    </div>
                 ) : (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:bg-stone-800 prose-pre:text-stone-100">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                 )}
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
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-4 pr-12 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder-stone-400"
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
              Storyboard Workspace
              <span className="text-xs font-normal text-stone-400 ml-2">
                ({selectedNodeIds.length} selected)
              </span>
            </h2>
            <div className="flex items-center gap-2">
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
                    disabled={isGenerating || selectedNodeIds.length === 0}
                    className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm shadow-purple-200"
                >
                    {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {isGenerating ? 'Generating...' : 'Generate Storyboard'}
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 relative">
           <div className="flex gap-6 h-full">
             {/* Available Research / Context Selection */}
             <div className="w-1/3 min-w-[250px] overflow-y-auto pr-2 space-y-3">
                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 sticky top-0 bg-stone-50 py-2 z-10">
                    Available Research
                </h3>
                {relevantNodes.length === 0 ? (
                    <div className="text-center py-10 text-stone-400 bg-white rounded-lg border border-stone-200 border-dashed">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-xs">No findings yet</p>
                    </div>
                ) : (
                    relevantNodes.map(node => {
                        const isSelected = selectedNodeIds.includes(node.id);
                        const data = node.data as any;
                        return (
                            <div 
                                key={node.id}
                                className={`bg-white p-2 rounded-lg border transition-all group ${
                                    isSelected 
                                        ? 'border-purple-500 ring-1 ring-purple-100 shadow-sm' 
                                        : 'border-stone-200 hover:border-stone-300'
                                }`}
                            >
                                <div className="flex justify-between items-start gap-2 mb-1">
                                    <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                                        node.type === 'start' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                                    }`}>
                                        {node.type === 'start' ? 'HOOK' : (data.type || 'finding')}
                                    </span>
                                    <button
                                        onClick={() => toggleNodeSelection(node.id)}
                                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md transition-colors flex items-center gap-1 ${
                                            isSelected
                                                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                        }`}
                                    >
                                        {isSelected ? <CheckCircle2 className="w-3 h-3" /> : <PlusCircle className="w-3 h-3" />}
                                        {isSelected ? 'Added' : 'Add'}
                                    </button>
                                </div>
                                <h4 className="font-bold text-stone-800 text-xs mb-1 line-clamp-2">
                                    {data.title || data.label}
                                </h4>
                                <p className="text-[10px] text-stone-500 line-clamp-2">
                                    {data.content}
                                </p>
                                {data.imageUrl && (
                                    <div className="mt-2 h-16 rounded bg-stone-100 overflow-hidden">
                                        <img src={data.imageUrl} alt="" className="w-full h-full object-cover opacity-90" />
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
             </div>

             {/* Storyboard Preview Area */}
             <div className="flex-1 h-full overflow-y-auto">
               {isGenerating ? (
                   <div className="h-full flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm rounded-xl border-2 border-dashed border-purple-200">
                       <div className="relative w-16 h-16 mb-6">
                            <div className="absolute inset-0 border-4 border-stone-100 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
                            <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-purple-500 animate-pulse" />
                        </div>
                        <h3 className="text-lg font-bold text-stone-800 mb-2">Creating Storyboard</h3>
                        <p className="text-stone-500 text-center text-sm max-w-xs animate-pulse">
                            {generationStep || 'Processing...'}
                        </p>
                   </div>
               ) : storyboard.length > 0 ? (
                 <div className="space-y-6 pb-20">
                    {storyboard.map((scene, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={scene.id || idx} 
                        className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden flex flex-col md:flex-row group hover:shadow-md transition-shadow"
                      >
                        <div className="md:w-1/3 bg-stone-100 relative min-h-[150px]">
                          {scene.image ? (
                             <img src={scene.image} alt="Scene visual" className="w-full h-full object-cover absolute inset-0" />
                          ) : (
                             <div className="absolute inset-0 flex items-center justify-center text-stone-300 bg-stone-50">
                               <div className="text-center p-4">
                                   <ImageIcon className="w-6 h-6 mx-auto mb-2 opacity-50" />
                                   <span className="text-[10px]">No image</span>
                               </div>
                             </div>
                          )}
                          <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm uppercase tracking-wider">
                            Scene {idx + 1}
                          </div>
                        </div>
                        <div className="md:w-2/3 p-5 flex flex-col justify-center">
                           <div className="prose prose-sm text-stone-600 mb-3">
                             <p className="whitespace-pre-wrap text-sm leading-relaxed">{scene.text}</p>
                           </div>
                           {scene.notes && (
                             <div className="bg-yellow-50 text-yellow-800 text-[10px] p-2 rounded-lg border border-yellow-100 flex items-start gap-2">
                               <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                               <span className="leading-relaxed">{scene.notes}</span>
                             </div>
                           )}
                        </div>
                      </motion.div>
                    ))}
                 </div>
               ) : (
                 <div className="h-full flex flex-col items-center justify-center text-center text-stone-400 p-8 border-2 border-dashed border-stone-200 rounded-xl bg-stone-50/50">
                    <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mb-4">
                       <Layout className="w-6 h-6 text-purple-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-stone-600 mb-1">Empty Storyboard</h3>
                    <p className="text-sm max-w-xs mx-auto">
                        Select research nodes from the left and chat with the assistant to generate your storyboard.
                    </p>
                 </div>
               )}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}

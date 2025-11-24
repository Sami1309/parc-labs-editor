export interface StoryboardScene {
  id: string;
  text: string;
  image?: string;
  notes?: string;
}

export interface TimelineItem extends StoryboardScene {
  duration: number; // default to e.g. 5s
  audioUrl?: string;
  isGeneratingVisual?: boolean;
  isGeneratingAudio?: boolean;
  transition?: 'cut' | 'fade' | 'dissolve' | 'wipe'; 
  effect?: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static'; // New field
  type?: 'scene' | 'empty';
  contextData?: {
    text?: string;
    files?: File[]; // Note: File is not serializable for localStorage, need to handle this
    fileReferences?: { name: string, type: string, url?: string }[];
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface SavedStoryboardSession {
  id: string;
  name: string;
  storyboard: StoryboardScene[];
  messages: Message[];
  selectedNodeIds?: string[];
  selectedNodeId?: string; // legacy support
  timestamp: number;
}

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
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

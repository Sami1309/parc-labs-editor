export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface NodeData {
  label: string;
  content?: string;
  url?: string;
  source?: string;
  imageUrl?: string;
  // New fields
  type?: 'finding' | 'asset';
  assets?: string[]; // For asset nodes
  suggestedQuestion?: string;
  suggestedPaths?: string[];
  isLoading?: boolean; // For UI state
  [key: string]: any;
}

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
  transition?: 'cut' | 'fade' | 'dissolve' | 'wipe'; // New field
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface SavedStoryboardSession {
  id: string;
  name: string;
  selectedNodeIds: string[];
  messages: Message[];
  storyboard: StoryboardScene[];
  timestamp: number;
}

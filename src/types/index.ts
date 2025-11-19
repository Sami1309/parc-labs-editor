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

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
  [key: string]: any;
}


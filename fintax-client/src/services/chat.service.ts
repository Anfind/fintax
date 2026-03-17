import api from './api';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  chartData?: ChartData | null;
  responsePayload?: AssistantResponsePayload | null;
  timestamp: string;
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area' | 'composed';
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  label?: string;
}

export interface MermaidBlock {
  code: string;
}

export interface ImageBlock {
  url: string;
  alt?: string;
  caption?: string;
  mimeType?: string;
}

export interface AssistantResponsePayload {
  markdown: string;
  charts: ChartData[];
  mermaid: MermaidBlock[];
  images: ImageBlock[];
  confidence: number;
}

export interface ChatSession {
  _id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  updatedAt: string;
}

export interface ChatDetail {
  _id: string;
  title: string;
  messages: ChatMessage[];
}

export interface SendMessageResponse {
  chatId: string;
  response: string;
  chartData: ChartData | ChartData[] | null;
  responsePayload: AssistantResponsePayload | null;
  intent: string;
}

export const chatService = {
  getHistory: () => api.get<{ data: ChatSession[] }>('/chat/history'),

  getChatById: (chatId: string) => api.get<{ data: ChatDetail }>(`/chat/${chatId}`),

  sendMessage: (params: { chatId?: string; message: string }) =>
    api.post<{ data: SendMessageResponse }>('/chat/message', params),

  deleteChat: (chatId: string) => api.delete(`/chat/${chatId}`),
};

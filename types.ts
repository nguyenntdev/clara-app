export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  files?: UploadedFile[];
  suggestedQuestions?: string[];
}

export interface UploadedFile {
  id: string;
  name: string;
  url?: string;
  type: 'image' | 'document' | 'audio' | 'video';
  mimeType?: string;
}

export interface AppState {
  currentView: 'landing' | 'research' | 'scribe';
  apiKey: string | null;
}

export interface DifyResponse {
  event: string;
  task_id: string;
  id: string;
  answer: string;
  created_at: number;
  conversation_id: string;
  metadata?: {
    retriever_resources?: Array<{
        position: number;
        dataset_name: string;
        content: string;
        score: number;
    }>;
    usage?: any;
  };
}

export interface AppParameters {
  opening_statement: string;
  suggested_questions: string[];
  suggested_questions_after_answer: {
      enabled: boolean;
  };
  speech_to_text: {
      enabled: boolean;
  };
  retriever_resource: {
      enabled: boolean;
  };
  user_input_form: Array<any>;
}

export interface TTSSettings {
  enabled: boolean;
  autoPlay: boolean;
  lang: string;
  voiceURI: string | null;
  rate: number;
  pitch: number;
}

export const CONSTANTS = {
  API_ENDPOINT: 'https://dify.thiennn.icu/v1',
  KEYS: {
    RESEARCH: 'app-PvUMjA7ardT6ccfrEMmnfIPG',
    SCRIBE: 'app-vBOnBtyJY0KyTk3pbzt3dlNB'
  }
};
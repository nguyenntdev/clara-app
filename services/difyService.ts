import { CONSTANTS, AppParameters, Message, UploadedFile } from '../types';

// Helper to generate a random user ID for the session
const getUserId = () => {
  let userId = localStorage.getItem('clara_user_id');
  if (!userId) {
    userId = `user_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('clara_user_id', userId);
  }
  return userId;
};

// Timeout helper (Default 300s)
const fetchWithTimeout = async (resource: string, options: RequestInit & { timeout?: number } = {}) => {
  const { timeout = 300000, ...rest } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
      const response = await fetch(resource, {
        ...rest,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
  } catch (error: any) {
      clearTimeout(id);
      if (error.name === 'AbortError') {
          throw new Error('Request timed out after 300 seconds');
      }
      throw error;
  }
};

export const fetchAppParams = async (apiKey: string): Promise<AppParameters> => {
    const url = `${CONSTANTS.API_ENDPOINT}/parameters?user=${getUserId()}`;
    try {
        const response = await fetchWithTimeout(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch app parameters');
        return await response.json();
    } catch (error) {
        console.error("Params fetch error:", error);
        // Fallback default
        return {
            opening_statement: "System Online.",
            suggested_questions: [],
            suggested_questions_after_answer: { enabled: false },
            speech_to_text: { enabled: false },
            retriever_resource: { enabled: false },
            user_input_form: []
        };
    }
};

export const fetchHistory = async (apiKey: string, conversationId: string): Promise<Message[]> => {
    const url = `${CONSTANTS.API_ENDPOINT}/messages?user=${getUserId()}&conversation_id=${conversationId}&limit=20`;
    try {
        const response = await fetchWithTimeout(url, {
             method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        if (!response.ok) return [];
        const data = await response.json();
        
        // Map Dify messages to local Message format
        // Dify returns { data: [...] } where items have query (user) and answer (bot)
        // We need to flatten this into our message list
        const messages: Message[] = [];
        // Iterate reverse because they often come newest first, we want oldest first
        for (let i = data.data.length - 1; i >= 0; i--) {
            const item = data.data[i];
            
            // User message
            messages.push({
                id: `u_${item.id}`,
                role: 'user',
                content: item.query,
                timestamp: item.created_at * 1000,
                files: item.message_files?.map((f: any) => ({
                    id: f.id,
                    name: f.filename || 'file',
                    type: f.type === 'image' ? 'image' : 'document',
                    url: f.url
                }))
            });

            // Assistant message
            if (item.answer) {
                 messages.push({
                    id: `a_${item.id}`,
                    role: 'assistant',
                    content: item.answer,
                    timestamp: item.created_at * 1000 + 1 // Ensure slightly after
                });
            }
        }
        return messages;
    } catch (error) {
        console.error('History fetch error', error);
        return [];
    }
};

export const sendMessageToDify = async (
  apiKey: string,
  query: string,
  conversationId: string | null,
  files: { type: string; transfer_method: string; url?: string; upload_file_id?: string }[] = []
) => {
  const url = `${CONSTANTS.API_ENDPOINT}/chat-messages`;
  
  // Fix for "contents are required" error from some LLMs (like Gemini)
  // If query is empty but we have files, provide a default prompt description.
  let finalQuery = query;
  if (!finalQuery.trim() && files.length > 0) {
      const fileTypes = files.map(f => f.type);
      if (fileTypes.includes('image')) finalQuery = "Please analyze the attached image.";
      else if (fileTypes.includes('audio')) finalQuery = "Please transcribe and analyze the attached audio.";
      else finalQuery = "Please analyze the attached document.";
  }
  
  const body = {
    inputs: {}, 
    query: finalQuery,
    response_mode: 'blocking', 
    conversation_id: conversationId || "",
    user: getUserId(),
    files: files.map(f => ({
      // Actually, for Dify v1, 'type' should be 'image' for vision, or handled by tools. 
      // If we are uploading to a knowledge base or tool, it handles differently.
      // For safety in this generic client, if it's an image, send 'image'. If document, Dify usually takes it as context if configured.
      // Let's pass the type as is if supported, else 'image' is the safest 'file' type key for Dify Chat unless using 'document' feature.
      type: 'image', // Forcing image type structure for file attachment compatibility in simple chat mode
      transfer_method: f.transfer_method, 
      upload_file_id: f.upload_file_id
    }))
  };

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Failed to send message');
    }

    return await response.json();
  } catch (error) {
    console.error('Dify API Error:', error);
    throw error;
  }
};

export const uploadFileToDify = async (apiKey: string, file: File, user: string) => {
  const url = `${CONSTANTS.API_ENDPOINT}/files/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('user', user);

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('File upload failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Upload Error:', error);
    throw error;
  }
};
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { UserPreferences } from '../types';

export interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Returns whether the AI System is configured and enabled.
 */
export function isAiSystemActive(preferences: UserPreferences): boolean {
  if (preferences.aiEnabled === false) return false;
  return true;
}

/**
 * Returns the currently active provider name.
 */
export function getActiveProvider(preferences: UserPreferences): 'gemini' | 'openai' | 'claude' | 'openrouter' {
  return preferences.aiProvider || 'gemini';
}

/**
 * Returns the active model for the configured provider.
 */
export function getActiveModel(preferences: UserPreferences): string {
  if (preferences.aiModel) return preferences.aiModel;
  
  const provider = getActiveProvider(preferences);
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'claude':
      return 'claude-3-5-haiku-20241022';
    case 'openrouter':
      return 'google/gemini-2.5-flash';
    case 'gemini':
    default:
      return 'gemini-2.5-flash';
  }
}

/**
 * Gets the active API key for the selected provider.
 */
export function getActiveApiKey(preferences: UserPreferences): string {
  const provider = getActiveProvider(preferences);
  switch (provider) {
    case 'openai':
      return preferences.openaiApiKey || '';
    case 'claude':
      return preferences.claudeApiKey || '';
    case 'openrouter':
      return preferences.openrouterApiKey || '';
    case 'gemini':
    default:
      return preferences.geminiApiKey || preferences.customApiKey || '';
  }
}

/**
 * Central function to query the selected AI provider.
 */
export async function callAiSystem(
  messages: AiMessage[],
  preferences: UserPreferences,
  customSystemInstruction?: string
): Promise<string> {
  if (!isAiSystemActive(preferences)) {
    throw new Error('AI System is currently disabled in Settings.');
  }

  const provider = getActiveProvider(preferences);
  const model = getActiveModel(preferences);
  const apiKey = getActiveApiKey(preferences);

  if (!apiKey) {
    throw new Error(`API Key for ${provider.toUpperCase()} is not configured. Please open Settings or AI System to enter your key.`);
  }

  // Handle system instructions
  const systemMsg = messages.find(m => m.role === 'system');
  const systemText = systemMsg?.content || customSystemInstruction || 'You are an elegant, helpful co-pilot inside AetherOS.';
  
  // Filter out system message from content arrays where required
  const conversationMessages = messages.filter(m => m.role !== 'system');

  switch (provider) {
    case 'gemini': {
      try {
        const ai = new GoogleGenAI({ apiKey });
        
        // Map roles for Gemini: 'user' or 'model'
        const contents = conversationMessages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

        const response = await ai.models.generateContent({
          model: model,
          contents: contents,
          config: {
            systemInstruction: systemText,
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        });

        if (!response.text) {
          throw new Error('Empty response received from Gemini.');
        }
        return response.text;
      } catch (err: any) {
        console.error('Gemini call error:', err);
        throw new Error(err.message || 'Gemini generation failed.');
      }
    }

    case 'openai': {
      try {
        const payloadMessages = [];
        if (systemText) {
          payloadMessages.push({ role: 'system', content: systemText });
        }
        conversationMessages.forEach(m => {
          payloadMessages.push({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
          });
        });

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: payloadMessages,
            temperature: 0.7,
            max_tokens: 2048
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `OpenAI returned status ${res.status}`);
        }

        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (!text) {
          throw new Error('Empty response from OpenAI.');
        }
        return text;
      } catch (err: any) {
        console.error('OpenAI call error:', err);
        throw new Error(err.message || 'OpenAI call failed.');
      }
    }

    case 'claude': {
      try {
        const payloadMessages: any[] = conversationMessages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }));

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: model,
            system: systemText,
            messages: payloadMessages,
            max_tokens: 2048,
            temperature: 0.7
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Claude API returned status ${res.status}`);
        }

        const data = await res.json();
        const text = data?.content?.[0]?.text;
        if (!text) {
          throw new Error('Empty response from Claude.');
        }
        return text;
      } catch (err: any) {
        console.error('Claude call error:', err);
        throw new Error(err.message || 'Claude call failed.');
      }
    }

    case 'openrouter': {
      try {
        const payloadMessages = [];
        if (systemText) {
          payloadMessages.push({ role: 'system', content: systemText });
        }
        conversationMessages.forEach(m => {
          payloadMessages.push({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
          });
        });

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://ai.studio/build',
            'X-Title': 'AetherOS'
          },
          body: JSON.stringify({
            model: model,
            messages: payloadMessages,
            temperature: 0.7,
            max_tokens: 2048
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `OpenRouter returned status ${res.status}`);
        }

        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (!text) {
          throw new Error('Empty response from OpenRouter.');
        }
        return text;
      } catch (err: any) {
        console.error('OpenRouter call error:', err);
        throw new Error(err.message || 'OpenRouter call failed.');
      }
    }

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

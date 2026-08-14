/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.ts';

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    if (!env.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    aiClient = new GoogleGenAI({
      apiKey: env.gemini.apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'hnxcis-backend',
        },
      },
    });
  }
  return aiClient;
}

/** Gemini occasionally wraps JSON in a markdown fence — unwrap before parsing. */
export function parseJsonResponse<T>(text: string | undefined): T {
  const raw = (text ?? '').trim();
  if (!raw) return {} as T;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : raw;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    }
    throw new Error('Gemini trả về nội dung không phải JSON hợp lệ.');
  }
}

export async function generateText(systemInstruction: string, contents: string): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: env.gemini.model,
    contents,
    config: { systemInstruction },
  });
  return response.text ?? '';
}

export async function generateJson<T>(systemInstruction: string, contents: string): Promise<T> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: env.gemini.model,
    contents,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
    },
  });
  return parseJsonResponse<T>(response.text);
}

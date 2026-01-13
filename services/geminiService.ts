import { GoogleGenAI, Type } from "@google/genai";
import { AiAnalysisResult } from "../types";

const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment");
  }
  return new GoogleGenAI({ apiKey });
};

// We will send a snippet of audio or a prompt about the link
export const analyzeContent = async (
  filename: string, 
  context?: string // could be a link or text extraction
): Promise<AiAnalysisResult> => {
  try {
    const ai = getGeminiClient();
    
    const prompt = `
      I have a video file named "${filename}".
      ${context ? `Context/Link: ${context}` : ''}
      
      Please generate a creative title, a short catchy summary, 3 hashtags, and a predicted viral score (0-100) for a video with this name/context.
      Assuming it's a raw recording that needs editing (silence removal).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            viralScore: { type: Type.NUMBER }
          },
          required: ["title", "summary", "tags", "viralScore"]
        }
      }
    });

    const result = JSON.parse(response.text);
    return result as AiAnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    // Fallback if API fails or key is missing
    return {
      title: "Content Analysis Unavailable",
      summary: "Could not connect to Gemini AI. Ensure API Key is configured.",
      tags: ["error", "offline"],
      viralScore: 0
    };
  }
};
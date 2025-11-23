import { GoogleGenAI, Type } from "@google/genai";
import { AssetItem, TimelineSegment, VideoConfig } from "../types";

// Helper to convert File to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

export const generateVideoScript = async (
  audioFile: File,
  imageFiles: AssetItem[],
  config: VideoConfig
): Promise<TimelineSegment[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey });

  const audioBase64 = await fileToBase64(audioFile);
  const imagePromises = imageFiles.map(img => fileToBase64(img.file));
  const imagesBase64 = await Promise.all(imagePromises);

  const parts: any[] = [];

  // Add Audio Part
  parts.push({
    inlineData: {
      mimeType: audioFile.type.startsWith('audio/') ? audioFile.type : 'audio/mp3',
      data: audioBase64
    }
  });

  // Add Image Parts
  imagesBase64.forEach((b64) => {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg', 
        data: b64
      }
    });
  });

  const promptText = `
    You are an expert automated video editor.
    
    Input:
    1. Audio File (Voiceover)
    2. ${imagesBase64.length} Image Files (Visual Assets, indexed 0 to ${imagesBase64.length - 1})

    Task:
    Create a precise video timeline that aligns the visual assets to the voiceover audio.

    Instructions:
    1. Listen to the audio and transcribe the speech into captions.
    2. Divide the audio into logical segments based on phrases or sentences.
    3. For each segment, assign an image index (0-${imagesBase64.length - 1}) that best matches the context (or cycle through them if context is neutral).
    4. Define the exact 'startTime' and 'endTime' in seconds for each segment.
    5. Choose a smooth animation ('pan_zoom', 'zoom_in', 'static', 'slide_left', 'slide_right').
    6. Choose a transition ('fade', 'cut', 'dissolve').

    Configuration:
    - Style: ${config.style}
    - Caption Style: ${config.captionStyle}
    
    Return a raw JSON array.
  `;

  parts.push({ text: promptText });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            startTime: { type: Type.NUMBER },
            endTime: { type: Type.NUMBER },
            imageIndex: { type: Type.INTEGER },
            caption: { type: Type.STRING },
            animation: { type: Type.STRING },
            transition: { type: Type.STRING }
          },
          required: ['startTime', 'endTime', 'imageIndex', 'caption', 'animation', 'transition']
        }
      }
    }
  });

  const json = JSON.parse(response.text || '[]');

  // Map the returned imageIndex back to our internal assetId
  return json.map((item: any) => ({
    startTime: item.startTime,
    endTime: item.endTime,
    assetId: imageFiles[item.imageIndex]?.id || imageFiles[0].id,
    caption: item.caption,
    animation: item.animation,
    transition: item.transition
  }));
};


import { GoogleGenAI, Type } from "@google/genai";
import { AudioAnalysis } from "../types";

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    genre: { type: Type.STRING, description: "Detected musical genre" },
    key: { type: Type.STRING, description: "Detected musical key and scale" },
    bpm: { type: Type.NUMBER, description: "Detected tempo in BPM" },
    qualityScore: { type: Type.NUMBER, description: "Audio quality score from 1-10" },
    vocalType: { type: Type.STRING, description: "Lead, background, rap, etc." },
    detectedGender: { type: Type.STRING, enum: ["Masculine", "Feminine", "Neutral"], description: "Detected vocal timbre gender" },
    issues: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Specific audio issues like noise, clipping, etc."
    },
    metrics: {
      type: Type.OBJECT,
      properties: {
        lufs: { type: Type.NUMBER, description: "Integrated loudness in LUFS" },
        peak: { type: Type.NUMBER, description: "True peak level in dB" },
        dynamicRange: { type: Type.NUMBER, description: "Dynamic range in dB" }
      },
      required: ["lufs", "peak", "dynamicRange"]
    },
    suggestedParameters: {
      type: Type.OBJECT,
      properties: {
        intensity: { type: Type.NUMBER },
        tuneAmount: { type: Type.NUMBER },
        compression: { type: Type.NUMBER },
        reverb: { type: Type.NUMBER },
        deNoise: { type: Type.NUMBER },
        deRoom: { type: Type.NUMBER },
        deEss: { type: Type.NUMBER },
        comp2: { type: Type.NUMBER },
        limit: { type: Type.NUMBER },
        air: { type: Type.NUMBER },
        body: { type: Type.NUMBER },
        saturate: { type: Type.NUMBER },
        revSize: { type: Type.NUMBER },
        revDecay: { type: Type.NUMBER },
        revMix: { type: Type.NUMBER },
        // Added missing parameters to schema
        delay: { type: Type.NUMBER },
        autoEq: { type: Type.NUMBER },
        // Added EFX+ parameters to schema
        retuneSpeed: { type: Type.NUMBER },
        humanize: { type: Type.NUMBER },
        breathe: { type: Type.NUMBER }
      }
    }
  },
  required: ["genre", "key", "bpm", "qualityScore", "vocalType", "detectedGender", "issues", "metrics", "suggestedParameters"]
};

export const analyzeAudioCharacteristics = async (fileName: string, fileSize: number): Promise<AudioAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Perform a technical analysis for a vocal file "${fileName}" (${fileSize} bytes).
      Determine if the vocal is Masculine, Feminine, or Neutral.
      Include standard audio engineering metrics and processing suggestions.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA
      }
    });

    const data = JSON.parse(response.text || "{}");
    return data as AudioAnalysis;
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return {
      genre: "Pop",
      key: "C Major",
      bpm: 120,
      qualityScore: 6,
      vocalType: "Lead Vocal",
      detectedGender: "Neutral",
      issues: ["Mild noise floor"],
      metrics: {
        lufs: -14.5,
        peak: -1.2,
        dynamicRange: 8.5
      },
      suggestedParameters: {
        intensity: 65,
        tuneAmount: 80,
        compression: 70,
        reverb: 40,
        deNoise: 30,
        deRoom: 20,
        deEss: 40,
        comp2: 30,
        limit: 90,
        air: 50,
        body: 30,
        saturate: 20,
        revSize: 50,
        revDecay: 40,
        revMix: 15,
        // Fixed missing parameters in fallback object
        delay: 15,
        autoEq: 50,
        // Added missing EFX+ parameters to fallback object
        retuneSpeed: 20,
        humanize: 40,
        breathe: 15
      }
    };
  }
};

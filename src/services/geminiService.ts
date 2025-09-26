import { GoogleGenAI, Modality } from "@google/genai";
import type { EnhancementSettings } from '../App';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper function to convert File object to a base64 string
const fileToInlineData = async (file: File): Promise<{mimeType: string, data: string}> => {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // The result includes the 'data:image/jpeg;base64,' prefix, which we need to remove.
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error("Failed to read file."));
      }
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsDataURL(file);
  });
  return {
    mimeType: file.type,
    data: await base64EncodedDataPromise,
  };
};

export const removeBackground = async (imageFile: File): Promise<string> => {
  const model = 'gemini-2.5-flash-image-preview';

  const imagePart = {
    inlineData: await fileToInlineData(imageFile)
  };

  const textPart = {
    text: "Precisely segment the main subject from the background. The output must be a high-quality PNG image with a fully transparent background. It is crucial to preserve all the details of the subject, including fine elements like hair strands, clothing textures, and subtle edges. Do not crop or alter the subject. The final result should be only the isolated subject on a transparent canvas."
  };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [imagePart, textPart],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const { data: base64ImageBytes, mimeType } = part.inlineData;
        if (!base64ImageBytes || !mimeType) {
          continue;
        }
        // Ensure the mimeType is PNG for transparency
        if (mimeType.toLowerCase() !== 'image/png') {
            console.warn(`Model returned ${mimeType}, forcing PNG for transparency.`);
        }
        return `data:image/png;base64,${base64ImageBytes}`;
      }
    }

    const textResponse = response.text?.trim();
    if (textResponse) {
      throw new Error(`The model returned a text response instead of an image: "${textResponse}"`);
    }

    throw new Error('Background removal failed. The model response did not contain image data.');

  } catch (error) {
    console.error("Error calling Gemini API for background removal:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
       throw new Error('Invalid API Key. Please check your environment configuration.');
    }
    throw new Error('Failed to remove background due to an API error.');
  }
};


export const generateFashionImage = async (
  imageFile: File,
  scenePrompt: string,
  aspectRatio: 'portrait' | 'landscape',
  backgroundRefFile: File | null,
  style: string
): Promise<string> => {
  const model = 'gemini-2.5-flash-image-preview';

  const parts: (
    | { inlineData: { mimeType: string; data: string } }
    | { text: string }
  )[] = [];

  let combinedPrompt: string;
  const stylePrompt = style && style.toLowerCase() !== 'photorealistic' 
    ? `in a ${style.toLowerCase()} style` 
    : 'in a photorealistic style';
  
  // Construct the prompt first
  if (backgroundRefFile) {
    // When using multiple images, the prompt should refer to them positionally.
    // The parts will be added in order: [text, model_image, background_image]
    combinedPrompt = `Using the first image provided (the person) and the second image provided (the background reference), generate a new fashion editorial image ${stylePrompt}. The scene is described as: "${scenePrompt}". The first image is the primary subject; you must recreate the person's appearance and clothing. The second image should be used as a strong visual reference for the new background's style, mood, and color palette. The person's pose and the overall composition should be newly generated to fit the scene.`;
  } else {
    combinedPrompt = `Generate a new fashion editorial image ${stylePrompt} based on the scene description: "${scenePrompt}". Use the provided image of a person as a strong visual reference for their appearance and clothing. Recreate the style of the outfit, the person's hair, and general physical characteristics in the new scene. The person's pose and the background environment should be newly generated based on the scene description.`;
  }
  
  if (aspectRatio === 'portrait') {
    combinedPrompt += ` CRITICAL: The final generated image must have a portrait aspect ratio (9:16).`;
  } else {
    combinedPrompt += ` CRITICAL: The final generated image must have a landscape aspect ratio (16:9).`;
  }
  
  combinedPrompt += ` The result should be a cohesive, high-quality photograph.`;
  
  // Add parts in the order: text, model image, then optional background image.
  parts.push({ text: combinedPrompt });
  
  const imagePart = {
    inlineData: await fileToInlineData(imageFile)
  };
  parts.push(imagePart);
  
  if (backgroundRefFile) {
    const backgroundRefPart = {
      inlineData: await fileToInlineData(backgroundRefFile),
    };
    parts.push(backgroundRefPart);
  }
  
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: parts,
      },
      config: {
        // Nano Banana requires both IMAGE and TEXT modalities
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    // Find the image part in the response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const { data: base64ImageBytes, mimeType } = part.inlineData;
        if (!base64ImageBytes || !mimeType) {
            continue;
        }
        return `data:${mimeType};base64,${base64ImageBytes}`;
      }
    }

    // Check for a text-only response if no image is found
    const textResponse = response.text?.trim();
    if (textResponse) {
      throw new Error(`The model returned a text response instead of an image: "${textResponse}"`);
    }

    throw new Error('No image was generated. The model response did not contain image data.');

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
       throw new Error('Invalid API Key. Please check your environment configuration.');
    }
    throw new Error('Failed to generate image due to an API error.');
  }
};

export const enhanceImage = async (
  base64ImageDataUri: string,
  settings: EnhancementSettings
): Promise<string> => {
  const model = 'gemini-2.5-flash-image-preview';

  const [header, data] = base64ImageDataUri.split(',');
  if (!header || !data) {
    throw new Error("Invalid base64 image data URI for enhancement.");
  }
  const mimeType = header.match(/:(.*?);/)?.[1];
  if (!mimeType) {
    throw new Error("Could not extract mime type from data URI for enhancement.");
  }
  
  const imagePart = {
    inlineData: {
      mimeType: mimeType,
      data: data,
    }
  };

  // Build a dynamic, highly specific prompt based on user settings to prevent blur.
  let enhancementPrompt = "Critically analyze this image and perform a high-fidelity enhancement. Your primary goal is to increase sharpness, clarity, and detail to achieve a professional, high-quality photographic look. The final image must be crisp and in sharp focus. Preserve all original elements—do not change the person's appearance, clothing, pose, or the background.\n";

  // Add specific instructions based on settings
  if (settings.denoise) {
    enhancementPrompt += "- Apply subtle digital noise reduction, especially in shadow areas, without sacrificing essential texture.\n";
  }
  if (settings.clarity > 0) {
    const clarityLevel = settings.clarity < 33 ? 'subtly' : settings.clarity < 66 ? 'moderately' : 'significantly';
    enhancementPrompt += `- ${clarityLevel} increase the overall clarity and crispness of the image.\n`;
  }
  if (settings.textureBoost > 0) {
    const textureLevel = settings.textureBoost < 33 ? 'subtly' : settings.textureBoost < 66 ? 'moderately' : 'significantly';
    enhancementPrompt += `- ${textureLevel} enhance the definition of fine textures in elements like clothing fabric, hair, and environmental surfaces.\n`;
  }

  // Add a critical negative constraint to forbid blurriness.
  enhancementPrompt += "\nCRITICAL CONSTRAINT: Under no circumstances should you add blur, haze, soft focus, or dream-like effects. The output image must be sharper and clearer than the input image.";


  const textPart = { text: enhancementPrompt };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [imagePart, textPart],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const { data: base64ImageBytes, mimeType: responseMimeType } = part.inlineData;
        if (!base64ImageBytes || !responseMimeType) {
            continue;
        }
        return `data:${responseMimeType};base64,${base64ImageBytes}`;
      }
    }
    
    const textResponse = response.text?.trim();
    if (textResponse) {
      throw new Error(`The enhancement model returned text instead of an image: "${textResponse}"`);
    }

    throw new Error('Enhancement failed. The model response did not contain image data.');

  } catch (error) {
    console.error("Error calling Gemini API for enhancement:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
       throw new Error('Invalid API Key. Please check your environment configuration.');
    }
    throw new Error('Failed to enhance image due to an API error.');
  }
};

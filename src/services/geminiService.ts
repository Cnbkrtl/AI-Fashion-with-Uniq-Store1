import { GoogleGenAI, Modality } from "@google/genai";

// Initialize the client. If the API key is missing, pass an empty string.
// The actual API calls will fail, which is handled below, but the app won't crash on import.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * Checks if the API_KEY environment variable is set.
 * @returns {boolean} True if the API key is available, false otherwise.
 */
export const isApiKeyAvailable = (): boolean => {
  return !!process.env.API_KEY;
};

// A centralized error handler to provide more specific feedback to the user.
const handleApiError = (error: unknown, context: string): never => {
  console.error(`Error calling Gemini API for ${context}:`, error);

  let errorMessage = `Failed to ${context} due to an API error.`;

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('api key not valid')) {
      errorMessage = 'Your API Key is not valid. Please verify it in your environment settings.';
    } else if (msg.includes('model `gemini-2.5-flash-image-preview` is not found')) {
      errorMessage = 'The image editing model is not available for your project. Please ensure you have access.';
    } else if (msg.includes('billing')) {
      errorMessage = 'API call failed. Please ensure billing is enabled for your Google Cloud project.';
    } else if (msg.includes('permission denied')) {
      errorMessage = 'API permission denied. Please ensure the "Generative Language API" is enabled in your Google Cloud project.';
    } else if (msg.includes('deadline exceeded')) {
      errorMessage = 'The request timed out. The server may be busy, please try again.';
    } else if (msg.includes('content has been blocked')) {
      errorMessage = 'The request was blocked due to safety policies. Please adjust your image or prompt.';
    } else {
      // Extract a more concise message from a potentially long error string.
      const coreMessage = error.message.split(':').pop()?.trim();
      if (coreMessage) {
        errorMessage = `API Error: ${coreMessage}`;
      }
    }
  }

  throw new Error(errorMessage);
};


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
      if (part.inlineData && part.inlineData.data && part.inlineData.mimeType) {
        const base64ImageBytes: string = part.inlineData.data;
        const mimeType = part.inlineData.mimeType;
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
    return handleApiError(error, 'remove background');
  }
};


export const generateFashionImage = async (
  imageFile: File,
  scenePrompt: string
): Promise<string> => {
  const model = 'gemini-2.5-flash-image-preview';

  const imagePart = {
    inlineData: await fileToInlineData(imageFile)
  };

  // Revised prompt to be less restrictive and align with model capabilities.
  const combinedPrompt = `Generate a new fashion editorial image based on the scene description: "${scenePrompt}". Use the provided image of a person as a strong visual reference for their appearance and clothing. Recreate the style of the outfit, the person's hair, and general physical characteristics in the new scene. The person's pose and the background environment should be newly generated based on the scene description. The result should be a cohesive, high-quality photograph.`;

  const textPart = {
    text: combinedPrompt,
  };
  
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [imagePart, textPart],
      },
      config: {
        // Nano Banana requires both IMAGE and TEXT modalities
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    // Find the image part in the response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data && part.inlineData.mimeType) {
        const base64ImageBytes: string = part.inlineData.data;
        const mimeType = part.inlineData.mimeType;
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
    return handleApiError(error, 'generate image');
  }
};

export const enhanceImage = async (base64ImageDataUri: string): Promise<string> => {
  const model = 'gemini-2.5-flash-image-preview';

  const [header, data] = base64ImageDataUri.split(',');
  if (!header || !data) {
    throw new Error("Invalid base64 image data URI for enhancement.");
  }
  const mimeTypeMatch = header.match(/:(.*?);/);
  if (!mimeTypeMatch || !mimeTypeMatch[1]) {
    throw new Error("Could not extract mime type from data URI for enhancement.");
  }
  const mimeType = mimeTypeMatch[1];
  
  const imagePart = {
    inlineData: {
      mimeType: mimeType,
      data: data,
    }
  };

  // A more forceful prompt to demand higher technical quality and sharpness.
  const textPart = {
    text: "Dramatically enhance this image to an ultra-realistic, 4K resolution quality. Your task is to upscale the image, sharpen every detail, and improve its overall clarity to match that of a professional DSLR photograph. Focus on making textures in clothing crisp, ensuring skin tones are lifelike, and refining the lighting and shadows for a photorealistic effect. CRITICAL: You must not alter the content in any way. The person's appearance, their pose, the clothing, and the background must remain exactly the same. This is a technical enhancement, not a creative change.",
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
      if (part.inlineData && part.inlineData.data && part.inlineData.mimeType) {
        const base64ImageBytes: string = part.inlineData.data;
        const responseMimeType = part.inlineData.mimeType;
        return `data:${responseMimeType};base64,${base64ImageBytes}`;
      }
    }
    
    const textResponse = response.text?.trim();
    if (textResponse) {
      throw new Error(`The enhancement model returned text instead of an image: "${textResponse}"`);
    }

    throw new Error('Enhancement failed. The model response did not contain image data.');

  } catch (error) {
    return handleApiError(error, 'enhance image');
  }
};

export const analyzeImageForPrompt = async (imageFile: File): Promise<string> => {
  const model = 'gemini-2.5-flash';

  const imagePart = {
    inlineData: await fileToInlineData(imageFile)
  };

  const textPart = {
    text: "Analyze the provided image and generate a concise, descriptive sentence for a fashion photoshoot prompt. Describe the person's clothing, hair, and key visual elements. Focus on objective details. For example: 'A woman with long brown hair wearing a beige crop top and matching wide-leg pants.' Do not describe the background.",
  };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [imagePart, textPart],
      },
    });

    const textResponse = response.text?.trim();
    if (textResponse) {
      return textResponse;
    }

    throw new Error('Analysis failed. The model did not return a description.');

  } catch (error) {
    return handleApiError(error, 'analyze image');
  }
};
import { GoogleGenAI, Modality, Part } from "@google/genai";

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

interface GenerateImageParams {
  imageFile: File;
  sceneImage: File | null;
  scenePrompt: string;
  style: string;
}

export const generateFashionImage = async ({
  imageFile,
  sceneImage,
  scenePrompt,
  style,
}: GenerateImageParams): Promise<string> => {
  const model = 'gemini-2.5-flash-image-preview';
  const parts: Part[] = [];

  // 1. Add the main subject/model image
  parts.push({ inlineData: await fileToInlineData(imageFile) });

  // 2. Add the optional scene/background image
  if (sceneImage) {
    parts.push({ inlineData: await fileToInlineData(sceneImage) });
  }

  // 3. Construct the detailed text prompt
  let combinedPrompt = `Generate a new fashion editorial image. The final image should have a professional, high-quality photographic look in a '${style}' artistic style.`;
  
  if (sceneImage) {
    combinedPrompt += `\n\n**Visual References:**\n- **Person Reference (first image):** Use this person as the main subject. Recreate their appearance, clothing, hair, and general physical characteristics in the new scene. The pose should be adapted naturally to the new environment.\n- **Scene Reference (second image):** Use this image as the definitive background and environment for the final photo. The subject must be realistically integrated into this scene.`;
  } else {
    combinedPrompt += `\n\n**Visual Reference:**\n- **Person Reference (the provided image):** Use this person as the main subject. Recreate their appearance, clothing, hair, and general physical characteristics in the new scene.`;
  }
  
  combinedPrompt += `\n\n**Scene Description:**\n- Create a scene based on this description: "${scenePrompt}".`;
  
  if (sceneImage) {
     combinedPrompt += ` The text description should be used to inform the mood, lighting, and subject's pose within the provided scene image.`;
  } else {
    combinedPrompt += ` The background, environment, and the person's pose should be newly generated based on this description.`;
  }

  combinedPrompt += `\n\n**Final Output Requirements:**\n- The result must be a single, cohesive photograph that seamlessly blends the subject into the environment.\n- Pay close attention to realistic lighting, shadows, and perspective.`;

  parts.unshift({ text: combinedPrompt }); // Add text prompt to the beginning of the array
  
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: {
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

  // New, highly-specific prompt for professional-grade enhancement and cleaning.
  const textPart = {
    text: "Perform a professional-grade enhancement on this image. Your primary goal is to increase the resolution and sharpen details for a crystal-clear, high-fidelity result. CRITICAL: It is absolutely essential to eliminate all digital noise, grain, and compression artifacts. The final image must be perfectly clean and smooth, especially in flat areas and color gradients. The result should look like it was captured with a high-end studio camera, not like a digitally over-processed image. Do not alter the content in any way—the person's appearance, clothing, pose, and background must remain exactly the same. This is a technical quality enhancement only.",
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

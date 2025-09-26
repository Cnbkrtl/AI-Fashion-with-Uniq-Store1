import { GoogleGenAI, Modality } from "@google/genai";

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
    console.error("Error calling Gemini API for background removal:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
       throw new Error('Invalid API Key. Please check your environment configuration.');
    }
    throw new Error('Failed to remove background due to an API error.');
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
      if (part.inlineData) {
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
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
       throw new Error('Invalid API Key. Please check your environment configuration.');
    }
    throw new Error('Failed to generate image due to an API error.');
  }
};

export const enhanceImage = async (base64ImageDataUri: string): Promise<string> => {
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

  // Revised prompt to focus on quality improvement without triggering identity policies.
  const textPart = {
    text: "Enhance this image by upscaling it to a higher resolution and improving its photorealism. Focus on refining details like textures, skin tones, lighting, and shadows to achieve a professional, high-quality photographic look. It is critical to preserve all original elements of the image—do not change the person's appearance, clothing, pose, or the background. The objective is strictly to improve visual quality and fidelity without altering the content.",
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
    console.error("Error calling Gemini API for enhancement:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
       throw new Error('Invalid API Key. Please check your environment configuration.');
    }
    throw new Error('Failed to enhance image due to an API error.');
  }
};
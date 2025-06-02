// Gemini API implementation
import fetch from 'node-fetch';

interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text?: string;
      }[];
    };
  }[];
}

interface GeminiError {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  }
}

/**
 * Analyze an image using Google Gemini API to extract text
 * @param imageBase64 The base64-encoded image data
 * @returns An object with extracted text or error details
 */
export async function analyzeImage(imageBase64: string): Promise<{text: string | null; error?: string}> {
  try {
    // Access environment variables in Netlify Functions
    const apiKey = process.env.GEMINI_API_KEY || process.env.NETLIFY_GEMINI_API_KEY || "";
    
    if (!apiKey) {
      console.error("No Gemini API key provided");
      return { 
        text: null,
        error: "API key missing. Please configure the Gemini API key." 
      };
    }
    
    // Log that we found the API key (but don't log the actual key)
    console.log("Found Gemini API key: " + (apiKey ? "[API KEY PRESENT]" : "[MISSING]"));
    
    // Change to v1 API endpoint instead of beta for more stability
    const apiUrl = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent";
    
    const promptText = `
      Extract ALL TEXT from this image first. Then identify and extract ALL partner names and their tippable hours from the text.
      
      Look for patterns indicating partner names followed by hours, such as:
      - "Name: X hours" or "Name: Xh"
      - "Name - X hours"
      - "Name (X hours)"
      - Any text that includes names with numeric values that could represent hours
      
      Return EACH partner's full name followed by their hours, with one partner per line.
      Format the output exactly like this:
      John Smith: 32
      Maria Garcia: 24.5
      Alex Johnson: 18.75
      
      Make sure to include ALL partners mentioned in the image, not just the first one.
      If hours are not explicitly labeled, look for numeric values near names that could represent hours.
    `;
    
    // Updated request format for more reliable OCR processing
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: promptText
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: imageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,        // Lower temperature for more predictable results
        topP: 0.95,              // Slightly higher top_p for better diversity
        topK: 32,                // Adjusted for balance
        maxOutputTokens: 4096,   // Increased max tokens for more complete extraction
        stopSequences: []        // No stop sequences
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE"
        }
      ]
    };
    
    const response = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Failed to call Gemini API";
      
      console.log(`Gemini API response status: ${response.status}`);
      // Log response headers in a way compatible with older JavaScript versions
      const headerObj: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headerObj[key] = value;
      });
      console.log(`Response headers: ${JSON.stringify(headerObj)}`);
      
      try {
        const errorData = JSON.parse(errorText) as GeminiError;
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
          // Hide the API key if it's in the error message
          errorMessage = errorMessage.replace(/api_key:[a-zA-Z0-9-_]+/, "api_key:[REDACTED]");
          console.error("Parsed Gemini API error:", JSON.stringify(errorData.error));
        }
      } catch (e) {
        // If error parsing fails, log the raw error
        console.error("Failed to parse error JSON:", errorText);
      }
      
      console.error("Gemini API error:", response.status, errorText);
      
      // Special handling for common error codes
      if (response.status === 400) {
        return { 
          text: null, 
          error: `Bad request to Gemini API. Check your API key permissions and image format.`
        };
      } else if (response.status === 403) {
        return { 
          text: null, 
          error: `Authentication error. Your Gemini API key may be invalid or missing Vision API permissions.`
        };
      } else if (response.status === 429) {
        return { 
          text: null, 
          error: `Gemini API quota exceeded. Please try again later or check your API key limits.`
        };
      }
      
      return { 
        text: null, 
        error: `API Error (${response.status}): ${errorMessage}`
      };
    }
    
    const data = await response.json() as GeminiResponse;
    
    if (!data.candidates || data.candidates.length === 0) {
      console.error("No candidates in Gemini response");
      return { 
        text: null,
        error: "No text extracted from the image. Try a clearer image or manual entry."
      };
    }
    
    const extractedText = data.candidates[0].content.parts
      .map(part => part.text)
      .filter(Boolean)
      .join("\n");
    
    if (!extractedText) {
      return { 
        text: null,
        error: "No text extracted from the image. Try a clearer image or manual entry."
      };
    }
    
    return { text: extractedText };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return { 
      text: null,
      error: "An unexpected error occurred while processing the image."
    };
  }
}

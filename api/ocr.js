import multer from 'multer';
import fetch from 'node-fetch';

// Gemini API function
async function analyzeImage(imageBase64) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || "";
    
    if (!apiKey) {
      console.error("No Gemini API key provided");
      return {
        text: null,
        error: "API key missing. Please configure the Gemini API key."
      };
    }
    
    console.log("Found Gemini API key: " + (apiKey ? "[API KEY PRESENT]" : "[MISSING]"));
    
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
        temperature: 0.1,
        topP: 0.95,
        topK: 32,
        maxOutputTokens: 4096,
        stopSequences: []
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
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
          errorMessage = errorMessage.replace(/api_key:[a-zA-Z0-9-_]+/, "api_key:[REDACTED]");
        }
      } catch (e) {
        console.error("Failed to parse error JSON:", errorText);
      }
      
      console.error("Gemini API error:", response.status, errorText);
      
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
    
    const data = await response.json();
    
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

// Helper functions
function extractPartnerHours(text) {
  const lines = text.split('\n');
  const partnerHours = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Look for patterns like "Name: hours" or "Name - hours"
    const match = trimmedLine.match(/^(.+?)[:−\-]\s*(\d+(?:\.\d+)?)/);
    if (match) {
      const name = match[1].trim();
      const hours = parseFloat(match[2]);
      
      if (name && !isNaN(hours) && hours > 0) {
        partnerHours.push({ name, hours });
      }
    }
  }
  
  return partnerHours;
}

function formatOCRResult(text) {
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Helper function to handle multipart/form-data in Vercel
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Handle file upload
    await runMiddleware(req, res, upload.single('image'));
    
    console.log("OCR request received");
    
    if (!req.file) {
      console.log("No image file provided in request");
      return res.status(400).json({ error: "No image file provided" });
    }
    
    console.log(`Image received: ${req.file.originalname}, ${req.file.size} bytes`);
    
    // Convert image buffer to base64
    const imageBase64 = req.file.buffer.toString("base64");
    console.log(`Image converted to base64, length: ${imageBase64.length} chars`);
    
    // Use Gemini API to analyze the image
    console.log("Calling Gemini API...");
    const result = await analyzeImage(imageBase64);
    console.log(`Gemini API response received: ${result.text ? 'Success' : 'Failed'}`);
    
    if (!result.text) {
      console.error("Gemini API error:", result.error);
      return res.status(500).json({ 
        error: result.error || "Failed to extract text from image",
        suggestManualEntry: true
      });
    }
    
    // Parse extracted text to get partner hours
    console.log("Parsing extracted text for partner hours");
    const partnerHours = extractPartnerHours(result.text);
    console.log(`Found ${partnerHours.length} partners with hours`);
    
    // Format the extracted text for display
    const formattedText = formatOCRResult(result.text);
    
    console.log("OCR processing completed successfully");
    return res.json({
      extractedText: formattedText,
      partnerHours
    });
  } catch (error) {
    console.error("OCR processing error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    console.error(`Error details: ${errorMessage}\n${errorStack}`);
    
    return res.status(500).json({ 
      error: "Failed to process the image. Please try manual entry instead.",
      details: errorMessage,
      suggestManualEntry: true 
    });
  }
}

// Configure API route
export const config = {
  api: {
    bodyParser: false, // Disable default body parser for file uploads
  },
}
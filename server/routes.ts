import type { Express, Request } from "express";
import type { FileFilterCallback } from "multer";

// Define the multer request type with file property
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer: Buffer;
}

interface MulterRequest extends Request {
  file?: MulterFile;
}
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { analyzeImage } from "./api/gemini";
import { extractPartnerHours, formatOCRResult } from "../client/src/lib/formatUtils";
import { calculatePayout } from "../client/src/lib/utils";
import { roundAndCalculateBills } from "../client/src/lib/billCalc";
import { partnerHoursSchema } from "@shared/schema";

// Setup file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  
  // OCR Processing endpoint
  app.post("/api/ocr", upload.single("image"), async (req: MulterRequest, res) => {
    console.log("OCR request received");
    try {
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
        // Return a specific error message from the API if available
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
      res.json({
        extractedText: formattedText,
        partnerHours
      });
    } catch (error) {
      console.error("OCR processing error:", error);
      // Send more detailed error information
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : 'No stack trace';
      console.error(`Error details: ${errorMessage}\n${errorStack}`);
      
      res.status(500).json({ 
        error: "Failed to process the image. Please try manual entry instead.",
        details: errorMessage,
        suggestManualEntry: true 
      });
    }
  });
  
  // Calculate tip distribution
  app.post("/api/distributions/calculate", async (req, res) => {
    try {
      const { partnerHours, totalAmount, totalHours, hourlyRate } = req.body;
      
      // Validate input values
      if (!Array.isArray(partnerHours) || partnerHours.length === 0) {
        return res.status(400).json({ error: "Partner hours data is missing or empty" });
      }
      
      if (totalAmount <= 0 || !isFinite(totalAmount)) {
        return res.status(400).json({ error: "Total amount must be a positive number" });
      }
      
      if (totalHours <= 0 || !isFinite(totalHours)) {
        return res.status(400).json({ error: "Total hours must be a positive number" });
      }
      
      if (hourlyRate <= 0 || !isFinite(hourlyRate)) {
        return res.status(400).json({ error: "Hourly rate must be a positive number" });
      }
      
      // Validate partner hours
      try {
        partnerHoursSchema.parse(partnerHours);
      } catch (error) {
        return res.status(400).json({ error: "Invalid partner hours data" });
      }
      
      // Calculate payout for each partner
      const partnerPayouts = partnerHours.map(partner => {
        const payout = calculatePayout(partner.hours, hourlyRate);
        
        if (!isFinite(payout) || payout < 0) {
          throw new Error(`Invalid payout calculation for partner ${partner.name}`);
        }
        
        const { rounded, billBreakdown } = roundAndCalculateBills(payout);
        
        return {
          name: partner.name,
          hours: partner.hours,
          payout,
          rounded,
          billBreakdown
        };
      });
      
      const distributionData = {
        totalAmount,
        totalHours,
        hourlyRate,
        partnerPayouts
      };
      
      res.json(distributionData);
    } catch (error) {
      console.error("Distribution calculation error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to calculate distribution";
      res.status(500).json({ error: errorMessage });
    }
  });
  
  // Save distribution to history
  app.post("/api/distributions", async (req, res) => {
    try {
      const { totalAmount, totalHours, hourlyRate, partnerData } = req.body;
      
      const distribution = await storage.createDistribution({
        totalAmount,
        totalHours,
        hourlyRate,
        partnerData
      });
      
      res.status(201).json(distribution);
    } catch (error) {
      console.error("Save distribution error:", error);
      res.status(500).json({ error: "Failed to save distribution" });
    }
  });
  
  // Get distribution history
  app.get("/api/distributions", async (req, res) => {
    try {
      const distributions = await storage.getDistributions();
      res.json(distributions);
    } catch (error) {
      console.error("Get distributions error:", error);
      res.status(500).json({ error: "Failed to retrieve distributions" });
    }
  });
  
  // Partners endpoints
  app.post("/api/partners", async (req, res) => {
    try {
      const { name } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: "Partner name is required" });
      }
      
      const partner = await storage.createPartner({ name: name.trim() });
      res.status(201).json(partner);
    } catch (error) {
      console.error("Create partner error:", error);
      res.status(500).json({ error: "Failed to create partner" });
    }
  });
  
  app.get("/api/partners", async (req, res) => {
    try {
      const partners = await storage.getPartners();
      res.json(partners);
    } catch (error) {
      console.error("Get partners error:", error);
      res.status(500).json({ error: "Failed to retrieve partners" });
    }
  });
  
  const httpServer = createServer(app);
  return httpServer;
}

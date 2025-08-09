import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import * as path from 'path';

export interface ImageInterpretationResult {
  interpretation: string;
  confidence: number;
  success: boolean;
  error?: string;
  metadata?: {
    model: string;
    processingTime: number;
    imageSize: number;
    mimeType: string;
  };
}

export class GeminiVisionService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * Convert image file to base64 data URI
   */
  private imageToBase64(imagePath: string): { data: string; mimeType: string } {
    const imageBuffer = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
    };

    const mimeType = mimeTypes[ext] || 'image/jpeg';
    const base64Data = imageBuffer.toString('base64');

    return {
      data: base64Data,
      mimeType,
    };
  }

  /**
   * Analyze marketing image/banner for ad copy context
   */
  async analyzeMarketingImage(imagePath: string): Promise<ImageInterpretationResult> {
    const startTime = Date.now();

    try {
      const { data, mimeType } = this.imageToBase64(imagePath);
      const imageSize = fs.statSync(imagePath).size;

      const prompt = `
Analyze this marketing image/banner and provide a detailed interpretation for ad copy generation. Focus on:

1. **Visual Elements**: What products, people, or objects are shown?
2. **Brand Elements**: Any logos, brand names, or brand colors visible?
3. **Text Content**: Any text, headlines, or slogans in the image?
4. **Emotional Tone**: What mood or feeling does the image convey?
5. **Target Audience**: Who appears to be the intended audience?
6. **Marketing Message**: What is the main marketing message or value proposition?
7. **Call-to-Action**: Any visible CTAs or action-oriented elements?
8. **Style & Aesthetic**: Modern, classic, minimalist, bold, etc.?

Provide a comprehensive analysis that would help an AI copywriter understand the context and create compelling ad copy that aligns with this visual content.

Format your response as a detailed paragraph that captures all these elements in a natural, flowing description.
`;

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            data: data,
            mimeType: mimeType,
          },
        },
      ]);

      const response = await result.response;
      const interpretation = response.text();

      const processingTime = Date.now() - startTime;

      if (!interpretation || interpretation.trim().length === 0) {
        return {
          interpretation: '',
          confidence: 0,
          success: false,
          error: 'No interpretation generated for the image',
          metadata: {
            model: 'gemini-1.5-flash',
            processingTime,
            imageSize,
            mimeType,
          },
        };
      }

      return {
        interpretation: interpretation.trim(),
        confidence: 0.9, // Gemini doesn't provide confidence scores, so we use a high default
        success: true,
        metadata: {
          model: 'gemini-1.5-flash',
          processingTime,
          imageSize,
          mimeType,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        interpretation: '',
        confidence: 0,
        success: false,
        error: `Image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          model: 'gemini-1.5-flash',
          processingTime,
          imageSize: 0,
          mimeType: 'unknown',
        },
      };
    }
  }

  /**
   * Analyze general image content for context
   */
  async analyzeImageContent(imagePath: string): Promise<ImageInterpretationResult> {
    const startTime = Date.now();

    try {
      const { data, mimeType } = this.imageToBase64(imagePath);
      const imageSize = fs.statSync(imagePath).size;

      const prompt = `
Describe this image in detail for marketing and advertising context. Include:

- What is shown in the image (objects, people, scenes, products)
- The overall mood and atmosphere
- Colors, lighting, and visual style
- Any text or branding visible
- The setting or environment
- Potential target audience or use case
- Marketing relevance and appeal

Provide a comprehensive description that would help create relevant advertising copy.
`;

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            data: data,
            mimeType: mimeType,
          },
        },
      ]);

      const response = await result.response;
      const interpretation = response.text();

      const processingTime = Date.now() - startTime;

      if (!interpretation || interpretation.trim().length === 0) {
        return {
          interpretation: '',
          confidence: 0,
          success: false,
          error: 'No interpretation generated for the image',
          metadata: {
            model: 'gemini-1.5-flash',
            processingTime,
            imageSize,
            mimeType,
          },
        };
      }

      return {
        interpretation: interpretation.trim(),
        confidence: 0.9,
        success: true,
        metadata: {
          model: 'gemini-1.5-flash',
          processingTime,
          imageSize,
          mimeType,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        interpretation: '',
        confidence: 0,
        success: false,
        error: `Image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          model: 'gemini-1.5-flash',
          processingTime,
          imageSize: 0,
          mimeType: 'unknown',
        },
      };
    }
  }

  /**
   * Extract text from image using Gemini's OCR capabilities
   */
  async extractTextFromImage(imagePath: string): Promise<ImageInterpretationResult> {
    const startTime = Date.now();

    try {
      const { data, mimeType } = this.imageToBase64(imagePath);
      const imageSize = fs.statSync(imagePath).size;

      const prompt = `
Extract all visible text from this image. Include:
- Headlines and titles
- Body text and descriptions
- Button text and CTAs
- Brand names and logos
- Any other readable text

Format the extracted text clearly, maintaining the hierarchy and structure where possible.
If no text is visible, respond with "No readable text found in the image."
`;

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            data: data,
            mimeType: mimeType,
          },
        },
      ]);

      const response = await result.response;
      const interpretation = response.text();

      const processingTime = Date.now() - startTime;

      return {
        interpretation: interpretation.trim(),
        confidence: 0.95, // High confidence for text extraction
        success: true,
        metadata: {
          model: 'gemini-1.5-flash',
          processingTime,
          imageSize,
          mimeType,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        interpretation: '',
        confidence: 0,
        success: false,
        error: `Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          model: 'gemini-1.5-flash',
          processingTime,
          imageSize: 0,
          mimeType: 'unknown',
        },
      };
    }
  }

  /**
   * Auto-analyze image based on context (marketing vs general)
   */
  async analyzeImageAuto(
    imagePath: string,
    context: 'marketing' | 'general' = 'marketing'
  ): Promise<ImageInterpretationResult> {
    if (context === 'marketing') {
      return this.analyzeMarketingImage(imagePath);
    } else {
      return this.analyzeImageContent(imagePath);
    }
  }
}

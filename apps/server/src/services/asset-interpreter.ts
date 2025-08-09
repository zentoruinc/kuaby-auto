import {
  GoogleSpeechService,
  type SpeechTranscriptionResult,
} from "./google-speech";
import {
  GeminiVisionService,
  type ImageInterpretationResult,
} from "./gemini-vision";
import { VideoProcessor } from "./video-processor";
import { AssetInterpretationService } from "./asset-interpretation";
import fs from "fs";

export interface AssetInterpretationResult {
  dropboxFileId: string;
  fileType: "image" | "video";
  interpretation: string;
  processingMethod: string;
  success: boolean;
  error?: string;
  metadata: {
    confidence?: number;
    duration?: number;
    processingTime: number;
    fromCache: boolean;
    originalMetadata?: any;
  };
}

export class AssetInterpreter {
  private speechService: GoogleSpeechService;
  private visionService: GeminiVisionService;

  constructor() {
    this.speechService = new GoogleSpeechService();
    this.visionService = new GeminiVisionService();
  }

  /**
   * Interpret a single asset (image or video)
   */
  async interpretAsset(
    dropboxFileId: string,
    filePath: string,
    fileType: "image" | "video",
    fileName: string
  ): Promise<AssetInterpretationResult> {
    const startTime = Date.now();

    try {
      // Check if interpretation is already cached
      const cached =
        await AssetInterpretationService.getCachedInterpretation(dropboxFileId);

      if (
        cached &&
        (await AssetInterpretationService.isInterpretationFresh(dropboxFileId))
      ) {
        return {
          dropboxFileId,
          fileType,
          interpretation: cached.interpretation,
          processingMethod: cached.processingMethod,
          success: true,
          metadata: {
            confidence: cached.metadata.confidence,
            duration: cached.metadata.duration,
            processingTime: Date.now() - startTime,
            fromCache: true,
            originalMetadata: cached.metadata,
          },
        };
      }

      let result: AssetInterpretationResult;

      if (fileType === "image") {
        result = await this.interpretImage(dropboxFileId, filePath, fileName);
      } else {
        result = await this.interpretVideo(dropboxFileId, filePath, fileName);
      }

      // Cache the result if successful
      if (result.success) {
        await AssetInterpretationService.cacheInterpretation(
          dropboxFileId,
          fileType,
          result.interpretation,
          result.processingMethod,
          {
            confidence: result.metadata.confidence,
            duration: result.metadata.duration,
            processingTime: result.metadata.processingTime,
            fileName,
            ...result.metadata.originalMetadata,
          }
        );
      }

      return result;
    } catch (error) {
      return {
        dropboxFileId,
        fileType,
        interpretation: "",
        processingMethod: "error",
        success: false,
        error: `Asset interpretation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          processingTime: Date.now() - startTime,
          fromCache: false,
        },
      };
    }
  }

  /**
   * Interpret an image using Gemini Vision
   */
  private async interpretImage(
    dropboxFileId: string,
    imagePath: string,
    fileName: string
  ): Promise<AssetInterpretationResult> {
    const startTime = Date.now();

    try {
      const visionResult: ImageInterpretationResult =
        await this.visionService.analyzeMarketingImage(imagePath);

      if (!visionResult.success) {
        return {
          dropboxFileId,
          fileType: "image",
          interpretation: "",
          processingMethod: "gemini_vision",
          success: false,
          error: visionResult.error,
          metadata: {
            processingTime: Date.now() - startTime,
            fromCache: false,
            originalMetadata: visionResult.metadata,
          },
        };
      }

      return {
        dropboxFileId,
        fileType: "image",
        interpretation: visionResult.interpretation,
        processingMethod: "gemini_vision",
        success: true,
        metadata: {
          confidence: visionResult.confidence,
          processingTime: Date.now() - startTime,
          fromCache: false,
          originalMetadata: visionResult.metadata,
        },
      };
    } catch (error) {
      return {
        dropboxFileId,
        fileType: "image",
        interpretation: "",
        processingMethod: "gemini_vision",
        success: false,
        error: `Image interpretation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          processingTime: Date.now() - startTime,
          fromCache: false,
        },
      };
    }
  }

  /**
   * Interpret a video by extracting audio and transcribing it
   */
  private async interpretVideo(
    dropboxFileId: string,
    videoPath: string,
    fileName: string
  ): Promise<AssetInterpretationResult> {
    const startTime = Date.now();
    let audioPath: string | null = null;

    try {
      // Extract audio from video
      const videoResult = await VideoProcessor.extractAudio(videoPath);

      if (!videoResult.success) {
        return {
          dropboxFileId,
          fileType: "video",
          interpretation: "",
          processingMethod: "speech_to_text",
          success: false,
          error: `Audio extraction failed: ${videoResult.error}`,
          metadata: {
            duration: videoResult.duration,
            processingTime: Date.now() - startTime,
            fromCache: false,
          },
        };
      }

      audioPath = videoResult.audioPath;

      // Transcribe the extracted audio
      const speechResult: SpeechTranscriptionResult =
        await this.speechService.transcribeAudioAuto(
          audioPath,
          videoResult.duration
        );

      // Clean up the temporary audio file
      VideoProcessor.cleanupTempFile(audioPath);

      if (!speechResult.success) {
        return {
          dropboxFileId,
          fileType: "video",
          interpretation: "",
          processingMethod: "speech_to_text",
          success: false,
          error: speechResult.error,
          metadata: {
            duration: videoResult.duration,
            processingTime: Date.now() - startTime,
            fromCache: false,
            originalMetadata: speechResult.metadata,
          },
        };
      }

      // Create a comprehensive interpretation combining audio transcript with context
      const interpretation = this.enhanceVideoInterpretation(
        speechResult.transcript,
        fileName,
        videoResult.duration
      );

      return {
        dropboxFileId,
        fileType: "video",
        interpretation,
        processingMethod: "speech_to_text",
        success: true,
        metadata: {
          confidence: speechResult.confidence,
          duration: videoResult.duration,
          processingTime: Date.now() - startTime,
          fromCache: false,
          originalMetadata: {
            ...speechResult.metadata,
            videoDuration: videoResult.duration,
          },
        },
      };
    } catch (error) {
      // Clean up audio file if it exists
      if (audioPath) {
        VideoProcessor.cleanupTempFile(audioPath);
      }

      return {
        dropboxFileId,
        fileType: "video",
        interpretation: "",
        processingMethod: "speech_to_text",
        success: false,
        error: `Video interpretation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          processingTime: Date.now() - startTime,
          fromCache: false,
        },
      };
    }
  }

  /**
   * Enhance video interpretation with context
   */
  private enhanceVideoInterpretation(
    transcript: string,
    fileName: string,
    duration: number
  ): string {
    if (!transcript || transcript.trim().length === 0) {
      return `Video file "${fileName}" (${Math.round(duration)}s duration) contains no detectable speech or audio content. This appears to be a silent video or contains only background music/sounds.`;
    }

    return `Video content from "${fileName}" (${Math.round(duration)}s duration): ${transcript.trim()}`;
  }

  /**
   * Interpret multiple assets in batch
   */
  async interpretAssets(
    assets: Array<{
      dropboxFileId: string;
      filePath: string;
      fileType: "image" | "video";
      fileName: string;
    }>
  ): Promise<AssetInterpretationResult[]> {
    const results: AssetInterpretationResult[] = [];

    // Process assets sequentially to avoid overwhelming the APIs
    for (const asset of assets) {
      try {
        const result = await this.interpretAsset(
          asset.dropboxFileId,
          asset.filePath,
          asset.fileType,
          asset.fileName
        );
        results.push(result);
      } catch (error) {
        results.push({
          dropboxFileId: asset.dropboxFileId,
          fileType: asset.fileType,
          interpretation: "",
          processingMethod: "error",
          success: false,
          error: `Batch processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          metadata: {
            processingTime: 0,
            fromCache: false,
          },
        });
      }
    }

    return results;
  }

  /**
   * Clean up temporary files
   */
  static cleanupTempFiles(filePaths: string[]): void {
    filePaths.forEach((filePath) => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.warn(`Failed to cleanup temp file ${filePath}:`, error);
      }
    });
  }
}

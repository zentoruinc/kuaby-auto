import { SpeechClient } from '@google-cloud/speech';
import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';

export interface SpeechTranscriptionResult {
  transcript: string;
  confidence: number;
  duration: number;
  language: string;
  success: boolean;
  error?: string;
  metadata?: {
    audioEncoding: string;
    sampleRateHertz: number;
    languageCode: string;
    processingTime: number;
  };
}

export class GoogleSpeechService {
  private speechClient: SpeechClient;
  private storageClient: Storage;
  private bucketName: string;

  constructor() {
    // Initialize Google Cloud clients
    this.speechClient = new SpeechClient({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
    });

    this.storageClient = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
    });

    this.bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'kuaby-audio-temp';
  }

  /**
   * Upload audio file to Google Cloud Storage
   */
  private async uploadToStorage(audioPath: string): Promise<string> {
    const fileName = `audio-${nanoid()}-${Date.now()}.wav`;
    const file = this.storageClient.bucket(this.bucketName).file(fileName);

    try {
      await file.save(fs.readFileSync(audioPath), {
        metadata: {
          contentType: 'audio/wav',
        },
      });

      // Return the GCS URI
      return `gs://${this.bucketName}/${fileName}`;
    } catch (error) {
      throw new Error(`Failed to upload audio to storage: ${error}`);
    }
  }

  /**
   * Delete file from Google Cloud Storage
   */
  private async deleteFromStorage(gcsUri: string): Promise<void> {
    try {
      const fileName = gcsUri.replace(`gs://${this.bucketName}/`, '');
      await this.storageClient.bucket(this.bucketName).file(fileName).delete();
    } catch (error) {
      console.warn(`Failed to delete file from storage: ${error}`);
    }
  }

  /**
   * Transcribe audio file using Google Cloud Speech-to-Text
   */
  async transcribeAudio(
    audioPath: string,
    languageCode: string = 'en-US'
  ): Promise<SpeechTranscriptionResult> {
    const startTime = Date.now();

    try {
      // Upload audio to Google Cloud Storage for processing
      const gcsUri = await this.uploadToStorage(audioPath);

      // Configure the audio settings and features
      const audio = {
        uri: gcsUri,
      };

      const config = {
        encoding: 'LINEAR16' as const,
        sampleRateHertz: 16000,
        languageCode: languageCode,
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
        model: 'latest_long', // Use the latest long-form model for better accuracy
        useEnhanced: true, // Use enhanced model if available
      };

      const request = {
        audio: audio,
        config: config,
      };

      // Perform the speech recognition request
      const [operation] = await this.speechClient.longRunningRecognize(request);
      const [response] = await operation.promise();

      // Clean up the uploaded file
      await this.deleteFromStorage(gcsUri);

      const processingTime = Date.now() - startTime;

      if (!response.results || response.results.length === 0) {
        return {
          transcript: '',
          confidence: 0,
          duration: 0,
          language: languageCode,
          success: false,
          error: 'No speech detected in audio',
          metadata: {
            audioEncoding: config.encoding,
            sampleRateHertz: config.sampleRateHertz,
            languageCode: config.languageCode,
            processingTime,
          },
        };
      }

      // Combine all transcripts and calculate average confidence
      let fullTranscript = '';
      let totalConfidence = 0;
      let resultCount = 0;

      response.results.forEach((result) => {
        if (result.alternatives && result.alternatives[0]) {
          fullTranscript += result.alternatives[0].transcript + ' ';
          totalConfidence += result.alternatives[0].confidence || 0;
          resultCount++;
        }
      });

      const averageConfidence = resultCount > 0 ? totalConfidence / resultCount : 0;

      return {
        transcript: fullTranscript.trim(),
        confidence: averageConfidence,
        duration: 0, // Duration will be set by the caller
        language: languageCode,
        success: true,
        metadata: {
          audioEncoding: config.encoding,
          sampleRateHertz: config.sampleRateHertz,
          languageCode: config.languageCode,
          processingTime,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        transcript: '',
        confidence: 0,
        duration: 0,
        language: languageCode,
        success: false,
        error: `Speech transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          audioEncoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: languageCode,
          processingTime,
        },
      };
    }
  }

  /**
   * Transcribe short audio file (< 60 seconds) using synchronous recognition
   */
  async transcribeShortAudio(
    audioPath: string,
    languageCode: string = 'en-US'
  ): Promise<SpeechTranscriptionResult> {
    const startTime = Date.now();

    try {
      // Read the audio file
      const audioBytes = fs.readFileSync(audioPath).toString('base64');

      const audio = {
        content: audioBytes,
      };

      const config = {
        encoding: 'LINEAR16' as const,
        sampleRateHertz: 16000,
        languageCode: languageCode,
        enableAutomaticPunctuation: true,
      };

      const request = {
        audio: audio,
        config: config,
      };

      // Perform the speech recognition request
      const [response] = await this.speechClient.recognize(request);

      const processingTime = Date.now() - startTime;

      if (!response.results || response.results.length === 0) {
        return {
          transcript: '',
          confidence: 0,
          duration: 0,
          language: languageCode,
          success: false,
          error: 'No speech detected in audio',
          metadata: {
            audioEncoding: config.encoding,
            sampleRateHertz: config.sampleRateHertz,
            languageCode: config.languageCode,
            processingTime,
          },
        };
      }

      // Combine all transcripts and calculate average confidence
      let fullTranscript = '';
      let totalConfidence = 0;
      let resultCount = 0;

      response.results.forEach((result) => {
        if (result.alternatives && result.alternatives[0]) {
          fullTranscript += result.alternatives[0].transcript + ' ';
          totalConfidence += result.alternatives[0].confidence || 0;
          resultCount++;
        }
      });

      const averageConfidence = resultCount > 0 ? totalConfidence / resultCount : 0;

      return {
        transcript: fullTranscript.trim(),
        confidence: averageConfidence,
        duration: 0, // Duration will be set by the caller
        language: languageCode,
        success: true,
        metadata: {
          audioEncoding: config.encoding,
          sampleRateHertz: config.sampleRateHertz,
          languageCode: config.languageCode,
          processingTime,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        transcript: '',
        confidence: 0,
        duration: 0,
        language: languageCode,
        success: false,
        error: `Speech transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          audioEncoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: languageCode,
          processingTime,
        },
      };
    }
  }

  /**
   * Auto-detect the best transcription method based on audio duration
   */
  async transcribeAudioAuto(
    audioPath: string,
    duration: number,
    languageCode: string = 'en-US'
  ): Promise<SpeechTranscriptionResult> {
    // Use synchronous recognition for short audio (< 60 seconds)
    // Use asynchronous recognition for longer audio
    if (duration < 60) {
      return this.transcribeShortAudio(audioPath, languageCode);
    } else {
      return this.transcribeAudio(audioPath, languageCode);
    }
  }
}

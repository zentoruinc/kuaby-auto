import { spawn } from "child_process";
import fs from "fs";
import * as path from "path";
import { nanoid } from "nanoid";

export interface VideoProcessingResult {
  audioPath: string;
  duration: number;
  success: boolean;
  error?: string;
}

export class VideoProcessor {
  private static ensureTempDir(): string {
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
  }

  static async extractAudio(videoPath: string): Promise<VideoProcessingResult> {
    return new Promise((resolve) => {
      const tempDir = this.ensureTempDir();
      const audioFileName = `${nanoid()}.wav`;
      const audioPath = path.join(tempDir, audioFileName);

      // Use ffmpeg to extract audio
      const ffmpeg = spawn("ffmpeg", [
        "-i",
        videoPath, // Input video file
        "-vn", // No video
        "-acodec",
        "pcm_s16le", // Audio codec (PCM 16-bit little-endian)
        "-ar",
        "16000", // Sample rate (16kHz for speech recognition)
        "-ac",
        "1", // Mono audio
        "-y", // Overwrite output file
        audioPath, // Output audio file
      ]);

      let duration = 0;
      let stderr = "";

      ffmpeg.stderr.on("data", (data) => {
        const output = data.toString();
        stderr += output;

        // Extract duration from ffmpeg output
        const durationMatch = output.match(
          /Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/
        );
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseFloat(durationMatch[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
        }
      });

      ffmpeg.on("close", (code) => {
        if (code === 0 && fs.existsSync(audioPath)) {
          resolve({
            audioPath,
            duration,
            success: true,
          });
        } else {
          resolve({
            audioPath: "",
            duration: 0,
            success: false,
            error: `FFmpeg process exited with code ${code}. Error: ${stderr}`,
          });
        }
      });

      ffmpeg.on("error", (error) => {
        resolve({
          audioPath: "",
          duration: 0,
          success: false,
          error: `Failed to spawn ffmpeg: ${error.message}`,
        });
      });
    });
  }

  static async getVideoInfo(videoPath: string): Promise<{
    duration: number;
    width: number;
    height: number;
    fps: number;
    success: boolean;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const ffprobe = spawn("ffprobe", [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        videoPath,
      ]);

      let stdout = "";
      let stderr = "";

      ffprobe.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffprobe.on("close", (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(stdout);
            const videoStream = info.streams.find(
              (stream: any) => stream.codec_type === "video"
            );

            if (videoStream) {
              resolve({
                duration: parseFloat(info.format.duration) || 0,
                width: videoStream.width || 0,
                height: videoStream.height || 0,
                fps: eval(videoStream.r_frame_rate) || 0, // e.g., "30/1" -> 30
                success: true,
              });
            } else {
              resolve({
                duration: 0,
                width: 0,
                height: 0,
                fps: 0,
                success: false,
                error: "No video stream found",
              });
            }
          } catch (error) {
            resolve({
              duration: 0,
              width: 0,
              height: 0,
              fps: 0,
              success: false,
              error: `Failed to parse ffprobe output: ${error}`,
            });
          }
        } else {
          resolve({
            duration: 0,
            width: 0,
            height: 0,
            fps: 0,
            success: false,
            error: `FFprobe process exited with code ${code}. Error: ${stderr}`,
          });
        }
      });

      ffprobe.on("error", (error) => {
        resolve({
          duration: 0,
          width: 0,
          height: 0,
          fps: 0,
          success: false,
          error: `Failed to spawn ffprobe: ${error.message}`,
        });
      });
    });
  }

  static cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(
          `[VideoProcessor] Successfully cleaned up temp file: ${filePath}`
        );
      } else {
        console.log(`[VideoProcessor] Temp file already removed: ${filePath}`);
      }
    } catch (error) {
      console.error(
        `[VideoProcessor] Failed to cleanup temp file ${filePath}:`,
        error
      );
    }
  }

  static cleanupTempFiles(filePaths: string[]): void {
    filePaths.forEach((filePath) => this.cleanupTempFile(filePath));
  }
}

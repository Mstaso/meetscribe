import { execFile } from "child_process";
import { access, readFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { homedir, tmpdir } from "os";
import type {
  TranscriptionProvider,
  TranscriptionProviderConfig,
  TranscriptionResult,
} from "./types";

const DEFAULT_BINARY = "whisper-cli";
const DEFAULT_MODELS_DIR = join(homedir(), ".meetscribe", "models");
const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export class WhisperCppProvider implements TranscriptionProvider {
  readonly id = "whisper-cpp";
  readonly name = "Whisper.cpp (Local)";
  readonly requiresApiKey = false;
  private binaryPath: string;
  private model: string;

  constructor(config: TranscriptionProviderConfig) {
    this.binaryPath = config.baseUrl || DEFAULT_BINARY;
    this.model = config.model || "base";
  }

  private getModelPath(): string {
    return join(DEFAULT_MODELS_DIR, `ggml-${this.model}.bin`);
  }

  private async ensureBinaryExists(): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(this.binaryPath, ["--help"], { timeout: 5000 }, (error) => {
        if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
          reject(
            new Error(
              `whisper-cli not found. Install it with: brew install whisper-cpp\n` +
                `Or download from https://github.com/ggerganov/whisper.cpp/releases ` +
                `and set the binary path in Settings.`
            )
          );
        } else {
          // --help returns non-zero exit code, but that's fine — binary exists
          resolve();
        }
      });
    });
  }

  private async ensureModelExists(): Promise<void> {
    const modelPath = this.getModelPath();
    try {
      await access(modelPath);
    } catch {
      throw new Error(
        `Whisper model not found at ${modelPath}\n\n` +
          `Download it with:\n` +
          `  mkdir -p ~/.meetscribe/models\n` +
          `  curl -L -o ~/.meetscribe/models/ggml-${this.model}.bin \\\n` +
          `    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${this.model}.bin\n\n` +
          `Available models: tiny (75MB), base (142MB), small (466MB), medium (1.5GB), large-v3 (3GB)`
      );
    }
  }

  async transcribe(
    filePath: string,
    options?: { model?: string; language?: string }
  ): Promise<TranscriptionResult> {
    await this.ensureBinaryExists();
    await this.ensureModelExists();

    const modelPath = this.getModelPath();

    // Create a temp directory for whisper output
    const tempDir = await mkdtemp(join(tmpdir(), "meetscribe-"));
    const outputBase = join(tempDir, "output");

    const args = [
      "-m", modelPath,
      "-f", filePath,
      "-oj",                  // output JSON
      "-of", outputBase,      // output file base name (whisper adds .json)
      "--no-prints",          // suppress progress to stderr
    ];

    if (options?.language) {
      args.push("-l", options.language);
    }

    try {
      await this.runWhisper(args);

      // whisper.cpp writes output.json
      const jsonPath = `${outputBase}.json`;
      const raw = await readFile(jsonPath, "utf-8");
      const data = JSON.parse(raw);

      // Clean up temp files
      await unlink(jsonPath).catch(() => {});

      return this.parseOutput(data);
    } catch (error) {
      // Clean up on error too
      await unlink(`${outputBase}.json`).catch(() => {});

      if (error instanceof Error) {
        // Detect common failure modes
        if (error.message.includes("SIGKILL") || error.message.includes("signal: 9")) {
          throw new Error(
            `Whisper process was killed (likely out of memory). ` +
              `Try a smaller model — current: "${this.model}". ` +
              `Model sizes: tiny < base < small < medium < large-v3`
          );
        }
        if (error.message.includes("ffmpeg") || error.message.includes("Failed to open")) {
          throw new Error(
            `whisper.cpp could not read the audio file. ` +
              `Make sure ffmpeg is installed: brew install ffmpeg`
          );
        }
        if (error.message.includes("TIMEOUT")) {
          throw new Error(
            `Transcription timed out after 30 minutes. ` +
              `Try a smaller model for faster processing — current: "${this.model}".`
          );
        }
      }
      throw error;
    }
  }

  private runWhisper(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        this.binaryPath,
        args,
        { timeout: TIMEOUT_MS, maxBuffer: 50 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            if (error.killed) {
              reject(new Error("TIMEOUT: Whisper process timed out"));
            } else {
              reject(
                new Error(
                  `Whisper failed (exit code ${error.code}): ${stderr || error.message}`
                )
              );
            }
          } else {
            resolve(stdout);
          }
        }
      );
    });
  }

  private parseOutput(data: unknown): TranscriptionResult {
    // whisper.cpp JSON format can vary by version.
    // Handle both common structures defensively.
    let text = "";
    let duration: number | undefined;

    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;

      // Format 1: { transcription: [{ text: "..." }] }
      if (Array.isArray(obj.transcription)) {
        text = obj.transcription
          .map((seg: Record<string, unknown>) =>
            typeof seg.text === "string" ? seg.text.trim() : ""
          )
          .filter(Boolean)
          .join(" ");

        // Get duration from last segment's timestamp
        const lastSeg = obj.transcription[obj.transcription.length - 1] as
          | Record<string, unknown>
          | undefined;
        if (lastSeg?.timestamps && typeof lastSeg.timestamps === "object") {
          const ts = lastSeg.timestamps as Record<string, string>;
          duration = this.parseTimestamp(ts.to);
        }
        if (lastSeg?.offsets && typeof lastSeg.offsets === "object") {
          const offsets = lastSeg.offsets as Record<string, number>;
          if (typeof offsets.to === "number") {
            duration = Math.round(offsets.to / 1000);
          }
        }
      }

      // Format 2: { result: { segments: [{ text: "..." }] } }
      if (!text && obj.result && typeof obj.result === "object") {
        const result = obj.result as Record<string, unknown>;
        if (Array.isArray(result.segments)) {
          text = result.segments
            .map((seg: Record<string, unknown>) =>
              typeof seg.text === "string" ? seg.text.trim() : ""
            )
            .filter(Boolean)
            .join(" ");
        }
      }

      // Format 3: top-level segments array
      if (!text && Array.isArray(obj.segments)) {
        text = obj.segments
          .map((seg: Record<string, unknown>) =>
            typeof seg.text === "string" ? seg.text.trim() : ""
          )
          .filter(Boolean)
          .join(" ");
      }
    }

    if (!text) {
      throw new Error(
        "Could not parse whisper.cpp output. The JSON format may have changed."
      );
    }

    return { text, duration };
  }

  private parseTimestamp(ts: string | undefined): number | undefined {
    if (!ts) return undefined;
    // Format: "HH:MM:SS.mmm" or "MM:SS.mmm"
    const parts = ts.split(":");
    if (parts.length === 3) {
      const hours = parseInt(parts[0], 10);
      const mins = parseInt(parts[1], 10);
      const secs = parseFloat(parts[2]);
      return Math.round(hours * 3600 + mins * 60 + secs);
    }
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10);
      const secs = parseFloat(parts[1]);
      return Math.round(mins * 60 + secs);
    }
    return undefined;
  }
}

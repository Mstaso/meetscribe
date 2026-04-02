import { execFile } from "child_process";
import { access, readFile, unlink, mkdtemp, readdir } from "fs/promises";
import { join, basename } from "path";
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
    const tempDir = await mkdtemp(join(tmpdir(), "meetscribe-"));
    const outputBase = join(tempDir, "output");

    // whisper.cpp only reads WAV natively — convert other formats via ffmpeg
    const ext = filePath.split(".").pop()?.toLowerCase();
    let audioPath = filePath;
    if (ext !== "wav") {
      audioPath = join(tempDir, "input.wav");
      await this.convertToWav(filePath, audioPath);
    }

    const args = [
      "-m", modelPath,
      "-f", audioPath,
      "-oj",                  // output JSON
      "-of", outputBase,      // output file base name
      "--no-prints",          // suppress progress to stderr
    ];

    if (options?.language) {
      args.push("-l", options.language);
    }

    try {
      const stdout = await this.runWhisper(args);

      // Strategy 1: Look for output.json at the expected path
      // Strategy 2: Look for any .json file in the temp dir (some versions name differently)
      // Strategy 3: Parse stdout as JSON (some versions print JSON to stdout)
      // Strategy 4: Use plain text output as fallback

      const jsonData = await this.findAndReadJsonOutput(tempDir, outputBase, stdout, filePath);

      if (jsonData) {
        return this.parseJsonOutput(jsonData);
      }

      // Strategy 4: Look for .txt output or use stdout as plain text
      const textResult = await this.findTextOutput(tempDir, outputBase, stdout);
      if (textResult) {
        return { text: textResult };
      }

      throw new Error(
        "whisper.cpp ran but produced no output. " +
          "Try running whisper-cli manually to check: " +
          `whisper-cli -m ${modelPath} -f "${filePath}" -oj`
      );
    } catch (error) {
      if (error instanceof Error) {
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
    } finally {
      // Clean up all temp files
      try {
        const files = await readdir(tempDir);
        for (const f of files) {
          await unlink(join(tempDir, f)).catch(() => {});
        }
      } catch {
        // temp dir cleanup is best-effort
      }
    }
  }

  private convertToWav(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(
        "ffmpeg",
        [
          "-i", inputPath,
          "-ar", "16000",     // 16kHz sample rate (what Whisper expects)
          "-ac", "1",         // mono
          "-c:a", "pcm_s16le", // 16-bit PCM WAV
          "-y",               // overwrite output
          outputPath,
        ],
        { timeout: 5 * 60 * 1000 }, // 5 min timeout for conversion
        (error, _stdout, stderr) => {
          if (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
              reject(
                new Error(
                  "ffmpeg not found. It is required to process non-WAV audio files.\n" +
                    "Install it with: brew install ffmpeg"
                )
              );
            } else {
              reject(
                new Error(`ffmpeg conversion failed: ${stderr || error.message}`)
              );
            }
          } else {
            resolve();
          }
        }
      );
    });
  }

  private async findAndReadJsonOutput(
    tempDir: string,
    outputBase: string,
    stdout: string,
    filePath: string
  ): Promise<unknown | null> {
    // Try exact expected path first
    const expectedPath = `${outputBase}.json`;
    try {
      const raw = await readFile(expectedPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      // Not at expected path
    }

    // Search temp dir for any .json file whisper might have created
    try {
      const files = await readdir(tempDir);
      const jsonFile = files.find((f) => f.endsWith(".json"));
      if (jsonFile) {
        const raw = await readFile(join(tempDir, jsonFile), "utf-8");
        return JSON.parse(raw);
      }
    } catch {
      // No json files found
    }

    // Some versions write JSON next to the input file instead of the -of path
    const inputJsonPath = filePath.replace(/\.[^.]+$/, ".json");
    try {
      const raw = await readFile(inputJsonPath, "utf-8");
      const data = JSON.parse(raw);
      // Clean up — we don't want to leave .json files next to uploads
      await unlink(inputJsonPath).catch(() => {});
      return data;
    } catch {
      // Not next to input file either
    }

    // Try parsing stdout as JSON
    const trimmedStdout = stdout.trim();
    if (trimmedStdout.startsWith("{") || trimmedStdout.startsWith("[")) {
      try {
        return JSON.parse(trimmedStdout);
      } catch {
        // stdout isn't JSON
      }
    }

    return null;
  }

  private async findTextOutput(
    tempDir: string,
    outputBase: string,
    stdout: string
  ): Promise<string | null> {
    // Check for .txt file in temp dir
    const expectedTxt = `${outputBase}.txt`;
    try {
      const raw = await readFile(expectedTxt, "utf-8");
      if (raw.trim()) return raw.trim();
    } catch {
      // no txt file
    }

    // Search temp dir for any .txt file
    try {
      const files = await readdir(tempDir);
      const txtFile = files.find((f) => f.endsWith(".txt"));
      if (txtFile) {
        const raw = await readFile(join(tempDir, txtFile), "utf-8");
        if (raw.trim()) return raw.trim();
      }
    } catch {
      // no txt files
    }

    // Use stdout if it has meaningful text content
    const trimmed = stdout.trim();
    if (trimmed.length > 20 && !trimmed.startsWith("{")) {
      // Strip whisper.cpp timing markers like [00:00:00.000 --> 00:00:05.000]
      const cleaned = trimmed
        .replace(/\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]\s*/g, "")
        .trim();
      if (cleaned) return cleaned;
    }

    return null;
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

  private parseJsonOutput(data: unknown): TranscriptionResult {
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

      // Format 4: top-level text field
      if (!text && typeof obj.text === "string") {
        text = obj.text.trim();
      }
    }

    if (!text) {
      throw new Error(
        "Could not parse whisper.cpp JSON output. The format may have changed."
      );
    }

    return { text, duration };
  }

  private parseTimestamp(ts: string | undefined): number | undefined {
    if (!ts) return undefined;
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

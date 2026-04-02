# MeetScribe

AI-powered meeting transcription and notes. Upload audio/video recordings and get automatic summaries and action items. Runs locally with privacy-first defaults.

## Features

- Upload audio/video files (mp3, wav, mp4, webm, m4a, ogg, mov)
- Automatic transcription via local Whisper.cpp or OpenAI Whisper API
- AI-generated meeting summaries and action item extraction
- Pluggable LLM providers (Ollama local, OpenAI, Anthropic Claude)
- Export notes as Markdown
- Toggle action items as complete
- All provider settings configurable from the UI

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)

## Setup

```bash
# 1. Clone the repo and install dependencies
git clone <your-repo-url> meetscribe
cd meetscribe
pnpm install

# 2. Set up the database (SQLite, just a local file)
npx prisma db push
npx prisma generate

# 3. Start the app
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and go to **Settings** to configure your providers.

## Transcription Setup

### Option A: Local Whisper.cpp (recommended, fully private)

No audio data leaves your machine.

**macOS:**

```bash
brew install whisper-cpp
```

**Linux:**

```bash
# Build from source
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
make
sudo cp build/bin/whisper-cli /usr/local/bin/
```

**Download a model:**

```bash
mkdir -p ~/.meetscribe/models

# Base model (142MB) — good balance of speed and accuracy
curl -L -o ~/.meetscribe/models/ggml-base.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
```

Available models (pick one):

| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| tiny | 75 MB | Fastest | Lower |
| base | 142 MB | Fast | Good |
| small | 466 MB | Moderate | Better |
| medium | 1.5 GB | Slow | Great |
| large-v3 | 3 GB | Slowest | Best |

For meetings up to 45 minutes, `base` or `small` is recommended.

Then in MeetScribe Settings: select **Whisper.cpp (Local)**, set model to `base` (or whichever you downloaded), and save.

### Option B: OpenAI Whisper API (cloud)

Select **OpenAI Whisper (Cloud)** in Settings and enter your OpenAI API key. Audio is sent to OpenAI's servers for processing.

## LLM Setup

Configure which AI model generates summaries and extracts action items.

### Ollama (local, private)

```bash
# Install Ollama
brew install ollama    # macOS
# or see https://ollama.ai for Linux

# Pull a model
ollama pull llama3
```

In Settings: select **Ollama (Local)**, model = `llama3`, save.

### OpenAI

In Settings: select **OpenAI**, enter your API key, model = `gpt-oss` (or your company's available model), save.

### Anthropic (Claude)

In Settings: select **Anthropic (Claude)**, enter your API key, save.

## Quick Start on a New Machine

```bash
# Install everything
pnpm install
npx prisma db push
npx prisma generate

# Set up local transcription
brew install whisper-cpp
mkdir -p ~/.meetscribe/models
curl -L -o ~/.meetscribe/models/ggml-base.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin

# Set up local LLM (optional — or use a cloud provider)
brew install ollama
ollama pull llama3

# Run
pnpm dev
```

## Project Structure

```
src/
  app/                  # Next.js pages and API routes
  providers/
    llm/                # LLM providers (OpenAI, Anthropic, Ollama)
    transcription/      # Transcription providers (Whisper.cpp, Whisper API)
  lib/
    pipeline.ts         # Upload -> Transcribe -> Summarize -> Store
    prompts.ts          # LLM prompt templates
    parse-action-items.ts  # Robust JSON parsing for weaker models
    export.ts           # Markdown export generation
  server/db.ts          # Prisma client (SQLite)
  components/           # MUI React components
  theme/                # Material UI theme config
prisma/schema.prisma    # Database schema
uploads/                # Uploaded audio files (gitignored)
```

## Tech Stack

- **Framework:** Next.js (App Router)
- **UI:** Material UI (MUI)
- **Database:** SQLite via Prisma
- **AI:** Zero vendor SDKs — all providers use raw `fetch()` calls

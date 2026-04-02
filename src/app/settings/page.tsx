"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import SaveIcon from "@mui/icons-material/Save";

interface ProviderInfo {
  id: string;
  name: string;
  requiresApiKey: boolean;
  defaultModel: string;
}

interface Settings {
  transcriptionProvider: string;
  transcriptionApiKey: string | null;
  transcriptionModel: string | null;
  transcriptionBaseUrl: string | null;
  llmProvider: string;
  llmApiKey: string | null;
  llmModel: string | null;
  llmBaseUrl: string | null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [llmProviders, setLlmProviders] = useState<ProviderInfo[]>([]);
  const [transcriptionProviders, setTranscriptionProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state (separate from saved settings so we can track changes)
  const [llmProvider, setLlmProvider] = useState("");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [llmBaseUrl, setLlmBaseUrl] = useState("");
  const [transcriptionProvider, setTranscriptionProvider] = useState("");
  const [transcriptionApiKey, setTranscriptionApiKey] = useState("");
  const [transcriptionModel, setTranscriptionModel] = useState("");
  const [transcriptionBaseUrl, setTranscriptionBaseUrl] = useState("");

  useEffect(() => {
    async function fetchSettings() {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data.settings);
      setLlmProviders(data.availableLLMProviders);
      setTranscriptionProviders(data.availableTranscriptionProviders);

      // Initialize form
      setLlmProvider(data.settings.llmProvider);
      setLlmModel(data.settings.llmModel ?? "");
      setLlmBaseUrl(data.settings.llmBaseUrl ?? "");
      setTranscriptionProvider(data.settings.transcriptionProvider);
      setTranscriptionModel(data.settings.transcriptionModel ?? "");
      setTranscriptionBaseUrl(data.settings.transcriptionBaseUrl ?? "");
      setLoading(false);
    }
    fetchSettings();
  }, []);

  const selectedLlm = llmProviders.find((p) => p.id === llmProvider);
  const selectedTranscription = transcriptionProviders.find(
    (p) => p.id === transcriptionProvider
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const body: Record<string, string> = {
        llmProvider,
        llmModel,
        llmBaseUrl,
        transcriptionProvider,
        transcriptionModel,
        transcriptionBaseUrl,
      };

      // Only send API keys if they were changed (not the masked value)
      if (llmApiKey && llmApiKey !== "••••••••") {
        body.llmApiKey = llmApiKey;
      }
      if (transcriptionApiKey && transcriptionApiKey !== "••••••••") {
        body.transcriptionApiKey = transcriptionApiKey;
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to save settings");

      const data = await res.json();
      setSettings(data.settings);
      setLlmApiKey("");
      setTranscriptionApiKey("");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 700, mx: "auto" }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Settings
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
          Settings saved successfully.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            LLM Provider
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose which AI model to use for generating summaries and extracting action items.
          </Typography>

          <TextField
            select
            label="Provider"
            fullWidth
            value={llmProvider}
            onChange={(e) => {
              setLlmProvider(e.target.value);
              const provider = llmProviders.find((p) => p.id === e.target.value);
              if (provider) setLlmModel(provider.defaultModel);
            }}
            sx={{ mb: 2 }}
          >
            {llmProviders.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>

          {selectedLlm?.requiresApiKey && (
            <TextField
              label="API Key"
              fullWidth
              type="password"
              value={llmApiKey}
              onChange={(e) => setLlmApiKey(e.target.value)}
              placeholder={settings?.llmApiKey ? "••••••••  (saved — enter new to change)" : "Enter API key"}
              sx={{ mb: 2 }}
            />
          )}

          <TextField
            label="Model"
            fullWidth
            value={llmModel}
            onChange={(e) => setLlmModel(e.target.value)}
            placeholder={selectedLlm?.defaultModel ?? "Model name"}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Base URL (optional)"
            fullWidth
            value={llmBaseUrl}
            onChange={(e) => setLlmBaseUrl(e.target.value)}
            placeholder={llmProvider === "ollama" ? "http://localhost:11434" : "Leave empty for default"}
            helperText={
              llmProvider === "ollama"
                ? "Default: http://localhost:11434"
                : "Only needed for custom/self-hosted endpoints"
            }
          />
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Transcription Provider
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose which service to use for converting audio to text.
          </Typography>

          <TextField
            select
            label="Provider"
            fullWidth
            value={transcriptionProvider}
            onChange={(e) => {
              setTranscriptionProvider(e.target.value);
              const provider = transcriptionProviders.find(
                (p) => p.id === e.target.value
              );
              if (provider) setTranscriptionModel(provider.defaultModel);
            }}
            sx={{ mb: 2 }}
          >
            {transcriptionProviders.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>

          {selectedTranscription?.requiresApiKey && (
            <TextField
              label="API Key"
              fullWidth
              type="password"
              value={transcriptionApiKey}
              onChange={(e) => setTranscriptionApiKey(e.target.value)}
              placeholder={
                settings?.transcriptionApiKey
                  ? "••••••••  (saved — enter new to change)"
                  : "Enter API key"
              }
              sx={{ mb: 2 }}
            />
          )}

          <TextField
            label="Model"
            fullWidth
            value={transcriptionModel}
            onChange={(e) => setTranscriptionModel(e.target.value)}
            placeholder={selectedTranscription?.defaultModel ?? "Model name"}
            sx={{ mb: 2 }}
            helperText={
              transcriptionProvider === "whisper-cpp"
                ? "Model size: tiny, base, small, medium, or large-v3 (larger = more accurate but slower)"
                : undefined
            }
          />

          <TextField
            label={transcriptionProvider === "whisper-cpp" ? "Binary path (optional)" : "Base URL (optional)"}
            fullWidth
            value={transcriptionBaseUrl}
            onChange={(e) => setTranscriptionBaseUrl(e.target.value)}
            placeholder={
              transcriptionProvider === "whisper-cpp"
                ? "whisper-cli (default, uses PATH)"
                : "Leave empty for default"
            }
            helperText={
              transcriptionProvider === "whisper-cpp"
                ? "Leave empty if installed via: brew install whisper-cpp"
                : "Only needed for self-hosted endpoints"
            }
          />
        </CardContent>
      </Card>

      <Divider sx={{ mb: 3 }} />

      <Button
        variant="contained"
        size="large"
        fullWidth
        startIcon={<SaveIcon />}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </Box>
  );
}

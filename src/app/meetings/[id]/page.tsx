"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Checkbox from "@mui/material/Checkbox";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import ReplayIcon from "@mui/icons-material/Replay";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Link from "next/link";

interface ActionItem {
  id: string;
  content: string;
  assignee: string | null;
  priority: string | null;
  dueDate: string | null;
  completed: boolean;
}

interface Decision {
  id: string;
  content: string;
  rationale: string | null;
  decisionMakers: string | null;
}

interface OpenQuestion {
  id: string;
  question: string;
  context: string | null;
  owner: string | null;
}

interface Meeting {
  id: string;
  title: string;
  fileName: string;
  status: string;
  duration: number | null;
  errorMessage: string | null;
  transcript: string | null;
  summary: string | null;
  createdAt: string;
  actionItems: ActionItem[];
  decisions: Decision[];
  openQuestions: OpenQuestion[];
}

const statusLabels: Record<string, string> = {
  uploaded: "Uploaded",
  transcribing: "Transcribing...",
  summarizing: "Summarizing...",
  complete: "Complete",
  error: "Error",
};

const statusColors: Record<string, "default" | "info" | "warning" | "success" | "error"> = {
  uploaded: "default",
  transcribing: "info",
  summarizing: "warning",
  complete: "success",
  error: "error",
};

export default function MeetingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  const fetchMeeting = useCallback(async () => {
    const res = await fetch(`/api/meetings/${params.id}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setMeeting(data);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    fetchMeeting();
  }, [fetchMeeting]);

  // Poll while processing
  useEffect(() => {
    if (!meeting) return;
    const isProcessing = ["uploaded", "transcribing", "summarizing"].includes(meeting.status);
    if (!isProcessing) return;

    const interval = setInterval(fetchMeeting, 2000);
    return () => clearInterval(interval);
  }, [meeting, fetchMeeting]);

  const toggleActionItem = async (actionItem: ActionItem) => {
    await fetch(`/api/meetings/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionItemId: actionItem.id,
        completed: !actionItem.completed,
      }),
    });
    fetchMeeting();
  };

  const handleRetry = async () => {
    await fetch(`/api/meetings/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retry: true }),
    });
    fetchMeeting();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this meeting? This cannot be undone.")) return;
    await fetch(`/api/meetings/${params.id}`, { method: "DELETE" });
    router.push("/");
  };

  const handleExport = () => {
    window.open(`/api/meetings/${params.id}/export?format=md`, "_blank");
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!meeting) {
    return (
      <Box sx={{ textAlign: "center", mt: 8 }}>
        <Typography variant="h5" color="text.secondary">
          Meeting not found
        </Typography>
        <Button component={Link} href="/" sx={{ mt: 2 }}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  const isProcessing = ["uploaded", "transcribing", "summarizing"].includes(meeting.status);

  return (
    <Box>
      <Button
        component={Link}
        href="/"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
      >
        Back to Dashboard
      </Button>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {meeting.title}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Chip
              label={statusLabels[meeting.status] ?? meeting.status}
              color={statusColors[meeting.status] ?? "default"}
              size="small"
            />
            <Typography variant="body2" color="text.secondary">
              {new Date(meeting.createdAt).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Typography>
            {meeting.duration && (
              <Typography variant="body2" color="text.secondary">
                {Math.floor(meeting.duration / 60)}m {meeting.duration % 60}s
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          {meeting.status === "complete" && (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
            >
              Export
            </Button>
          )}
          {meeting.status === "error" && (
            <Button
              variant="outlined"
              startIcon={<ReplayIcon />}
              onClick={handleRetry}
            >
              Retry
            </Button>
          )}
          <IconButton color="error" onClick={handleDelete}>
            <DeleteIcon />
          </IconButton>
        </Box>
      </Box>

      {isProcessing && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="body1" gutterBottom>
              Processing your meeting...
            </Typography>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {statusLabels[meeting.status]}
            </Typography>
          </CardContent>
        </Card>
      )}

      {meeting.status === "error" && meeting.errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {meeting.errorMessage}
        </Alert>
      )}

      {meeting.status === "complete" && (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Summary" />
            <Tab label={`Action Items (${meeting.actionItems.length})`} />
            <Tab label={`Decisions (${meeting.decisions.length})`} />
            <Tab label={`Open Questions (${meeting.openQuestions.length})`} />
            <Tab label="Transcript" />
          </Tabs>

          <Divider sx={{ mb: 2 }} />

          {tab === 0 && (
            <Card>
              <CardContent>
                <Typography
                  variant="body1"
                  sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}
                >
                  {meeting.summary || "No summary generated."}
                </Typography>
              </CardContent>
            </Card>
          )}

          {tab === 1 && (
            <Card>
              <CardContent>
                {meeting.actionItems.length === 0 ? (
                  <Typography color="text.secondary">
                    No action items were identified in this meeting.
                  </Typography>
                ) : (
                  <List disablePadding>
                    {meeting.actionItems.map((item) => {
                      const secondaryParts: string[] = [];
                      if (item.assignee) secondaryParts.push(`Assigned to: ${item.assignee}`);
                      if (item.priority) secondaryParts.push(`Priority: ${item.priority}`);
                      if (item.dueDate) secondaryParts.push(`Due: ${item.dueDate}`);
                      const secondary = secondaryParts.length > 0 ? secondaryParts.join(" · ") : null;

                      return (
                        <ListItem
                          key={item.id}
                          disablePadding
                          secondaryAction={
                            item.priority ? (
                              <Chip
                                label={item.priority.toUpperCase()}
                                size="small"
                                color={
                                  item.priority === "high" ? "error" :
                                  item.priority === "medium" ? "warning" : "default"
                                }
                                variant="outlined"
                              />
                            ) : undefined
                          }
                        >
                          <ListItemButton onClick={() => toggleActionItem(item)} dense>
                            <ListItemIcon>
                              <Checkbox
                                edge="start"
                                checked={item.completed}
                                tabIndex={-1}
                                disableRipple
                              />
                            </ListItemIcon>
                            <ListItemText
                              primary={item.content}
                              secondary={secondary}
                              sx={{
                                textDecoration: item.completed ? "line-through" : "none",
                                color: item.completed ? "text.secondary" : "text.primary",
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 2 && (
            <Card>
              <CardContent>
                {meeting.decisions.length === 0 ? (
                  <Typography color="text.secondary">
                    No key decisions were identified in this meeting.
                  </Typography>
                ) : (
                  <List disablePadding>
                    {meeting.decisions.map((item) => {
                      const secondaryParts: string[] = [];
                      if (item.rationale) secondaryParts.push(item.rationale);
                      if (item.decisionMakers) secondaryParts.push(`Decided by: ${item.decisionMakers}`);
                      const secondary = secondaryParts.length > 0 ? secondaryParts.join(" · ") : null;

                      return (
                        <ListItem key={item.id}>
                          <ListItemText
                            primary={item.content}
                            secondary={secondary}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 3 && (
            <Card>
              <CardContent>
                {meeting.openQuestions.length === 0 ? (
                  <Typography color="text.secondary">
                    No open questions were identified in this meeting.
                  </Typography>
                ) : (
                  <List disablePadding>
                    {meeting.openQuestions.map((item) => {
                      const secondaryParts: string[] = [];
                      if (item.context) secondaryParts.push(item.context);
                      if (item.owner) secondaryParts.push(`Owner: ${item.owner}`);
                      const secondary = secondaryParts.length > 0 ? secondaryParts.join(" · ") : null;

                      return (
                        <ListItem key={item.id}>
                          <ListItemText
                            primary={item.question}
                            secondary={secondary}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 4 && (
            <Card>
              <CardContent>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.8,
                    fontFamily: "monospace",
                    maxHeight: 600,
                    overflow: "auto",
                  }}
                >
                  {meeting.transcript || "No transcript available."}
                </Typography>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}

"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import CircularProgress from "@mui/material/CircularProgress";
import AddIcon from "@mui/icons-material/Add";
import Link from "next/link";

interface Meeting {
  id: string;
  title: string;
  fileName: string;
  status: string;
  duration: number | null;
  createdAt: string;
  actionItems: { id: string; completed: boolean }[];
}

const statusColors: Record<string, "default" | "info" | "warning" | "success" | "error"> = {
  uploaded: "default",
  transcribing: "info",
  summarizing: "warning",
  complete: "success",
  error: "error",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Dashboard() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchMeetings() {
      try {
        const res = await fetch("/api/meetings", { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setMeetings(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        setLoading(false);
      }
    }
    fetchMeetings();

    const interval = setInterval(fetchMeetings, 3000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Meetings</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          component={Link}
          href="/upload"
        >
          Upload Meeting
        </Button>
      </Box>

      {meetings.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No meetings yet
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Upload an audio or video file to get started.
            </Typography>
            <Button variant="outlined" component={Link} href="/upload">
              Upload your first meeting
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {meetings.map((meeting) => {
            const completedActions = meeting.actionItems.filter((a) => a.completed).length;
            const totalActions = meeting.actionItems.length;

            return (
              <Grid key={meeting.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card>
                  <CardActionArea
                    component={Link}
                    href={`/meetings/${meeting.id}`}
                  >
                    <CardContent>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                        <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>
                          {meeting.title}
                        </Typography>
                        <Chip
                          label={meeting.status}
                          color={statusColors[meeting.status] ?? "default"}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(meeting.createdAt)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Duration: {formatDuration(meeting.duration)}
                      </Typography>
                      {totalActions > 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          Action items: {completedActions}/{totalActions} done
                        </Typography>
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}

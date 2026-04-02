import type { Metadata } from "next";
import ThemeRegistry from "@/theme/ThemeRegistry";
import Nav from "@/components/Nav";
import Box from "@mui/material/Box";

export const metadata: Metadata = {
  title: "MeetScribe",
  description: "AI-powered meeting transcription and notes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <Nav />
          <Box component="main" sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
            {children}
          </Box>
        </ThemeRegistry>
      </body>
    </html>
  );
}

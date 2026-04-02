"use client";

import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import DescriptionIcon from "@mui/icons-material/Description";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Upload", href: "/upload" },
  { label: "Settings", href: "/settings" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <AppBar position="static" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Toolbar>
        <DescriptionIcon sx={{ mr: 1 }} />
        <Typography variant="h6" sx={{ mr: 4, fontWeight: 700 }}>
          MeetScribe
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {navItems.map((item) => (
            <Button
              key={item.href}
              component={Link}
              href={item.href}
              color="inherit"
              variant={pathname === item.href ? "outlined" : "text"}
              sx={{
                borderColor: pathname === item.href ? "rgba(255,255,255,0.5)" : "transparent",
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

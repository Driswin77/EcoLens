import React from "react";
import {
  Drawer,
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Switch,
  Card,
  LinearProgress,
} from "@mui/material";
import { Scale, ScaleIcon } from "lucide-react";

// Icons
import DashboardIcon from "@mui/icons-material/Dashboard";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import MapIcon from "@mui/icons-material/Map";
import FolderIcon from "@mui/icons-material/Folder";
import ReportIcon from "@mui/icons-material/Report";
import EcoIcon from "@mui/icons-material/EnergySavingsLeaf";
import LogoutIcon from "@mui/icons-material/Logout"; // Added Logout Icon

const drawerWidth = 260;

// Update props to accept 'user' and 'onLogout'
export default function Sidebar({ currentView, onNavigate, user, onLogout }) {
  
  // Menu Items Configuration
  const menuItems = [
    { text: "Dashboard", icon: <DashboardIcon />, view: "Dashboard" },
    { text: "Visual Scanner", icon: <CameraAltIcon />, view: "VisualScanner" },
    { text: "Eco Map & Impact", icon: <MapIcon />, view: "EcoMap" },
    { text: "Digital Glovebox", icon: <FolderIcon />, view: "Glovebox" },
    { text: "Legal Advisor", icon: <ScaleIcon />, view: "LegalAdvisor" },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          // Dark Green Gradient Background
          background: "linear-gradient(180deg, #0b3d2e, #062b20)",
          color: "#dff6ee",
          borderRight: "none",
        },
      }}
    >
      {/* APP LOGO */}
<Box sx={{ 
    px: 3,      // Keep side padding
    pt: 3,      // Keep top padding
    pb: -2,      // <--- CHANGE THIS: Reduces space below the logo
    display: "flex", 
    alignItems: "center", 
    gap: 0.5 
}}>
  <Box 
    component="img" 
    src="/logo2.png" 
    alt="EcoLens Logo"
    sx={{ 
      height: 75, 
      width: '80px',
      mb: 0,
    }} 
  />
  <Typography variant="h6" fontWeight="bold">
      EcoLens
  </Typography>
</Box>
      {/* NAVIGATION MENU */}
      <List>
        {menuItems.map((item, index) => {
          const isActive = currentView === item.view;

          return (
            <ListItemButton
              key={index}
              onClick={() => onNavigate(item.view)}
              sx={{
                mx: 2,
                my: 0.5,
                borderRadius: 2,
                // Active State Styling
                backgroundColor: isActive ? "rgba(74, 222, 128, 0.15)" : "transparent",
                borderLeft: isActive ? "4px solid #4ade80" : "4px solid transparent",
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.08)",
                },
              }}
            >
              <ListItemIcon sx={{ color: isActive ? "#4ade80" : "#8ff0c8", minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text} 
                primaryTypographyProps={{ 
                  fontWeight: isActive ? "bold" : "medium",
                  fontSize: "0.95rem",
                  color: isActive ? "#fff" : "inherit"
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      {/* Spacer to push content to bottom */}
      <Box sx={{ flexGrow: 1 }} />

      {/* BOTTOM CONTROLS */}
      <Box sx={{ px: 3, pb: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="body2" sx={{opacity: 0.8}}>Eco-Pilot</Typography>
          <Switch notchecked color="success" size="small" />
        </Box>

        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="body2" sx={{opacity: 0.8}}>Push Alerts</Typography>
          <Switch notchecked color="success" size="small" />
        </Box>
      </Box>

      {/* NEW: USER PROFILE & LOGOUT SECTION */}
      {user && (
        <Box sx={{ p: 2, borderTop: "1px solid rgba(255,255,255,0.1)", backgroundColor: "rgba(0,0,0,0.2)" }}>
            <Box sx={{ px: 1, mb: 1 }}>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", textTransform: 'uppercase', fontSize: '0.7rem' }}>
                    Signed in as
                </Typography>
                <Typography variant="subtitle1" sx={{ color: "#fff", fontWeight: "bold", lineHeight: 1.2 }}>
                    {user.name}
                </Typography>
            </Box>
            
            <ListItemButton 
                onClick={onLogout} 
                sx={{ 
                    borderRadius: 2, 
                    color: "#f87171", // Red color for warning/logout
                    backgroundColor: "rgba(248, 113, 113, 0.1)",
                    '&:hover': { backgroundColor: "rgba(248, 113, 113, 0.2)" } 
                }}
            >
                <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>
                    <LogoutIcon />
                </ListItemIcon>
                <ListItemText primary="Log Out" primaryTypographyProps={{ fontWeight: 'bold', fontSize: '0.9rem' }} />
            </ListItemButton>
        </Box>
      )}

    </Drawer>
  );
}
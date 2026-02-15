import { useState } from "react";
import { Box, CssBaseline } from "@mui/material";

// Import Components
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import VisualScanner from "./components/VisualScanner";
import Ecomap from "./components/Ecomap";
import Glovebox from "./components/Glovebox";
import ReportPage from "./Pages/ReportPage";
import LoginPage from "./components/LoginPage"; 

function App() {
  // State to track the currently logged-in user
  // Starts as null EVERY TIME to force Login
  const [currentUser, setCurrentUser] = useState(null);
  
  // Default view state
  const [currentView, setCurrentView] = useState("Dashboard");

  // Function to handle successful login
  const handleLogin = (user) => {
    setCurrentUser(user);
    // Note: We do NOT save to localStorage, so it resets on refresh.
  };

  // Function to handle logout
  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView("Dashboard"); 
  };

  // --- THE GATEKEEPER ---
  // If no user is logged in, show the Login Page immediately.
  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // If user is logged in, show the main app
  return (
    <Box
      sx={{
        display: "flex",
        width: "100%",
        height: "100vh",
        bgcolor: "#000",
        overflow: "hidden",
      }}
    >
      <CssBaseline />

      {/* SIDEBAR NAVIGATION */}
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        user={currentUser}
        onLogout={handleLogout}
      />

      {/* MAIN CONTENT AREA */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          height: "100%",
          // Dynamic Background: Black for Scanner, Light Gray for others
          bgcolor: currentView === "VisualScanner" ? "#000" : "#f3f4f6",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* --- VIEW ROUTING LOGIC --- */}

        {/* 1. Dashboard View */}
        {currentView === "Dashboard" && (
          <Box sx={{ p: 4, height: "100%", overflowY: "auto" }}>
            <Dashboard userName={currentUser.name} />
          </Box>
        )}

        {/* 2. Visual Scanner View */}
        {currentView === "VisualScanner" && (
            // UPDATED: Passing userEmail
            <VisualScanner userEmail={currentUser.email} /> 
        )}

        {/* 3. Eco Map View */}
        {currentView === "EcoMap" && <Ecomap />}

        {/* 4. Digital Glovebox */}
        {currentView === "Glovebox" && (
            // UPDATED: Passing userEmail
            <Glovebox userEmail={currentUser.email} />
        )}

        {/* 5. Report Issue View */}
        {currentView === "Report" && (
          <Box sx={{ height: "100%", overflowY: "auto" }}>
            {/* UPDATED: Passing userEmail */}
            <ReportPage userEmail={currentUser.email} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default App;
import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  Stack,
  CircularProgress,
  IconButton,
  Grid,
  InputBase,
  Paper,
  Divider,
  Chip,
} from "@mui/material";
import axios from "axios";

// Icons
import LocationOnIcon from "@mui/icons-material/LocationOn";
import WarningIcon from "@mui/icons-material/Warning";
import EcoIcon from "@mui/icons-material/EnergySavingsLeaf";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import TrafficIcon from "@mui/icons-material/Traffic";
import GppGoodIcon from '@mui/icons-material/GppGood';
import AirIcon from '@mui/icons-material/Air';

export default function Dashboard({ userName }) {
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [place, setPlace] = useState("Detecting precise location...");
  const [searchQuery, setSearchQuery] = useState("");
  const [zoneType, setZoneType] = useState("Identifying Zone...");
  
  // AQI State
  const [aqi, setAqi] = useState(null); 

  // Laws State
  const [trafficRules, setTrafficRules] = useState([]);
  const [ecoRules, setEcoRules] = useState([]);

  // =========================================================
  // 0. DYNAMIC GREETING LOGIC
  // =========================================================
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // =========================================================
  // 1. LIVE LOCATION
  // =========================================================
  const detectLocation = () => {
    setLoading(true);
    setRulesLoading(true);
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                setCoords({ latitude, longitude });
                await fetchAddress(latitude, longitude);
                fetchAqi(latitude, longitude); 
            },
            (err) => {
                console.warn("Geo Error:", err);
                handleLocationError();
            },
            { enableHighAccuracy: true } // Force GPS for better precision
        );
    } else {
        handleLocationError();
    }
  };

  const handleLocationError = () => {
      setPlace("Location Access Denied");
      setZoneType("Default Zone");
      fetchRealLaws("India");
      fetchAqiIP(); 
      setLoading(false);
      setRulesLoading(false);
  };

  // =========================================================
  // 2. REVERSE GEOCODING (UPDATED FOR PRECISION)
  // =========================================================
  const fetchAddress = async (lat, lon) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
      );
      const data = await res.json();
      const addr = data.address;

      // UPDATED PRIORITY: Check for small areas (village/hamlet) BEFORE city/town
      // This ensures we get "Parappuram" instead of "Ponnani"
      const specificPlace = 
          addr?.hamlet || 
          addr?.village || 
          addr?.neighbourhood || 
          addr?.suburb || 
          addr?.residential ||
          addr?.town || 
          addr?.city_district ||
          addr?.city || 
          addr?.municipality || 
          addr?.county ||
          "Unknown Location"; 

      const fullLocation = data.display_name || "Unknown Location";

      setPlace(fullLocation);
      setSearchQuery(specificPlace); 

      // Update Zone Logic based on the new specific place type
      if (addr?.city || addr?.town || addr?.municipality) {
          setZoneType("Urban / Smart City Zone");
      } else if (addr?.village || addr?.hamlet) {
          setZoneType("Rural / Eco-Sensitive Zone");
      } else {
          setZoneType("Standard Monitoring Zone");
      }

      console.log("Fetching laws for precise location:", specificPlace);
      fetchRealLaws(specificPlace);

    } catch (error) {
      console.error("Address Error:", error);
      setPlace("Location Unavailable");
      setRulesLoading(false);
    }
    setLoading(false);
  };

  // =========================================================
  // 3. SEARCH LOGIC
  // =========================================================
  const handleSearch = async (e) => {
    if (e.key === "Enter" && searchQuery.trim() !== "") {
      setLoading(true);
      setRulesLoading(true);
      
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}&addressdetails=1`);
        const data = await res.json();

        if (data && data.length > 0) {
            const { lat, lon, display_name } = data[0];
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lon);

            setCoords({ latitude, longitude });
            setPlace(display_name);
            setZoneType("Searched Zone (Monitoring Active)");

            fetchAqi(latitude, longitude);
            // Pass the exact search query to fetchRealLaws
            fetchRealLaws(searchQuery);

        } else {
            setPlace("Location not found");
            setRulesLoading(false);
        }
      } catch (err) {
          console.error("Search failed", err);
          setPlace("Search Error");
          setRulesLoading(false);
      } finally {
          setLoading(false);
      }
    }
  };

  // =========================================================
  // 4. FETCH LAWS
  // =========================================================
  const fetchRealLaws = async (locationName) => {
    setRulesLoading(true);
    try {
      // Send the precise location to the backend
      const response = await axios.post("http://localhost:5000/get-local-laws", {
        location: locationName
      });

      if (response.data.success) {
        setTrafficRules(response.data.traffic || []);
        setEcoRules(response.data.eco || []);
      } else {
        throw new Error("AI could not retrieve laws");
      }
    } catch (err) {
      console.error("Failed to fetch live laws:", err);
      setTrafficRules([{ title: "Connection Error", desc: "Could not fetch live laws. Check server." }]);
      setEcoRules([{ title: "Connection Error", desc: "Ensure backend is running on port 5000." }]);
    } finally {
      setRulesLoading(false);
    }
  };

  // =========================================================
  // 5. FETCH AQI
  // =========================================================
  const fetchAqi = async (lat, lon) => {
      try {
        const API_KEY = '0334d184-19eb-46d8-8bf5-fdc2fb6f22e8';
        const res = await fetch(`https://api.airvisual.com/v2/nearest_city?lat=${lat}&lon=${lon}&key=${API_KEY}`);
        const data = await res.json();
        
        if (data.status === 'success') {
            setAqi(data.data.current.pollution.aqius);
        }
      } catch (err) { 
          console.error("AQI Fetch Error", err); 
          fetchAqiIP(); 
      }
  };

  const fetchAqiIP = async () => {
      try {
        const API_KEY = '0334d184-19eb-46d8-8bf5-fdc2fb6f22e8';
        const res = await fetch(`https://api.airvisual.com/v2/nearest_city?key=${API_KEY}`);
        const data = await res.json();
        if (data.status === 'success') {
            setAqi(data.data.current.pollution.aqius);
        }
      } catch (err) { console.error("AQI IP Error", err); }
  };

  const getAqiColor = (score) => {
      if (!score) return "#94a3b8";
      if (score <= 50) return "#4ade80"; 
      if (score <= 100) return "#facc15"; 
      if (score <= 150) return "#fb923c"; 
      return "#ef4444"; 
  };

  useEffect(() => {
    detectLocation(); 
  }, []);

  const scrollbarStyle = {
    "&::-webkit-scrollbar": { width: "4px" },
    "&::-webkit-scrollbar-track": { background: "rgba(255,255,255,0.05)" },
    "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.2)", borderRadius: "10px" },
    "&::-webkit-scrollbar-thumb:hover": { background: "rgba(255,255,255,0.4)" },
  };

  return (
    <Box sx={{ width: "100%", pb: 4, px: 2, bgcolor: "#f8fafc" }}>
      {/* ================= HEADER ================= */}
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems="center" spacing={2} sx={{ py: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="800" sx={{ color: "#0f172a", letterSpacing: "-0.5px" }}>
            {getGreeting()}, {userName || "Citizen"}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
            <Typography variant="body2" fontWeight="500" color="#64748b">
                Live Regional Intelligence Active
            </Typography>
          </Stack>
        </Box>

        {/* SEARCH BAR & LOCATION BUTTON */}
        <Paper
          elevation={0}
          sx={{
            display: "flex", alignItems: "center", px: 2, py: 1,
            borderRadius: "16px", bgcolor: "#fff", border: "1px solid #e2e8f0",
            width: { xs: "100%", md: 450 }, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
          }}
        >
          <LocationOnIcon sx={{ color: "#3b82f6", mr: 1, fontSize: 22 }} />
          <InputBase
            sx={{ flex: 1, fontSize: 14, fontWeight: "500" }}
            placeholder="Search specific area (e.g., Parappuram)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
          {loading && <CircularProgress size={18} sx={{ mr: 1 }} />}
          <Divider orientation="vertical" flexItem sx={{ mx: 1, height: 24 }} />
          
          <IconButton 
            size="small" 
            onClick={detectLocation} 
            sx={{ color: "#3b82f6" }}
            title="Use Current Precise Location"
          >
            <MyLocationIcon fontSize="small" />
          </IconButton>
        </Paper>
      </Stack>

      <Grid container spacing={3}>
        {/* === LEFT COLUMN: THE HIGHLIGHTED ZONE CARD === */}
        <Grid item xs={12} md={8}>
          <Card
            elevation={0}
            sx={{
              p: 3, borderRadius: "24px",
              background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
              color: "white", minHeight: 450, display: "flex", flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)", position: "relative", overflow: "hidden"
            }}
          >
            {/* Background Decorative Element */}
            <Box sx={{ position: "absolute", top: -50, right: -50, width: 200, height: 200, borderRadius: "50%", background: "rgba(59, 130, 246, 0.1)", filter: "blur(40px)" }} />
            
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ zIndex: 1 }}>
              <Box>
                <Chip 
                  label="CURRENT MONITORING ZONE" 
                  size="small" 
                  sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "#94a3b8", fontWeight: "700", fontSize: "10px", mb: 1 }} 
                />
                <Typography variant="h5" fontWeight="800" sx={{ color: "#f8fafc", mt: 1 }}>
                    {zoneType}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                  <LocationOnIcon sx={{ fontSize: 16, color: "#3b82f6" }} />
                  <Typography variant="body2" sx={{ opacity: 0.8, fontWeight: "400", maxWidth: "400px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {loading ? "Triangulating coordinates..." : (place || "Unknown Location")}
                  </Typography>
                </Stack>
              </Box>

              {/* === AQI BOX === */}
              <Box sx={{ textAlign: "right", p: 2, bgcolor: "rgba(255,255,255,0.05)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5} mb={0.5}>
                    <AirIcon sx={{ fontSize: 16, color: "#94a3b8" }} />
                    <Typography variant="caption" sx={{ color: "#94a3b8" }}>LOCAL AQI</Typography>
                </Box>
                <Typography variant="h4" fontWeight="800" sx={{ color: getAqiColor(aqi) }}>
                    {aqi !== null ? aqi : "--"}
                </Typography>
                <Typography variant="caption" sx={{ color: getAqiColor(aqi) }}>
                    {aqi <= 50 ? "Good" : aqi <= 100 ? "Moderate" : "Poor"}
                </Typography>
              </Box>
            </Stack>

            <Box sx={{ mt: 3, mb: 3 }}>
                <Typography variant="body2" sx={{ color: "#cbd5e1", lineHeight: 1.6, maxWidth: "600px" }}>
                  Active compliance monitoring is in effect. The protocols below are <strong>dynamically fetched</strong> based on 
                  local municipal bylaws and regional transport acts for <strong>{searchQuery || "this region"}</strong>.
                </Typography>
            </Box>

            {/* === RULES SECTION: FIXED LAYOUT === */}
            {rulesLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="220px" width="100%">
                    <Stack alignItems="center" spacing={2}>
                        <CircularProgress sx={{ color: "#3b82f6" }} />
                        <Typography variant="caption" color="#94a3b8">Fetching Laws for {searchQuery}...</Typography>
                    </Stack>
                </Box>
            ) : (
                <Grid container spacing={2} sx={{ flexGrow: 1 }}>
                    <Grid item xs={12} md={6}> 
                        <Box sx={{ 
                            bgcolor: "rgba(255,255,255,0.03)", borderRadius: "20px", 
                            border: "1px solid rgba(255,255,255,0.08)",
                            height: 220, 
                            display: 'flex', flexDirection: 'column', 
                            overflow: 'hidden' 
                        }}>
                          {/* FIXED HEADER */}
                          <Box sx={{ 
                             bgcolor: "#1e293b", 
                             p: 1.5, 
                             borderBottom: "1px solid rgba(255,255,255,0.1)", 
                             display: "flex", alignItems: "center", gap: 1,
                             flexShrink: 0
                          }}>
                             <TrafficIcon sx={{ color: "#fcd34d", fontSize: 20 }} />
                             <Typography variant="subtitle2" fontWeight="bold" sx={{ color: "#fcd34d" }}>TRAFFIC PROTOCOLS</Typography>
                          </Box>

                          {/* SCROLLING CONTENT */}
                          <Box sx={{ p: 2, overflowY: "auto", flexGrow: 1, ...scrollbarStyle }}>
                            <Stack spacing={2}>
                                {trafficRules.length > 0 ? trafficRules.map((rule, index) => (
                                <Box key={index}>
                                    <Typography variant="body2" sx={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>{rule.title}</Typography>
                                    <Typography variant="caption" sx={{ fontSize: 11, color: "#94a3b8", display: "block" }}>{rule.desc}</Typography>
                                </Box>
                                )) : (
                                  <Typography variant="caption" color="text.secondary">No data available.</Typography>
                                )}
                            </Stack>
                          </Box>
                        </Box>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Box sx={{ 
                            bgcolor: "rgba(255,255,255,0.03)", borderRadius: "20px", 
                            border: "1px solid rgba(255,255,255,0.08)",
                            height: 220, 
                            display: 'flex', flexDirection: 'column',
                            overflow: 'hidden'
                        }}>
                          {/* FIXED HEADER */}
                          <Box sx={{ 
                             bgcolor: "#1e293b", 
                             p: 1.5, 
                             borderBottom: "1px solid rgba(255,255,255,0.1)", 
                             display: "flex", alignItems: "center", gap: 1,
                             flexShrink: 0
                          }}>
                             <EcoIcon sx={{ color: "#4ade80", fontSize: 20 }} />
                             <Typography variant="subtitle2" fontWeight="bold" sx={{ color: "#4ade80" }}>ENVIRONMENT PROTOCOLS</Typography>
                          </Box>

                          {/* SCROLLING CONTENT */}
                          <Box sx={{ p: 2, overflowY: "auto", flexGrow: 1, ...scrollbarStyle }}>
                            <Stack spacing={2}>
                                {ecoRules.length > 0 ? ecoRules.map((rule, index) => (
                                <Box key={index}>
                                    <Typography variant="body2" sx={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>{rule.title}</Typography>
                                    <Typography variant="caption" sx={{ fontSize: 11, color: "#94a3b8", display: "block" }}>{rule.desc}</Typography>
                                </Box>
                                )) : (
                                  <Typography variant="caption" color="text.secondary">No data available.</Typography>
                                )}
                            </Stack>
                          </Box>
                        </Box>
                    </Grid>
                </Grid>
            )}
          </Card>
        </Grid>
     </Grid>
    </Box>
  );
}
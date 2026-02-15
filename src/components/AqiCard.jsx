import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box, CircularProgress, Chip } from '@mui/material';
import AirIcon from '@mui/icons-material/Air';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import RouterIcon from '@mui/icons-material/Router';

const AqiCard = () => {
  const [aqiData, setAqiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // YOUR NEW IQAIR API KEY
  const API_KEY = '0334d184-19eb-46d8-8bf5-fdc2fb6f22e8'; 

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          fetchAqi(latitude, longitude);
        },
        (err) => {
          fetchAqiIP(); // Fallback if user blocks location
        }
      );
    } else {
      fetchAqiIP();
    }
  }, []);

  // Method 1: IQAir Nearest City (GPS)
  const fetchAqi = async (lat, lon) => {
    try {
      // IQAir endpoint for coordinates
      const response = await fetch(
        `https://api.airvisual.com/v2/nearest_city?lat=${lat}&lon=${lon}&key=${API_KEY}`
      );
      const result = await response.json();
      
      if (result.status === 'success') {
        setAqiData(result.data);
      } else {
        throw new Error('Station not found');
      }
    } catch (err) {
      console.log("GPS failed, trying IP fallback...", err);
      fetchAqiIP(); 
    } finally {
      setLoading(false);
    }
  };

  // Method 2: IQAir IP Auto-Detect
  const fetchAqiIP = async () => {
    try {
      // IQAir endpoint that auto-detects based on IP
      const response = await fetch(
        `https://api.airvisual.com/v2/nearest_city?key=${API_KEY}`
      );
      const result = await response.json();

      if (result.status === 'success') {
        setAqiData(result.data);
      } else {
        setError("Could not fetch air quality data.");
      }
    } catch (err) {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  // Helper colors for US AQI Standard (0-500)
  const getStatusColor = (aqi) => {
    if (aqi <= 50) return { color: "#4ade80", text: "Good", bg: "#dcfce7" };
    if (aqi <= 100) return { color: "#facc15", text: "Moderate", bg: "#fef9c3" };
    if (aqi <= 150) return { color: "#fb923c", text: "Unhealthy (Sensitive)", bg: "#ffedd5" };
    if (aqi <= 200) return { color: "#f87171", text: "Unhealthy", bg: "#fee2e2" };
    return { color: "#ef4444", text: "Hazardous", bg: "#fee2e2" };
  };

  if (loading) return <CircularProgress size={30} sx={{ m: 2 }} />;
  if (error) return <Typography color="error" sx={{ p: 2 }}>{error}</Typography>;
  if (!aqiData) return null;

  // IQAir Data Structure Extraction
  const aqi = aqiData.current.pollution.aqius; // US AQI standard
  const city = aqiData.city;
  const state = aqiData.state;
  const status = getStatusColor(aqi);

  return (
    <Card sx={{ minWidth: 250, boxShadow: 4, borderRadius: 3, background: 'linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)' }}>
      <CardContent>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <AirIcon color="primary" />
            <Typography variant="h6" fontWeight="bold" color="text.primary">
              Air Quality
            </Typography>
          </Box>
          <Chip label="IQAir" size="small" color="primary" variant="outlined" />
        </Box>

        {/* Big AQI Number */}
        <Box textAlign="center" py={2}>
          <Typography variant="h2" fontWeight="800" sx={{ color: status.color }}>
            {aqi}
          </Typography>
          <Chip 
            label={status.text} 
            sx={{ bgcolor: status.bg, color: status.color, fontWeight: "bold", mt: 1 }} 
          />
        </Box>

        {/* Location Info */}
        <Box 
            mt={2} 
            p={1} 
            borderRadius={2} 
            bgcolor="rgba(0,0,0,0.04)"
            display="flex" 
            alignItems="flex-start" 
            gap={1}
        >
          <RouterIcon fontSize="small" color="action" sx={{ mt: 0.3 }} />
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" fontWeight="bold">
              Detected Location:
            </Typography>
            <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.2 }}>
              {city}, {state}
            </Typography>
          </Box>
        </Box>

        {/* Extra Weather Data (IQAir Bonus) */}
        <Box mt={2} display="flex" justifyContent="space-between" px={1}>
            <Typography variant="body2" color="text.secondary">Temp:</Typography>
            <Typography variant="body2" fontWeight="bold">{aqiData.current.weather.tp}°C</Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AqiCard;
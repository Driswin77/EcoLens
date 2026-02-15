import { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Paper,
  CircularProgress
} from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";

// Icons
import LeafIcon from "@mui/icons-material/EnergySavingsLeaf"; 
import NavigationIcon from "@mui/icons-material/Navigation";
import SpeedIcon from "@mui/icons-material/Speed";
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';

// Fix Leaflet Marker Icons
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Helper component to center map on new markers
function MapUpdater({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [50, 50] });
  }, [bounds, map]);
  return null;
}

export default function Ecomap() {
  const [startLoc, setStartLoc] = useState("");
  const [endLoc, setEndLoc] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(0);
  const [markers, setMarkers] = useState({ start: null, end: null });

  // --- STRICT PHYSICS ENGINE ---
  const calculateRealPhysics = (distanceMeters, durationSeconds) => {
    const distKm = distanceMeters / 1000;
    const hours = durationSeconds / 3600;
    const avgSpeed = distKm / hours; // Real average speed including stops

    // 1. CALCULATE TRAFFIC DELAY
    // Assume free-flow highway speed is 60km/h (Indian context)
    const freeFlowTime = distKm / 60; // Hours needed without traffic
    const delayHours = hours - freeFlowTime;
    const delayMins = Math.max(0, Math.round(delayHours * 60));

    // 2. FUEL EFFICIENCY CURVE (Indian Hatchback Petrol)
    // - Optimal: 15 km/L at 60km/h
    // - Traffic: 8 km/L at 15km/h
    // - Fast: 12 km/L at 100km/h
    let mileage = 15; // Base mileage (km/L)
    
    if (avgSpeed < 20) mileage = 8 + (avgSpeed * 0.2); // Extremely inefficient in traffic
    else if (avgSpeed < 60) mileage = 12 + ((avgSpeed - 20) * 0.075); // Climbing to optimal
    else mileage = 15 - ((avgSpeed - 60) * 0.1); // Drag reduces efficiency at high speed

    // 3. FUEL CONSUMED
    const fuelLiters = distKm / mileage;

    // 4. CO2 EMISSIONS (Real Chemical Constant)
    // Burning 1 Liter of Petrol produces ~2.31 kg of CO2
    const totalCo2 = fuelLiters * 2.31;

    // 5. ECO SCORE (Strict)
    // Baseline: 100g CO2/km is "100/100" (Toyota Hybrid level)
    // Reality: Average car is 150g/km (Score 50/100)
    const gramsPerKm = (totalCo2 * 1000) / distKm;
    let score = 100 - (gramsPerKm - 100);
    
    // Penalize heavily for traffic delay
    score -= (delayMins * 0.5); 

    // Clamp Score
    if (score > 99) score = 99;
    if (score < 10) score = 10;

    let trafficStatus = "Free Flow";
    if (delayMins > 30) trafficStatus = "Heavy Traffic";
    else if (delayMins > 10) trafficStatus = "Moderate";
    else if (avgSpeed > 80) trafficStatus = "High Speed";

    return {
        distKm: distKm.toFixed(1),
        fuel: fuelLiters.toFixed(1),
        co2: totalCo2.toFixed(2),
        traffic: trafficStatus,
        delay: delayMins,
        score: Math.round(score),
        avgSpeed: Math.round(avgSpeed)
    };
  };

  const handleAnalyze = async () => {
    if (!startLoc || !endLoc) {
        alert("Please enter both Start and End locations.");
        return;
    }
    setLoading(true);

    try {
      // 1. Geocode Start & End
      const startRes = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${startLoc}`);
      const endRes = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${endLoc}`);

      if (startRes.data.length === 0 || endRes.data.length === 0) {
        alert("Location not found. Try adding a city name.");
        setLoading(false);
        return;
      }

      const start = { lat: parseFloat(startRes.data[0].lat), lon: parseFloat(startRes.data[0].lon), name: startLoc };
      const end = { lat: parseFloat(endRes.data[0].lat), lon: parseFloat(endRes.data[0].lon), name: endLoc };

      setMarkers({ start, end });

      // 2. Get REAL Routes from OSRM
      const routeUrl = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson&alternatives=true`;
      const routeRes = await axios.get(routeUrl);
      
      const rawRoutes = routeRes.data.routes;

      // 3. Process Routes using STRICT PHYSICS
      let processedRoutes = rawRoutes.map((routeData, index) => {
          const durationMin = routeData.duration / 60;
          const h = Math.floor(durationMin / 60);
          const m = Math.floor(durationMin % 60);
          const geometry = routeData.geometry.coordinates.map((c) => [c[1], c[0]]);

          // REAL MATH CALCULATION
          const metrics = calculateRealPhysics(routeData.distance, routeData.duration);

          return {
              id: index,
              rawDuration: routeData.duration, 
              rawCo2: parseFloat(metrics.co2),
              timeStr: `${h}h ${m}m`,
              distStr: `${metrics.distKm} km`,
              co2Str: `${metrics.co2} kg`,
              fuelStr: `${metrics.fuel} L`,
              traffic: metrics.traffic,
              delay: metrics.delay,
              score: metrics.score,
              avgSpeed: metrics.avgSpeed,
              geometry: geometry,
              name: `Route Option ${String.fromCharCode(65 + index)}`
          };
      });

      // 4. Find the "Best" based on Score (Efficiency)
      const bestScore = Math.max(...processedRoutes.map(r => r.score));
      const minDuration = Math.min(...processedRoutes.map(r => r.rawDuration));

      processedRoutes = processedRoutes.map(r => {
          let type = "STANDARD";
          let color = "#3b82f6"; // Blue

          if (r.score === bestScore) {
              type = "ECO BEST"; 
              color = "#16a34a"; // Green
          } else if (r.rawDuration === minDuration) {
              type = "FASTEST";
              color = "#eab308"; // Yellow
          }

          return { ...r, type, color };
      });

      // Sort: Best Score First
      processedRoutes.sort((a, b) => b.score - a.score);

      setRoutes(processedRoutes);
      setSelectedRouteId(0);

    } catch (err) {
      console.error(err);
      alert("Error calculating route. OSRM server might be busy.");
    } finally {
      setLoading(false);
    }
  };

  const currentRoute = routes[selectedRouteId];

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, zIndex: 10 }}>
        <Stack direction="row" spacing={2}>
            <TextField 
                fullWidth size="small" label="Start" placeholder="e.g. Edappal"
                value={startLoc} onChange={e=>setStartLoc(e.target.value)}
            />
            <TextField 
                fullWidth size="small" label="Destination" placeholder="e.g. Thrissur"
                value={endLoc} onChange={e=>setEndLoc(e.target.value)}
            />
            <Button 
                variant="contained" onClick={handleAnalyze} disabled={loading} 
                startIcon={loading ? <CircularProgress size={20} color="inherit"/> : <NavigationIcon />}
                sx={{bgcolor: "#064e3b", minWidth: 150}}
            >
              {loading ? "Calculating..." : "Analyze"}
            </Button>
        </Stack>
      </Paper>

      {/* Main Layout */}
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
        
        {/* Route List */}
        <Box sx={{ width: 350, overflowY: "auto", p: 2, bgcolor: "white", borderRight: "1px solid #ddd" }}>
            {routes.length === 0 ? (
                <Box textAlign="center" mt={5} color="text.secondary">
                    <Typography variant="body1" fontWeight="bold">Real-Time Physics Engine</Typography>
                    <Typography variant="body2" sx={{mt:1}}>
                        Calculates CO2 based on Traffic Delay & Fuel Consumption Curves.
                    </Typography>
                </Box>
            ) : (
                routes.map((r, i) => (
                    <Card 
                        key={i} 
                        onClick={() => setSelectedRouteId(i)} 
                        sx={{ 
                            mb: 2, cursor: "pointer", 
                            border: selectedRouteId === i ? `2px solid ${r.color}` : "1px solid #eee",
                            bgcolor: selectedRouteId === i ? `${r.color}05` : "white"
                        }}
                    >
                        <CardContent>
                            <Stack direction="row" justifyContent="space-between" mb={1}>
                                <Chip label={r.type} size="small" sx={{ bgcolor: `${r.color}20`, color: r.color, fontWeight: "bold" }} />
                                <Box display="flex" alignItems="center" gap={0.5}>
                                    <LeafIcon sx={{ fontSize: 16, color: r.score > 75 ? "green" : "orange" }} />
                                    <Typography fontWeight="bold" color={r.score > 75 ? "green" : "orange"}>{r.score}/100</Typography>
                                </Box>
                            </Stack>
                            
                            <Typography variant="h6">{r.name}</Typography>
                            <Typography color="text.secondary">{r.timeStr} • {r.distStr}</Typography>
                            
                            {/* NEW: Traffic & Fuel Data */}
                            <Stack direction="row" alignItems="center" gap={1} mt={1} flexWrap="wrap">
                                <Chip 
                                    icon={<SpeedIcon sx={{fontSize: "14px !important"}}/>} 
                                    label={r.traffic} size="small" 
                                    color={r.avgSpeed < 30 ? "error" : "default"} variant="outlined" 
                                />
                                <Chip 
                                    icon={<LocalGasStationIcon sx={{fontSize: "14px !important"}}/>} 
                                    label={r.fuelStr} size="small" variant="outlined" 
                                />
                            </Stack>
                            
                            <Typography variant="body2" fontWeight="bold" color="text.primary" mt={1}>
                                Est. CO2: {r.co2Str}
                            </Typography>
                            {r.delay > 10 && (
                                <Typography variant="caption" color="error">
                                    ⚠️ {r.delay} mins traffic delay included
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                ))
            )}
        </Box>

        {/* Map */}
        <Box sx={{ flex: 1, position: "relative" }}>
             <MapContainer center={[10.85, 76.27]} zoom={8} style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                
                {markers.start && <Marker position={[markers.start.lat, markers.start.lon]}><Popup>Start: {markers.start.name}</Popup></Marker>}
                {markers.end && <Marker position={[markers.end.lat, markers.end.lon]}><Popup>End: {markers.end.name}</Popup></Marker>}
                
                {currentRoute?.geometry && (
                    <Polyline 
                        key={selectedRouteId} 
                        positions={currentRoute.geometry} 
                        color={currentRoute.color} 
                        weight={6} opacity={0.8}
                    />
                )}
                {markers.start && markers.end && <MapUpdater bounds={[[markers.start.lat, markers.start.lon], [markers.end.lat, markers.end.lon]]} />}
             </MapContainer>
        </Box>

      </Box>
    </Box>
  );
}
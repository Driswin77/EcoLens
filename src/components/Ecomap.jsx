import { useState, useEffect, useRef } from "react";
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
  CircularProgress,
  InputAdornment,
  IconButton
} from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";

// Icons
import LeafIcon from "@mui/icons-material/EnergySavingsLeaf"; 
import NavigationIcon from "@mui/icons-material/Navigation";
import SpeedIcon from "@mui/icons-material/Speed";
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import MyLocationIcon from "@mui/icons-material/MyLocation";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import CloseIcon from '@mui/icons-material/Close';

// Fix Leaflet Marker Icons
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Vehicle Icon (matches screenshot car)
const carIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/744/744465.png',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
});

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Helper component to center map on new markers and handle 3D Tilt
function MapUpdater({ bounds, center, isNavigating }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && !isNavigating) map.fitBounds(bounds, { padding: [50, 50] });
  }, [bounds, isNavigating, map]);

  useEffect(() => {
    if (center && isNavigating) {
        map.setView(center, 18, { animate: true });
    }
  }, [center, isNavigating, map]);
  
  return null;
}

export default function Ecomap() {
  const [startLoc, setStartLoc] = useState("");
  const [endLoc, setEndLoc] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(0);
  const [markers, setMarkers] = useState({ start: null, end: null });
  const [realZones, setRealZones] = useState([]); // STORES REAL OSM DATA ALONG ROUTE

  // --- REAL-TIME NAVIGATION & TELEMETRY STATES ---
  const [isNavigating, setIsNavigating] = useState(false);
  const [userPos, setUserPos] = useState(null);
  const [liveSpeed, setLiveSpeed] = useState(0); // in km/h
  const watchId = useRef(null);
  const lastInstructionRef = useRef("");
  const alertedZones = useRef(new Set());

  // --- VOICE ENGINE ---
  const speak = (text) => {
    if (window.speechSynthesis && text !== lastInstructionRef.current) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
      lastInstructionRef.current = text;
    }
  };

  // --- 1. OVERPASS API: FETCH DATA BETWEEN START AND DESTINATION (REAL DATA) ---
  const fetchZonesBetweenPoints = async (start, end) => {
    // Defines a bounding box based on the route area to find zones "between" them
    const south = Math.min(start.lat, end.lat) - 0.01;
    const west = Math.min(start.lon, end.lon) - 0.01;
    const north = Math.max(start.lat, end.lat) + 0.01;
    const east = Math.max(start.lon, end.lon) + 0.01;

    const query = `
      [out:json][timeout:25];
      (
        node["amenity"~"hospital|school"](${south}, ${west}, ${north}, ${east});
        way["leisure"~"nature_reserve|park"](${south}, ${west}, ${north}, ${east});
      );
      out body;
      >;
      out skel qt;
    `;
    try {
      const res = await axios.post("https://overpass-api.de/api/interpreter", query);
      const fetchedZones = res.data.elements
        .filter(el => el.lat && el.lon)
        .map(el => ({
          id: el.id,
          name: el.tags?.name || "Official Sensitive Area",
          lat: el.lat,
          lon: el.lon,
          type: el.tags?.amenity ? "VIOLATION" : "ECO",
          radius: el.tags?.amenity ? 300 : 500
        }));
      setRealZones(fetchedZones);
    } catch (err) {
      console.error("Overpass Route Query Error:", err);
    }
  };

  // --- STRICT PHYSICS ENGINE (DYNAMIC WITH LIVE SPEED) ---
  const calculateRealPhysics = (distanceMeters, durationSeconds, speedOverride = null) => {
    const distKm = distanceMeters / 1000;
    const hours = durationSeconds / 3600;
    const speed = speedOverride || (distKm / hours);

    const freeFlowTime = distKm / 60; 
    const delayMins = Math.max(0, Math.round((hours - freeFlowTime) * 60));

    // Dynamic Mileage based on Speed
    let mileage = 15; 
    if (speed < 10) mileage = 5; // Traffic penalty
    else if (speed < 60) mileage = 12 + ((speed - 10) * 0.12); 
    else mileage = 18 - ((speed - 60) * 0.15); 

    const fuelLiters = distKm / mileage;
    const totalCo2 = fuelLiters * 2.31;
    const gramsPerKm = (totalCo2 * 1000) / distKm;
    let score = 100 - (gramsPerKm - 80) - (delayMins * 0.5); 

    return {
        distKm: distKm.toFixed(1),
        fuel: fuelLiters.toFixed(2),
        co2: totalCo2.toFixed(2),
        score: Math.min(Math.max(Math.round(score), 10), 99)
    };
  };

  // --- GET CURRENT LOCATION ---
  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            setStartLoc(res.data.display_name);
            setUserPos([latitude, longitude]);
          } catch (err) { setStartLoc(`${latitude}, ${longitude}`); }
          setLoading(false);
        },
        () => { setLoading(false); alert("Location access denied."); }
      );
    }
  };

  const handleAnalyze = async () => {
    if (!startLoc || !endLoc) return;
    setLoading(true);
    try {
      const startRes = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${startLoc}`);
      const endRes = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${endLoc}`);
      const start = { lat: parseFloat(startRes.data[0].lat), lon: parseFloat(startRes.data[0].lon) };
      const end = { lat: parseFloat(endRes.data[0].lat), lon: parseFloat(endRes.data[0].lon) };
      setMarkers({ start, end });

      await fetchZonesBetweenPoints(start, end);

      const routeUrl = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson&alternatives=true&steps=true`;
      const routeRes = await axios.get(routeUrl);
      const rawRoutes = routeRes.data.routes;

      let processedRoutes = rawRoutes.map((routeData, index) => {
          const metrics = calculateRealPhysics(routeData.distance, routeData.duration);
          return {
              id: index,
              rawDist: routeData.distance,
              rawDur: routeData.duration,
              timeStr: `${Math.floor(routeData.duration/3600)}h ${Math.floor((routeData.duration%3600)/60)}m`,
              distStr: `${metrics.distKm} km`,
              co2Str: `${metrics.co2} kg`,
              fuelStr: `${metrics.fuel} L`,
              score: metrics.score,
              geometry: routeData.geometry.coordinates.map((c) => [c[1], c[0]]),
              steps: routeData.legs[0].steps,
              name: index === 0 ? "Fastest" : `Alternative ${index}`,
              color: index === 0 ? "#16a34a" : "#3b82f6"
          };
      });
      setRoutes(processedRoutes);
      setSelectedRouteId(0);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const startNavigation = () => {
    if (!routes[selectedRouteId]) return;
    setIsNavigating(true);
    speak("Navigation started. Monitoring legal zones and live velocity.");
    if (navigator.geolocation) {
      watchId.current = navigator.geolocation.watchPosition((position) => {
          const { latitude, longitude, speed } = position.coords;
          setUserPos([latitude, longitude]);
          const kmh = speed ? Math.round(speed * 3.6) : 0;
          setLiveSpeed(kmh);
          checkProximity(latitude, longitude, kmh);
        }, null, { enableHighAccuracy: true }
      );
    }
  };

  const stopNavigation = () => {
      setIsNavigating(false);
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
      setUserPos(null);
      setLiveSpeed(0);
      alertedZones.current.clear();
  };

  const checkProximity = (lat, lon, speed) => {
    if (!routes[selectedRouteId]) return;
    routes[selectedRouteId].steps.forEach(step => {
      const dist = L.latLng(lat, lon).distanceTo(L.latLng(step.maneuver.location[1], step.maneuver.location[0]));
      if (dist < 30) speak(step.maneuver.instruction);
    });

    realZones.forEach(zone => {
        const dist = L.latLng(lat, lon).distanceTo(L.latLng(zone.lat, zone.lon));
        if (dist <= 500 && !alertedZones.current.has(zone.id)) {
            let msg = zone.type === "VIOLATION" 
                ? `Caution. 500 meters to official silent zone at ${zone.name}.` 
                : `Entering ${zone.name} Nature Reserve in 500 meters.`;
            if (speed > 50 && zone.type === "VIOLATION") msg += " Please reduce speed to avoid penalty.";
            speak(msg);
            alertedZones.current.add(zone.id);
        }
    });
  };

  const currentRoute = routes[selectedRouteId];
  const liveMetrics = currentRoute ? calculateRealPhysics(currentRoute.rawDist, currentRoute.rawDur, liveSpeed) : null;

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      
      {!isNavigating ? (
          <Paper elevation={4} sx={{ position: "absolute", top: 10, left: 10, zIndex: 1000, p: 2, borderRadius: "15px", bgcolor: "rgba(255,255,255,0.9)", width: 350 }}>
            <Stack spacing={1.5}>
                <TextField fullWidth size="small" placeholder="Start" value={startLoc} onChange={e=>setStartLoc(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><IconButton onClick={useCurrentLocation} size="small" color="primary"><MyLocationIcon/></IconButton></InputAdornment> }}
                />
                <TextField fullWidth size="small" placeholder="Destination" value={endLoc} onChange={e=>setEndLoc(e.target.value)} />
                <Button fullWidth variant="contained" onClick={handleAnalyze} disabled={loading} sx={{bgcolor: "#064e3b", borderRadius: "20px"}}>{loading ? <CircularProgress size={20}/> : "SEARCH"}</Button>
                
                {routes.length > 0 && (
                    <Stack spacing={1} sx={{ mt: 1, maxHeight: 250, overflowY: 'auto' }}>
                        <Typography variant="caption" fontWeight="bold">SELECT ROUTE</Typography>
                        {routes.map((r, i) => (
                            <Card key={i} onClick={() => setSelectedRouteId(i)} sx={{ p: 1, cursor: "pointer", border: selectedRouteId === i ? `2px solid ${r.color}` : "1px solid #eee", bgcolor: selectedRouteId === i ? `${r.color}10` : "white" }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Box><Typography variant="body2" fontWeight="bold">{r.name}</Typography><Typography variant="caption">{r.timeStr} • {r.distStr}</Typography></Box>
                                    <Chip label={`${r.score}/100`} size="small" color="success" />
                                </Stack>
                            </Card>
                        ))}
                        <Button fullWidth variant="contained" color="success" onClick={startNavigation} startIcon={<NavigationIcon />} sx={{borderRadius: "20px"}}>START</Button>
                    </Stack>
                )}
            </Stack>
          </Paper>
      ) : (
          <Paper elevation={4} sx={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1000, p: 2, bgcolor: "#064e3b", color: "white", borderRadius: "0 0 20px 20px" }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                  <Box sx={{ bgcolor: "white", color: "#064e3b", p: 1, borderRadius: "10px", minWidth: 65, textAlign: "center" }}>
                      <Typography variant="h6" fontWeight="bold">{liveSpeed}</Typography>
                      <Typography variant="caption">km/h</Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}><Typography variant="h6" fontWeight="bold">towards {endLoc}</Typography><Typography variant="body2" sx={{ opacity: 0.8 }}>Live Legal Telemetry Active</Typography></Box>
                  <IconButton onClick={stopNavigation} sx={{ color: "white" }}><CloseIcon /></IconButton>
              </Stack>
          </Paper>
      )}

      <Box sx={{ flex: 1, zIndex: 1, "& .leaflet-container": isNavigating ? { transform: "perspective(1000px) rotateX(25deg)", transformOrigin: "top center", transition: "transform 1s ease" } : {} }}>
         <MapContainer center={[10.85, 76.27]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
            <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution='&copy; Google Maps' />
            
            {/* RENDER INACTIVE ROUTES FIRST (CLICKABLE) */}
            {routes.map((r, i) => {
                if (i === selectedRouteId) return null;
                return (
                    <Polyline 
                        key={i} 
                        positions={r.geometry} 
                        color="#f2f7fe" // Lighter blue for alternative routes
                        weight={6} 
                        opacity={0.6} 
                        eventHandlers={{ 
                            click: (e) => { L.DomEvent.stopPropagation(e); setSelectedRouteId(i); } 
                        }} 
                    >
                        <Popup>Tap to Switch Route</Popup>
                    </Polyline>
                );
            })}

            {/* RENDER ACTIVE ROUTE LAST (ON TOP) */}
            {routes.length > 0 && (
                <Polyline 
                    key={selectedRouteId} 
                    positions={routes[selectedRouteId].geometry} 
                    color={routes[selectedRouteId].color} 
                    weight={8} 
                    opacity={1} 
                />
            )}

            {isNavigating && realZones.map(zone => (
                <Circle key={zone.id} center={[zone.lat, zone.lon]} radius={zone.radius} pathOptions={{ color: zone.type === "VIOLATION" ? 'red' : 'green', fillColor: zone.type === "VIOLATION" ? 'red' : 'green', fillOpacity: 0.25 }} />
            ))}
            {userPos && <Marker position={userPos} icon={carIcon} />}
            <MapUpdater bounds={!isNavigating && markers.start && markers.end ? [[markers.start.lat, markers.start.lon], [markers.end.lat, markers.end.lon]] : null} center={isNavigating ? userPos : null} isNavigating={isNavigating} />
         </MapContainer>
      </Box>

      {currentRoute && (
        <Paper elevation={4} sx={{ position: "absolute", bottom: 20, left: 15, right: 15, zIndex: 1000, p: 2, borderRadius: "20px" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box><Typography variant="h5" color="success.main" fontWeight="800">{currentRoute.timeStr}</Typography><Typography variant="body2" color="text.secondary">Live CO2: {liveMetrics?.co2} kg • {currentRoute.distStr}</Typography></Box>
                <Stack alignItems="flex-end"><Chip icon={<LeafIcon />} label={`${liveMetrics?.score}/100`} color="success" sx={{fontWeight: "bold"}} /><Typography variant="caption">Fuel: {liveMetrics?.fuel} L</Typography></Stack>
            </Stack>
        </Paper>
      )}
    </Box>
  );
}
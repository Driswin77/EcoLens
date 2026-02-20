import React, { useRef, useState, useEffect } from "react";
import axios from 'axios';
import Webcam from "react-webcam"; 
import {
  Box,
  Button,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  CircularProgress,
  Divider,
  Fade,
  Card,
  CardContent,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import GppBadIcon from '@mui/icons-material/GppBad';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import MapIcon from '@mui/icons-material/Map';
import HistoryIcon from '@mui/icons-material/History'; 
import DescriptionIcon from '@mui/icons-material/Description'; 
import AccessTimeIcon from '@mui/icons-material/AccessTime'; 

// Smooth transition for popups
const Transition = React.forwardRef(function Transition(props, ref) {
  return <Fade ref={ref} {...props} />;
});

export default function VisualScanner({ userEmail }) {
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);

  // States
  const [previewType, setPreviewType] = useState(null); 
  const [imgSrc, setImgSrc] = useState(null);
  
  // UI States
  const [openScanner, setOpenScanner] = useState(false);
  
  // Location States
  const [place, setPlace] = useState("Locating...");
  const [coords, setCoords] = useState({ lat: null, lon: null });
  
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [reportStatus, setReportStatus] = useState(null);
  const [successData, setSuccessData] = useState(null); 

  // --- NEW STATES FOR HISTORY ---
  const [openHistory, setOpenHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  /* ================= 1. ROBUST LOCATION FINDER ================= */
  useEffect(() => {
    if (!navigator.geolocation) {
      setPlace("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          setCoords({ lat: latitude, lon: longitude });
          
          // Reverse Geocoding
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          const address = data.address || {};
          
          const locName = 
            address.suburb || 
            address.residential || 
            address.neighbourhood || 
            address.village || 
            address.town || 
            address.city || 
            address.county ||
            "Unknown District";
            
          setPlace(locName);
        } catch (err) {
          console.error("Location Error:", err);
          setPlace("Unknown Location");
        }
      },
      (err) => {
        console.error("Geo Error:", err);
        setPlace("Location Access Denied");
      },
      { enableHighAccuracy: true } 
    );
  }, []);

  /* ================= 2. STRICT AUTHORITY ROUTING (UPDATED) ================= */
  const findRealAuthority = async (category) => {
    const TOMTOM_KEY = "u0ilQFRkdoZ9gPvf1G6ri97BH5ZslXb3"; 

    // 1. Determine Category Type
    const catLower = category?.toLowerCase() || "";
    const isTraffic = catLower.includes("traffic") || catLower.includes("vehicle") || catLower.includes("helmet") || catLower.includes("license");
    const isEnvironmental = catLower.includes("waste") || catLower.includes("garbage") || catLower.includes("burn") || catLower.includes("dump") || catLower.includes("environmental");
    const isFire = catLower.includes("fire") || catLower.includes("smoke");

    // 2. Define Search Queries based on category
    let searchQueries = [];
    if (isTraffic) {
        searchQueries = [`Traffic Police Station ${place}`, `Police Station ${place}`, `RTO ${place}`];
    } else if (isEnvironmental) {
        searchQueries = [`Municipality Office ${place}`, `Panchayat Office ${place}`, `Health Centre ${place}`];
    } else if (isFire) {
        searchQueries = [`Fire Station ${place}`];
    } else {
        searchQueries = [`Police Station ${place}`];
    }

    try {
        // Run the Search Waterfall
        for (const query of searchQueries) {
            console.log(`🔍 Searching: ${query}`);
            
            const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${TOMTOM_KEY}&lat=${coords.lat}&lon=${coords.lon}&radius=5000&limit=5`; 
            
            const res = await fetch(url);
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                // FILTER: Remove bad results
                for (let item of data.results) {
                    const name = item.poi.name;
                    const nameLower = name.toLowerCase();
                    
                    // --- STRICT FILTERING RULES ---
                    
                    // A. BAD WORDS (Blocklist) - Immediately reject these
                    if (
                        nameLower.includes("educational") || 
                        nameLower.includes("school") || 
                        nameLower.includes("college") || 
                        nameLower.includes("academy") || 
                        nameLower.includes("bank") || 
                        nameLower.includes("atm") || 
                        nameLower.includes("post office") || 
                        nameLower.includes("hotel") || 
                        nameLower.includes("lodge") || 
                        nameLower.includes("residence") || 
                        nameLower.includes("quarters") ||
                        nameLower.includes("shop") ||
                        nameLower.includes("store") ||
                        nameLower.includes("canteen") ||
                        nameLower.includes("mess")
                    ) {
                        continue; // Skip this result
                    }

                    // B. GOOD WORDS (Allowlist) - Result MUST contain one of these
                    let isValid = false;
                    if (isTraffic) {
                        if (nameLower.includes("police") || nameLower.includes("station") || nameLower.includes("rto") || nameLower.includes("enforcement")) isValid = true;
                    } else if (isEnvironmental) {
                        if (nameLower.includes("municipality") || nameLower.includes("panchayat") || nameLower.includes("corporation") || nameLower.includes("council") || nameLower.includes("health") || nameLower.includes("police")) isValid = true;
                    } else if (isFire) {
                          if (nameLower.includes("fire")) isValid = true;
                    } else {
                          if (nameLower.includes("police") || nameLower.includes("station")) isValid = true;
                    }

                    if (isValid) {
                        console.log("✅ Found Verified Authority:", name);
                        return name; // Return the first valid match
                    }
                }
            }
        }
    } catch (e) {
        console.error("TomTom Error:", e);
    }

    // 3. Fallback Generation (If API returns nothing useful or blocked results)
    if (isTraffic) return `${place} Traffic Police Station`;
    if (isEnvironmental) return `${place} Municipality Office`;
    if (isFire) return `${place} Fire Station`;
    
    return `${place} Police Station`;
  };

  /* ================= CAMERA LOGIC ================= */
  const startCamera = () => {
    setError(null);
    setResult(null);
    setSuccessData(null);
    setReportStatus(null);
    setPreviewType("camera");
    setImgSrc(null);
    setOpenScanner(true);
  };

  const capture = React.useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    setImgSrc(imageSrc);
  }, [webcamRef]);

  /* ================= UPLOAD LOGIC ================= */
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setSuccessData(null);
    setReportStatus(null);
    setPreviewType("image");
    setOpenScanner(true);
    const reader = new FileReader();
    reader.onloadend = () => setImgSrc(reader.result);
    reader.readAsDataURL(file);
  };

  /* ================= ANALYZE LOGIC (AI ENFORCER) ================= */
  const analyze = async () => {
    try {
      setAnalyzing(true);
      setError(null);
      
      let finalImage = imgSrc;
      if (previewType === "camera" && !finalImage && webcamRef.current) {
         finalImage = webcamRef.current.getScreenshot();
         setImgSrc(finalImage);
      }
      
      if (!finalImage) throw new Error("No image captured.");

      const response = await fetch("http://localhost:5000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64: finalImage, 
          // RESTORED PROMPT: DIRECT AUTHORITY ROUTING (NO INDUSTRY WARNINGS)
          prompt: `You are an AI Enforcement Officer for India. Analyze this image deeply.
          
          STEP 1: DETECT
          Check for ANY violation (Traffic, Environmental, Garbage, Burning, Encroachment).
          
          STEP 2: IDENTIFY LAW & FINE (DYNAMIC)
          - Do NOT guess. Retrieve the EXACT Indian Act/Section applicable to this specific image.
          - Example: If triple riding, find "Section 128/194C MV Act". If burning plastic, find "NGT Act / Section 15 EPA".
          - Estimate the fine amount in Indian Rupees (₹) based on current 2024/2025 standards.
          
          STEP 3: FORMAT OUTPUT
          Return STRICT JSON (No markdown): 
          { 
            "violation": boolean, 
            "category": "Traffic Violation" | "Environmental Violation" | "Civic Issue", 
            "title": "Precise Violation Name", 
            "description": "Short observation of the scene", 
            "law": "Specific Act & Section Number", 
            "fineAmount": "₹ Amount (e.g. ₹1000)",
            "severity": "High" | "Medium" | "Low"
          }`,
          context: { administrativeArea: place }
        }),
      });

      const data = await response.json();
      if (!data || data.error) throw new Error(data.error || "Analysis failed.");

      setResult(data);
      setOpenScanner(false); 
      
    } catch (err) {
      setError("Analysis Failed: " + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  /* ================= REPORT LOGIC (STANDARD DIRECT ROUTING) ================= */
  const handleInstantReport = async () => {
    if (!userEmail) {
        alert("Session Expired. Please login again.");
        return;
    }
    setReportStatus('sending');

    try {
        const now = new Date();
        const dateString = now.toLocaleDateString('en-IN'); 
        const timeString = now.toLocaleTimeString('en-IN'); 

        // --- DIRECT REPORTING TO AUTHORITY (NO INDUSTRY CHECKS) ---
        // We calculate the correct authority based on TomTom spatial data
        // and route the violation directly to their dashboard.
        
        const realAuthorityName = await findRealAuthority(result.category);

        const reportPayload = {
            userEmail: userEmail,
            title: result.title || "Detected Violation",
            category: result.category || "General", 
            severity: result.severity || "Medium", 
            description: `${result.description}. Law: ${result.law}.`,
            location: place, 
            image: imgSrc, 
            dateOfOffense: dateString, 
            timeOfOffense: timeString,
            authorityName: realAuthorityName 
        };

        const res = await axios.post("http://localhost:5000/submit-report", reportPayload);
        
        setResult(null);
        setSuccessData({
            authority: realAuthorityName, 
            id: res.data.report._id || "CASE-8842",
            date: dateString,
            time: timeString,
            category: result.category
        });
        setReportStatus('success');
        
        // --- End of Direct Reporting Logic ---

    } catch (err) {
        console.error(err);
        setReportStatus('error');
        alert("Failed to submit report. Server might be busy.");
    }
  };

  /* ================= HISTORY FETCH LOGIC ================= */
  const fetchHistory = async () => {
    if (!userEmail) return;
    setLoadingHistory(true);
    setOpenHistory(true);
    try {
        const res = await axios.get(`http://localhost:5000/my-reports?userEmail=${userEmail}`);
        setHistoryData(res.data);
    } catch (err) {
        console.error("Error fetching history", err);
    } finally {
        setLoadingHistory(false);
    }
  };

  return (
    <Box sx={{ width: "100%", minHeight: "85vh", bgcolor: "#121212", pb: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      
      {/* --- HISTORY BUTTON (Top Right) --- */}
      <Box sx={{ position: 'absolute', top: 20, right: 20 }}>
          <Button
            variant="outlined"
            onClick={fetchHistory}
            startIcon={<HistoryIcon />}
            sx={{
                color: "#9ca3af",
                borderColor: "#374151",
                borderRadius: 3,
                textTransform: 'none',
                "&:hover": { color: "#fff", borderColor: "#fff", bgcolor: "rgba(255,255,255,0.05)" }
            }}
          >
            Previous Reports
          </Button>
      </Box>

      {/* --- DASHBOARD HEADER --- */}
      <Box sx={{ width: "100%", maxWidth: "600px", px: 3, textAlign: "center" }}>
        <Typography variant="h5" fontWeight="800" mb={1} sx={{ 
            background: "linear-gradient(45deg, #FF512F 30%, #DD2476 90%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
        }}>
          Enforcement Mode
        </Typography>
        <Typography variant="body1" mb={4} sx={{ color: "#9ca3af" }}>
           Automated Violation Detection & Routing System
        </Typography>

        <Button
          startIcon={<CameraAltIcon />}
          onClick={startCamera}
          variant="contained"
          size="medium"
          sx={{
            width: "80%", py: 2.5, mb: 2, borderRadius: 3,
            bgcolor: "#ef4444", color: "#fff", fontWeight: 700, fontSize: "1.1rem",
            boxShadow: "0 0 25px rgba(239, 68, 68, 0.4)",
            "&:hover": { bgcolor: "#dc2626" }
          }}
        >
          SCAN VIOLATION
        </Button>

        <Divider sx={{ my: 3, borderColor: "#333", color: "#555" }}>OR UPLOAD EVIDENCE</Divider>

        <Button
          startIcon={<UploadFileIcon />}
          onClick={() => fileInputRef.current.click()}
          variant="outlined"
          sx={{
            width: "80%", py: 2, borderRadius: 3,
            borderColor: "#555", color: "#ccc",
            "&:hover": { borderColor: "#fff", color: "#fff", bgcolor: "rgba(255,255,255,0.05)" }
          }}
        >
          SELECT FROM GALLERY
        </Button>

        <input ref={fileInputRef} hidden type="file" accept="image/*" onChange={handleUpload} />
      </Box>

      {/* --- 1. PREVIEW DIALOG --- */}
      <Dialog open={openScanner} onClose={() => setOpenScanner(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: "#1e1e1e", color: "#fff", borderRadius: 3 } }}>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: '1px solid #333' }}>
          Scanning Evidence...
          <IconButton onClick={() => setOpenScanner(false)} sx={{ color: "#fff" }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ height: "450px", display: "flex", flexDirection: "column", gap: 2, p: 0, justifyContent: 'center', alignItems: 'center', bgcolor: "#000" }}>
          
          {previewType === "camera" && !imgSrc ? (
             <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "environment" }}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
             />
          ) : (
             <img src={imgSrc} alt="Preview" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          )}

          <Box sx={{ position: 'absolute', bottom: 20, width: '90%', display: 'flex', gap: 2 }}>
             {previewType === "camera" && !imgSrc && (
                <Button variant="contained" fullWidth onClick={capture} sx={{ bgcolor: "#fff", color: "#000", fontWeight: "bold" }}>
                   CAPTURE PHOTO
                </Button>
             )}
             {imgSrc && (
                <Button 
                   variant="contained" fullWidth onClick={analyze} disabled={analyzing}
                   sx={{ bgcolor: "#f59e0b", color: "#000", fontWeight: "bold" }}
                >
                   {analyzing ? <CircularProgress size={24} color="inherit" /> : "ANALYZE & DETECT"}
                </Button>
             )}
             {imgSrc && (
                 <Button variant="outlined" onClick={() => setImgSrc(null)} sx={{ color: "#fff", borderColor: "#fff" }}>
                    RETAKE
                 </Button>
             )}
          </Box>
        </DialogContent>
      </Dialog>

      {/* --- 2. RESULT POPUP --- */}
      <Dialog 
        open={!!result} 
        onClose={() => setResult(null)} 
        TransitionComponent={Transition}
        maxWidth="md" 
        fullWidth 
        PaperProps={{ sx: { bgcolor: "#0f172a", color: "#fff", borderRadius: 3, border: "1px solid #374151" } }}
      >
        <Box sx={{ position: 'absolute', right: 12, top: 12 }}>
            <IconButton onClick={() => setResult(null)} sx={{ color: "#94a3b8" }}><CloseIcon /></IconButton>
        </Box>

        <DialogContent sx={{ p: 0 }}>
            <Grid container>
                <Grid item xs={12} md={7} sx={{ p: 3, borderRight: { md: "1px solid #374151" } }}>
                    <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                        {result?.violation ? 
                            <Box sx={{ p: 1, bgcolor: "rgba(239,68,68,0.2)", borderRadius: "50%" }}><GppBadIcon color="error" sx={{ fontSize: 32 }} /></Box> : 
                            <Box sx={{ p: 1, bgcolor: "rgba(34,197,94,0.2)", borderRadius: "50%" }}><CheckCircleIcon color="success" sx={{ fontSize: 32 }} /></Box>
                        }
                        <Box>
                            <Typography variant="overline" color="#94a3b8" fontWeight="bold" letterSpacing={1.2}>STATUS</Typography>
                            <Typography variant="h6" fontWeight="900" color={result?.violation ? "#ef4444" : "#22c55e"}>
                                {result?.violation ? "VIOLATION DETECTED" : "COMPLIANT"}
                            </Typography>
                        </Box>
                    </Stack>

                    <Divider sx={{ my: 2, bgcolor: "#374151" }} />

                    <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ fontSize: "1.1rem" }}>{result?.title}</Typography>
                    <Typography variant="body2" sx={{ color: "#cbd5e1", mb: 3, lineHeight: 1.5, fontSize: "0.9rem" }}>
                        {result?.description}
                    </Typography>
                    
                    {/* Severity Chip */}
                    {result?.violation && (
                        <Box mb={3} display="flex" gap={1}>
                            <Chip 
                                label={`SEVERITY: ${result.severity?.toUpperCase() || "PENDING"}`} 
                                sx={{ 
                                    bgcolor: result?.severity?.toLowerCase() === 'high' ? "#b91c1c" : result?.severity?.toLowerCase() === 'medium' ? "#ca8a04" : "#15803d", 
                                    color: "#fff", fontWeight: "bold" 
                                }} 
                            />
                        </Box>
                    )}

                    {result?.violation && (
                         <Button
                            fullWidth
                            variant="contained"
                            color="error"
                            size="medium"
                            endIcon={reportStatus === 'sending' ? null : <SendIcon />}
                            onClick={handleInstantReport}
                            disabled={reportStatus === 'sending'}
                            sx={{ 
                                py: 1.5, borderRadius: 2, fontWeight: 'bold', fontSize: '0.9rem',
                                bgcolor: "#dc2626", "&:hover": { bgcolor: "#b91c1c" }
                            }}
                        >
                            {reportStatus === 'sending' ? "ROUTING TO AUTHORITY..." : "REPORT TO AUTHORITY"}
                        </Button>
                    )}
                </Grid>

                <Grid item xs={12} md={5} sx={{ bgcolor: "#1e293b", p: 3 }}>
                    <Typography variant="overline" color="#94a3b8" fontWeight="bold" display="block" mb={2}>
                        DIGITAL CASE FILE
                    </Typography>

                    <Stack spacing={2}>
                        <Box>
                            <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                                <MapIcon sx={{ fontSize: 16, color: "#64748b" }} />
                                <Typography variant="caption" color="#94a3b8" fontWeight="bold">JURISDICTION</Typography>
                            </Stack>
                            <Typography variant="body2" fontWeight="600" color="#fff">{place}</Typography>
                        </Box>

                        <Box sx={{ p: 1.5, bgcolor: "rgba(15, 23, 42, 0.6)", borderRadius: 2, border: "1px dashed #475569" }}>
                            <Typography variant="caption" color="#f87171" fontWeight="bold" display="block" mb={0.5}>
                                APPLICABLE LAW
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#e2e8f0", fontFamily: "monospace", lineHeight: 1.4, whiteSpace: "pre-wrap", display: "block" }}>
                                {result?.law || "Pending Legal Review"}
                            </Typography>
                        </Box>

                        <Box>
                            <Typography variant="caption" color="#94a3b8" fontWeight="bold" display="block" mb={0.5}>
                                EST. PENALTY
                            </Typography>
                            <Typography variant="h5" fontWeight="800" color="#ef4444">
                                {result?.fineAmount || "₹ --"}
                            </Typography>
                        </Box>
                    </Stack>
                </Grid>
            </Grid>
        </DialogContent>
      </Dialog>

      {/* --- 3. SUCCESS RECEIPT --- */}
      <Dialog 
        open={!!successData} 
        onClose={() => setSuccessData(null)}
        TransitionComponent={Transition}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: "#fff", color: "#1f2937", borderRadius: 4 } }}
      >
          <Box sx={{ bgcolor: "#059669", height: 8, width: "100%" }} /> 
          
          <DialogContent sx={{ textAlign: 'center', pt: 3, pb: 4, px: 4 }}>
              <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: '#d1fae5', mb: 2 }}>
                  <AssignmentTurnedInIcon sx={{ fontSize: 32, color: '#059669' }} />
              </Box>
              
              <Typography variant="h6" fontWeight="900" color="#064e3b" gutterBottom>
                  REPORT FILED SUCCESSFULLY
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                  The nearest competent authority has been notified.
              </Typography>

              <Card variant="outlined" sx={{ textAlign: 'left', mb: 3, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                      <Stack spacing={2}>
                          <Box>
                              <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                                <AccountBalanceIcon sx={{ fontSize: 16, color: "#64748b" }} />
                                <Typography variant="caption" fontWeight="bold" color="text.secondary">ROUTED TO</Typography>
                              </Stack>
                              <Typography variant="subtitle2" fontWeight="bold" color="#0f172a" sx={{ fontSize: "1rem" }}>
                                  {successData?.authority}
                              </Typography>
                          </Box>

                          <Divider />

                          <Stack direction="row" justifyContent="space-between">
                              <Box>
                                  <Typography variant="caption" fontWeight="bold" color="text.secondary">DATE</Typography>
                                  <Typography variant="body2" fontWeight="bold">{successData?.date}</Typography>
                              </Box>
                              <Box>
                                  <Typography variant="caption" fontWeight="bold" color="text.secondary">TIME</Typography>
                                  <Typography variant="body2" fontWeight="bold">{successData?.time}</Typography>
                              </Box>
                          </Stack>
                          <Box>
                              <Typography variant="caption" fontWeight="bold" color="text.secondary">CASE ID</Typography>
                              <Typography variant="body2" fontFamily="monospace" sx={{ letterSpacing: 1, bgcolor: "#e2e8f0", display: "inline-block", px: 1, borderRadius: 1 }}>
                                {successData?.id.slice(-8).toUpperCase()}
                              </Typography>
                          </Box>
                      </Stack>
                  </CardContent>
              </Card>

              <Button 
                variant="contained" 
                onClick={() => setSuccessData(null)}
                fullWidth
                sx={{ bgcolor: "#0f172a", color: "#fff", py: 1.2, "&:hover": { bgcolor: "#334155" } }}
              >
                  CLOSE & SCAN NEXT
              </Button>
          </DialogContent>
      </Dialog>

      {/* --- 4. HISTORY DIALOG --- */}
      <Dialog 
        open={openHistory} 
        onClose={() => setOpenHistory(false)}
        TransitionComponent={Transition}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: "#0f172a", color: "#fff", borderRadius: 3, border: "1px solid #374151", minHeight: '60vh' } }}
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: '1px solid #374151' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
              <HistoryIcon sx={{ color: "#f59e0b" }} />
              <Typography variant="h6" fontWeight="bold">Submission History</Typography>
          </Stack>
          <IconButton onClick={() => setOpenHistory(false)} sx={{ color: "#94a3b8" }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
            {loadingHistory ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                    <CircularProgress color="warning" />
                </Box>
            ) : historyData.length === 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', opacity: 0.6 }}>
                    <DescriptionIcon sx={{ fontSize: 60, mb: 2 }} />
                    <Typography>No reports found.</Typography>
                </Box>
            ) : (
                <List>
                    {historyData.map((report) => (
                        <Card key={report._id} variant="outlined" sx={{ mb: 2, bgcolor: "#1e293b", borderColor: "#334155" }}>
                            <ListItem alignItems="flex-start" sx={{ px: 2, py: 1.5 }}>
                                <ListItemIcon sx={{ minWidth: 40, mt: 1 }}>
                                    {report.category.toLowerCase().includes('traffic') ? 
                                        <GppBadIcon sx={{ color: '#ef4444', fontSize: 28 }} /> : 
                                        <MapIcon sx={{ color: '#22c55e', fontSize: 28 }} />
                                    }
                                </ListItemIcon>
                                <ListItemText 
                                    primary={
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                            <Typography variant="subtitle1" fontWeight="bold" color="#fff">
                                                {report.title}
                                            </Typography>
                                            <Chip 
                                                label={report.status || "Forwarded"} 
                                                size="small" 
                                                sx={{ 
                                                    bgcolor: "rgba(34,197,94,0.15)", 
                                                    color: "#4ade80", 
                                                    fontWeight: "bold",
                                                    fontSize: '0.7rem'
                                                }} 
                                            />
                                        </Box>
                                    }
                                    secondary={
                                        <Box>
                                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                                                <AccountBalanceIcon sx={{ fontSize: 14, color: "#94a3b8" }} />
                                                <Typography variant="body2" color="#cbd5e1">
                                                    {report.forwardedTo || "Pending Assignment"}
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                <AccessTimeIcon sx={{ fontSize: 14, color: "#64748b" }} />
                                                <Typography variant="caption" color="#94a3b8">
                                                    {new Date(report.date).toLocaleDateString()} at {new Date(report.date).toLocaleTimeString()}
                                                </Typography>
                                            </Stack>
                                        </Box>
                                    }
                                />
                            </ListItem>
                        </Card>
                    ))}
                </List>
            )}
        </DialogContent>
      </Dialog>

    </Box>
  );
}
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
  ListItemIcon,
  Alert,
  AlertTitle,
  Tooltip
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
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';

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
  const [locationError, setLocationError] = useState(null);
  
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [reportStatus, setReportStatus] = useState(null);
  const [successData, setSuccessData] = useState(null); 

  // History States
  const [openHistory, setOpenHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Location Effect
  useEffect(() => {
    if (!navigator.geolocation) {
      setPlace("Location unavailable");
      setLocationError("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          setCoords({ lat: latitude, lon: longitude });
          
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
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
            address.state_district ||
            "Unknown Location";
            
          setPlace(locName);
          setLocationError(null);
        } catch (err) {
          console.error("Location Error:", err);
          setPlace("Location unavailable");
          setLocationError("Failed to get location name");
        }
      },
      (err) => {
        console.error("Geo Error:", err);
        setPlace("Location access denied");
        setLocationError("Please enable location access for accurate routing");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Camera Functions
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

  // Analyze Function
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
          base64: finalImage
        }),
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || "Analysis failed.");
      if (data.error) throw new Error(data.error);

      setResult(data);
      setOpenScanner(false); 
      
    } catch (err) {
      setError("Analysis Failed: " + err.message);
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  // Find Real Authority Function
  const findRealAuthority = async (category, coordinates, placeName) => {
    const TOMTOM_KEY = "u0ilQFRkdoZ9gPvf1G6ri97BH5ZslXb3"; 

    const catLower = category?.toLowerCase() || "";
    const isTraffic = catLower.includes("traffic");
    const isEnvironmental = catLower.includes("environmental") || catLower.includes("garbage") || catLower.includes("waste");

    let searchQueries = [];
    if (isTraffic) {
        searchQueries = [`Traffic Police Station ${placeName}`, `Police Station ${placeName}`, `RTO ${placeName}`];
    } else if (isEnvironmental) {
        searchQueries = [`Municipality Office ${placeName}`, `Panchayat Office ${placeName}`, `Pollution Control Board ${placeName}`];
    } else {
        searchQueries = [`Police Station ${placeName}`];
    }

    try {
        for (const query of searchQueries) {
            console.log(`🔍 Searching for: ${query}`);
            
            if (!coordinates.lat || !coordinates.lon) continue;

            const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${TOMTOM_KEY}&lat=${coordinates.lat}&lon=${coordinates.lon}&radius=10000&limit=5&idxSet=POI`; 
            
            const res = await fetch(url);
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                const sortedResults = data.results.sort((a, b) => a.dist - b.dist);

                for (let item of sortedResults) {
                    const name = item.poi.name;
                    const nameLower = name.toLowerCase();
                    
                    // Filter out unwanted results
                    if (nameLower.match(/school|college|bank|atm|hotel|hospital|clinic|shop|store/)) {
                        continue; 
                    }

                    // Validate based on category
                    let isValid = false;
                    if (isTraffic && nameLower.match(/police|traffic|rto|enforcement/)) isValid = true;
                    if (isEnvironmental && nameLower.match(/municipality|panchayat|corporation|board|council/)) isValid = true;
                    if (!isTraffic && !isEnvironmental && nameLower.match(/police/)) isValid = true;

                    if (isValid) {
                        console.log(`✅ Found: ${name} (${Math.round(item.dist)}m away)`);
                        return `${name}, ${item.address?.freeformAddress || placeName}`; 
                    }
                }
            }
        }
    } catch (e) {
        console.error("Routing Error:", e);
    }

    // Fallback
    if (isTraffic) return `Traffic Police Headquarters, ${placeName} District`;
    if (isEnvironmental) return `State Pollution Control Board, ${placeName}`;
    return `Police Headquarters, ${placeName}`;
  };

  // Report Function
  const handleInstantReport = async () => {
    if (!userEmail) {
        alert("Please login to file a report.");
        return;
    }
    
    if (!coords.lat || !coords.lon) {
        alert("Location is still loading. Please wait a moment.");
        return;
    }

    setReportStatus('sending');

    try {
        const now = new Date();
        const dateString = now.toLocaleDateString('en-IN'); 
        const timeString = now.toLocaleTimeString('en-IN'); 

        const mainCategory = result.violations && result.violations.length > 0 
            ? result.violations[0].category 
            : "General";

        const realAuthorityName = await findRealAuthority(mainCategory, coords, place);

        const compiledDescription = result.violations?.map(v => 
          `${v.title}: ${v.description} (${v.law}) - Fine: ${v.fineAmount}`
        ).join('\n\n') || "No violations detected.";

        const reportPayload = {
            userEmail: userEmail,
            title: `${result.violations.length} Violation(s) Detected`,
            category: mainCategory, 
            severity: result.violations.some(v => v.severity === 'High') ? 'High' : 'Medium', 
            description: compiledDescription,
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
            id: res.data.report?._id || `CASE-${Date.now().toString().slice(-6)}`,
            date: dateString,
            time: timeString,
            category: mainCategory,
            violations: result.violations.length
        });
        setReportStatus('success');

    } catch (err) {
        console.error(err);
        setReportStatus('error');
        alert("Failed to submit report. Please try again.");
    }
  };

  // History Function
  const fetchHistory = async () => {
    if (!userEmail) {
      alert("Please login to view history");
      return;
    }
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
    <Box sx={{ 
      width: "100%", 
      minHeight: "85vh", 
      bgcolor: "#121212", 
      pb: 5, 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      position: 'relative' 
    }}>
      
      {/* History Button */}
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

      {/* Location Status */}
      {locationError && (
        <Alert 
          severity="warning" 
          icon={<WarningIcon />}
          sx={{ 
            position: 'absolute', 
            top: 80, 
            right: 20, 
            maxWidth: 300,
            bgcolor: '#33241a',
            color: '#ffb74d',
            border: '1px solid #664d33'
          }}
        >
          <AlertTitle sx={{ color: '#ffb74d', fontWeight: 'bold' }}>Location Warning</AlertTitle>
          {locationError}
        </Alert>
      )}

      {/* Main Content */}
      <Box sx={{ width: "100%", maxWidth: "600px", px: 3, textAlign: "center" }}>
        <Typography variant="h5" fontWeight="800" mb={1} sx={{ 
            background: "linear-gradient(45deg, #FF512F 30%, #DD2476 90%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
        }}>
          AI Enforcement Scanner
        </Typography>
        <Typography variant="body1" mb={4} sx={{ color: "#9ca3af" }}>
          Smart Violation Detection & Routing System
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

      {/* Scanner Dialog */}
      <Dialog 
        open={openScanner} 
        onClose={() => setOpenScanner(false)} 
        maxWidth="sm" 
        fullWidth 
        PaperProps={{ sx: { bgcolor: "#1e1e1e", color: "#fff", borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: '1px solid #333' }}>
          Capture Evidence
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
                   variant="contained" 
                   fullWidth 
                   onClick={analyze} 
                   disabled={analyzing}
                   sx={{ bgcolor: "#f59e0b", color: "#000", fontWeight: "bold", "&:disabled": { bgcolor: "#666" } }}
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

      {/* Results Dialog */}
      <Dialog 
        open={!!result} 
        onClose={() => setResult(null)} 
        TransitionComponent={Transition}
        maxWidth="md" 
        fullWidth 
        PaperProps={{ sx: { bgcolor: "#0f172a", color: "#fff", borderRadius: 3, border: "1px solid #374151" } }}
      >
        <Box sx={{ position: 'absolute', right: 12, top: 12 }}>
            <IconButton onClick={() => setResult(null)} sx={{ color: "#94a3b8", zIndex: 10 }}><CloseIcon /></IconButton>
        </Box>

        <DialogContent sx={{ p: 0 }}>
            <Grid container>
                <Grid item xs={12} md={7} sx={{ p: 3, borderRight: { md: "1px solid #374151" } }}>
                    <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                        {result?.violationsFound ? 
                            <Box sx={{ p: 1, bgcolor: "rgba(239,68,68,0.2)", borderRadius: "50%" }}>
                              <GppBadIcon color="error" sx={{ fontSize: 32 }} />
                            </Box> : 
                            <Box sx={{ p: 1, bgcolor: "rgba(34,197,94,0.2)", borderRadius: "50%" }}>
                              <CheckCircleIcon color="success" sx={{ fontSize: 32 }} />
                            </Box>
                        }
                        <Box>
                            <Typography variant="overline" color="#94a3b8" fontWeight="bold" letterSpacing={1.2}>
                              SCAN RESULT
                            </Typography>
                            <Typography variant="h6" fontWeight="900" color={result?.violationsFound ? "#ef4444" : "#22c55e"}>
                                {result?.violationsFound ? `${result.violations.length} VIOLATION(S) DETECTED` : "NO VIOLATIONS"}
                            </Typography>
                        </Box>
                    </Stack>

                    {/* Classification Info */}
                    {result?.classification && (
                      <Box sx={{ mb: 2, p: 1.5, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 2 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <InfoIcon sx={{ fontSize: 16, color: "#94a3b8" }} />
                          <Typography variant="caption" color="#94a3b8">
                            Image Type: {result.classification.isTraffic ? 'Traffic' : 'Non-Traffic'} 
                            ({result.classification.confidence} confidence)
                          </Typography>
                        </Stack>
                      </Box>
                    )}

                    <Divider sx={{ my: 2, bgcolor: "#374151" }} />

                    {/* Violations List */}
                    <Box sx={{ 
                      maxHeight: "350px", 
                      overflowY: "auto", 
                      pr: 1, 
                      mb: 3, 
                      "&::-webkit-scrollbar": { width: "6px" },
                      "&::-webkit-scrollbar-thumb": { backgroundColor: "#475569", borderRadius: "10px" }
                    }}>
                        {result?.violations?.map((violation, index) => (
                            <Box key={index} sx={{ mb: 2, p: 2, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 2, border: "1px solid #374151" }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                                    <Typography variant="h6" fontWeight="bold" sx={{ fontSize: "1.1rem" }}>
                                      {violation.title}
                                    </Typography>
                                    <Chip 
                                        label={violation.severity?.toUpperCase() || "MEDIUM"} 
                                        size="small"
                                        sx={{ 
                                            bgcolor: violation.severity?.toLowerCase() === 'high' ? "#b91c1c" : 
                                                    violation.severity?.toLowerCase() === 'medium' ? "#ca8a04" : "#15803d", 
                                            color: "#fff", 
                                            fontWeight: "bold", 
                                            fontSize: "0.7rem"
                                        }} 
                                    />
                                </Stack>
                                <Typography variant="body2" sx={{ color: "#cbd5e1", mb: 2, lineHeight: 1.5, fontSize: "0.9rem" }}>
                                    {violation.description}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                    <Box sx={{ bgcolor: "rgba(239, 68, 68, 0.1)", px: 1.5, py: 0.5, borderRadius: 1, border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                                        <Typography variant="caption" color="#fca5a5" display="block" fontWeight="bold">
                                          LAW
                                        </Typography>
                                        <Typography variant="body2" color="#f87171" fontWeight="bold" fontFamily="monospace">
                                          {violation.law}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ bgcolor: "rgba(245, 158, 11, 0.1)", px: 1.5, py: 0.5, borderRadius: 1, border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                                        <Typography variant="caption" color="#fcd34d" display="block" fontWeight="bold">
                                          FINE
                                        </Typography>
                                        <Typography variant="body2" color="#fbbf24" fontWeight="bold">
                                          {violation.fineAmount}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        ))}
                    </Box>

                    {result?.violationsFound && (
                         <Tooltip title={!userEmail ? "Please login to report" : ""}>
                           <span>
                             <Button
                                fullWidth
                                variant="contained"
                                color="error"
                                size="small"
                                endIcon={reportStatus === 'sending' ? null : <SendIcon />}
                                onClick={handleInstantReport}
                                disabled={reportStatus === 'sending' || !userEmail}
                                sx={{ 
                                    py: 1.5, 
                                    borderRadius: 2, 
                                    fontWeight: 'bold', 
                                    fontSize: '0.9rem',
                                    bgcolor: "#dc2626", 
                                    "&:hover": { bgcolor: "#b91c1c" },
                                    "&:disabled": { bgcolor: "#4a4a4a" }
                                }}
                            >
                                {reportStatus === 'sending' ? "ROUTING..." : "FILE OFFICIAL REPORT"}
                            </Button>
                           </span>
                         </Tooltip>
                    )}
                </Grid>

                <Grid item xs={12} md={5} sx={{ bgcolor: "#1e293b", p: 3 }}>
                    <Typography variant="overline" color="#94a3b8" fontWeight="bold" display="block" mb={2}>
                        CASE SUMMARY
                    </Typography>

                    <Stack spacing={2}>
                        <Box>
                            <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                                <MapIcon sx={{ fontSize: 16, color: "#64748b" }} />
                                <Typography variant="caption" color="#94a3b8" fontWeight="bold">
                                  LOCATION
                                </Typography>
                            </Stack>
                            <Typography variant="body2" fontWeight="600" color="#fff">
                              {place}
                            </Typography>
                        </Box>

                        <Box>
                            <Typography variant="caption" color="#94a3b8" fontWeight="bold" display="block" mb={0.5}>
                                TOTAL FINE
                            </Typography>
                            <Typography variant="h4" fontWeight="800" color="#ef4444">
                                {result?.totalEstimatedFine || "₹0"}
                            </Typography>
                        </Box>

                        <Box sx={{ p: 1.5, bgcolor: "rgba(15, 23, 42, 0.6)", borderRadius: 2 }}>
                            <Typography variant="caption" color="#94a3b8" fontWeight="bold" display="block" mb={1}>
                                NEXT STEPS
                            </Typography>
                            <Typography variant="body2" sx={{ color: "#cbd5e1", fontSize: "0.85rem" }}>
                                1. Review all detected violations
                            </Typography>
                            <Typography variant="body2" sx={{ color: "#cbd5e1", fontSize: "0.85rem" }}>
                                2. Click "File Official Report" to route to authorities
                            </Typography>
                            <Typography variant="body2" sx={{ color: "#cbd5e1", fontSize: "0.85rem" }}>
                                3. Track status in "Previous Reports"
                            </Typography>
                        </Box>
                    </Stack>
                </Grid>
            </Grid>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
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
                  {successData?.violations} violation(s) reported to the nearest authority.
              </Typography>

              <Card variant="outlined" sx={{ textAlign: 'left', mb: 3, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                      <Stack spacing={2}>
                          <Box>
                              <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                                <AccountBalanceIcon sx={{ fontSize: 16, color: "#64748b" }} />
                                <Typography variant="caption" fontWeight="bold" color="text.secondary">
                                  ROUTED TO
                                </Typography>
                              </Stack>
                              <Typography variant="subtitle2" fontWeight="bold" color="#0f172a" sx={{ fontSize: "0.95rem" }}>
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
                              <Typography variant="caption" fontWeight="bold" color="text.secondary">REFERENCE ID</Typography>
                              <Typography variant="body2" fontFamily="monospace" sx={{ 
                                letterSpacing: 1, 
                                bgcolor: "#e2e8f0", 
                                display: "inline-block", 
                                px: 1.5, 
                                py: 0.5, 
                                borderRadius: 1 
                              }}>
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
                sx={{ 
                  bgcolor: "#0f172a", 
                  color: "#fff", 
                  py: 1.2, 
                  "&:hover": { bgcolor: "#334155" } 
                }}
              >
                  CLOSE
              </Button>
          </DialogContent>
      </Dialog>

      {/* History Dialog */}
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
              <Typography variant="h6" fontWeight="bold">Your Reports</Typography>
          </Stack>
          <IconButton onClick={() => setOpenHistory(false)} sx={{ color: "#94a3b8" }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
            {loadingHistory ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                    <CircularProgress color="warning" />
                </Box>
            ) : historyData.length === 0 ? (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '300px', 
                  opacity: 0.6 
                }}>
                    <DescriptionIcon sx={{ fontSize: 60, mb: 2, color: '#4b5563' }} />
                    <Typography color="#9ca3af">No reports found.</Typography>
                    <Typography variant="caption" color="#6b7280" sx={{ mt: 1 }}>
                        Scan and report violations to see them here.
                    </Typography>
                </Box>
            ) : (
                <List>
                    {historyData.map((report) => (
                        <Card key={report._id} variant="outlined" sx={{ mb: 2, bgcolor: "#1e293b", borderColor: "#334155" }}>
                            <ListItem alignItems="flex-start" sx={{ px: 2, py: 1.5 }}>
                                <ListItemIcon sx={{ minWidth: 40, mt: 1 }}>
                                    {report.category?.toLowerCase().includes('traffic') ? 
                                        <GppBadIcon sx={{ color: '#ef4444', fontSize: 28 }} /> : 
                                        <MapIcon sx={{ color: '#22c55e', fontSize: 28 }} />
                                    }
                                </ListItemIcon>
                                <ListItemText 
                                    primary={
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                            <Typography variant="subtitle1" fontWeight="bold" color="#fff">
                                                {report.title || 'Violation Report'}
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
                                                    {report.forwardedTo || "Awaiting Assignment"}
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

      {/* Error Display */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            position: 'fixed', 
            bottom: 20, 
            left: '50%', 
            transform: 'translateX(-50%)',
            maxWidth: 500,
            bgcolor: '#2d1a1a',
            color: '#ff8a80',
            border: '1px solid #b71c1c'
          }}
          onClose={() => setError(null)}
        >
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}
    </Box>
  );
}
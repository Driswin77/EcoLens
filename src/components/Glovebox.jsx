import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  IconButton,
  Chip,
  Stack,
  CircularProgress,
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle
} from "@mui/material";

// Icons
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VisibilityIcon from "@mui/icons-material/Visibility"; // Added for better UX
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close"; // Added for Modal
import axios from "axios";

// 1. Accept userEmail as a prop (CHANGED FROM userPhone)
export default function Glovebox({ userEmail }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);

  // New State for Viewing Files (Modal)
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // 2. Fetch docs whenever the userEmail changes (e.g. on login)
  useEffect(() => {
    if (userEmail) {
        fetchDocs();
    }
  }, [userEmail]);

  const fetchDocs = async () => {
    try {
      // 3. Send userEmail to backend to get ONLY your files (CHANGED)
      const res = await axios.get(`http://localhost:5000/my-docs?userEmail=${userEmail}`);
      setDocs(res.data);
    } catch (err) {
      console.error("Fetch error", err);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Safety check (CHANGED)
    if (!userEmail) {
        alert("Please log in to upload documents.");
        return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      try {
        const base64 = reader.result;
        // 4. Send userEmail with the upload so it belongs to you (CHANGED)
        await axios.post("http://localhost:5000/upload-doc", {
          image: base64,
          name: file.name,
          userEmail: userEmail // <--- LINK TO USER EMAIL
        });
        
        // Wait a bit for DB to save, then refresh
        setTimeout(() => {
            fetchDocs();
        }, 500);
        
      } catch (err) {
        alert("Upload Failed: " + err.message);
      } finally {
        setLoading(false);
      }
    };
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Delete this document permanently?")) return;
    await axios.delete(`http://localhost:5000/delete-doc/${id}`);
    fetchDocs(); // Refresh list after delete
  };

  // New Function: Handle Opening the File Viewer
  const handleViewFile = (doc) => {
      setSelectedDoc(doc);
      setViewOpen(true);
  };

  // New Function: Handle Closing the Viewer
  const handleCloseView = () => {
      setViewOpen(false);
      setSelectedDoc(null);
  };

  // Helper: Calculate Days Left & Formatting
  const getExpiryDetails = (expiryDate) => {
    if (!expiryDate) return { days: 0, text: "Unknown", status: "ATTENTION", color: "primary" };
    
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let status = "VALID";
    let statusBg = "#dcfce7";
    let statusText = "#166534";

    if (days < 0) {
        status = "EXPIRED";
        statusBg = "#fee2e2";
        statusText = "#991b1b";
    } else if (days < 30) {
        status = "EXPIRING SOON";
        statusBg = "#fef9c3";
        statusText = "#854d0e";
    }

    // Format text like "4 months 23 days left"
    let timeText = `${days} days left`;
    if (days > 30) {
        const months = Math.floor(days / 30);
        const remainingDays = days % 30;
        timeText = `${months} months ${remainingDays} days left`;
    }

    return { days, text: timeText, status, statusBg, statusText };
  };

  return (
    <Box sx={{ p: 4, height: "100%", overflowY: "auto", bgcolor: "#f8fafc" }}>
      
      {/* HEADER SECTION */}
      <Box mb={4}>
        <Typography variant="h4" fontWeight="bold" color="#111827">Digital Glovebox</Typography>
        <Stack direction="row" alignItems="center" spacing={2} mt={1}>
            <Typography color="#6b7280" variant="body1">
                Secure Cloud Storage & Auto-Verification.
            </Typography>
            <Chip 
                label="CLOUD SYNC ACTIVE" 
                size="small" 
                sx={{ bgcolor: "#dbeafe", color: "#1e40af", fontWeight: "bold", fontSize: "0.7rem", borderRadius: 1 }} 
            />
        </Stack>
      </Box>

      {/* MAIN GRID */}
      <Grid container spacing={3}>
        
        {/* 1. UPLOAD CARD (ALWAYS FIRST) */}
        <Grid item xs={12} md={4}>
            <Button
                component="label"
                sx={{ 
                    width: "100%", 
                    height: "240px", 
                    border: "2px dashed #cbd5e1", 
                    borderRadius: 3,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textTransform: "none",
                    bgcolor: "white",
                    "&:hover": { bgcolor: "#f1f5f9", borderColor: "#94a3b8" }
                }}
                disabled={loading}
            >
                {loading ? (
                    <CircularProgress size={40} sx={{color: "#cbd5e1"}} />
                ) : (
                    <>
                        <Box sx={{ bgcolor: "#f1f5f9", p: 2, borderRadius: "50%", mb: 2 }}>
                            <AddIcon sx={{ fontSize: 40, color: "#94a3b8" }} />
                        </Box>
                        <Typography variant="h6" color="#64748b" fontWeight="bold">Upload Document</Typography>
                        <Typography variant="caption" color="#94a3b8" mt={0.5}>Encrypted Cloud Storage</Typography>
                        <Typography variant="caption" color="#94a3b8">Supports PUC & RC (Img/PDF)</Typography>
                    </>
                )}
                <input type="file" hidden onChange={handleFileUpload} accept="image/*,application/pdf" />
            </Button>
        </Grid>

        {/* 2. DOCUMENT CARDS */}
        {docs.length === 0 && !loading ? (
             // Optional: Empty State Message if user has no docs yet
             <Grid item xs={12} md={8} display="flex" alignItems="center" justifyContent="center">
                <Typography color="#94a3b8">No documents found. Upload your first one!</Typography>
             </Grid>
        ) : (
            docs.map((doc) => {
                const { text, status, statusBg, statusText } = getExpiryDetails(doc.expiry);
                
                return (
                  <Grid item xs={12} md={4} key={doc.id || Math.random()}>
                    <Card sx={{ 
                        height: "240px", 
                    
                        borderRadius: 3, 
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)", 
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        p: 2
                    }}>
                      
                      {/* Card Header */}
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Stack direction="row" spacing={2}>
                            <Box sx={{ p: 1.5, bgcolor: "#f3f4f6", borderRadius: 2 }}>
                                {doc.type === "PUC" ? <VerifiedUserIcon sx={{ color: "#4b5563" }} /> : <InsertDriveFileIcon sx={{ color: "#4b5563" }} />}
                            </Box>
                            <Box>
                                <Typography variant="subtitle1" fontWeight="bold" color="#111827">
                                    {doc.type || "Document"}
                                </Typography>
                                <Typography variant="caption" color="#6b7280" display="block">
                                    {doc.plate !== "Unknown" ? doc.plate : "Unknown Vehicle"}
                                </Typography>
                            </Box>
                        </Stack>

                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Chip 
                                label={status} 
                                size="small" 
                                sx={{ bgcolor: statusBg, color: statusText, fontWeight: "bold", fontSize: "0.7rem", borderRadius: 1 }} 
                            />
                            <IconButton size="small" onClick={() => handleDelete(doc.id)}>
                                <DeleteOutlineIcon fontSize="small" color="disabled" />
                            </IconButton>
                        </Stack>
                      </Box>

                      {/* Card Body (Details) */}
                      <Box mt={2}>
                        <Typography variant="caption" color="#9ca3af" fontWeight="bold" letterSpacing={1}>VALID UNTIL</Typography>
                        <Typography variant="h6" fontWeight="bold" color="#374151">
                            {doc.expiry}
                        </Typography>
                        
                        <Stack direction="row" alignItems="center" spacing={0.5} mt={0.5}>
                            <AccessTimeIcon sx={{ fontSize: 16, color: statusText }} />
                            <Typography variant="body2" color={statusText} fontWeight="medium">
                                {text}
                            </Typography>
                        </Stack>
                      </Box>

                      {/* Card Footer (Actions) */}
                      <Box mt={2} display="flex" justifyContent="flex-end" alignItems="center">
                          <Button 
                            size="small" 
                            endIcon={<VisibilityIcon sx={{fontSize: "16px !important"}} />}
                            sx={{ textTransform: "none", color: "#2563eb", fontWeight: "bold" }}
                            onClick={() => handleViewFile(doc)} 
                          >
                            View File
                          </Button>
                      </Box>

                    </Card>
                  </Grid>
                );
            })
        )}

      </Grid>

      {/* FILE PREVIEW MODAL */}
      <Dialog 
        open={viewOpen} 
        onClose={handleCloseView} 
        maxWidth="md" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, height: '80vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography fontWeight="bold">
                {selectedDoc?.type ? `${selectedDoc.type} Preview` : 'Document Preview'}
            </Typography>
            <IconButton onClick={handleCloseView}>
                <CloseIcon />
            </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {selectedDoc && (
                selectedDoc.image.startsWith("data:application/pdf") ? (
                    <embed 
                        src={selectedDoc.image} 
                        type="application/pdf" 
                        width="100%" 
                        height="100%" 
                        style={{ border: 'none' }}
                    />
                ) : (
                    <img 
                        src={selectedDoc.image} 
                        alt="Document Preview" 
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                    />
                )
            )}
        </DialogContent>
        <DialogActions>
            <Button onClick={handleCloseView} color="primary">Close</Button>
            {selectedDoc && (
                 <Button onClick={() => {
                    const link = document.createElement("a");
                    link.href = selectedDoc.image;
                    link.download = "document_download";
                    link.click();
                 }} variant="contained" color="success">
                    Download
                 </Button>
            )}
        </DialogActions>
      </Dialog>

    </Box>
  );
}
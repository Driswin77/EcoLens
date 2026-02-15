import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Stack,
  Divider,
  Button,
  Chip,
  Box,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/WarningAmber";
import GavelIcon from '@mui/icons-material/Gavel';
import InfoIcon from '@mui/icons-material/Info';
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee"; // Added Icon

export default function ResultPanel({ data, onClose }) {
  // 1. Safe check for data to prevent crashes
  if (!data) return null;

  // 2. Map backend fields to frontend variables
  // Note: We also look for 'fineAmount' which we added in VisualScanner
  const { violation, title, description, law, severity, preventive_action, fineAmount } = data;
  
  // Handle boolean or string inputs for violation status
  const isViolation = violation === true || (typeof violation === 'string' && violation === 'true');
  
  // Helper to determine severity color
  const getSeverityColor = (sev) => {
    if (!sev) return "default";
    const s = sev.toLowerCase();
    if (s.includes("high")) return "error";
    if (s.includes("medium")) return "warning";
    return "info";
  };

  return (
    <Dialog 
      open 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { 
          bgcolor: "#111", 
          color: "#fff",
          borderRadius: 2,
          border: isViolation ? "1px solid #dc2626" : "1px solid #16a34a"
        }
      }}
    >
      {/* --- HEADER --- */}
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, borderBottom: "1px solid #333" }}>
        {isViolation ? (
          <>
            <WarningIcon color="error" sx={{ fontSize: 30 }} />
            <Typography variant="h6" color="error" fontWeight="bold">
              VIOLATION DETECTED
            </Typography>
          </>
        ) : (
          <>
            <CheckCircleIcon color="success" sx={{ fontSize: 30 }} />
            <Typography variant="h6" color="success" fontWeight="bold">
              COMPLIANCE VERIFIED
            </Typography>
          </>
        )}

        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8, color: "#9ca3af" }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* --- CONTENT --- */}
      <DialogContent sx={{ mt: 2 }}>
        {!isViolation ? (
          <Stack alignItems="center" spacing={2} py={3}>
             <Typography variant="body1" align="center" sx={{ color: "#d1d5db" }}>
               {description || "No visible traffic or environmental violations detected in this frame."}
             </Typography>
             <Chip label="Safe to Proceed" color="success" variant="outlined" />
          </Stack>
        ) : (
          <Stack spacing={2}>
            
            {/* Title & Severity */}
            <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" fontWeight="bold" sx={{ color: "#fff" }}>
                  {title || "Potential Violation"}
                </Typography>
                {severity && (
                  <Chip 
                    label={`Severity: ${severity}`} 
                    color={getSeverityColor(severity)} 
                    size="small" 
                    variant="filled"
                    sx={{ fontWeight: "bold" }}
                  />
                )}
            </Box>

            <Divider sx={{ bgcolor: "#333" }} />

            {/* --- NEW SECTION: ESTIMATED FINE --- */}
            {/* Only shows if there is a fine amount present */}
            <Box 
                sx={{ 
                    bgcolor: "rgba(220, 38, 38, 0.1)", 
                    border: "1px solid #dc2626", 
                    borderRadius: 2, 
                    p: 2, 
                    display: "flex", 
                    alignItems: "center",
                    justifyContent: "space-between"
                }}
            >
                <Box>
                    <Typography variant="caption" sx={{ color: "#fca5a5", fontWeight: "bold", letterSpacing: 1 }}>
                        ESTIMATED PENALTY
                    </Typography>
                    <Typography variant="h4" sx={{ color: "#ef4444", fontWeight: "bold", display: 'flex', alignItems: 'center' }}>
                         {fineAmount || "Assessment Pending"} 
                    </Typography>
                </Box>
                <CurrencyRupeeIcon sx={{ fontSize: 40, color: "#ef4444", opacity: 0.6 }} />
            </Box>
            {/* ----------------------------------- */}

            {/* Description */}
            <Box>
                <Typography variant="subtitle2" sx={{ color: "#9ca3af", mb: 0.5 }}>
                  VISUAL EVIDENCE
                </Typography>
                <Typography variant="body1" sx={{ color: "#e5e7eb" }}>
                  {description}
                </Typography>
            </Box>

            {/* Applicable Law */}
            <Box sx={{ bgcolor: "rgba(37, 99, 235, 0.1)", p: 1.5, borderRadius: 1, borderLeft: "4px solid #2563eb" }}>
                <Stack direction="row" alignItems="center" gap={1} mb={0.5}>
                    <GavelIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle2" color="primary" fontWeight="bold">
                        LEGAL CONTEXT
                    </Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: "#bfdbfe" }}>
                  {law || "Advisory warning only."}
                </Typography>
            </Box>

            {/* Preventive Action */}
            <Box sx={{ bgcolor: "rgba(22, 163, 74, 0.1)", p: 1.5, borderRadius: 1, borderLeft: "4px solid #16a34a" }}>
                <Stack direction="row" alignItems="center" gap={1} mb={0.5}>
                    <InfoIcon fontSize="small" color="success" />
                    <Typography variant="subtitle2" color="success" fontWeight="bold">
                        RECOMMENDED ACTION
                    </Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: "#bbf7d0" }}>
                  {preventive_action || "Ensure compliance with local safety regulations."}
                </Typography>
            </Box>

          </Stack>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} fullWidth variant="outlined" sx={{ color: "#fff", borderColor: "#555", "&:hover": { borderColor: "#fff", bgcolor: "#333" } }}>
          CLOSE REPORT
        </Button>
      </DialogActions>
    </Dialog>
  );
}
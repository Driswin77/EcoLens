import React, { useState, useEffect } from 'react';
import { Scale, FileText, Send, X } from 'lucide-react';
import { 
  Box, Typography, Button, TextField, Paper, Grid, Divider, 
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, IconButton 
} from '@mui/material';
import jsPDF from 'jspdf';

const LegalAdvisor = () => {
  const [caseDescription, setCaseDescription] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false); 
  
  // DYNAMIC USER RETRIEVAL:
  // This pulls the user object stored during login. 
  // Fallback to "Guest" if no user is found in localStorage.
  const [currentUserName, setCurrentUserName] = useState("Guest");

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser && storedUser.name) {
      setCurrentUserName(storedUser.name);
    }
  }, []);

  const handleAnalyze = async () => {
    if (!caseDescription.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/legal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          description: caseDescription,
          userId: currentUserName // Use the dynamic name for database tracking
        }),
      });
      const data = await response.json();
      
      setAnalysis(data.analysis || data);
      setOpen(true);
      
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Could not connect to the legal database.");
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDF = () => {
    if (!analysis) return;

    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();
    let cursorY = 20; 
    const margin = 20;
    const pageHeight = doc.internal.pageSize.height;

    // Helper to manage multi-page content
    const checkPageBreak = (addedHeight) => {
      if (cursorY + addedHeight > pageHeight - 30) {
        doc.addPage();
        cursorY = 20; 
        return true;
      }
      return false;
    };

    // 1. Professional Header
    doc.setFontSize(20);
    doc.setTextColor(5, 150, 105); // EcoLens Green
    doc.text("EcoLens Legal Advisory Report", margin, cursorY);
    cursorY += 12;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${date}`, margin, cursorY);
    cursorY += 6;
    doc.text(`Prepared For: ${currentUserName}`, margin, cursorY);
    cursorY += 6;
    doc.text(`Case ID: ${currentUserName.toUpperCase().replace(/\s/g, '')}_${Date.now().toString().slice(-6)}`, margin, cursorY);
    cursorY += 6;
    doc.line(margin, cursorY, 190, cursorY);
    cursorY += 15;

    // 2. Incident Summary
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("Incident Description:", margin, cursorY);
    cursorY += 8;
    doc.setFont("helvetica", "normal");
    const wrappedDesc = doc.splitTextToSize(caseDescription, 170);
    doc.text(wrappedDesc, margin, cursorY);
    cursorY += (wrappedDesc.length * 7) + 12;

    // 3. Penalty and Statutes
    checkPageBreak(40);
    doc.setFont("helvetica", "bold");
    doc.text("Estimated Penalty Analysis:", margin, cursorY);
    cursorY += 8;
    doc.setFont("helvetica", "normal");
    const wrappedPenalty = doc.splitTextToSize(analysis.penalty || "N/A", 170);
    doc.text(wrappedPenalty, margin, cursorY);
    cursorY += (wrappedPenalty.length * 7) + 12;

    doc.setFont("helvetica", "bold");
    doc.text("Applicable Legal Statutes:", margin, cursorY);
    cursorY += 8;
    doc.setFont("helvetica", "normal");
    const wrappedLaw = doc.splitTextToSize(analysis.law || "N/A", 170);
    doc.text(wrappedLaw, margin, cursorY);
    cursorY += (wrappedLaw.length * 7) + 15;

    // 4. Detailed Appeal Guidance
    checkPageBreak(30);
    doc.line(margin, cursorY, 190, cursorY);
    cursorY += 10;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Formal Appeal Guidance", margin, cursorY);
    cursorY += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const detailedContent = analysis.appealDraft || analysis.resolution || "";
    const splitDraft = doc.splitTextToSize(detailedContent, 170);

    splitDraft.forEach((line) => {
      if (checkPageBreak(7)) {}
      doc.text(line, margin, cursorY);
      cursorY += 7;
    });

    // 5. Unified Footer with Page Numbers
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${totalPages}`, 170, 285);
      doc.text(`Report for ${currentUserName}. EcoLens AI: Not legal advice.`, margin, 285);
    }

    doc.save(`EcoLens_Report_${currentUserName.replace(/\s/g, '_')}.pdf`);
  };

  return (
    <Box sx={{ p: 4, bgcolor: '#ffffffe1', minHeight: '100vh' }}>
      <Box sx={{ mb: 6, textAlign: 'center' }}>
        <Grid container justifyContent="center" alignItems="center" sx={{ mb: 2 }}>
          <Grid item>
          </Grid>
          <Grid item>
            <Paper elevation={0} sx={{ p: 1, bgcolor: '#d1fae5', borderRadius: 2, display: 'flex', alignItems: 'center', gap: -0.2 }}>
              <Scale size={40} color="#10b981" />
              
            <Typography variant="h5"sx={{ fontWeight: 800, color: '#1e293b', ml: 2 }}>
              AI Legal Guidance
            </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      <Grid container justifyContent="center">
        <Grid item xs={12} md={8} lg={6}>
          <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
            <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 700, color: '#334155' }}>
              <FileText size={22} color="#059669" /> Case Documentation
            </Typography>
            
            <TextField
              fullWidth
              multiline
              rows={8}
              variant="outlined"
              placeholder="Provide a detailed description of the legal notice or incident here..."
              value={caseDescription}
              onChange={(e) => setCaseDescription(e.target.value)}
              sx={{ bgcolor: '#ffffff', '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            />
<Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, pl: 1, pr: 1 }}> 
  <Button
    variant="contained"
    disabled={isLoading}
    onClick={handleAnalyze}
    sx={{ 
      bgcolor: '#059669', 
      '&:hover': { bgcolor: '#047857' },
      py: 1.8, 
      px: 6, // Adding horizontal padding makes the button look more professional
      borderRadius: 3, 
      textTransform: 'none', 
      fontSize: '1.1rem', 
      fontWeight: 600,
      minWidth: '280px' // Ensures the button has a consistent size
    }}
  >
    {isLoading ? "Consulting AI Advisor..." : "Execute Legal Analysis"}
  </Button>
</Box>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4, p: 1, boxShadow: 24 } }}>
        <DialogTitle sx={{ m: 0, p: 2, fontWeight: 800, color: '#065f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Official Analysis Insight
          <IconButton onClick={() => setOpen(false)}><X size={20}/></IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ pb: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <Box>
              <Typography variant="overline" sx={{ color: '#059669', fontWeight: 900, letterSpacing: 1.5 }}>Calculated Penalty</Typography>
              <Typography variant="body1" sx={{ color: '#1e293b', fontWeight: 600 }}>{analysis?.penalty || "Evaluation pending..."}</Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="overline" sx={{ color: '#059669', fontWeight: 900, letterSpacing: 1.5 }}>Legal Reference</Typography>
              <Typography variant="body1" sx={{ color: '#1e293b', fontWeight: 600 }}>{analysis?.law || "Statutory review required."}</Typography>
            </Box>

            <Divider />

            <Box sx={{ bgcolor: '#f0fdf4', p: 3, borderRadius: 3, borderLeft: '5px solid #10b981' }}>
              <Typography variant="overline" sx={{ color: '#065f46', fontWeight: 900, letterSpacing: 1.5 }}>
                Actionable Resolution Roadmap
              </Typography>
              <Box sx={{ mt: 1.5 }}>
                {analysis?.resolution?.split(';').map((step, index) => (
                  <Typography key={index} variant="body2" sx={{ color: '#064e3b', fontWeight: 600, mb: 1, lineHeight: 1.6 }}>
                    {index + 1}. {step.trim()}
                  </Typography>
                )) || <Typography variant="body2">Awaiting strategic steps...</Typography>}
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 1.5 }}>
          <Button onClick={() => setOpen(false)} sx={{ textTransform: 'none', fontWeight: 700, color: '#64748b' }}>Close Insight</Button>
          <Button 
            variant="contained" 
            color="success" 
            onClick={generatePDF} 
            sx={{ textTransform: 'none', borderRadius: 2.5, fontWeight: 700, bgcolor: '#059669', px: 3, '&:hover': { bgcolor: '#047857' } }}
          >
            Download Official Appeal Package
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LegalAdvisor;
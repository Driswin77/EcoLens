import React, { useState, useEffect, useRef } from 'react';
import { Scale, FileText, Send, X, Mic, MicOff, Languages } from 'lucide-react';
import { 
  Box, Typography, Button, TextField, Paper, Grid, Divider, 
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  MenuItem, Select, FormControl, InputLabel
} from '@mui/material';
import jsPDF from 'jspdf';
// IMPORT the fonts from the separate file
import { MALAYALAM_FONT, HINDI_FONT , KANNADA_FONT } from './fontData';

const LegalAdvisor = () => {
  const [caseDescription, setCaseDescription] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false); 
  const [isListening, setIsListening] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-IN'); 
  
  // Use a Ref to keep track of the recognition instance across renders
  const recognitionRef = useRef(null);
  const [currentUserName, setCurrentUserName] = useState("Guest"); // Default to Guest to avoid empty string errors

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser && storedUser.name) {
      setCurrentUserName(storedUser.name);
    }
  }, []);

  // IMPROVED Voice Recognition Logic to handle silence and dictionary gaps
  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return; 
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    // Configuration for higher sensitivity
    recognition.lang = selectedLanguage;
    recognition.continuous = true; 
    recognition.interimResults = true; 
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        setIsListening(true);
        console.log("Speech recognition started");
    };
    
    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        // We capture both final and interim to ensure no words are "dropped"
        if (event.results[i].isFinal) {
          currentTranscript += event.results[i][0].transcript;
        }
      }
      
      if (currentTranscript) {
        // Debounce-like update to prevent cursor jumping
        setCaseDescription((prev) => {
            const trimmedPrev = prev.trim();
            return trimmedPrev ? `${trimmedPrev} ${currentTranscript.trim()}` : currentTranscript.trim();
        });
      }
    };

    recognition.onend = () => {
      // Logic to restart if user didn't manually stop (handles browser timeouts)
      if (isListening) {
        try {
            recognition.start();
        } catch (err) {
            console.error("Restart error:", err);
        }
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === 'no-speech') {
          // Do not stop the UI state, just log it; common in noisy environments
          return;
      }
      setIsListening(false);
    };

    recognition.start();
  };

 const handleAnalyze = async () => {
  if (!caseDescription.trim()) return;
  
  // FIX: Ensures userId is never empty, preventing Mongoose ValidationError
  const validUserId = currentUserName.trim() === "" ? "Guest" : currentUserName;
  
  setIsLoading(true);
  try {
    const response = await fetch('http://localhost:5000/api/legal/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        description: caseDescription,
        userId: validUserId, 
        language: selectedLanguage 
      }),
    });

    const data = await response.json();
    
    // IMPROVEMENT: Check if data contains actual analysis fields
    const analysisData = data.analysis || data;
    
    if (analysisData && (analysisData.penalty || analysisData.law)) {
        setAnalysis(analysisData);
        setOpen(true);
    } else {
        alert("The AI Advisor could not generate a clear analysis. Please try rephrasing.");
    }
    
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
    
    // Register Fonts from the imported constants
    doc.addFileToVFS("Malayalam.ttf", MALAYALAM_FONT);
    doc.addFont("Malayalam.ttf", "Malayalam", "normal");
    
    doc.addFileToVFS("Hindi.ttf", HINDI_FONT);
    doc.addFont("Hindi.ttf", "Hindi", "normal");

    doc.addFileToVFS("Kannada.ttf", KANNADA_FONT);
    doc.addFont("Kannada.ttf", "Kannada", "normal");


    // Dynamic Font Selection for PDF
    if (selectedLanguage === 'ml-IN') {
        doc.setFont("Malayalam");
    } else if (selectedLanguage === 'hi-IN') {
        doc.setFont("Hindi");
    } else if (selectedLanguage === 'kn-IN') {
        doc.setFont("Kannada");
    } else {
        doc.setFont("helvetica"); 
    }

    const date = new Date().toLocaleDateString();
    let cursorY = 20; 
    const margin = 20;
    const pageHeight = doc.internal.pageSize.height;

    const checkPageBreak = (addedHeight) => {
      if (cursorY + addedHeight > pageHeight - 30) {
        doc.addPage();
        cursorY = 20; 
        if (selectedLanguage === 'ml-IN') doc.setFont("Malayalam");
        else if (selectedLanguage === 'hi-IN') doc.setFont("Hindi");
        else if (selectedLanguage === 'kn-IN') doc.setFont("Kannada");
        return true;
      }
      return false;
    };

    doc.setFontSize(20);
    doc.setTextColor(5, 150, 105); 
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

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Incident Description:", margin, cursorY);
    cursorY += 8;
    const wrappedDesc = doc.splitTextToSize(caseDescription, 170);
    doc.text(wrappedDesc, margin, cursorY);
    cursorY += (wrappedDesc.length * 7) + 12;

    checkPageBreak(40);
    doc.text("Estimated Penalty Analysis:", margin, cursorY);
    cursorY += 8;
    const wrappedPenalty = doc.splitTextToSize(analysis.penalty || "N/A", 170);
    doc.text(wrappedPenalty, margin, cursorY);
    cursorY += (wrappedPenalty.length * 7) + 12;

    doc.text("Applicable Legal Statutes:", margin, cursorY);
    cursorY += 8;
    const wrappedLaw = doc.splitTextToSize(analysis.law || "N/A", 170);
    doc.text(wrappedLaw, margin, cursorY);
    cursorY += (wrappedLaw.length * 7) + 15;

    checkPageBreak(30);
    doc.line(margin, cursorY, 190, cursorY);
    cursorY += 10;
    doc.setFontSize(14);
    doc.text("Formal Appeal Guidance", margin, cursorY);
    cursorY += 10;

    doc.setFontSize(11);
    const detailedContent = analysis.appealDraft || analysis.resolution || "";
    const splitDraft = doc.splitTextToSize(detailedContent, 170);

    splitDraft.forEach((line) => {
      if (checkPageBreak(7)) {}
      doc.text(line, margin, cursorY);
      cursorY += 7;
    });

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
    <Box sx={{ p: 4, background: 'radial-gradient(circle at 70% 30%, #456d55 0%, #022c18 60%)', minHeight: '100vh' }}>
      
      <Grid container justifyContent="center">
        <Grid item xs={12} md={8} lg={6}>

          <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '2px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', mt:9 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 160, bgcolor: 'white', borderRadius: 2 }}>
              <InputLabel sx={{ display: 'flex', alignItems: 'center', gap: 1, mt :-1 }}>
                <Languages size={16} /> Language
              </InputLabel>
              <ReviewSelect />
              <Select
                value={selectedLanguage}
                label="Language"
                onChange={(e) => setSelectedLanguage(e.target.value)}
                sx={{ borderRadius: 2 , border: '1px solid #cbd5e1' }}
              >
                <MenuItem value="en-IN">English (India)</MenuItem>
                <MenuItem value="hi-IN">Hindi (हिन्दी)</MenuItem>
                <MenuItem value="ml-IN">Malayalam (മലയാളം)</MenuItem>
                <MenuItem value="ta-IN">Tamil (தமிழ்)</MenuItem>
                <MenuItem value="kn-IN">Kannada (ಕನ್ನಡ)</MenuItem>
              </Select>
            </FormControl>
          </Box>
            <Typography variant="h6" sx={{ mb: 3, mt: -6, display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 700, color: '#334155' }}>
              <FileText size={22} color="#059669" /> Case Documentation
            </Typography>
            
            <Box sx={{ position: 'relative' }}>
              <TextField
                fullWidth
                multiline
                rows={8}
                variant="outlined"
                placeholder="Describe your incident here or use the microphone..."
                value={caseDescription}
                onChange={(e) => setCaseDescription(e.target.value)}
                sx={{ bgcolor: '#ffffff', '& .MuiOutlinedInput-root': { borderRadius: 3, pr: 10 } }}
              />
              <IconButton 
                onClick={toggleListening}
                sx={{ 
                  position: 'absolute', 
                  right: 15, 
                  bottom: 15, 
                  bgcolor: isListening ? '#fee2e2' : '#f1f5f9',
                  color: isListening ? '#ef4444' : '#64748b',
                  '&:hover': { bgcolor: isListening ? '#fecaca' : '#e2e8f0' },
                  transition: 'all 0.3s ease'
                }}
              >
                {isListening ? <MicOff size={24} className="animate-pulse" /> : <Mic size={24} />}
              </IconButton>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, pl: 11, pr: 11 }}> 
              <Button
                variant="contained"
                disabled={isLoading}
                onClick={handleAnalyze}
                startIcon={isLoading && <CircularProgress size={20} color="inherit" />}
                sx={{ 
                  bgcolor: '#059669', 
                  '&:hover': { bgcolor: '#047857' },
                  py: 1.8, 
                  px: 6, 
                  borderRadius: 3, 
                  textTransform: 'none', 
                  fontSize: '1.1rem', 
                  fontWeight: 600,
                  minWidth: '280px' 
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

// Helper component for layout cleanup
const ReviewSelect = () => null;

export default LegalAdvisor;
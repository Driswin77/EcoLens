import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ReportPage.css';

// 1. Accept userEmail AND userName to save in the new collection
const ReportPage = ({ userEmail, userName }) => {
  const [incidentTitle, setIncidentTitle] = useState('');
  const [category, setCategory] = useState('Traffic Violation');
  const [severity, setSeverity] = useState('Medium');
  const [description, setDescription] = useState('');
  const [roughNotes, setRoughNotes] = useState('');
  const [autoFillEnabled, setAutoFillEnabled] = useState(true);
  const [uploadedImage, setUploadedImage] = useState(null); // Base64 string
  const [fileName, setFileName] = useState('');
  const [location, setLocation] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  
  // New: List of past reports from 'localreports' collection
  const [recentReports, setRecentReports] = useState([]);

  // 2. Fetch reports only when userEmail is available/changes
  useEffect(() => {
    if (userEmail) {
        fetchReports();
    } else {
        setRecentReports([]); // Clear reports if logged out
    }
  }, [userEmail]);

  const fetchReports = async () => {
    try {
        // 3. UPDATED: Hit the new endpoint for local reports
        const res = await axios.get(`http://localhost:5000/my-local-reports?userEmail=${userEmail}`);
        setRecentReports(res.data);
    } catch (err) {
        console.error("Error fetching local reports", err);
    }
  };

  const categories = [
    'Traffic Violation',
    'Road Damage',
    'Public Safety',
    'Infrastructure',
    'Environmental',
    'Noise Complaint',
    'Garbage / Waste'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Safety check
    if (!userEmail) {
        alert("Please log in to submit a report.");
        return;
    }

    const reportData = {
      userEmail: userEmail, 
      userName: userName || "Anonymous", // 4. Send Name to Backend
      title: incidentTitle,
      category,
      severity,
      description,
      location,
      image: uploadedImage 
    };

    try {
        // 5. UPDATED: Post to the new local-report endpoint
        const res = await axios.post("http://localhost:5000/submit-local-report", reportData);
        
        // === REAL AUTHORITY DISPLAY ===
        // The backend calculates this based on location + category
        const routedAuthority = res.data.forwardedTo || "Local Municipality";
        
        alert(`✅ REPORT LODGED SUCCESSFULLY!\n\nRouted to Competent Authority:\n🏛️ ${routedAuthority}\n\nReference ID: #${res.data.report._id.slice(-6).toUpperCase()}`);
        
        // Reset Form
        setIncidentTitle('');
        setDescription('');
        setRoughNotes('');
        setUploadedImage(null);
        setFileName('');
        setLocation('');
        
        // Refresh List to show the new report immediately
        fetchReports();
    } catch (err) {
        alert("Submission Failed: " + err.message);
    }
  };

  const handleAutoFill = () => {
    if (autoFillEnabled && roughNotes) {
      const notes = roughNotes.toLowerCase();
      
      if (notes.includes('pothole') || notes.includes('road')) setCategory('Road Damage');
      else if (notes.includes('traffic')) setCategory('Traffic Violation');
      else if (notes.includes('garbage') || notes.includes('waste') || notes.includes('dump')) setCategory('Garbage / Waste');
      else if (notes.includes('smoke') || notes.includes('pollution')) setCategory('Environmental');

      if (notes.includes('huge') || notes.includes('danger')) setSeverity('High');
      else if (notes.includes('small')) setSeverity('Low');
      else setSeverity('Medium');

      const firstSentence = roughNotes.split('.')[0];
      if (firstSentence && !incidentTitle) {
        setIncidentTitle(firstSentence.substring(0, 50));
      }
      
      if (!description) setDescription(roughNotes);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
        setFileName(file.name);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            setUploadedImage(reader.result);
        };
    }
  };

  const detectLocation = () => {
    setDetectingLocation(true);
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            // In a real app, use Google Maps API to reverse geocode lat/lng
            setLocation(`Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)}`);
            setDetectingLocation(false);
        }, () => {
            setLocation('Location Access Denied');
            setDetectingLocation(false);
        });
    } else {
        setLocation('Geolocation not supported');
        setDetectingLocation(false);
    }
  };

  React.useEffect(() => {
    if (autoFillEnabled) {
      handleAutoFill();
    }
  }, [roughNotes, autoFillEnabled]);

  return (
    <div className="report-page">
      <div className="report-container">
        <div className="header-section">
          <h1 className="page-title">Submit Local Report</h1>
          <p className="page-subtitle">Report community issues directly to local authorities.</p>
        </div>

        <div className="content-wrapper">
          {/* Left Section - Main Form */}
          <div className="left-section">
            <form className="report-form" onSubmit={handleSubmit}>
              
              {/* Evidence Section */}
              <div className="form-section">
                <div className="form-section-header">
                  <h3 className="form-section-title">EVIDENCE (PHOTO)</h3>
                </div>
                <div className="form-group">
                  <div className="upload-section">
                    <label className="upload-area">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="file-input"
                      />
                      <div className="upload-content">
                        <div className="upload-icon">📷</div>
                        <div className="upload-text">{fileName || "Tap to upload photo evidence"}</div>
                        <div className="upload-subtext">Supports JPG, PNG (Max 50MB)</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Location Section */}
              <div className="form-section">
                <div className="form-section-header">
                  <h3 className="form-section-title">INCIDENT LOCATION</h3>
                </div>
                <div className="form-group">
                  <div className="location-section">
                    <div className="location-row">
                        <button 
                            type="button" 
                            className="location-detect-btn"
                            onClick={detectLocation}
                            disabled={detectingLocation}
                        >
                            {detectingLocation ? '📍 Locating...' : '📍 Detect My Location'}
                        </button>
                        <input
                            type="text"
                            className="location-input form-input" 
                            placeholder="Or type address manually..."
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>
                  </div>
                </div>
              </div>

              {/* Rough Notes Section */}
              <div className="form-section">
                <div className="form-section-header">
                  <h3 className="form-section-title">QUICK NOTES (AI ASSIST)</h3>
                </div>
                <div className="form-group">
                  <textarea
                    className="form-textarea rough-notes"
                    placeholder="e.g. 'Garbage dump near central park'"
                    value={roughNotes}
                    onChange={(e) => setRoughNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="auto-fill-toggle">
                    <input
                        type="checkbox"
                        checked={autoFillEnabled}
                        onChange={(e) => setAutoFillEnabled(e.target.checked)}
                        style={{ marginRight: '10px' }}
                    />
                    <span className="toggle-text">Enable AI Auto-Fill</span>
                </div>
              </div>

              {/* Incident Details */}
              <div className="form-section">
                <div className="form-section-header">
                  <h3 className="form-section-title">DETAILS</h3>
                </div>
                
                <div className="form-group">
                  <label className="form-label form-section-title">TITLE</label>
                  <input
                    type="text"
                    className="form-input"
                    value={incidentTitle}
                    onChange={(e) => setIncidentTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row" style={{ display: 'flex', gap: '20px', marginTop: '15px' }}>
                  <div className="form-group half-width" style={{ flex: 1 }}>
                    <label className="form-label form-section-title">CATEGORY</label>
                    <select
                      className="form-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group half-width" style={{ flex: 1 }}>
                    <label className="form-label form-section-title">SEVERITY</label>
                    <div className="severity-buttons">
                      {['Low', 'Medium', 'High'].map((level) => (
                        <button
                          key={level}
                          type="button"
                          className={`severity-button ${severity === level ? 'active' : ''} ${level.toLowerCase()}`}
                          onClick={() => setSeverity(level)}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="form-group" style={{ marginTop: '15px' }}>
                  <label className="form-label form-section-title">DESCRIPTION</label>
                  <textarea
                    className="form-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    required
                  />
                </div>
              </div>

              <div className="submit-section">
                <button type="submit" className="submit-button">
                  Submit Official Report
                </button>
              </div>
            </form>
          </div>

          {/* Right Section - Recent Reports */}
          <div className="right-section">
            <div className="recent-reports">
              <h2 className="section-title">LOCAL REPORTS HISTORY</h2>
              {recentReports.length === 0 ? (
                <div className="reports-empty" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                    <div className="empty-icon" style={{ fontSize: '2rem', marginBottom: '10px' }}>📋</div>
                    <p className="empty-text">No local reports found for your account.</p>
                </div>
              ) : (
                <div className="reports-list">
                    {recentReports.map(report => (
                        <div key={report._id} className="report-card-mini">
                            <span className={`status-badge ${report.status.toLowerCase()}`}>{report.status}</span>
                            <h4 style={{ margin: '0 0 5px 0', color: '#1e293b' }}>{report.title}</h4>
                            <span className="report-date">{new Date(report.date).toLocaleDateString()}</span>
                            <span className="report-cat" style={{ fontSize: '0.8rem', color: '#64748b' }}> • {report.category}</span>
                            {/* Show Routed Authority */}
                            {report.forwardedTo && (
                                <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '4px' }}>
                                    🏛️ {report.forwardedTo}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
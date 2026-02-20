import React, { useState } from 'react';
import axios from 'axios';
import './LoginPage.css';

const LoginPage = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false); // Toggle between Login and Signup
  const [name, setName] = useState('');
  const [email, setEmail] = useState(''); // <--- CHANGED: Phone -> Email
  const [password, setPassword] = useState(''); 
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Basic Validation
    if (!email || !password) {
        setError("Please fill in all fields.");
        return;
    }
    if (isSignUp && !name) {
        setError("Name is required for Sign Up.");
        return;
    }

    setLoading(true);

    const endpoint = isSignUp ? '/signup' : '/login';
    // Updated payload to use EMAIL
    const payload = isSignUp ? { name, email, password } : { email, password };

    try {
      const API_URL = `http://${window.location.hostname}:5000`;
const res = await axios.post(`${API_URL}${endpoint}`, payload);
      if (res.data.success) {
        // Call the parent function with the user data
        onLogin(res.data.user); 
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          
          <div className="app-icon-wrapper">
             <img 
               src="/logo2.png" 
               alt="EcoPenalty Logo" 
               className="app-logo-img" 
               style={{ width: '100px', height: 'auto', marginBottom: '-35px' }} 
             />
          </div>

          <h2>EcoLens</h2>
          <p>{isSignUp ? 'Join via Email' : 'Secure Login'}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {/* NAME FIELD (Only for Sign Up) */}
          {isSignUp && (
            <div className="form-group">
              <label htmlFor="name">FULL NAME</label>
              <div className="input-wrapper">
                <span className="input-icon">👤</span>
                <input
                  type="text"
                  id="name"
                  placeholder="e.g. Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={isSignUp}
                />
              </div>
            </div>
          )}

          {/* EMAIL FIELD (Replaced Phone) */}
          <div className="form-group">
            <label htmlFor="email">EMAIL ADDRESS</label>
            <div className="input-wrapper">
              <span className="input-icon">✉️</span> {/* Email Icon */}
              <input
                type="email"
                id="email"
                placeholder="Enter you e-mail address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* PASSWORD FIELD */}
          <div className="form-group">
            <label htmlFor="password">PASSWORD</label>
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input
                type="password"
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up & Login' : 'Secure Login')}
          </button>
        </form>

        <div className="login-footer">
          <p>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button 
                type="button" 
                className="toggle-button" 
                onClick={() => { 
                    setIsSignUp(!isSignUp); 
                    setError(''); 
                    setPassword(''); // Clear password on toggle
                }}
            >
              {isSignUp ? 'Log In' : 'Register Now'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
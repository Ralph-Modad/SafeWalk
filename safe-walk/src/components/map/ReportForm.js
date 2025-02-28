import React, { useState } from 'react';
import { useUser } from '../../context/UserContext';
import '../../styles/ReportForm.css';

const categories = [
  { id: 'poor_lighting', label: 'Poor Lighting' },
  { id: 'unsafe_area', label: 'Unsafe Area' },
  { id: 'construction', label: 'Construction' },
  { id: 'obstacle', label: 'Obstacle' },
  { id: 'bad_weather', label: 'Bad Weather Conditions' }
];

const ReportForm = ({ location, onSubmit, onCancel }) => {
  const { isAuthenticated, user } = useUser();
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(3);
  const [isTemporary, setIsTemporary] = useState(false);
  const [expiresIn, setExpiresIn] = useState('24');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!isAuthenticated) {
      setError('You must be logged in to submit a report');
      return;
    }

    if (!category) {
      setError('Please select a category');
      return;
    }

    const reportData = {
      userId: user.id,
      location,
      category,
      description,
      severity: parseInt(severity),
      temporary: isTemporary,
      expiresAt: isTemporary ? new Date(Date.now() + parseInt(expiresIn) * 60 * 60 * 1000) : null,
      createdAt: new Date()
    };

    onSubmit(reportData);
  };

  return (
    <div className="report-form-container">
      <h2>Report a Safety Issue</h2>
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit} className="report-form">
        <div className="form-group">
          <label>Location</label>
          <div className="location-display">
            Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            <option value="">Select a category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide details about the issue..."
            rows={4}
          />
        </div>

        <div className="form-group">
          <label htmlFor="severity">Severity (1-5)</label>
          <div className="severity-slider">
            <input
              type="range"
              id="severity"
              min="1"
              max="5"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            />
            <div className="severity-value">{severity}</div>
          </div>
          <div className="severity-labels">
            <span>Minor</span>
            <span>Severe</span>
          </div>
        </div>

        <div className="form-group checkbox-group">
          <input
            type="checkbox"
            id="isTemporary"
            checked={isTemporary}
            onChange={(e) => setIsTemporary(e.target.checked)}
          />
          <label htmlFor="isTemporary">Temporary issue</label>
        </div>

        {isTemporary && (
          <div className="form-group">
            <label htmlFor="expiresIn">Expires in (hours)</label>
            <select
              id="expiresIn"
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
            >
              <option value="1">1 hour</option>
              <option value="3">3 hours</option>
              <option value="6">6 hours</option>
              <option value="12">12 hours</option>
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
              <option value="72">72 hours</option>
            </select>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="submit-button">
            Submit Report
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReportForm;
import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, ChangeEvent, FormEvent, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  X,
  MapPin,
  Package,
  Info,
  Clock,
  Utensils,
  Image as ImageIcon,
} from 'lucide-react';
import './AddListingPage.css';

interface ListingData {
  // Step 1: Basic Info
  foodName: string;
  category: string;
  foodType: string;
  cuisine: string;
  description: string;
  
  // Step 2: Quantity & Timing
  quantity: string;
  unit: string;
  servings: string;
  availableFrom: string;
  bestBefore: string;
  pickupTimeSlots: string[];
  
  // Step 3: Location & Pickup
  pickupLocation: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  
  // Step 4: Additional Details
  storageType: string;
  packagingType: string;
  handlingInstructions: string;
  allergens: string[];
  dietaryInfo: string[];
  
  // Images
  images: string[];
}

const AddListingPage = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const userId = localStorage.getItem('userId');
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  const defaultCenter: [number, number] = [28.6139, 77.209];

  useEffect(() => {
    if (!localStorage.getItem('isAuthenticated')) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    if (currentStep === 3) {
      // Allow layout to settle before mounting Leaflet
      const timer = setTimeout(() => setMapReady(true), 0);
      return () => clearTimeout(timer);
    }
    setMapReady(false);
  }, [currentStep]);

  const [formData, setFormData] = useState<ListingData>({
    foodName: '',
    category: 'cooked-meals',
    foodType: 'veg',
    cuisine: '',
    description: '',
    quantity: '',
    unit: 'kg',
    servings: '',
    availableFrom: '',
    bestBefore: '',
    pickupTimeSlots: [],
    pickupLocation: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    latitude: 0,
    longitude: 0,
    storageType: 'refrigerated',
    packagingType: 'containerized',
    handlingInstructions: '',
    allergens: [],
    dietaryInfo: [],
    images: [],
  });

  const totalSteps = 5;

  const categories = [
    { value: 'cooked-meals', label: 'Cooked Meals', icon: '🍛' },
    { value: 'bakery', label: 'Bakery Items', icon: '🥖' },
    { value: 'dairy', label: 'Dairy Products', icon: '🥛' },
    { value: 'fruits-vegetables', label: 'Fruits & Vegetables', icon: '🥗' },
    { value: 'packaged-food', label: 'Packaged Food', icon: '📦' },
    { value: 'beverages', label: 'Beverages', icon: '🥤' },
  ];

  const allergenOptions = ['Nuts', 'Dairy', 'Gluten', 'Soy', 'Eggs', 'Shellfish', 'Fish'];
  const dietaryOptions = ['Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Sugar-Free'];

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (field: 'allergens' | 'dietaryInfo', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
  };

  const handleTimeSlotToggle = (slot: string) => {
    setFormData(prev => ({
      ...prev,
      pickupTimeSlots: prev.pickupTimeSlots.includes(slot)
        ? prev.pickupTimeSlots.filter(s => s !== slot)
        : [...prev.pickupTimeSlots, slot]
    }));
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPreviews: string[] = [];
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result as string);
        if (newPreviews.length === files.length) {
          setImagePreviews(prev => [...prev, ...newPreviews].slice(0, 5));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!userId) {
        alert('Please login again to continue.');
        navigate('/login');
        return;
      }
      
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/donor/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...formData,
          donorId: userId,
          quantity: parseFloat(formData.quantity),
          images: imagePreviews,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('✅ Food listing created successfully!');
        navigate('/donor/dashboard');
      } else {
        alert('❌ ' + (data.error || 'Failed to create listing'));
      }
    } catch (error) {
      console.error('Error creating listing:', error);
      alert('❌ Failed to create listing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.foodName && formData.category && formData.foodType;
      case 2:
        return formData.quantity && formData.unit && formData.availableFrom && formData.bestBefore;
      case 3:
        return formData.pickupLocation && formData.city && formData.pincode;
      case 4:
        return formData.storageType && formData.packagingType;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const timeSlots = [
    '6:00 AM - 9:00 AM',
    '9:00 AM - 12:00 PM',
    '12:00 PM - 3:00 PM',
    '3:00 PM - 6:00 PM',
    '6:00 PM - 9:00 PM',
    '9:00 PM - 12:00 AM',
  ];

  class MapErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
      return { hasError: true };
    }

    render() {
      if (this.state.hasError) {
        return (
          <div className="map-fallback">
            Map failed to load. Please refresh or try again.
          </div>
        );
      }
      return this.props.children;
    }
  }

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
        if (leafletMapRef.current) {
          leafletMapRef.current.setView([position.coords.latitude, position.coords.longitude], 13);
        }
      },
      () => {
        alert('Unable to retrieve your location. Please allow location access.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    if (!leafletMapRef.current) {
      try {
        if ((mapRef.current as any)._leaflet_id) {
          delete (mapRef.current as any)._leaflet_id;
        }
        const mapInstance = L.map(mapRef.current).setView(defaultCenter, 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(mapInstance);

        mapInstance.on('click', (e: L.LeafletMouseEvent) => {
          setFormData(prev => ({
            ...prev,
            latitude: e.latlng.lat,
            longitude: e.latlng.lng,
          }));
        });

        leafletMapRef.current = mapInstance;
        setTimeout(() => mapInstance.invalidateSize(), 0);
      } catch (error: any) {
        console.error('Leaflet init error:', error);
        setMapError('Map failed to initialize. Please refresh.');
      }
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [mapReady]);

  useEffect(() => {
    if (!leafletMapRef.current) return;
    if (formData.latitude === 0 || formData.longitude === 0) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([formData.latitude, formData.longitude]);
    } else {
      markerRef.current = L.circleMarker([formData.latitude, formData.longitude], {
        radius: 8,
        color: '#22c55e',
      }).addTo(leafletMapRef.current);
    }
  }, [formData.latitude, formData.longitude]);

  return (
    <div className="add-listing-page">
      {/* Header */}
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/donor/dashboard')}>
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="page-title">Add New Food Listing</h1>
        <p className="page-subtitle">Share your surplus food with those in need</p>
      </div>

      {/* Progress Steps */}
      <div className="progress-steps">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`progress-step ${currentStep >= step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}
          >
            <div className="step-circle">
              {currentStep > step ? <Check size={16} /> : step}
            </div>
            <span className="step-label">
              {step === 1 && 'Basic Info'}
              {step === 2 && 'Quantity'}
              {step === 3 && 'Location'}
              {step === 4 && 'Details'}
              {step === 5 && 'Review'}
            </span>
          </div>
        ))}
      </div>

      {/* Form Container */}
      <motion.div
        className="form-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <form onSubmit={handleSubmit}>
          <AnimatePresence mode="wait">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="form-step"
              >
                <div className="step-header">
                  <Utensils className="step-icon" />
                  <h2>Basic Information</h2>
                  <p>Tell us about the food you're donating</p>
                </div>

                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Food Name *</label>
                    <input
                      type="text"
                      name="foodName"
                      value={formData.foodName}
                      onChange={handleInputChange}
                      placeholder="e.g., Vegetable Biryani, Assorted Pastries"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Category *</label>
                    <div className="category-grid">
                      {categories.map((cat) => (
                        <label
                          key={cat.value}
                          className={`category-card ${formData.category === cat.value ? 'selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="category"
                            value={cat.value}
                            checked={formData.category === cat.value}
                            onChange={handleInputChange}
                          />
                          <span className="category-icon">{cat.icon}</span>
                          <span className="category-label">{cat.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Food Type *</label>
                    <div className="radio-group">
                      <label className={`radio-card ${formData.foodType === 'veg' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="foodType"
                          value="veg"
                          checked={formData.foodType === 'veg'}
                          onChange={handleInputChange}
                        />
                        <span>🥗 Vegetarian</span>
                      </label>
                      <label className={`radio-card ${formData.foodType === 'non-veg' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="foodType"
                          value="non-veg"
                          checked={formData.foodType === 'non-veg'}
                          onChange={handleInputChange}
                        />
                        <span>🍗 Non-Vegetarian</span>
                      </label>
                      <label className={`radio-card ${formData.foodType === 'vegan' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="foodType"
                          value="vegan"
                          checked={formData.foodType === 'vegan'}
                          onChange={handleInputChange}
                        />
                        <span>🌱 Vegan</span>
                      </label>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Cuisine Type</label>
                    <input
                      type="text"
                      name="cuisine"
                      value={formData.cuisine}
                      onChange={handleInputChange}
                      placeholder="e.g., Indian, Chinese, Continental"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={4}
                      placeholder="Provide additional details about the food, ingredients, taste, etc."
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Quantity & Timing */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="form-step"
              >
                <div className="step-header">
                  <Package className="step-icon" />
                  <h2>Quantity & Timing</h2>
                  <p>Specify quantities and availability</p>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Quantity *</label>
                    <div className="quantity-input-group">
                      <input
                        type="number"
                        name="quantity"
                        value={formData.quantity}
                        onChange={handleInputChange}
                        placeholder="0"
                        min="0"
                        step="0.1"
                        required
                      />
                      <select
                        name="unit"
                        value={formData.unit}
                        onChange={handleInputChange}
                      >
                        <option value="kg">kg</option>
                        <option value="servings">servings</option>
                        <option value="pieces">pieces</option>
                        <option value="liters">liters</option>
                        <option value="packets">packets</option>
                        <option value="boxes">boxes</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Estimated Servings</label>
                    <input
                      type="number"
                      name="servings"
                      value={formData.servings}
                      onChange={handleInputChange}
                      placeholder="Number of people this can feed"
                      min="0"
                    />
                  </div>

                  <div className="form-group">
                    <label>Available From *</label>
                    <input
                      type="datetime-local"
                      name="availableFrom"
                      value={formData.availableFrom}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Best Before *</label>
                    <input
                      type="datetime-local"
                      name="bestBefore"
                      value={formData.bestBefore}
                      onChange={handleInputChange}
                      required
                    />
                    <small className="hint">When the food should be collected by</small>
                  </div>

                  <div className="form-group full-width">
                    <label>Preferred Pickup Time Slots</label>
                    <div className="time-slots-grid">
                      {timeSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          className={`time-slot ${formData.pickupTimeSlots.includes(slot) ? 'selected' : ''}`}
                          onClick={() => handleTimeSlotToggle(slot)}
                        >
                          <Clock size={16} />
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Location & Pickup */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="form-step"
              >
                <div className="step-header">
                  <MapPin className="step-icon" />
                  <h2>Location & Pickup</h2>
                  <p>Where should NGOs collect the food?</p>
                </div>

                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Pickup Address *</label>
                    <textarea
                      name="pickupLocation"
                      value={formData.pickupLocation}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="Full address with building/floor details"
                      required
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Pickup Map Location (click to set marker)</label>
                    <div className="map-picker">
                      {mapReady ? (
                        <MapErrorBoundary>
                          <div ref={mapRef} className="leaflet-map">
                            {mapError && <div className="map-fallback">{mapError}</div>}
                          </div>
                        </MapErrorBoundary>
                      ) : (
                        <div className="map-fallback">Loading map...</div>
                      )}
                    </div>
                    <div className="map-actions">
                      <button type="button" className="btn-secondary" onClick={handleUseMyLocation}>
                        Use My Location
                      </button>
                    </div>
                    <small className="hint">
                      Selected: {formData.latitude && formData.longitude ? `${formData.latitude.toFixed(5)}, ${formData.longitude.toFixed(5)}` : 'None'}
                    </small>
                  </div>

                  <div className="form-group full-width">
                    <label>Landmark</label>
                    <input
                      type="text"
                      name="landmark"
                      value={formData.landmark}
                      onChange={handleInputChange}
                      placeholder="Near XYZ Mall, Opposite ABC School"
                    />
                  </div>

                  <div className="form-group">
                    <label>City *</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="City name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>State</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      placeholder="State name"
                    />
                  </div>

                  <div className="form-group">
                    <label>Pincode *</label>
                    <input
                      type="text"
                      name="pincode"
                      value={formData.pincode}
                      onChange={handleInputChange}
                      placeholder="6-digit pincode"
                      required
                      maxLength={6}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Additional Details */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="form-step"
              >
                <div className="step-header">
                  <Info className="step-icon" />
                  <h2>Additional Details</h2>
                  <p>Storage and handling information</p>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Storage Type *</label>
                    <select
                      name="storageType"
                      value={formData.storageType}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="refrigerated">Refrigerated</option>
                      <option value="frozen">Frozen</option>
                      <option value="room-temperature">Room Temperature</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Packaging Type *</label>
                    <select
                      name="packagingType"
                      value={formData.packagingType}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="containerized">Containerized</option>
                      <option value="packaged">Packaged</option>
                      <option value="sealed">Sealed</option>
                      <option value="loose">Loose (needs container)</option>
                    </select>
                  </div>

                  <div className="form-group full-width">
                    <label>Handling Instructions</label>
                    <textarea
                      name="handlingInstructions"
                      value={formData.handlingInstructions}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="Special instructions for storing or handling the food"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Allergens (if any)</label>
                    <div className="checkbox-grid">
                      {allergenOptions.map((allergen) => (
                        <label key={allergen} className="checkbox-card">
                          <input
                            type="checkbox"
                            checked={formData.allergens.includes(allergen)}
                            onChange={() => handleCheckboxChange('allergens', allergen)}
                          />
                          <span>{allergen}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-group full-width">
                    <label>Dietary Information</label>
                    <div className="checkbox-grid">
                      {dietaryOptions.map((option) => (
                        <label key={option} className="checkbox-card">
                          <input
                            type="checkbox"
                            checked={formData.dietaryInfo.includes(option)}
                            onChange={() => handleCheckboxChange('dietaryInfo', option)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 5: Photos & Review */}
            {currentStep === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="form-step"
              >
                <div className="step-header">
                  <ImageIcon className="step-icon" />
                  <h2>Photos & Review</h2>
                  <p>Add photos and review your listing</p>
                </div>

                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Food Photos (Max 5)</label>
                    <div className="image-upload-area">
                      <input
                        type="file"
                        id="imageUpload"
                        multiple
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="imageUpload" className="upload-label">
                        <Upload size={32} />
                        <span>Click to upload photos</span>
                        <small>or drag and drop (JPEG, PNG)</small>
                      </label>
                    </div>

                    {imagePreviews.length > 0 && (
                      <div className="image-previews">
                        {imagePreviews.map((preview, index) => (
                          <div key={index} className="image-preview">
                            <img src={preview} alt={`Preview ${index + 1}`} />
                            <button
                              type="button"
                              className="remove-image"
                              onClick={() => removeImage(index)}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="form-group full-width">
                    <div className="review-summary">
                      <h3>Review Your Listing</h3>
                      <div className="summary-grid">
                        <div className="summary-item">
                          <span className="summary-label">Food:</span>
                          <span className="summary-value">{formData.foodName}</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">Quantity:</span>
                          <span className="summary-value">{formData.quantity} {formData.unit}</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">Category:</span>
                          <span className="summary-value">{formData.category}</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">Best Before:</span>
                          <span className="summary-value">
                            {new Date(formData.bestBefore).toLocaleString()}
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">Location:</span>
                          <span className="summary-value">{formData.city}, {formData.pincode}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="form-navigation">
            {currentStep > 1 && (
              <button type="button" className="btn-nav btn-back" onClick={handleBack}>
                <ArrowLeft size={20} />
                <span>Back</span>
              </button>
            )}

            {currentStep < totalSteps ? (
              <button
                type="button"
                className="btn-nav btn-next"
                onClick={handleNext}
                disabled={!isStepValid()}
              >
                <span>Next</span>
                <ArrowRight size={20} />
              </button>
            ) : (
              <button
                type="submit"
                className="btn-nav btn-submit"
                disabled={loading || !isStepValid()}
              >
                {loading ? (
                  <>
                    <div className="spinner-small"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Check size={20} />
                    <span>Create Listing</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default AddListingPage;

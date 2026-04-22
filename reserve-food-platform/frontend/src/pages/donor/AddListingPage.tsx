import { motion, AnimatePresence } from 'framer-motion';
import { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  AlertTriangle,
  Leaf,
} from 'lucide-react';
import './AddListingPage.css';

interface ListingData {
  foodName: string;
  category: string;
  foodType: string;
  cuisine: string;
  description: string;
  quantity: string;
  unit: string;
  servings: string;
  availableFrom: string;
  bestBefore: string;
  pickupTimeSlots: string[];
  pickupLocation: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  storageType: string;
  packagingType: string;
  handlingInstructions: string;
  allergens: string[];
  dietaryInfo: string[];
  images: string[];
}

interface SpoilagePrediction {
  shelfLifeHours: number;
  confidence: string;
  riskLevel: string;
  tips: string[];
}

const STEPS = [
  { label: 'Basics', icon: <Utensils size={18} /> },
  { label: 'Quantity', icon: <Package size={18} /> },
  { label: 'Location', icon: <MapPin size={18} /> },
  { label: 'Details', icon: <Info size={18} /> },
  { label: 'Review', icon: <ImageIcon size={18} /> },
];

const CATEGORIES = [
  { value: 'cooked-meals', label: 'Cooked Meals', icon: '🍛' },
  { value: 'bakery', label: 'Bakery', icon: '🥖' },
  { value: 'dairy', label: 'Dairy', icon: '🥛' },
  { value: 'fruits-vegetables', label: 'Fruits & Veg', icon: '🥗' },
  { value: 'packaged-food', label: 'Packaged', icon: '📦' },
  { value: 'beverages', label: 'Beverages', icon: '🥤' },
];

const ALLERGENS = ['Nuts', 'Dairy', 'Gluten', 'Soy', 'Eggs', 'Shellfish', 'Fish'];
const DIETARY = ['Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Sugar-Free'];
const TIME_SLOTS = [
  '6:00 AM – 9:00 AM', '9:00 AM – 12:00 PM',
  '12:00 PM – 3:00 PM', '3:00 PM – 6:00 PM',
  '6:00 PM – 9:00 PM', '9:00 PM – 12:00 AM',
];

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 32 : -32 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -32 : 32 }),
};

export default function AddListingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [spoilage, setSpoilage] = useState<SpoilagePrediction | null>(null);
  const [spoilageLoading, setSpoilageLoading] = useState(false);
  const userId = localStorage.getItem('userId');

  useEffect(() => {
    if (!localStorage.getItem('isAuthenticated')) navigate('/login');
  }, [navigate]);

  const [form, setForm] = useState<ListingData>({
    foodName: '', category: 'cooked-meals', foodType: 'veg', cuisine: '', description: '',
    quantity: '', unit: 'kg', servings: '', availableFrom: '', bestBefore: '',
    pickupTimeSlots: [], pickupLocation: '', landmark: '', city: '', state: '', pincode: '',
    latitude: 0, longitude: 0, storageType: 'refrigerated', packagingType: 'containerized',
    handlingInstructions: '', allergens: [], dietaryInfo: [], images: [],
  });

  // ML spoilage prediction
  useEffect(() => {
    if (!form.storageType || !form.category || !form.bestBefore) return;
    const timer = setTimeout(async () => {
      setSpoilageLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/ml/predict/spoilage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            category: form.category, storageType: form.storageType, foodType: form.foodType,
            bestBefore: form.bestBefore, quantity: parseFloat(form.quantity) || 1,
          }),
        });
        if (res.ok) setSpoilage(await res.json());
      } catch { /* non-critical */ }
      finally { setSpoilageLoading(false); }
    }, 600);
    return () => clearTimeout(timer);
  }, [form.storageType, form.category, form.foodType, form.bestBefore, form.quantity]);

  const set = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  };

  const toggleList = (field: 'allergens' | 'dietaryInfo' | 'pickupTimeSlots', val: string) => {
    setForm(p => ({
      ...p,
      [field]: p[field].includes(val) ? p[field].filter(x => x !== val) : [...p[field], val],
    }));
  };

  const handleImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const results: string[] = [];
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        results.push(reader.result as string);
        if (results.length === files.length) {
          setImagePreviews(p => [...p, ...results].slice(0, 5));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const goNext = () => { setDirection(1); setStep(s => Math.min(s + 1, 5)); };
  const goBack = () => { setDirection(-1); setStep(s => Math.max(s - 1, 1)); };

  const isValid = () => {
    switch (step) {
      case 1: return !!(form.foodName && form.category && form.foodType);
      case 2: return !!(form.quantity && form.unit && form.availableFrom && form.bestBefore);
      case 3: return !!(form.pickupLocation && form.city && form.pincode);
      case 4: return !!(form.storageType && form.packagingType);
      case 5: return true;
      default: return false;
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return alert('Geolocation not supported.');
    navigator.geolocation.getCurrentPosition(
      pos => setForm(p => ({ ...p, latitude: pos.coords.latitude, longitude: pos.coords.longitude })),
      () => alert('Unable to get location. Please allow access.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) { alert('Please login again.'); navigate('/login'); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/donor/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...form, donorId: userId, quantity: parseFloat(form.quantity), images: imagePreviews }),
      });
      const data = await res.json();
      if (res.ok) { alert('✅ Food listing created!'); navigate('/donor/dashboard'); }
      else alert('❌ ' + (data.error || 'Failed to create listing'));
    } catch { alert('❌ Failed. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="add-listing-page">
      {/* Hero Header */}
      <div className="page-hero">
        <div className="page-hero-inner">
          <button className="back-button" onClick={() => navigate('/donor/dashboard')}>
            <ArrowLeft size={15} />
            Back to Dashboard
          </button>
          <div className="page-hero-label">
            <Leaf size={12} />
            ReServe
          </div>
          <h1 className="page-title">List Surplus Food</h1>
          <p className="page-subtitle">Share what you have — feed those who need it most</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="progress-wrapper">
        <div className="progress-track">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={`progress-step ${step > i + 1 ? 'completed' : ''} ${step === i + 1 ? 'active' : ''}`}
            >
              <div className="step-circle">
                {step > i + 1 ? <Check size={13} /> : i + 1}
              </div>
              <span className="step-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="form-body">
        <form onSubmit={handleSubmit}>
          <div className="form-card">
            <AnimatePresence mode="wait" custom={direction}>
              {/* ── Step 1: Basic Info ── */}
              {step === 1 && (
                <motion.div key="step1" custom={direction} variants={slideVariants}
                  initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.22, ease: 'easeInOut' }}>
                  <div className="step-header">
                    <div className="step-icon-wrap"><Utensils size={22} /></div>
                    <div className="step-header-text">
                      <h2>Basic Information</h2>
                      <p>Tell us about the food you're donating</p>
                    </div>
                  </div>
                  <div className="form-step-body">
                    {/* Food Name */}
                    <div className="form-group">
                      <label className="form-label">Food Name <span className="required">*</span></label>
                      <input className="form-input" type="text" name="foodName"
                        value={form.foodName} onChange={set}
                        placeholder="e.g., Vegetable Biryani, Assorted Pastries" required />
                    </div>

                    {/* Category */}
                    <div className="form-group">
                      <label className="form-label">Category <span className="required">*</span></label>
                      <div className="category-grid">
                        {CATEGORIES.map(cat => (
                          <label key={cat.value} className={`category-card ${form.category === cat.value ? 'selected' : ''}`}>
                            <input type="radio" name="category" value={cat.value}
                              checked={form.category === cat.value} onChange={set} />
                            <span className="category-emoji">{cat.icon}</span>
                            <span className="category-label">{cat.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Food Type */}
                    <div className="form-group">
                      <label className="form-label">Food Type <span className="required">*</span></label>
                      <div className="toggle-group">
                        {[['veg', '🥗 Vegetarian'], ['non-veg', '🍗 Non-Veg'], ['vegan', '🌱 Vegan']].map(([val, lbl]) => (
                          <label key={val} className={`toggle-card ${form.foodType === val ? 'selected' : ''}`}>
                            <input type="radio" name="foodType" value={val} checked={form.foodType === val} onChange={set} />
                            {lbl}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Storage */}
                    <div className="form-group">
                      <label className="form-label">Storage / Refrigeration <span className="required">*</span></label>
                      <p className="form-hint">Helps our ML model predict spoilage time accurately</p>
                      <div className="toggle-group">
                        {[['refrigerated', '❄️ Refrigerated'], ['frozen', '🧊 Frozen'], ['room-temperature', '🌡️ Room Temp']].map(([val, lbl]) => (
                          <label key={val} className={`toggle-card ${form.storageType === val ? 'selected' : ''}`}>
                            <input type="radio" name="storageType" value={val} checked={form.storageType === val} onChange={set} />
                            {lbl}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Cuisine + Description */}
                    <div className="form-row cols-2">
                      <div className="form-group">
                        <label className="form-label">Cuisine</label>
                        <input className="form-input" type="text" name="cuisine"
                          value={form.cuisine} onChange={set} placeholder="e.g., Indian, Chinese" />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <textarea className="form-textarea" name="description"
                        value={form.description} onChange={set} rows={3}
                        placeholder="Ingredients, taste, additional notes..." />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: Quantity & Timing ── */}
              {step === 2 && (
                <motion.div key="step2" custom={direction} variants={slideVariants}
                  initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.22, ease: 'easeInOut' }}>
                  <div className="step-header">
                    <div className="step-icon-wrap"><Package size={22} /></div>
                    <div className="step-header-text">
                      <h2>Quantity & Timing</h2>
                      <p>Specify how much food and when it's available</p>
                    </div>
                  </div>
                  <div className="form-step-body">
                    <div className="form-row cols-2">
                      <div className="form-group">
                        <label className="form-label">Quantity <span className="required">*</span></label>
                        <div className="quantity-row">
                          <input className="form-input" type="number" name="quantity"
                            value={form.quantity} onChange={set} placeholder="0" min="0" step="0.1" required />
                          <select className="form-select" name="unit" value={form.unit} onChange={set}>
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
                        <label className="form-label">Estimated Servings</label>
                        <input className="form-input" type="number" name="servings"
                          value={form.servings} onChange={set} placeholder="Number of people" min="0" />
                      </div>
                    </div>

                    <div className="form-row cols-2">
                      <div className="form-group">
                        <label className="form-label">Available From <span className="required">*</span></label>
                        <input className="form-input" type="datetime-local" name="availableFrom"
                          value={form.availableFrom} onChange={set} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Best Before <span className="required">*</span></label>
                        <input className="form-input" type="datetime-local" name="bestBefore"
                          value={form.bestBefore} onChange={set} required />
                        <p className="form-hint">When should the food be collected by?</p>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Preferred Pickup Time Slots</label>
                      <div className="time-slots-grid">
                        {TIME_SLOTS.map(slot => (
                          <button key={slot} type="button"
                            className={`time-slot ${form.pickupTimeSlots.includes(slot) ? 'selected' : ''}`}
                            onClick={() => toggleList('pickupTimeSlots', slot)}>
                            <Clock size={14} />
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Step 3: Location ── */}
              {step === 3 && (
                <motion.div key="step3" custom={direction} variants={slideVariants}
                  initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.22, ease: 'easeInOut' }}>
                  <div className="step-header">
                    <div className="step-icon-wrap"><MapPin size={22} /></div>
                    <div className="step-header-text">
                      <h2>Pickup Location</h2>
                      <p>Where should NGOs collect the food?</p>
                    </div>
                  </div>
                  <div className="form-step-body">
                    <div className="form-group">
                      <label className="form-label">Pickup Address <span className="required">*</span></label>
                      <textarea className="form-textarea" name="pickupLocation"
                        value={form.pickupLocation} onChange={set} rows={3}
                        placeholder="Full address with building / floor details" required />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Landmark</label>
                      <input className="form-input" type="text" name="landmark"
                        value={form.landmark} onChange={set}
                        placeholder="Near XYZ Mall, Opposite ABC School" />
                    </div>

                    <div className="form-row cols-3">
                      <div className="form-group">
                        <label className="form-label">City <span className="required">*</span></label>
                        <input className="form-input" type="text" name="city"
                          value={form.city} onChange={set} placeholder="City" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">State</label>
                        <input className="form-input" type="text" name="state"
                          value={form.state} onChange={set} placeholder="State" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Pincode <span className="required">*</span></label>
                        <input className="form-input" type="text" name="pincode"
                          value={form.pincode} onChange={set} placeholder="6-digit" required maxLength={6} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">GPS Coordinates <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}>(optional)</span></label>
                      <div className="map-actions">
                        <button type="button" className="btn-location" onClick={useMyLocation}>
                          <MapPin size={15} />
                          Use My Location
                        </button>
                        {form.latitude !== 0 && (
                          <span className="coordinates-display">
                            📍 {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Step 4: Details ── */}
              {step === 4 && (
                <motion.div key="step4" custom={direction} variants={slideVariants}
                  initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.22, ease: 'easeInOut' }}>
                  <div className="step-header">
                    <div className="step-icon-wrap"><Info size={22} /></div>
                    <div className="step-header-text">
                      <h2>Additional Details</h2>
                      <p>Storage, handling, and dietary information</p>
                    </div>
                  </div>
                  <div className="form-step-body">
                    <div className="form-row cols-2">
                      <div className="form-group">
                        <label className="form-label">Storage Type</label>
                        <div className="storage-display">
                          {form.storageType === 'refrigerated' ? '❄️ Refrigerated' :
                           form.storageType === 'frozen' ? '🧊 Frozen' : '🌡️ Room Temperature'}
                          <span className="storage-hint">(set in step 1)</span>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Packaging Type <span className="required">*</span></label>
                        <select className="form-select" name="packagingType" value={form.packagingType} onChange={set} required>
                          <option value="containerized">Containerized</option>
                          <option value="packaged">Packaged</option>
                          <option value="sealed">Sealed</option>
                          <option value="loose">Loose (needs container)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Handling Instructions</label>
                      <textarea className="form-textarea" name="handlingInstructions"
                        value={form.handlingInstructions} onChange={set} rows={3}
                        placeholder="Any special storage or handling notes..." />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Allergens</label>
                      <div className="checkbox-grid">
                        {ALLERGENS.map(a => (
                          <label key={a} className={`checkbox-tag ${form.allergens.includes(a) ? 'selected' : ''}`}>
                            <input type="checkbox" checked={form.allergens.includes(a)}
                              onChange={() => toggleList('allergens', a)} />
                            <span className="check-dot">
                              {form.allergens.includes(a) && <Check size={9} />}
                            </span>
                            {a}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Dietary Info</label>
                      <div className="checkbox-grid">
                        {DIETARY.map(d => (
                          <label key={d} className={`checkbox-tag ${form.dietaryInfo.includes(d) ? 'selected' : ''}`}>
                            <input type="checkbox" checked={form.dietaryInfo.includes(d)}
                              onChange={() => toggleList('dietaryInfo', d)} />
                            <span className="check-dot">
                              {form.dietaryInfo.includes(d) && <Check size={9} />}
                            </span>
                            {d}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* ML Spoilage */}
                    <div className="spoilage-card">
                      <div className="spoilage-card-header">
                        <AlertTriangle size={18} />
                        <h3>🤖 ML Spoilage Prediction</h3>
                      </div>
                      {spoilageLoading ? (
                        <p className="spoilage-loading">Analysing food data...</p>
                      ) : spoilage ? (
                        <>
                          <div className="spoilage-stats">
                            <div className={`spoilage-stat risk-${spoilage.riskLevel}`}>
                              <span className="spoilage-stat-label">Risk Level</span>
                              <span className="spoilage-stat-value">{spoilage.riskLevel.toUpperCase()}</span>
                            </div>
                            <div className="spoilage-stat risk-shelf">
                              <span className="spoilage-stat-label">Est. Shelf Life</span>
                              <span className="spoilage-stat-value">
                                {spoilage.shelfLifeHours >= 24
                                  ? `${Math.round(spoilage.shelfLifeHours / 24)}d`
                                  : `${spoilage.shelfLifeHours}h`}
                              </span>
                            </div>
                            <div className="spoilage-stat risk-conf">
                              <span className="spoilage-stat-label">Confidence</span>
                              <span className="spoilage-stat-value">{spoilage.confidence}</span>
                            </div>
                          </div>
                          {spoilage.tips.length > 0 && (
                            <div className="spoilage-tips">
                              <strong>Tips</strong>
                              <ul>{spoilage.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="spoilage-empty">Fill in category, storage type & best-before date to get a prediction.</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Step 5: Photos & Review ── */}
              {step === 5 && (
                <motion.div key="step5" custom={direction} variants={slideVariants}
                  initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.22, ease: 'easeInOut' }}>
                  <div className="step-header">
                    <div className="step-icon-wrap"><ImageIcon size={22} /></div>
                    <div className="step-header-text">
                      <h2>Photos & Review</h2>
                      <p>Add photos and confirm your listing details</p>
                    </div>
                  </div>
                  <div className="form-step-body">
                    {/* Image Upload */}
                    <div className="form-group">
                      <label className="form-label">Food Photos <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}>(max 5)</span></label>
                      <input type="file" id="img-upload" multiple accept="image/*"
                        onChange={handleImages} style={{ display: 'none' }} />
                      <label htmlFor="img-upload" className="image-upload-zone">
                        <div className="upload-icon-ring"><Upload size={22} /></div>
                        <p>Click to upload photos</p>
                        <small>JPEG or PNG, up to 5 images</small>
                      </label>
                      {imagePreviews.length > 0 && (
                        <div className="image-previews">
                          {imagePreviews.map((src, i) => (
                            <div key={i} className="image-preview">
                              <img src={src} alt={`Preview ${i + 1}`} />
                              <button type="button" className="remove-image"
                                onClick={() => setImagePreviews(p => p.filter((_, j) => j !== i))}>
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Summary */}
                    <div className="review-card">
                      <div className="review-card-header">Review Your Listing</div>
                      <div className="review-grid">
                        {[
                          ['Food', form.foodName || '—'],
                          ['Category', form.category],
                          ['Quantity', form.quantity ? `${form.quantity} ${form.unit}` : '—'],
                          ['Food Type', form.foodType],
                          ['Storage', form.storageType],
                          ['Packaging', form.packagingType],
                          ['Available From', form.availableFrom ? new Date(form.availableFrom).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'],
                          ['Best Before', form.bestBefore ? new Date(form.bestBefore).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'],
                          ['City', form.city || '—'],
                          ['Pincode', form.pincode || '—'],
                        ].map(([label, value]) => (
                          <div className="review-item" key={label}>
                            <div className="review-label">{label}</div>
                            <div className="review-value">{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div className="form-nav">
              <div className="form-nav-left">
                {step > 1 && (
                  <button type="button" className="btn-back" onClick={goBack}>
                    <ArrowLeft size={16} /> Back
                  </button>
                )}
                <span className="step-counter">Step {step} of 5</span>
              </div>

              {step < 5 ? (
                <button type="button" className="btn-next" onClick={goNext} disabled={!isValid()}>
                  Next <ArrowRight size={16} />
                </button>
              ) : (
                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? (
                    <><div className="spinner-sm" /> Creating...</>
                  ) : (
                    <><Check size={16} /> Create Listing</>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
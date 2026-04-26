import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  Trash2,
  Loader,
  Utensils,
  Package,
  MapPin,
  Info,
  Calendar,
} from 'lucide-react';
import { donorApi } from '../../services/api';
import { useToast } from '../../components/ToastProvider';
import DonorLayout from '../../components/DonorLayout';
import type { Listing } from '../../types';
import './EditListingPage.css';

interface EditFormData {
  foodName: string;
  category: string;
  foodType: string;
  quantity: string;
  unit: string;
  description: string;
  availableFrom: string;
  bestBefore: string;
  pickupLocation: string;
  latitude: string;
  longitude: string;
  storageType: string;
  packagingType: string;
  handlingInstructions: string;
}

const categories = [
  { value: 'cooked-meals', label: 'Cooked Meals', icon: '🍛' },
  { value: 'bakery', label: 'Bakery Items', icon: '🥖' },
  { value: 'dairy', label: 'Dairy Products', icon: '🥛' },
  { value: 'fruits-vegetables', label: 'Fruits & Vegetables', icon: '🥗' },
  { value: 'packaged-food', label: 'Packaged Food', icon: '📦' },
  { value: 'beverages', label: 'Beverages', icon: '🥤' },
];

const EditListingPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [formData, setFormData] = useState<EditFormData>({
    foodName: '',
    category: 'cooked-meals',
    foodType: 'veg',
    quantity: '',
    unit: 'kg',
    description: '',
    availableFrom: '',
    bestBefore: '',
    pickupLocation: '',
    latitude: '',
    longitude: '',
    storageType: 'refrigerated',
    packagingType: 'containerized',
    handlingInstructions: '',
  });

  useEffect(() => {
    if (!localStorage.getItem('isAuthenticated')) {
      navigate('/login');
      return;
    }
    fetchListing();
  }, [id]);

  const fetchListing = async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem('userId');
      if (!userId) {
        showToast('Please login again to continue.', 'error');
        navigate('/login');
        return;
      }

      const listings = await donorApi.getListings(Number(userId));
      const listing = listings.find((l: Listing) => l.id === Number(id));

      if (!listing) {
        setNotFound(true);
        showToast('Listing not found.', 'error');
        return;
      }

      const formatDateTime = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };

      setFormData({
        foodName: listing.foodName || '',
        category: listing.category || 'cooked-meals',
        foodType: listing.foodType || 'veg',
        quantity: listing.quantity?.toString() || '',
        unit: listing.unit || 'kg',
        description: listing.description || '',
        availableFrom: formatDateTime(listing.availableFrom),
        bestBefore: formatDateTime(listing.bestBefore),
        pickupLocation: listing.pickupLocation || '',
        latitude: listing.latitude?.toString() || '',
        longitude: listing.longitude?.toString() || '',
        storageType: listing.storageType || 'refrigerated',
        packagingType: listing.packagingType || 'containerized',
        handlingInstructions: listing.handlingInstructions || '',
      });
    } catch (error) {
      console.error('Error fetching listing:', error);
      showToast('Failed to load listing data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.foodName || !formData.quantity || !formData.pickupLocation) {
      showToast('Please fill in all required fields.', 'warning');
      return;
    }

    try {
      setSaving(true);
      await donorApi.updateListing(Number(id), {
        foodName: formData.foodName,
        category: formData.category,
        foodType: formData.foodType,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        description: formData.description,
        availableFrom: formData.availableFrom,
        bestBefore: formData.bestBefore,
        pickupLocation: formData.pickupLocation,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        storageType: formData.storageType,
        packagingType: formData.packagingType,
        handlingInstructions: formData.handlingInstructions,
      });

      showToast('Listing updated successfully!', 'success');
      navigate('/donor/dashboard');
    } catch (error: any) {
      console.error('Error updating listing:', error);
      showToast(error.message || 'Failed to update listing.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this listing? This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      setDeleting(true);
      await donorApi.deleteListing(Number(id));
      showToast('Listing deleted successfully.', 'success');
      navigate('/donor/dashboard');
    } catch (error: any) {
      console.error('Error deleting listing:', error);
      showToast(error.message || 'Failed to delete listing.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <DonorLayout>
        <div className="edit-listing-page">
          <div className="edit-loading-state">
            <Loader className="edit-spinner" size={40} />
            <p>Loading listing data...</p>
          </div>
        </div>
      </DonorLayout>
    );
  }

  if (notFound) {
    return (
      <DonorLayout>
        <div className="edit-listing-page">
          <div className="edit-not-found">
            <h2>Listing Not Found</h2>
            <p>The listing you are looking for does not exist or you do not have permission to edit it.</p>
            <button className="edit-btn-back-dashboard" onClick={() => navigate('/donor/dashboard')}>
              <ArrowLeft size={18} />
              Back to Dashboard
            </button>
          </div>
        </div>
      </DonorLayout>
    );
  }

  return (
    <DonorLayout>
      <div className="edit-listing-page">
        {/* Header */}
        <div className="edit-page-header">
          <h1 className="edit-page-title">Edit Listing</h1>
          <p className="edit-page-subtitle">Update the details of your food donation</p>
        </div>

      <motion.div
        className="edit-form-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <section className="edit-form-section">
            <div className="edit-section-header">
              <Utensils size={20} className="edit-section-icon" />
              <h2>Basic Information</h2>
            </div>

            <div className="edit-form-grid">
              <div className="edit-form-group edit-full-width">
                <label htmlFor="foodName">Food Name *</label>
                <input
                  id="foodName"
                  type="text"
                  name="foodName"
                  value={formData.foodName}
                  onChange={handleInputChange}
                  placeholder="e.g., Vegetable Biryani, Assorted Pastries"
                  required
                />
              </div>

              <div className="edit-form-group">
                <label>Category *</label>
                <div className="edit-category-grid">
                  {categories.map((cat) => (
                    <label
                      key={cat.value}
                      className={`edit-category-card ${formData.category === cat.value ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={cat.value}
                        checked={formData.category === cat.value}
                        onChange={handleInputChange}
                      />
                      <span className="edit-category-icon">{cat.icon}</span>
                      <span className="edit-category-label">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="edit-form-group">
                <label>Food Type *</label>
                <div className="edit-radio-group">
                  <label className={`edit-radio-card ${formData.foodType === 'veg' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="foodType"
                      value="veg"
                      checked={formData.foodType === 'veg'}
                      onChange={handleInputChange}
                    />
                    <span>Vegetarian</span>
                  </label>
                  <label className={`edit-radio-card ${formData.foodType === 'non-veg' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="foodType"
                      value="non-veg"
                      checked={formData.foodType === 'non-veg'}
                      onChange={handleInputChange}
                    />
                    <span>Non-Vegetarian</span>
                  </label>
                  <label className={`edit-radio-card ${formData.foodType === 'vegan' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="foodType"
                      value="vegan"
                      checked={formData.foodType === 'vegan'}
                      onChange={handleInputChange}
                    />
                    <span>Vegan</span>
                  </label>
                </div>
              </div>

              <div className="edit-form-group edit-full-width">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Additional details about the food, ingredients, etc."
                />
              </div>
            </div>
          </section>

          {/* Quantity & Timing */}
          <section className="edit-form-section">
            <div className="edit-section-header">
              <Package size={20} className="edit-section-icon" />
              <h2>Quantity & Timing</h2>
            </div>

            <div className="edit-form-grid">
              <div className="edit-form-group">
                <label htmlFor="quantity">Quantity *</label>
                <div className="edit-quantity-row">
                  <input
                    id="quantity"
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    placeholder="0"
                    min="0"
                    step="0.1"
                    required
                  />
                  <select name="unit" value={formData.unit} onChange={handleInputChange}>
                    <option value="kg">kg</option>
                    <option value="servings">servings</option>
                    <option value="pieces">pieces</option>
                    <option value="liters">liters</option>
                    <option value="packets">packets</option>
                    <option value="boxes">boxes</option>
                  </select>
                </div>
              </div>

              <div className="edit-form-group">
                <label htmlFor="availableFrom">
                  <Calendar size={14} className="edit-inline-icon" />
                  Available From *
                </label>
                <input
                  id="availableFrom"
                  type="datetime-local"
                  name="availableFrom"
                  value={formData.availableFrom}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="edit-form-group">
                <label htmlFor="bestBefore">
                  <Calendar size={14} className="edit-inline-icon" />
                  Best Before *
                </label>
                <input
                  id="bestBefore"
                  type="datetime-local"
                  name="bestBefore"
                  value={formData.bestBefore}
                  onChange={handleInputChange}
                  required
                />
                <small className="edit-hint">When the food should be collected by</small>
              </div>
            </div>
          </section>

          {/* Location & Pickup */}
          <section className="edit-form-section">
            <div className="edit-section-header">
              <MapPin size={20} className="edit-section-icon" />
              <h2>Location & Pickup</h2>
            </div>

            <div className="edit-form-grid">
              <div className="edit-form-group edit-full-width">
                <label htmlFor="pickupLocation">Pickup Address *</label>
                <textarea
                  id="pickupLocation"
                  name="pickupLocation"
                  value={formData.pickupLocation}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Full address with building/floor details"
                  required
                />
              </div>

              <div className="edit-form-group">
                <label htmlFor="latitude">Latitude</label>
                <input
                  id="latitude"
                  type="number"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleInputChange}
                  placeholder="e.g., 28.6139"
                  step="any"
                />
              </div>

              <div className="edit-form-group">
                <label htmlFor="longitude">Longitude</label>
                <input
                  id="longitude"
                  type="number"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleInputChange}
                  placeholder="e.g., 77.2090"
                  step="any"
                />
              </div>
            </div>
          </section>

          {/* Additional Details */}
          <section className="edit-form-section">
            <div className="edit-section-header">
              <Info size={20} className="edit-section-icon" />
              <h2>Additional Details</h2>
            </div>

            <div className="edit-form-grid">
              <div className="edit-form-group">
                <label htmlFor="storageType">Storage Type</label>
                <select
                  id="storageType"
                  name="storageType"
                  value={formData.storageType}
                  onChange={handleInputChange}
                >
                  <option value="refrigerated">Refrigerated</option>
                  <option value="frozen">Frozen</option>
                  <option value="room-temperature">Room Temperature</option>
                </select>
              </div>

              <div className="edit-form-group">
                <label htmlFor="packagingType">Packaging Type</label>
                <select
                  id="packagingType"
                  name="packagingType"
                  value={formData.packagingType}
                  onChange={handleInputChange}
                >
                  <option value="containerized">Containerized</option>
                  <option value="packaged">Packaged</option>
                  <option value="sealed">Sealed</option>
                  <option value="loose">Loose (needs container)</option>
                </select>
              </div>

              <div className="edit-form-group edit-full-width">
                <label htmlFor="handlingInstructions">Handling Instructions</label>
                <textarea
                  id="handlingInstructions"
                  name="handlingInstructions"
                  value={formData.handlingInstructions}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Special instructions for storing or handling the food"
                />
              </div>
            </div>
          </section>

          {/* Action Buttons */}
          <div className="edit-form-actions">
            <button
              type="button"
              className="edit-btn-delete"
              onClick={handleDelete}
              disabled={deleting || saving}
            >
              {deleting ? (
                <>
                  <Loader className="edit-spinner-small" size={16} />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  <span>Delete Listing</span>
                </>
              )}
            </button>

            <div className="edit-actions-right">
              <button
                type="button"
                className="edit-btn-cancel"
                onClick={() => navigate('/donor/dashboard')}
                disabled={saving || deleting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="edit-btn-save"
                disabled={saving || deleting}
              >
                {saving ? (
                  <>
                    <Loader className="edit-spinner-small" size={16} />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  </DonorLayout>
  );
};

export default EditListingPage;

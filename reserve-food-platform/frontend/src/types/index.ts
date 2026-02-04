export type UserType = 'donor' | 'ngo' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  userType: UserType;
  organizationName?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface Listing {
  id: number;
  donorId: number;
  foodName: string;
  category: string;
  foodType?: string;
  quantity: number;
  unit: string;
  description?: string;
  images?: string[];
  availableFrom: string;
  bestBefore: string;
  pickupLocation: string;
  latitude?: number;
  longitude?: number;
  status: string;
  createdAt: string;

  donorName?: string;
  organizationName?: string;
}

export interface Claim {
  id: number;
  listingId: number;
  ngoId: number;
  status: string;
  scheduledTime?: string;
  collectedAt?: string;
  quantity?: number;
  createdAt?: string;

  foodName?: string;
  unit?: string;
  donorName?: string;
  organizationName?: string;
  ngoName?: string;
  pickupLocation?: string;
  phone?: string;
}

export interface DonorStats {
  totalDonations: number;
  activeListings: number;
  totalClaims: number;
  foodSaved: number;
}

export interface NGOStats {
  totalCollections: number;
  activeClaims: number;
  foodCollected: number;
  peopleFed: number;
}

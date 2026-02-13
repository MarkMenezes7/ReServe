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
  bio?: string;
  profileImage?: string;
  isVerified?: number;
  isActive?: number;
  createdAt?: string;
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
  images?: string;
  availableFrom: string;
  bestBefore: string;
  pickupLocation: string;
  latitude?: number;
  longitude?: number;
  storageType?: string;
  packagingType?: string;
  handlingInstructions?: string;
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
  cancelReason?: string;
  createdAt?: string;
  foodName?: string;
  unit?: string;
  donorName?: string;
  organizationName?: string;
  ngoName?: string;
  ngoOrg?: string;
  pickupLocation?: string;
  phone?: string;
  donorId?: number;
}

export interface Review {
  id: number;
  claimId: number;
  reviewerId: number;
  revieweeId: number;
  foodQuality: number;
  communication: number;
  timeliness: number;
  overall: number;
  comment?: string;
  isAnonymous?: number;
  createdAt: string;
  reviewerName?: string;
  reviewerOrg?: string;
  foodName?: string;
}

export interface ReviewStats {
  averageOverall: number;
  averageFoodQuality: number;
  averageCommunication: number;
  averageTimeliness: number;
  totalReviews: number;
  distribution: { stars: number; count: number }[];
}

export interface Message {
  id: number;
  claimId: number;
  senderId: number;
  receiverId: number;
  content: string;
  messageType: 'text' | 'image' | 'quick-reply';
  imageUrl?: string;
  isRead: number;
  createdAt: string;
}

export interface Conversation {
  claimId: number;
  status: string;
  foodName: string;
  donorId: number;
  ngoId: number;
  counterpartName: string;
  counterpartOrg: string;
  counterpartId: number;
  unreadCount?: number;
  lastMessage?: string;
  lastMessageAt?: string;
}

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  relatedId?: number;
  relatedType?: string;
  isRead: number;
  createdAt: string;
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

export interface AdminStats {
  totalUsers: number;
  totalDonors: number;
  totalNGOs: number;
  totalListings: number;
  activeListings: number;
  totalClaims: number;
  collectedClaims: number;
  totalReviews: number;
  totalFoodSaved: number;
  totalMessages: number;
}

export interface ImpactStats {
  foodRescued: number;
  mealsProvided: number;
  registeredDonors: number;
  activeNGOs: number;
  totalCollections: number;
  citiesCovered: number;
  co2Saved: number;
  waterConserved: number;
}

export interface MLForecastHour {
  hour: number;
  probability: number;
  expectedQuantity: number;
  confidence: string;
}

export interface MLForecastDay {
  day: string;
  dayIndex: number;
  probability: number;
  expectedQuantity: number;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  organization?: string;
  interestType?: string;
  subject?: string;
  message: string;
  status: string;
  createdAt: string;
}

export interface GratitudeEntry {
  id: number;
  displayName: string;
  message?: string;
  tier?: string;
  createdAt: string;
}

export interface AIInsight {
  type: string;
  icon: string;
  title: string;
  description: string;
  color: string;
}

export interface CategoryDistribution {
  category: string;
  count: number;
  percentage: number;
  totalQuantity: number;
  avgQuantity: number;
  activeCount: number;
  trend: 'rising' | 'stable' | 'declining';
}

export interface CategoryVelocity {
  category: string;
  thisWeek: number;
  lastWeek: number;
  change: number;
  total: number;
}

export interface ForecastSummary {
  activeListings: number;
  todayListings: number;
  weeklyListings: number;
  avgDailyListings: number;
  peakHour: { hour: number; count: number } | null;
  categoryVelocity: CategoryVelocity[];
  demandScore: number;
  source: string;
}

export interface AreaForecast {
  area: string;
  totalListings: number;
  activeNow: number;
  avgQuantity: number;
  successRate: number;
  peakHour: number | null;
  peakDay: string | null;
  lat: number;
  lng: number;
}

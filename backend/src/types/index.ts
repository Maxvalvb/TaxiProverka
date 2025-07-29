export enum AppState {
  BOOKING = 'BOOKING',
  SEARCHING = 'SEARCHING',
  CONFIRMED = 'CONFIRMED',
  TRIP_IN_PROGRESS = 'TRIP_IN_PROGRESS',
  TRIP_COMPLETE = 'TRIP_COMPLETE',
}

export enum UserMode {
  CLIENT = 'CLIENT',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

export enum DriverState {
  OFFLINE = 'OFFLINE',
  ONLINE = 'ONLINE',
  INCOMING_RIDE = 'INCOMING_RIDE',
  TO_PICKUP = 'TO_PICKUP',
  TRIP_IN_PROGRESS = 'TRIP_IN_PROGRESS',
}

export enum RideType {
  ECONOMY = 'Эконом',
  COMFORT = 'Комфорт',
  BUSINESS = 'Бизнес',
}

export enum PaymentMethod {
  CARD = 'CARD',
  CASH = 'CASH',
}

export enum RidePurpose {
  PERSONAL = 'Личная',
  BUSINESS = 'Бизнес',
}

export enum RideStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// Database Types
export interface User {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: UserMode;
  photo_url?: string;
  wallet_balance: number;
  created_at: string;
  updated_at: string;
  location_lat?: number;
  location_lng?: number;
}

export interface Driver {
  id: string;
  user_id: string;
  car_model: string;
  license_plate: string;
  rating: number;
  earnings_today: number;
  state: DriverState;
  location_lat: number;
  location_lng: number;
  created_at: string;
  updated_at: string;
  // Relations
  user?: User;
}

export interface PaymentCard {
  id: string;
  user_id: string;
  last4: string;
  brand: 'mastercard' | 'visa' | 'unknown';
  created_at: string;
  updated_at: string;
}

export interface Ride {
  id: string;
  client_id: string;
  driver_id?: string;
  pickup_address: string;
  destination_address: string;
  pickup_lat: number;
  pickup_lng: number;
  destination_lat: number;
  destination_lng: number;
  fare: number;
  ride_type: RideType;
  status: RideStatus;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  // Relations
  client?: User;
  driver?: Driver;
}

export interface ChatMessage {
  id: string;
  ride_id: string;
  sender_id: string;
  sender_type: 'client' | 'driver';
  message: string;
  created_at: string;
  // Relations
  sender?: User;
}

// API Request/Response Types
export interface LoginRequest {
  phone: string;
  password?: string;
  role: UserMode;
}

export interface LoginResponse {
  user: User;
  token: string;
  driver?: Driver;
}

export interface CreateRideRequest {
  pickup_address: string;
  destination_address: string;
  pickup_lat: number;
  pickup_lng: number;
  destination_lat: number;
  destination_lng: number;
  fare: number;
  ride_type: RideType;
}

export interface UpdateDriverLocationRequest {
  lat: number;
  lng: number;
}

export interface UpdateDriverStateRequest {
  state: DriverState;
}

export interface SendMessageRequest {
  ride_id: string;
  message: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  photo_url?: string;
}

export interface AddPaymentCardRequest {
  last4: string;
  brand: 'mastercard' | 'visa' | 'unknown';
}

// WebSocket Events
export interface WebSocketEvent {
  type: string;
  data: any;
  userId?: string;
  rideId?: string;
}

export interface RideUpdateEvent extends WebSocketEvent {
  type: 'RIDE_UPDATE';
  data: {
    ride: Ride;
    driver?: Driver;
  };
}

export interface DriverLocationEvent extends WebSocketEvent {
  type: 'DRIVER_LOCATION';
  data: {
    driverId: string;
    lat: number;
    lng: number;
  };
}

export interface ChatMessageEvent extends WebSocketEvent {
  type: 'CHAT_MESSAGE';
  data: ChatMessage;
}

// Utility Types
export interface Location {
  lat: number;
  lng: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Express Request Extensions
export interface AuthenticatedRequest extends Express.Request {
  user?: User;
  driver?: Driver;
}
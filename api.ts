
import { 
    UserMode, UserProfile, Driver, DriverState, RideHistoryEntry, 
    PaymentCard, ActiveTrip, ChatMessage, RideType
} from '../types';
import { getDistance } from '../utils/helpers';

// Backend API configuration
const API_BASE_URL = 'http://localhost:3001/api';

// Token management
let authToken: string | null = localStorage.getItem('authToken');

const setAuthToken = (token: string | null) => {
    authToken = token;
    if (token) {
        localStorage.setItem('authToken', token);
    } else {
        localStorage.removeItem('authToken');
    }
};

// API request helper
const apiRequest = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultHeaders: HeadersInit = {
        'Content-Type': 'application/json',
    };

    if (authToken) {
        defaultHeaders.Authorization = `Bearer ${authToken}`;
    }

    const config: RequestInit = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.data || data;
};

export const apiService = {
    async login(mode: UserMode): Promise<{ user: UserProfile, token: string, driver?: Driver }> {
        const response = await apiRequest<{ user: UserProfile, token: string, driver?: Driver }>('/auth/login', {
            method: 'POST',
            body: {
                phone: '+7 999 123 45 67', // Simplified for demo
                role: mode
            }
        });
        
        setAuthToken(response.token);
        return response;
    },

    async fetchDrivers(): Promise<Driver[]> {
        return apiRequest<Driver[]>('/drivers');
    },

    async fetchRideHistory(): Promise<RideHistoryEntry[]> {
        return apiRequest<RideHistoryEntry[]>('/rides/user/me');
    },
    
    async createRide(details: { pickup: string, destination: string, fare: number, rideType: RideType, clientProfile: UserProfile }): Promise<ActiveTrip> {
        const rideData = {
            pickup_address: details.pickup,
            destination_address: details.destination,
            pickup_lat: details.clientProfile.location.lat,
            pickup_lng: details.clientProfile.location.lng,
            destination_lat: details.clientProfile.location.lat + 0.01, // Mock destination
            destination_lng: details.clientProfile.location.lng + 0.01,
            fare: details.fare,
            ride_type: details.rideType
        };

        return apiRequest<ActiveTrip>('/rides', {
            method: 'POST',
            body: rideData
        });
    },

    async getRideStatus(rideId: string, userMode: UserMode): Promise<{ status: string, driver: Driver | null }> {
        try {
            // First try to find a driver automatically
            await apiRequest(`/rides/${rideId}/find-driver`, {
                method: 'POST'
            });
        } catch (error) {
            // Ignore errors from auto-assignment
        }

        // Get updated ride info
        const ride = await apiRequest<ActiveTrip>(`/rides/${rideId}`);
        
        return {
            status: ride.status,
            driver: ride.driver || null
        };
    },

    async cancelRide(rideId: string): Promise<{ success: boolean }> {
        await apiRequest(`/rides/${rideId}/cancel`, {
            method: 'DELETE'
        });
        return { success: true };
    },
    
    async updateRideStatus(rideId: string, newStatus: 'TRIP_IN_PROGRESS' | 'TRIP_COMPLETE'): Promise<{ success: boolean }> {
        const statusMap = {
            'TRIP_IN_PROGRESS': 'IN_PROGRESS',
            'TRIP_COMPLETE': 'COMPLETED'
        };

        await apiRequest(`/rides/${rideId}/status`, {
            method: 'PUT',
            body: {
                status: statusMap[newStatus]
            }
        });
        
        return { success: true };
    },

    async updateDriverEarnings(driverId: string, fare: number): Promise<{ earningsToday: number }> {
        const result = await apiRequest<Driver>(`/drivers/${driverId}/earnings`, {
            method: 'PUT',
            body: {
                amount: fare
            }
        });
        
        return { earningsToday: result.earnings_today };
    },

    async sendMessage(text: string, sender: 'user' | 'driver', rideId?: string): Promise<ChatMessage> {
        if (!rideId) {
            // For demo purposes, create a mock message
            return {
                id: Date.now(),
                sender,
                text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
        }

        return apiRequest<ChatMessage>('/chat/messages', {
            method: 'POST',
            body: {
                ride_id: rideId,
                message: text
            }
        });
    },

    async updateProfile(profile: UserProfile): Promise<UserProfile> {
        const updateData = {
            name: profile.name,
            email: profile.email,
            photo_url: profile.photoUrl
        };

        return apiRequest<UserProfile>('/users/profile', {
            method: 'PUT',
            body: updateData
        });
    },

    async addPaymentCard(profile: UserProfile, card: PaymentCard): Promise<UserProfile> {
        const cardData = {
            last4: card.last4,
            brand: card.brand
        };

        await apiRequest('/users/payment-cards', {
            method: 'POST',
            body: cardData
        });

        // Return updated profile with new card
        const cards = await apiRequest<PaymentCard[]>('/users/payment-cards');
        return {
            ...profile,
            paymentMethods: cards
        };
    }
};
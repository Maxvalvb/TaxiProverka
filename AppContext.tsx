import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode, useRef } from 'react';
import { 
    AppState, Driver, DriverState, UserMode, ChatMessage, UserProfile, ToastData, 
    RideHistoryEntry, PaymentCard, RideType, Auth, AppContextType, ActiveTrip 
} from '../types';
import { apiService } from '../services/api';

const AppContext = createContext<AppContextType | undefined>(undefined);

function usePersistentState<T>(key: string, initialState: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialState;
        } catch (error) {
            console.error(`Error reading localStorage key “${key}”:`, error);
            return initialState;
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.error(`Error writing to localStorage key “${key}”:`, error);
        }
    }, [key, state]);

    return [state, setState];
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // --- AUTH & CORE UI STATE ---
    const [auth, setAuth] = usePersistentState<Auth>('auth', { isAuthenticated: false, userMode: null });
    const [isDarkMode, setIsDarkMode] = usePersistentState<boolean>('isDarkMode', false);
    
    // --- ASYNC & ERROR STATE ---
    const [isInitializing, setIsInitializing] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isFindingDriver, setIsFindingDriver] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- APP DATA STATE ---
    const [appState, setAppState] = useState<AppState>(AppState.BOOKING);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [clientProfile, setClientProfile] = useState<UserProfile | null>(null);
    const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
    const [assignedDriver, setAssignedDriver] = useState<Driver | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [eta, setEta] = useState<number | null>(null);
    const [toasts, setToasts] = useState<ToastData[]>([]);
    const [rideHistory, setRideHistory] = useState<RideHistoryEntry[]>([]);

    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // --- TOASTS ---
    const addToast = useCallback((message: string, type: ToastData['type'] = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev.slice(-4), { id, message, type }]);
    }, []);
    const removeToast = useCallback((id: number) => {
        setToasts(currentToasts => currentToasts.filter(t => t.id !== id));
    }, []);

    // --- AUTHENTICATION ---
    useEffect(() => {
        const checkAuthStatus = async () => {
            setIsInitializing(true);
            const savedAuth = window.localStorage.getItem('auth');
            if (savedAuth) {
                const parsedAuth: Auth = JSON.parse(savedAuth);
                if (parsedAuth.isAuthenticated && parsedAuth.userMode) {
                    await login(parsedAuth.userMode, true);
                }
            }
            setIsInitializing(false);
        };
        checkAuthStatus();
    }, []);

    const login = async (mode: UserMode, isRehydrating = false) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiService.login(mode);
            setClientProfile(response.user);
            setAuth({ isAuthenticated: true, userMode: mode });
            if (!isRehydrating) addToast(`Вы вошли как ${mode}`, 'success');
            
            // Fetch initial data
            const initialDrivers = await apiService.fetchDrivers();
            // Transform backend drivers to frontend format
            const transformedDrivers = initialDrivers.map(driver => ({
                id: driver.id,
                name: driver.user?.name || 'Unknown',
                rating: driver.rating,
                photoUrl: driver.user?.photo_url || '',
                carModel: driver.car_model,
                licensePlate: driver.license_plate,
                state: driver.state,
                earningsToday: driver.earnings_today,
                pastTrips: [],
                location: {
                    lat: driver.location_lat,
                    lng: driver.location_lng
                }
            }));
            setDrivers(transformedDrivers);
            
            try {
                const initialHistory = await apiService.fetchRideHistory();
                // Transform ride history if needed
                const transformedHistory = initialHistory.map(ride => ({
                    id: ride.id,
                    date: new Date(ride.created_at).toLocaleDateString(),
                    pickup: ride.pickup_address,
                    destination: ride.destination_address,
                    fare: ride.fare,
                    driver: ride.driver ? {
                        id: ride.driver.id,
                        name: ride.driver.user?.name || 'Unknown',
                        rating: ride.driver.rating,
                        photoUrl: ride.driver.user?.photo_url || '',
                        carModel: ride.driver.car_model,
                        licensePlate: ride.driver.license_plate,
                        state: ride.driver.state,
                        earningsToday: ride.driver.earnings_today,
                        pastTrips: [],
                        location: {
                            lat: ride.driver.location_lat,
                            lng: ride.driver.location_lng
                        }
                    } : {} as Driver
                }));
                setRideHistory(transformedHistory);
            } catch (historyError) {
                // Ignore history errors for now
                console.warn('Failed to fetch ride history:', historyError);
            }
        } catch (e: any) {
            setError(e.message);
            addToast(`Ошибка входа: ${e.message}`, 'error');
            throw e; // re-throw to be caught in UI
        } finally {
            setIsLoading(false);
        }
    };
    
    const logout = useCallback(() => {
        setAuth({ isAuthenticated: false, userMode: null });
        setClientProfile(null);
        setDrivers([]);
        setRideHistory([]);
        setAppState(AppState.BOOKING);
        setActiveTrip(null);
        setAssignedDriver(null);
        window.localStorage.removeItem('auth');
        addToast('Вы вышли из системы', 'info');
    }, [addToast]);
    
    // --- DARK MODE ---
     useEffect(() => {
        window.document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);
    const toggleDarkMode = useCallback(() => setIsDarkMode(p => !p), [setIsDarkMode]);

    // --- TRIP MANAGEMENT ---
    const stopPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    const handleFindDriver = async (pickup: string, destination: string, fare: string, rideType: RideType) => {
        if (!clientProfile) {
            addToast('Профиль клиента не загружен', 'error');
            return;
        }
        setIsFindingDriver(true);
        setError(null);
        try {
            const newTrip = await apiService.createRide({ pickup, destination, fare: parseInt(fare, 10), rideType, clientProfile });
            
            // Transform backend ride to frontend format
            const transformedTrip: ActiveTrip = {
                id: newTrip.id,
                clientId: newTrip.client_id,
                clientProfile: clientProfile,
                driverId: newTrip.driver_id || null,
                pickup: newTrip.pickup_address,
                destination: newTrip.destination_address,
                fare: newTrip.fare,
                rideType: newTrip.ride_type
            };
            
            setActiveTrip(transformedTrip);
            setAppState(AppState.SEARCHING);

            // Start polling for ride status
            pollingRef.current = setInterval(async () => {
                try {
                    const statusUpdate = await apiService.getRideStatus(newTrip.id, auth.userMode || UserMode.CLIENT);
                    if (statusUpdate.driver) {
                        // Transform driver data
                        const transformedDriver = {
                            id: statusUpdate.driver.id,
                            name: statusUpdate.driver.user?.name || 'Unknown',
                            rating: statusUpdate.driver.rating,
                            photoUrl: statusUpdate.driver.user?.photo_url || '',
                            carModel: statusUpdate.driver.car_model,
                            licensePlate: statusUpdate.driver.license_plate,
                            state: statusUpdate.driver.state,
                            earningsToday: statusUpdate.driver.earnings_today,
                            pastTrips: [],
                            location: {
                                lat: statusUpdate.driver.location_lat,
                                lng: statusUpdate.driver.location_lng
                            }
                        };
                        
                        setAssignedDriver(transformedDriver);
                        setActiveTrip(prev => prev ? { ...prev, driverId: statusUpdate.driver?.id } : null);
                        setAppState(AppState.CONFIRMED);
                        
                        const arrivalTime = Math.round(Math.random() * 300 + 120); // 2-7 mins
                        setEta(arrivalTime);

                        addToast(`Водитель ${transformedDriver.name} принял ваш заказ!`, 'success');
                        stopPolling();
                        setIsFindingDriver(false);
                    } else if (statusUpdate.status === 'CANCELLED') {
                        addToast('Водитель отменил заказ. Ищем нового.', 'info');
                        // Reset and search again could be implemented here
                    }
                } catch (pollError) {
                    console.error('Polling error:', pollError);
                    addToast('Ошибка при обновлении статуса поездки', 'error');
                    stopPolling();
                    setIsFindingDriver(false);
                    setAppState(AppState.BOOKING);
                }
            }, 3000);

        } catch (e: any) {
            setError(e.message);
            addToast(e.message, 'error');
            setIsFindingDriver(false);
            setAppState(AppState.BOOKING);
        }
    };

    const handleCancelClient = async () => {
        stopPolling();
        setIsFindingDriver(false);
        if (activeTrip) {
            await apiService.cancelRide(activeTrip.id);
        }
        setAppState(AppState.BOOKING);
        setActiveTrip(null);
        setAssignedDriver(null);
        setEta(null);
        addToast('Поездка отменена', 'info');
    };
    
    const handleNewRide = useCallback(() => {
        setAppState(AppState.BOOKING);
        setActiveTrip(null);
        setAssignedDriver(null);
        setEta(null);
        setChatMessages([]);
    }, []);

    // --- FAKE ETA COUNTDOWN ---
     useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (appState === AppState.CONFIRMED && eta !== null && eta > 0) {
          timer = setInterval(() => setEta(prev => (prev !== null && prev > 1) ? prev - 1 : 0), 1000);
        } else if (appState === AppState.CONFIRMED && eta === 0) {
          setAppState(AppState.TRIP_IN_PROGRESS);
          if (assignedDriver) handleStartTrip(assignedDriver.id);
        } else if (appState === AppState.TRIP_IN_PROGRESS && eta !== null && eta > 0) {
            timer = setInterval(() => setEta(prev => (prev !== null && prev > 1) ? prev - 1 : 0), 1000);
        } else if (appState === AppState.TRIP_IN_PROGRESS && eta === 0) {
           if (assignedDriver && activeTrip) handleEndTrip(assignedDriver.id, activeTrip.fare);
        }
        return () => { if(timer) clearInterval(timer); };
    }, [appState, eta]);

    // --- OTHER ACTIONS (to be converted to API calls) ---
    const handleAcceptRide = async (driverId: string) => { /* Logic in API now */ };
    const handleDeclineRide = async (driverId: string) => { /* Logic in API now */ };
    const handleStartTrip = async (driverId: string) => {
        if (!activeTrip) return;
        await apiService.updateRideStatus(activeTrip.id, 'TRIP_IN_PROGRESS');
        setAppState(AppState.TRIP_IN_PROGRESS);
        setEta(900); // 15 minutes for the trip itself
        addToast('Поездка началась!');
    };
    const handleEndTrip = async (driverId: string, fare: number) => {
        if (!activeTrip) return;
        await apiService.updateRideStatus(activeTrip.id, 'TRIP_COMPLETE');
        const updatedProfile = await apiService.updateDriverEarnings(driverId, fare);
        setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, ...updatedProfile } : d));
        setAppState(AppState.TRIP_COMPLETE);
        addToast('Поездка завершена. Спасибо!', 'success');
    };
    const handleSendMessage = async (text: string, sender: 'user' | 'driver') => {
        const newMessage = await apiService.sendMessage(text, sender);
        setChatMessages(prev => [...prev, newMessage]);
    };
    const handleProfileSave = async (p: UserProfile) => {
        setIsLoading(true);
        const updatedProfile = await apiService.updateProfile(p);
        setClientProfile(updatedProfile);
        setIsLoading(false);
        addToast('Профиль обновлен', 'success');
    };
    const handleAddCard = async (card: PaymentCard) => {
        if(!clientProfile) return;
        const updatedProfile = await apiService.addPaymentCard(clientProfile, card);
        setClientProfile(updatedProfile);
        addToast('Карта добавлена!', 'success');
    };

    const getDriverById = useCallback((id: string) => drivers.find(d => d.id === id), [drivers]);

    const value: AppContextType = {
        auth, login, logout, isDarkMode, toggleDarkMode,
        isInitializing, isLoading, isFindingDriver, error,
        appState, drivers, activeTrip, assignedDriver, chatMessages, eta, clientProfile, toasts, rideHistory,
        addToast, removeToast, handleFindDriver, handleAcceptRide, handleDeclineRide,
        handleStartTrip, handleEndTrip, handleCancelClient, handleNewRide, handleSendMessage,
        handleProfileSave, handleAddCard, setDrivers, getDriverById
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};

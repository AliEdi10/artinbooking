'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete, Circle } from '@react-google-maps/api';

const containerStyle = {
    width: '100%',
    height: '300px',
    borderRadius: '8px',
};

const defaultCenter = {
    lat: 44.6488, // Halifax default
    lng: -63.5752,
};

const libraries: ('places')[] = ['places'];

type AddressComponents = {
    line1: string;
    city: string;
    provinceOrState: string;
    formattedAddress: string;
};

type MapPickerProps = {
    latitude?: number | null;
    longitude?: number | null;
    radiusKm?: number | null;
    onLocationSelect: (lat: number, lng: number, address?: AddressComponents) => void;
};

export function MapPicker({ latitude, longitude, radiusKm, onLocationSelect }: MapPickerProps) {
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        libraries,
    });

    const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(
        latitude && longitude ? { lat: latitude, lng: longitude } : null
    );
    const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(
        latitude && longitude ? { lat: latitude, lng: longitude } : defaultCenter
    );
    const [searchValue, setSearchValue] = useState('');
    const [inputValue, setInputValue] = useState('');

    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounce search value updates to reduce re-renders
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            setSearchValue(inputValue);
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [inputValue]);

    const handleMapClick = useCallback(
        (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
                const lat = e.latLng.lat();
                const lng = e.latLng.lng();
                setMarkerPosition({ lat, lng });
                setMapCenter({ lat, lng });
                onLocationSelect(lat, lng);
            }
        },
        [onLocationSelect]
    );

    const handleMarkerDragEnd = useCallback(
        (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
                const lat = e.latLng.lat();
                const lng = e.latLng.lng();
                setMarkerPosition({ lat, lng });
                setMapCenter({ lat, lng });
                onLocationSelect(lat, lng);
            }
        },
        [onLocationSelect]
    );

    const onPlaceChanged = useCallback(() => {
        if (autocompleteRef.current) {
            const place = autocompleteRef.current.getPlace();
            if (place.geometry?.location) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                setMarkerPosition({ lat, lng });
                setMapCenter({ lat, lng });
                setInputValue(place.formatted_address || '');
                setSearchValue(place.formatted_address || '');

                // Extract address components
                let streetNumber = '';
                let route = '';
                let city = '';
                let provinceOrState = '';

                if (place.address_components) {
                    for (const component of place.address_components) {
                        const types = component.types;
                        if (types.includes('street_number')) {
                            streetNumber = component.long_name;
                        } else if (types.includes('route')) {
                            route = component.long_name;
                        } else if (types.includes('locality')) {
                            city = component.long_name;
                        } else if (types.includes('administrative_area_level_1')) {
                            provinceOrState = component.short_name;
                        }
                    }
                }

                const line1 = streetNumber ? `${streetNumber} ${route}` : route;

                onLocationSelect(lat, lng, {
                    line1,
                    city,
                    provinceOrState,
                    formattedAddress: place.formatted_address || '',
                });
            }
        }
    }, [onLocationSelect]);

    const onAutocompleteLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
        autocompleteRef.current = autocomplete;
    }, []);

    if (loadError) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                Error loading maps. Please check your Google Maps API key.
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="bg-slate-100 rounded-lg p-4 h-[300px] flex items-center justify-center">
                <div className="text-slate-600 text-sm">Loading map...</div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {/* Address Search Box */}
            <Autocomplete
                onLoad={onAutocompleteLoad}
                onPlaceChanged={onPlaceChanged}
                restrictions={{ country: 'ca' }}
            >
                <input
                    type="text"
                    placeholder="🔍 Search for an address..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </Autocomplete>
            <p className="text-xs text-slate-600">
                Search for an address above, or click on the map to set the location.
            </p>
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={mapCenter}
                zoom={markerPosition ? 15 : 12}
                onClick={handleMapClick}
                options={{
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                }}
            >
                {markerPosition && (
                    <Marker
                        position={markerPosition}
                        draggable={true}
                        onDragEnd={handleMarkerDragEnd}
                    />
                )}
                {markerPosition && radiusKm && radiusKm > 0 && (
                    <Circle
                        center={markerPosition}
                        radius={radiusKm * 1000} // Convert km to meters
                        options={{
                            strokeColor: '#3b82f6',
                            strokeOpacity: 0.8,
                            strokeWeight: 2,
                            fillColor: '#3b82f6',
                            fillOpacity: 0.15,
                        }}
                    />
                )}
            </GoogleMap>
            {markerPosition && (
                <div className="flex gap-2 text-xs text-slate-600">
                    <span className="bg-slate-100 px-2 py-1 rounded">
                        Lat: {markerPosition.lat.toFixed(6)}
                    </span>
                    <span className="bg-slate-100 px-2 py-1 rounded">
                        Lng: {markerPosition.lng.toFixed(6)}
                    </span>
                </div>
            )}
        </div>
    );
}

'use client';

import { useCallback, useState, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';

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

type MapPickerProps = {
    latitude?: number | null;
    longitude?: number | null;
    onLocationSelect: (lat: number, lng: number, address?: string) => void;
};

export function MapPicker({ latitude, longitude, onLocationSelect }: MapPickerProps) {
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

    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

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
                setSearchValue(place.formatted_address || '');
                onLocationSelect(lat, lng, place.formatted_address);
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
                <div className="text-slate-500 text-sm">Loading map...</div>
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
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
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

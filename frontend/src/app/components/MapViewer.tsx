'use client';

import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const containerStyle = {
    width: '100%',
    height: '200px',
    borderRadius: '8px',
};

type MapViewerProps = {
    latitude: number;
    longitude: number;
    label?: string;
    showNavigation?: boolean;
};

export function MapViewer({ latitude, longitude, label, showNavigation = true }: MapViewerProps) {
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    });

    const center = { lat: latitude, lng: longitude };

    const openInGoogleMaps = () => {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
        window.open(url, '_blank');
    };

    const openLocation = () => {
        const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        window.open(url, '_blank');
    };

    if (loadError) {
        return (
            <div className="bg-slate-50 border rounded-lg p-3 text-sm">
                <p className="text-slate-600 mb-2">{label || 'Location'}</p>
                <div className="flex gap-2">
                    <button
                        onClick={openLocation}
                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        type="button"
                    >
                        📍 View on Map
                    </button>
                    {showNavigation && (
                        <button
                            onClick={openInGoogleMaps}
                            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                            type="button"
                        >
                            🧭 Navigate
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="bg-slate-100 rounded-lg p-4 h-[200px] flex items-center justify-center">
                <div className="text-slate-500 text-sm">Loading map...</div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {label && <p className="text-xs font-medium text-slate-700">{label}</p>}
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={center}
                zoom={15}
                options={{
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                    zoomControl: true,
                    draggable: true,
                }}
            >
                <Marker position={center} />
            </GoogleMap>
            {showNavigation && (
                <div className="flex gap-2">
                    <button
                        onClick={openLocation}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                        type="button"
                    >
                        📍 Open in Maps
                    </button>
                    <button
                        onClick={openInGoogleMaps}
                        className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700"
                        type="button"
                    >
                        🧭 Get Directions
                    </button>
                </div>
            )}
        </div>
    );
}

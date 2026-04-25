import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";

interface DeliveryLocationSharingProps {
  orderId: string;
  onLocationUpdate?: (lat: number, lng: number) => void;
}

export function DeliveryLocationSharing({ orderId, onLocationUpdate }: DeliveryLocationSharingProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const startSharing = async () => {
    setIsLoading(true);
    try {
      if (!navigator.geolocation) {
        toast.error("Geolocation is not supported by your browser");
        return;
      }

      // Get current position first
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          onLocationUpdate?.(latitude, longitude);
          sendLocationToServer(latitude, longitude);
          
          // Start watching position
          watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              const { latitude: lat, longitude: lng } = pos.coords;
              setCurrentLocation({ lat, lng });
              onLocationUpdate?.(lat, lng);
              sendLocationToServer(lat, lng);
            },
            (error) => {
              console.error("Error watching position:", error);
              toast.error("Failed to track location");
              stopSharing();
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
          
          setIsSharing(true);
          toast.success("Location sharing started");
        },
        (error) => {
          console.error("Geolocation error:", error);
          toast.error("Could not get your location");
        }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const stopSharing = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsSharing(false);
    setCurrentLocation(null);
    toast.success("Location sharing stopped");
  };

  const sendLocationToServer = async (lat: number, lng: number) => {
    try {
      // This would call an API endpoint to update tracking
      // For now, we'll just log it
      console.log(`Updating location for order ${orderId}: ${lat}, ${lng}`);
    } catch (error) {
      console.error("Failed to send location:", error);
    }
  };

  return (
    <div className="p-4 bg-card border rounded-lg space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Live Location Sharing
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Share your location with customer and admin
          </p>
        </div>
        {isSharing && <Badge className="bg-green-100 text-green-700">Active</Badge>}
      </div>

      {currentLocation && (
        <div className="text-xs bg-muted p-2 rounded">
          <p className="text-muted-foreground">
            📍 Lat: {currentLocation.lat.toFixed(6)}, Lng: {currentLocation.lng.toFixed(6)}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        {!isSharing ? (
          <Button 
            size="sm" 
            onClick={startSharing} 
            disabled={isLoading}
            className="gap-1"
          >
            <Navigation className="w-3 h-3" />
            {isLoading ? "Starting..." : "Start Sharing Location"}
          </Button>
        ) : (
          <Button 
            size="sm" 
            variant="destructive"
            onClick={stopSharing}
          >
            Stop Sharing
          </Button>
        )}
      </div>
    </div>
  );
}

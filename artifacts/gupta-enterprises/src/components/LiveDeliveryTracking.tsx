import { useEffect, useState } from "react";
import { MapPin, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DeliveryAgentLocation {
  agentId: string;
  agentName?: string;
  currentLat: number;
  currentLng: number;
  destinationLat?: number;
  destinationLng?: number;
  estimatedMinutes?: number;
  distance?: number; // in km
  status: string;
}

interface LiveDeliveryTrackingProps {
  orderId: string;
  location?: DeliveryAgentLocation;
  isLoading?: boolean;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function LiveDeliveryTracking({ location, isLoading }: LiveDeliveryTrackingProps) {
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  useEffect(() => {
    if (location?.destinationLat && location?.destinationLng) {
      const dist = calculateDistance(
        location.currentLat,
        location.currentLng,
        location.destinationLat,
        location.destinationLng
      );
      setDistanceKm(dist);
      // Estimate 30 km/h average speed
      setEstimatedTime(Math.ceil((dist / 30) * 60));
    }
  }, [location]);

  if (isLoading) {
    return (
      <div className="p-4 bg-card border rounded-lg space-y-3">
        <p className="text-sm text-muted-foreground">Loading delivery location...</p>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="p-4 bg-card border rounded-lg space-y-3 text-center">
        <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">Delivery agent location not yet available</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-card border rounded-lg space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500" />
            Live Delivery Tracking
          </h3>
          {location.agentName && (
            <p className="text-xs text-muted-foreground mt-1">Agent: {location.agentName}</p>
          )}
        </div>
        <Badge variant="secondary" className="bg-green-100 text-green-700">
          Live
        </Badge>
      </div>

      {/* Location Details */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between p-2 bg-muted rounded">
          <span className="text-muted-foreground">Current Location</span>
          <span className="font-mono text-xs">
            {location.currentLat.toFixed(4)}°, {location.currentLng.toFixed(4)}°
          </span>
        </div>

        {distanceKm !== null && (
          <div className="flex items-center justify-between p-2 bg-muted rounded">
            <span className="text-muted-foreground">Distance Away</span>
            <span className="font-medium">{distanceKm.toFixed(1)} km</span>
          </div>
        )}

        {estimatedTime !== null && (
          <div className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="w-4 h-4 text-blue-500" />
              Estimated Arrival
            </span>
            <span className="font-medium text-blue-700">
              {estimatedTime <= 1 ? "< 1 min" : `${estimatedTime} min`}
            </span>
          </div>
        )}
      </div>

      {/* Open in Maps */}
      <a
        href={`https://maps.google.com/?q=${location.currentLat},${location.currentLng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full p-2 text-center text-sm font-medium text-primary hover:underline"
      >
        📍 View on Google Maps
      </a>
    </div>
  );
}

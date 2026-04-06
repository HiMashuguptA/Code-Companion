export const SHOP_CONFIG = {
  name: "Gupta Enterprises",
  ownerName: "Ashutosh Gupta",
  address: "Khedi Market, New NST, opposite Hotel Galaxy, Kohima, Nagaland 797001",
  city: "Kohima",
  state: "Nagaland",
  pincode: "797001",
  phone: "7905529544",
  email: "sg707012@gmail.com",
  since: 2012,
  lat: 25.6708,
  lng: 94.1086,
  deliveryRadiusKm: 15,
  openHours: "Mon–Sat, 9 AM – 8 PM",
} as const;

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinDeliveryRange(lat: number, lng: number): boolean {
  const dist = haversineDistanceKm(SHOP_CONFIG.lat, SHOP_CONFIG.lng, lat, lng);
  return dist <= SHOP_CONFIG.deliveryRadiusKm;
}

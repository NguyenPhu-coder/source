import { MapPin } from "lucide-react";

// Simple demo map using iframe (no API key needed)
export default function SimpleMap({
  center = { lat: 10.8231, lng: 106.6297 }, // TP.HCM mặc định
  zoom = 15,
}) {
  // Tạo Google Maps embed URL (không cần API key)
  const mapUrl = `https://www.google.com/maps?q=${center.lat},${center.lng}&z=${zoom}&output=embed`;

  return (
    <div className="rounded-lg overflow-hidden shadow-sm border border-gray-200">
      <iframe
        title="Google Map"
        width="100%"
        height="300"
        frameBorder="0"
        style={{ border: 0 }}
        src={mapUrl}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}

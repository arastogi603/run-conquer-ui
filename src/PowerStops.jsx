import React from "react";
import { CircleMarker, Tooltip } from "react-leaflet";

/* ===============================
   POWER-UP STOP TYPES
=============================== */

export const STOP_TYPES = [
  { id: "speed",    emoji: "⚡", label: "SPEED BOOST",    color: "#ffee00", glowColor: "rgba(255,238,0,0.4)" },
  { id: "shield",   emoji: "🛡️", label: "SHIELD",         color: "#00ff88", glowColor: "rgba(0,255,136,0.4)" },
  { id: "double",   emoji: "💥", label: "DOUBLE CAPTURE", color: "#ff6600", glowColor: "rgba(255,102,0,0.4)" },
  { id: "expand",   emoji: "📐", label: "EXPAND",         color: "#cc44ff", glowColor: "rgba(204,68,255,0.4)" },
  { id: "xp",       emoji: "⭐", label: "XP BONUS",       color: "#00ccff", glowColor: "rgba(0,204,255,0.4)" },
];

/* ===============================
   GENERATE STOPS FOR A GRID CELL
=============================== */

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate stops for a specific ~1km grid cell
export function generateStopsForCell(cellLat, cellLng, count = 4) {
  const stops = [];
  const baseSeed = Math.floor(cellLat * 100) * 10000 + Math.floor(cellLng * 100);

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + seededRandom(baseSeed + i) * 0.8;
    // Spread them across the ~1km cell
    const distance = 0.0010 + seededRandom(baseSeed + i + 100) * 0.0040; 
    const lat = cellLat + Math.sin(angle) * distance;
    const lng = cellLng + Math.cos(angle) * distance;
    const typeIdx = Math.floor(seededRandom(baseSeed + i + 200) * STOP_TYPES.length);

    stops.push({
      id: `stop-${cellLat}-${cellLng}-${i}`,
      lat,
      lng,
      type: STOP_TYPES[typeIdx],
      cooldownUntil: 0, 
      collected: false,
    });
  }

  return stops;
}

// Determine which grid cell a coordinate is in (approx 1km cells)
export function getGridCell(lat, lng) {
  return {
    cellLat: Math.floor(lat * 100) / 100,
    cellLng: Math.floor(lng * 100) / 100
  };
}

/* ===============================
   DISTANCE HELPER
=============================== */

export function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ===============================
   COMPONENT
=============================== */

export default function PowerStops({ stops, userPos, onCollect }) {
  const now = Date.now();

  return (
    <>
      {stops.map((stop) => {
        const onCooldown = now < stop.cooldownUntil;
        const isAvailable = !onCooldown;
        const inRange = userPos
          ? getDistanceMeters(userPos[0], userPos[1], stop.lat, stop.lng) < 25
          : false;

        return (
          <React.Fragment key={stop.id}>
            {/* Outer pulse ring (available only) */}
            {isAvailable && (
              <CircleMarker
                center={[stop.lat, stop.lng]}
                radius={18}
                pathOptions={{
                  color: stop.type.color,
                  fillColor: "transparent",
                  fillOpacity: 0,
                  weight: 2,
                  opacity: 0.4,
                  dashArray: "4 4",
                  className: "stop-pulse",
                }}
              />
            )}

            {/* Main stop marker */}
            <CircleMarker
              center={[stop.lat, stop.lng]}
              radius={isAvailable ? 10 : 6}
              pathOptions={{
                color: isAvailable ? stop.type.color : "#555",
                fillColor: isAvailable ? stop.type.color : "#333",
                fillOpacity: isAvailable ? 0.7 : 0.3,
                weight: isAvailable ? 2 : 1,
                opacity: isAvailable ? 1 : 0.4,
              }}
            >
              <Tooltip
                permanent
                direction="top"
                offset={[0, -12]}
                className={`stop-tooltip ${isAvailable ? "" : "stop-cooldown"}`}
              >
                <span style={{
                  fontSize: isAvailable ? "14px" : "10px",
                  filter: isAvailable ? "none" : "grayscale(1) opacity(0.4)",
                }}>
                  {stop.type.emoji}
                </span>
              </Tooltip>
            </CircleMarker>

            {/* In-range highlight */}
            {isAvailable && inRange && (
              <CircleMarker
                center={[stop.lat, stop.lng]}
                radius={24}
                pathOptions={{
                  color: stop.type.color,
                  fillColor: stop.type.color,
                  fillOpacity: 0.15,
                  weight: 3,
                  opacity: 0.8,
                  className: "stop-in-range",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

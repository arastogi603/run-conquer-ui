import React, { useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polygon,
  Tooltip,
  useMap
} from "react-leaflet";

import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import NeonTrailLayer from "./NeonTrailLayer";
import PowerStops, { generateStopsForCell, getGridCell, getDistanceMeters, STOP_TYPES } from "./PowerStops";

import "leaflet/dist/leaflet.css";
import "./App.css";

const SIMULATION_MODE = false;
// redeploy fix

/* ===============================
MAP CENTER CONTROLLER
=============================== */

function MapController({ center }) {

  const map = useMap();

  useEffect(() => {
    if (center) map.setView(center);
  }, [center]);

  return null;
}

/* ===============================
EXPLORER PAGE
=============================== */

function ExplorerPage({
  userPos,
  trails,
  territories,
  players,
  userId,
  distance,
  speed,
  resetSession,
  wsStatus,
  powerStops,
  inventory,
  quests,
  activeEffects,
  onCollectStop,
  onUseItem,
  toasts,
  questPanelOpen,
  setQuestPanelOpen,
  showSpeedWarning
}) {

  const territoryCount = (territories[userId] || []).length;

  return (

    <div className="game-container">

      <div className="hud-panel">

        <div className="hud-title">RUN & CONQUER</div>

        <div className="hud-stats">

          <div className="stat-card">
            <div className="stat-label">DISTANCE</div>
            <div className="stat-value">{(distance / 1000).toFixed(2)}<span className="stat-unit"> KM</span></div>
          </div>

          <div className="stat-card">
            <div className="stat-label">SPEED</div>
            <div className="stat-value">{speed.toFixed(1)}<span className="stat-unit"> KM/H</span></div>
          </div>

          <div className="stat-card">
            <div className="stat-label">CALORIES</div>
            <div className="stat-value">{((distance / 1000) * 72.5).toFixed(0)}<span className="stat-unit"> KCAL</span></div>
          </div>

        </div>

        <button className="reset-btn" onClick={resetSession}>
          ⟳ RESET
        </button>

        <div className="ws-status" style={{
          fontSize: '10px',
          padding: '3px 8px',
          borderRadius: '8px',
          marginTop: '4px',
          background: wsStatus === 'connected' ? 'rgba(0,255,100,0.2)' : 'rgba(255,60,60,0.2)',
          color: wsStatus === 'connected' ? '#00ff64' : '#ff3c3c',
          textAlign: 'center',
          fontFamily: 'Orbitron, monospace',
          letterSpacing: '1px'
        }}>
          {wsStatus === 'connected' ? '● LIVE' : wsStatus === 'connecting' ? '◌ CONNECTING...' : '✕ OFFLINE'}
          {' · '}
          {Object.keys(players).filter(id => String(id) !== String(userId)).length} ENEMIES
        </div>

      </div>

      {/* QUEST PANEL - LEFT SIDE */}
      <div className={`quest-panel ${questPanelOpen ? 'open' : ''}`}>
        <button className="quest-toggle" onClick={() => setQuestPanelOpen(!questPanelOpen)}>
          {questPanelOpen ? '✕' : '📜'}
        </button>
        {questPanelOpen && (
          <div className="quest-list">
            <div className="quest-panel-title">QUESTS</div>
            {quests.map((q, i) => (
              <div key={i} className={`quest-item ${q.completed ? 'quest-done' : ''}`}>
                <div className="quest-header">
                  <span className="quest-emoji">{q.emoji}</span>
                  <span className="quest-name">{q.name}</span>
                </div>
                <div className="quest-desc">{q.description}</div>
                <div className="quest-progress-bar">
                  <div
                    className="quest-progress-fill"
                    style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }}
                  />
                </div>
                <div className="quest-progress-text">
                  {q.completed ? '✅ COMPLETE' : `${Math.floor(q.progress)} / ${q.target}`}
                </div>
                {q.completed && !q.claimed && (
                  <div className="quest-reward">🎁 {q.rewardEmoji} {q.rewardLabel}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* INVENTORY BAR - BOTTOM LEFT */}
      <div className="inventory-bar">
        {STOP_TYPES.map(type => {
          const count = inventory[type.id] || 0;
          const isActive = activeEffects[type.id] > Date.now();
          return (
            <button
              key={type.id}
              className={`inv-item ${count > 0 ? 'inv-has' : ''} ${isActive ? 'inv-active' : ''}`}
              title={`${type.label}${count > 0 ? ' (tap to use)' : ''}`}
              onClick={() => count > 0 && onUseItem(type.id)}
              disabled={count === 0 || isActive}
            >
              <span className="inv-emoji">{type.emoji}</span>
              <span className="inv-count">{count}</span>
              {isActive && <span className="inv-active-dot" />}
            </button>
          );
        })}
      </div>

      {/* SPEED WARNING POPUP */}
      {showSpeedWarning && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex',
          justifyContent: 'center', alignItems: 'center', flexDirection: 'column'
        }}>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>🚗</div>
          <h2 style={{ color: '#ff3c3c', fontFamily: 'Orbitron, monospace', textAlign: 'center' }}>TOO FAST!</h2>
          <p style={{ color: 'white', opacity: 0.8, textAlign: 'center', padding: '0 20px', fontFamily: 'Inter, sans-serif' }}>
            Are you in a vehicle? Trail recording has been paused.
          </p>
          <p style={{ color: 'white', opacity: 0.5, fontSize: '12px', marginTop: '10px' }}>
            Slow down below 20 km/h to resume.
          </p>
        </div>
      )}

      {/* TOAST NOTIFICATIONS */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>

      <MapContainer
        center={userPos || [28.6139, 77.209]}
        zoom={17}
        className="map-view"
        zoomControl={false}
      >

        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

        <MapController center={userPos} />

        {/* CANVAS NEON TRAILS & TERRITORIES */}
        <NeonTrailLayer trails={trails} territories={territories} />

        {/* POWER-UP STOPS */}
        <PowerStops stops={powerStops} userPos={userPos} onCollect={onCollectStop} />

        {/* PLAYER DOT */}
        {userPos && (
          <CircleMarker
            center={userPos}
            radius={activeEffects.expand > Date.now() ? 14 : 8}
            pathOptions={{
              color: "#ffffff",
              fillColor: activeEffects.speed > Date.now() ? "#ffee00" : "#00f3ff",
              fillOpacity: 1
            }}
          >
            <Tooltip permanent direction="top" className="player-label" offset={[0, -10]}>
              🟦 YOU
            </Tooltip>
          </CircleMarker>
        )}

        {/* ENEMY DOTS */}
        {Object.values(players)
          .filter(p => p.userId !== userId && p.latitude && p.longitude)
          .map(p => (
            <CircleMarker
              key={p.userId}
              center={[p.latitude, p.longitude]}
              radius={7}
              pathOptions={{
                color: "#ffffff",
                fillColor: "#ff0055",
                fillOpacity: 1
              }}
            >
              <Tooltip permanent direction="top" className="player-label" offset={[0, -10]}>
                🟥 Player #{String(p.userId).slice(-4)}
              </Tooltip>
            </CircleMarker>
          ))}

      </MapContainer>

      {/* MINIMAP - Bottom Right */}
      <Link to="/world" className="minimap-container" title="Open World View">
        <div className="minimap-label">🌍 WORLD</div>
        <MapContainer
          center={userPos || [28.6139, 77.209]}
          zoom={13}
          className="minimap"
          zoomControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <MapController center={userPos} />

          {userPos && (
            <CircleMarker
              center={userPos}
              radius={4}
              pathOptions={{ color: "#00f3ff", fillColor: "#00f3ff", fillOpacity: 1 }}
            />
          )}

          {Object.values(players)
            .filter(p => p.userId !== userId && p.latitude && p.longitude)
            .map(p => (
              <CircleMarker
                key={`mini-${p.userId}`}
                center={[p.latitude, p.longitude]}
                radius={3}
                pathOptions={{ color: "#ff0055", fillColor: "#ff0055", fillOpacity: 1 }}
              />
            ))}
        </MapContainer>
      </Link>

    </div>
  );
}

/* ===============================
WORLD VIEW
=============================== */

function WorldViewPage({ territories, userId }) {

  return (

    <div className="game-container">

      <div className="hud-header">WORLD VIEW</div>

      <MapContainer
        center={[28.6139, 77.209]}
        zoom={14}
        className="map-view"
      >

        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

        {Object.entries(territories).map(([ownerId, polygonList]) => {
          if (!Array.isArray(polygonList)) return null;
          const isMe = String(ownerId) === String(userId);
          const color = isMe ? "#00f3ff" : "#ff0055";

          return polygonList.map((poly, idx) => {
            if (!poly || poly.length < 3) return null;
            return (
              <Polygon
                key={`world-${ownerId}-${idx}`}
                positions={poly}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 0.35,
                  weight: 2,
                  opacity: 0.8
                }}
              >
                <Tooltip sticky className="territory-tooltip">
                  <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '11px', fontWeight: 600 }}>
                    {isMe ? '🟦 YOU' : `🟥 Player #${ownerId}`}
                  </span>
                </Tooltip>
              </Polygon>
            );
          });
        })}

      </MapContainer>

      <Link to="/" className="back-btn">
        ← STREET VIEW
      </Link>

    </div>
  );
}

/* ===============================
MAIN APP
=============================== */

export default function App() {

  const [userPos, setUserPos] = useState(null);
  const [trails, setTrails] = useState({});
  const [territories, setTerritories] = useState({});
  const [players, setPlayers] = useState({});
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [wsStatus, setWsStatus] = useState('connecting');

  // Power-up stops & quests
  const [powerStops, setPowerStops] = useState([]);
  const [visitedCells, setVisitedCells] = useState(new Set()); // Track ~1km grid cells we've spawned stops in
  const [inventory, setInventory] = useState({ speed: 0, shield: 0, double: 0, expand: 0, xp: 0 });
  const [activeEffects, setActiveEffects] = useState({ speed: 0, shield: 0, double: 0, expand: 0 });
  const [quests, setQuests] = useState([
    { name: "Trail Blazer", emoji: "🏃", description: "Walk 500m", target: 500, progress: 0, completed: false, claimed: false, rewardType: "speed", rewardEmoji: "⚡", rewardLabel: "Speed Boost" },
    { name: "Conqueror", emoji: "🏴", description: "Capture 2 territories", target: 2, progress: 0, completed: false, claimed: false, rewardType: "shield", rewardEmoji: "🛡️", rewardLabel: "Shield" },
    { name: "Explorer", emoji: "📍", description: "Visit 3 power-up stops", target: 3, progress: 0, completed: false, claimed: false, rewardType: "double", rewardEmoji: "💥", rewardLabel: "Double Capture" },
  ]);
  const [toasts, setToasts] = useState([]);
  const [questPanelOpen, setQuestPanelOpen] = useState(false);
  const [showSpeedWarning, setShowSpeedWarning] = useState(false);
  const stopsGenerated = useRef(false);

  const stompClient = useRef(null);
  const userId = useRef((() => {
    let id = localStorage.getItem('runconquer_userId');
    if (!id) {
      id = String(Math.floor(Math.random() * 100000));
      localStorage.setItem('runconquer_userId', id);
    }
    return Number(id);
  })()).current;
  window.localPlayerId = userId;

  const lastPos = useRef(null);
  const lastGpsTime = useRef(null);
  const speedFilter = useRef(0);

  // Deduce API URL from the WS URL (remove /ws and change protocol)
  const apiUrl = import.meta.env.VITE_API_URL;

  // Helper to fetch territories from DB
  const fetchTerritories = useCallback(() => {
    fetch(`${apiUrl}/api/territories/all`)
      .then(res => res.json())
      .then(data => {
        const loadedTerritories = {};
        data.forEach(t => {
          if (!loadedTerritories[t.ownerId]) {
            loadedTerritories[t.ownerId] = [];
          }
          if (t.boundary && t.boundary.length >= 3) {
            loadedTerritories[t.ownerId].push(t.boundary);
          }
        });
        setTerritories(loadedTerritories);
      })
      .catch(err => console.error("Failed to fetch historical territories DB:", err));
  }, [apiUrl]);

  // Load existing territories from the Database on mount
  useEffect(() => {
    fetchTerritories();
  }, [fetchTerritories]);

  // Load existing player inventory & effects from DB on mount
  useEffect(() => {
    fetch(`${apiUrl}/api/player/${userId}`)
      .then(res => res.json())
      .then(data => {
        setInventory({ speed: data.speedCount, shield: data.shieldCount, double: data.doubleCount, expand: data.expandCount, xp: data.xpCount });
        setActiveEffects({ speed: data.speedEndTime, shield: data.shieldEndTime, double: data.doubleEndTime, expand: data.expandEndTime });
      })
      .catch(err => console.error("Failed to fetch historical player state:", err));
  }, [userId]);

  /* ===============================
GEOMETRY & INTERSECTION
=============================== */

  function ccw(A, B, C) {
    return (C[lngIdx] - A[lngIdx]) * (B[latIdx] - A[latIdx]) > (B[lngIdx] - A[lngIdx]) * (C[latIdx] - A[latIdx]);
  }

  const latIdx = 0, lngIdx = 1;

  function lineIntersect(A, B, C, D) {
    return ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);
  }

  function checkIntersectionAndCapture(playerId, newPoint, currentPath) {
    if (currentPath.length < 3) return null;

    const C = currentPath[currentPath.length - 1];
    const D = newPoint;

    // Require at least a gap of 3 points to prevent the moving tip
    // from intersecting its own immediate recent history on sharp curves
    for (let i = 0; i < currentPath.length - 3; i++) {
      const A = currentPath[i];
      const B = currentPath[i + 1];

      if (lineIntersect(A, B, C, D)) {
        return i; // Index where loop closed
      }
    }
    return null;
  }

  /* Point-in-polygon using ray casting algorithm */
  function pointInPolygon(point, polygon) {
    if (!polygon || polygon.length < 3) return false;
    const [px, py] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  /* Compute centroid (average of all vertices) */
  function polygonCentroid(polygon) {
    if (!polygon || polygon.length === 0) return null;
    let sumLat = 0, sumLng = 0;
    for (const pt of polygon) {
      sumLat += pt[0];
      sumLng += pt[1];
    }
    return [sumLat / polygon.length, sumLng / polygon.length];
  }

  /* Check if two polygons have ANY geometric overlap */
  function polygonsOverlap(polyA, polyB) {
    if (!polyA || polyA.length < 3 || !polyB || polyB.length < 3) return false;

    // Check if ANY vertex of polyA is inside polyB
    for (const pt of polyA) {
      if (pointInPolygon(pt, polyB)) return true;
    }

    // Check if ANY vertex of polyB is inside polyA
    for (const pt of polyB) {
      if (pointInPolygon(pt, polyA)) return true;
    }

    // Check if ANY edges cross each other
    for (let i = 0; i < polyA.length; i++) {
      const a1 = polyA[i];
      const a2 = polyA[(i + 1) % polyA.length];
      for (let j = 0; j < polyB.length; j++) {
        const b1 = polyB[j];
        const b2 = polyB[(j + 1) % polyB.length];
        if (lineIntersect(a1, a2, b1, b2)) return true;
      }
    }

    return false;
  }

  /* Check if the new loop overlaps any enemy territories and transfer them */
  function captureOverlappingEnemyTerritories(capturingUserId, newLoop, currentTerritories) {
    const updatedTerritories = {};
    const captured = [];

    Object.entries(currentTerritories).forEach(([ownerId, polygonList]) => {
      if (String(ownerId) === String(capturingUserId)) {
        // Don't check own territories
        updatedTerritories[ownerId] = polygonList;
        return;
      }

      if (!Array.isArray(polygonList)) {
        updatedTerritories[ownerId] = polygonList;
        return;
      }

      const remaining = [];
      polygonList.forEach(poly => {
        if (!poly || poly.length < 3) {
          remaining.push(poly);
          return;
        }
        if (polygonsOverlap(newLoop, poly)) {
          // Any overlap detected - STEAL this enemy territory!
          captured.push(poly);
        } else {
          remaining.push(poly);
        }
      });

      updatedTerritories[ownerId] = remaining;
    });

    return { captured, updatedTerritories };
  }

  /* ===============================
WEBSOCKET
=============================== */

  useEffect(() => {

    // In production, use SockJS (works through proxies/load balancers)
    // In dev, use native WebSocket (faster, no overhead)
    const wsUrl = import.meta.env.VITE_WS_URL;

console.log("[WS] Using SockJS URL:", wsUrl);

const stomp = new Client({
  webSocketFactory: () => new SockJS(wsUrl),

  reconnectDelay: 3000,

  heartbeatIncoming: 10000,
  heartbeatOutgoing: 10000,

  debug: (str) => console.log("[STOMP]", str),
});

    stomp.onStompError = (frame) => {
      console.error("[WS] STOMP error:", frame.headers?.message, frame.body);
    };

    stomp.onWebSocketClose = (evt) => {
      console.warn("[WS] WebSocket closed:", evt?.reason || "no reason", "code:", evt?.code);
      setWsStatus('disconnected');
    };

    stomp.onDisconnect = () => {
      console.warn("[WS] STOMP disconnected — will reconnect in 3s");
    };

    stomp.onConnect = () => {

      console.log("[WS] ✅ Connected! userId:", userId);
      setWsStatus('connected');

      // Listen for global map refreshes (e.g. someone stole territories)
      stomp.subscribe("/topic/territories/refresh", () => {
        console.log("[WS] Another player captured territory — Refreshing map...");
        fetchTerritories();
      });

      stomp.subscribe("/topic/move", msg => {

        let p;

        try {
          p = JSON.parse(msg.body);
        } catch {
          return;
        }

        if (!p || !p.userId) return;
        if (!p.latitude || !p.longitude) return;

        // Ignore local player from websocket to avoid trail echoing/zigzag
        if (p.userId === userId) return;

        setPlayers(prev => ({ ...prev, [p.userId]: { ...p, lastSeen: Date.now() } }));

        setTrails(prevTrails => {

          const currentTrail = prevTrails[p.userId] || [];

          const lastPoint = currentTrail[currentTrail.length - 1];

          const newPoint = [p.latitude, p.longitude];

          if (lastPoint) {
            const dist = Math.sqrt(
              Math.pow(lastPoint[0] - newPoint[0], 2) +
              Math.pow(lastPoint[1] - newPoint[1], 2)
            );

            if (dist < 0.00015) {
              return prevTrails; // Ignore micro-movements to save Canvas CPU load
            }
          }

          const updatedTrails = { ...prevTrails };

          const intersectIdx = checkIntersectionAndCapture(p.userId, newPoint, currentTrail);

          if (intersectIdx !== null) {

            const loop = currentTrail.slice(intersectIdx);
            loop.push(newPoint);

            setTerritories(prevTerr => {
              const { captured, updatedTerritories } = captureOverlappingEnemyTerritories(p.userId, loop, prevTerr);
              const myExisting = updatedTerritories[p.userId] || prevTerr[p.userId] || [];
              return { ...updatedTerritories, [p.userId]: [...myExisting, loop, ...captured] };
            });

            updatedTrails[p.userId] = [...currentTrail.slice(0, intersectIdx + 1), newPoint];

          } else {
            const nextTrail = [...currentTrail, newPoint];

            if (nextTrail.length > 300)
              nextTrail.shift();

            // Check if the enemy trail point is inside any of our territories - they steal it!
            setTerritories(prevTerr => {
              let changed = false;
              const updated = {};
              Object.entries(prevTerr).forEach(([ownerId, polygonList]) => {
                if (String(ownerId) === String(p.userId)) {
                  updated[ownerId] = polygonList;
                  return;
                }
                if (!Array.isArray(polygonList)) {
                  updated[ownerId] = polygonList;
                  return;
                }
                const remaining = [];
                const stolen = [];
                polygonList.forEach(poly => {
                  if (poly && poly.length >= 3 && pointInPolygon(newPoint, poly)) {
                    stolen.push(poly);
                    changed = true;
                  } else {
                    remaining.push(poly);
                  }
                });
                updated[ownerId] = remaining;
                if (stolen.length > 0) {
                  const myExisting = updated[p.userId] || prevTerr[p.userId] || [];
                  updated[p.userId] = [...myExisting, ...stolen];
                }
              });
              return changed ? updated : prevTerr;
            });

            updatedTrails[p.userId] = nextTrail;
          }

          return updatedTrails;

        });

      });

    };

    stomp.activate();
    stompClient.current = stomp;

    return () => stomp.deactivate();

  }, [userId, fetchTerritories]);

  /* ===============================
PLAYER CLEANUP — Remove stale players
=============================== */

  useEffect(() => {
    const cleanup = setInterval(() => {
      setPlayers(prev => {
        const now = Date.now();
        const active = {};
        let changed = false;
        Object.entries(prev).forEach(([id, p]) => {
          if (now - (p.lastSeen || 0) < 10000) {
            active[id] = p;
          } else {
            changed = true;
          }
        });
        return changed ? active : prev;
      });
    }, 5000);

    return () => clearInterval(cleanup);
  }, []);

  /* ===============================
PLAYER MOVEMENT
=============================== */

  useEffect(() => {

    if (SIMULATION_MODE) {

      // Start all players at the exact same point for collision testing
      let lat = 28.6139;
      let lng = 77.209;
      let heading = Math.random() * Math.PI * 2; // Different heading per tab = different direction
      let tick = 0;

      let lastRecordedPos = [lat, lng];

      const interval = setInterval(() => {

        tick++;
        // Tight consistent circles that close quickly and overlap enemy territory
        const turnRate = 0.18;
        heading += turnRate;

        const speed = 0.00006;
        lat += Math.sin(heading) * speed;
        lng += Math.cos(heading) * speed;

        const pos = [lat, lng];

        setUserPos(pos);

        // distance calculation to prevent state bloat on 50ms ticks
        const dist = Math.sqrt(
          Math.pow(pos[0] - lastRecordedPos[0], 2) +
          Math.pow(pos[1] - lastRecordedPos[1], 2)
        );

        if (dist > 0.00015) {
          // Speed calculation: dist in degrees, convert to km/h
          // 1 degree lat ≈ 111km, interval is 50ms 
          const distKm = dist * 111;
          const timeHrs = 0.05 / 3600; // 50ms in hours
          setSpeed(distKm / timeHrs);

          lastRecordedPos = pos;

          setTrails(prev => {

            const path = prev[userId] || [];

            const last = path[path.length - 1];

            if (
              last &&
              last[0] === pos[0] &&
              last[1] === pos[1]
            ) return prev;

            const intersectIdx = checkIntersectionAndCapture(userId, pos, path);

            if (intersectIdx !== null) {

              const loop = path.slice(intersectIdx);
              loop.push(pos);

              setTerritories(prevTerr => {
                const { captured, updatedTerritories } = captureOverlappingEnemyTerritories(userId, loop, prevTerr);
                const myExisting = updatedTerritories[userId] || prevTerr[userId] || [];
                return { ...updatedTerritories, [userId]: [...myExisting, loop, ...captured] };
              });

              // --- SAVE NEW TERRITORY TO DB ---
              fetch(`${apiUrl}/api/territories/polygon`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, polygon: loop })
              }).catch(err => console.error("[DB] Failed to save territory:", err));

              return {
                ...prev,
                [userId]: [...path.slice(0, intersectIdx + 1), pos]
              };
            }

            const next = [...path, pos];

            if (next.length > 400)
              next.shift();

            // Check if the trail point is inside any enemy territory - steal it!
            setTerritories(prevTerr => {
              let changed = false;
              const updated = {};
              Object.entries(prevTerr).forEach(([ownerId, polygonList]) => {
                if (String(ownerId) === String(userId)) {
                  updated[ownerId] = polygonList;
                  return;
                }
                if (!Array.isArray(polygonList)) {
                  updated[ownerId] = polygonList;
                  return;
                }
                const remaining = [];
                const stolen = [];
                polygonList.forEach(poly => {
                  if (poly && poly.length >= 3 && pointInPolygon(pos, poly)) {
                    stolen.push(poly);
                    changed = true;
                  } else {
                    remaining.push(poly);
                  }
                });
                updated[ownerId] = remaining;
                if (stolen.length > 0) {
                  const myExisting = updated[userId] || prevTerr[userId] || [];
                  updated[userId] = [...myExisting, ...stolen];
                }
              });
              return changed ? updated : prevTerr;
            });

            return {
              ...prev,
              [userId]: next
            };

          });

          setDistance(d => d + 3);
        }

        // Broadcast current location every 50ms (20fps) for smooth real-time enemy movement
        if (stompClient.current?.connected) {
          stompClient.current.publish({
            destination: "/app/move",
            body: JSON.stringify({
              userId,
              latitude: lat,
              longitude: lng
            })
          });
        }

      }, 50);

      return () => clearInterval(interval);

    } else {

      // REAL GPS MODE
      let lastGpsPos = null;

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const pos = [lat, lng];

          setUserPos(pos);

          if (!lastGpsPos) {
            lastGpsPos = pos;
            // Publish initial position immediately so other players can see us
            if (stompClient.current?.connected) {
              stompClient.current.publish({
                destination: "/app/move",
                body: JSON.stringify({ userId, latitude: lat, longitude: lng })
              });
            }
            return;
          }

          const dist = Math.sqrt(
            Math.pow(pos[0] - lastGpsPos[0], 2) +
            Math.pow(pos[1] - lastGpsPos[1], 2)
          );

          if (dist > 0.00005) { // ~5.5 meters for real GPS
            const now = Date.now();
            const distMeters = getDistanceMeters(lastGpsPos[0], lastGpsPos[1], pos[0], pos[1]);
            const timeElapsedMs = lastGpsTime.current ? (now - lastGpsTime.current) : 1000;
            const timeHrs = timeElapsedMs / 3600000;
            const distKm = distMeters / 1000;
            
            const rawSpeed = distKm / timeHrs;
            
            // Simple Exponential Moving Average (EMA) to smooth out GPS jitter
            // alpha = 0.3 (lower is smoother but slower to react)
            const alpha = 0.3;
            const smoothedSpeed = lastGpsTime.current 
              ? (alpha * rawSpeed + (1 - alpha) * speedFilter.current)
              : rawSpeed;
            
            speedFilter.current = smoothedSpeed;
            setSpeed(smoothedSpeed);
            lastGpsTime.current = now;
            lastGpsPos = pos;

            // Speed Limit Check: Stop recording if moving faster than 20 km/h (running pace)
            if (smoothedSpeed > 20) {
              setShowSpeedWarning(true);
              return;
            } else {
              setShowSpeedWarning(false);
            }

            setTrails(prev => {
              const path = prev[userId] || [];
              const last = path[path.length - 1];

              if (last && last[0] === pos[0] && last[1] === pos[1]) return prev;

              const intersectIdx = checkIntersectionAndCapture(userId, pos, path);

              if (intersectIdx !== null) {
                const loop = path.slice(intersectIdx);
                loop.push(pos);

                setTerritories(prevTerr => {
                  const { captured, updatedTerritories } = captureOverlappingEnemyTerritories(userId, loop, prevTerr);
                  const myExisting = updatedTerritories[userId] || prevTerr[userId] || [];
                  return { ...updatedTerritories, [userId]: [...myExisting, loop, ...captured] };
                });

                // --- SAVE NEW TERRITORY TO DB ---
                fetch(`${apiUrl}/api/territories/polygon`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, polygon: loop })
                }).catch(err => console.error("Failed to save territory:", err));

                return { ...prev, [userId]: [...path.slice(0, intersectIdx + 1), pos] };
              }

              const next = [...path, pos];
              if (next.length > 400) next.shift();

              // Trail-based territory stealing
              setTerritories(prevTerr => {
                let changed = false;
                const updated = {};
                Object.entries(prevTerr).forEach(([ownerId, polygonList]) => {
                  if (String(ownerId) === String(userId)) { updated[ownerId] = polygonList; return; }
                  if (!Array.isArray(polygonList)) { updated[ownerId] = polygonList; return; }
                  const remaining = [];
                  const stolen = [];
                  polygonList.forEach(poly => {
                    if (poly && poly.length >= 3 && pointInPolygon(pos, poly)) { stolen.push(poly); changed = true; }
                    else { remaining.push(poly); }
                  });
                  updated[ownerId] = remaining;
                  if (stolen.length > 0) {
                    const myExisting = updated[userId] || prevTerr[userId] || [];
                    updated[userId] = [...myExisting, ...stolen];
                  }
                });
                return changed ? updated : prevTerr;
              });

              return { ...prev, [userId]: next };
            });

            setDistance(d => d + dist * 111000); // meters

            if (stompClient.current?.connected) {
              stompClient.current.publish({
                destination: "/app/move",
                body: JSON.stringify({ userId, latitude: lat, longitude: lng })
              });
            }
          }
        },
        (err) => console.warn("GPS error:", err),
        { enableHighAccuracy: true, maximumAge: 0 }
      );

      return () => navigator.geolocation.clearWatch(watchId);

    }

  }, [userId]);

  /* ===============================
POSITION HEARTBEAT — Keep player visible to others
=============================== */

  useEffect(() => {
    // Re-broadcast current position every 3 seconds so:
    // 1. Stationary players (desktop) stay visible
    // 2. New/reconnecting clients immediately see all players
    const heartbeat = setInterval(() => {
      if (stompClient.current?.connected && userPos) {
        stompClient.current.publish({
          destination: "/app/move",
          body: JSON.stringify({
            userId,
            latitude: userPos[0],
            longitude: userPos[1]
          })
        });
      }
    }, 3000);

    return () => clearInterval(heartbeat);
  }, [userId, userPos]);

  /* ===============================
POWER-UP STOP COLLECTION
=============================== */

  const addToast = useCallback((message, type = 'collect') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // Dynamically generate stops as the player moves into new ~1km grid cells
  useEffect(() => {
    if (!userPos) return;

    const currentCell = getGridCell(userPos[0], userPos[1]);
    const cellKey = `${currentCell.cellLat},${currentCell.cellLng}`;

    // Also check neighboring 8 cells so we spawn them before we reach them
    const neighbors = [
      [0, 0], [0, 0.01], [0, -0.01],
      [0.01, 0], [0.01, 0.01], [0.01, -0.01],
      [-0.01, 0], [-0.01, 0.01], [-0.01, -0.01]
    ];

    let newStops = [];
    let updatedCells = new Set(visitedCells);
    let cellsAdded = false;

    for (const [latOffset, lngOffset] of neighbors) {
      const nLat = currentCell.cellLat + latOffset;
      const nLng = currentCell.cellLng + lngOffset;
      // Use toFixed to avoid precision issues in keys
      const nKey = `${nLat.toFixed(2)},${nLng.toFixed(2)}`;

      if (!updatedCells.has(nKey)) {
        updatedCells.add(nKey);
        cellsAdded = true;
        // Generate 4 stops per ~1km block
        newStops = [...newStops, ...generateStopsForCell(nLat, nLng, 4)];
      }
    }

    if (cellsAdded) {
      setVisitedCells(updatedCells);
      setPowerStops(prev => {
        // Keep existing stops (to preserve cooldown states), just concat new ones.
        // Optional: filter out stops that are extremely far away to save memory if needed later.
        return [...prev, ...newStops];
      });
    }

  }, [userPos]);

  // Check proximity to stops every time position updates
  useEffect(() => {
    if (!userPos || powerStops.length === 0) return;
    const now = Date.now();

    let collected = false;
    const updatedStops = powerStops.map(stop => {
      if (now < stop.cooldownUntil) return stop; // On cooldown
      const dist = getDistanceMeters(userPos[0], userPos[1], stop.lat, stop.lng);
      if (dist < 25) {
        collected = true;
        // Optimistically Add to inventory 
        setInventory(prev => ({ ...prev, [stop.type.id]: (prev[stop.type.id] || 0) + 1 }));

        // Persist collect to backend
        fetch(`${apiUrl}/api/player/${userId}/collect/${stop.type.id}`, { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            setInventory({ speed: data.speedCount, shield: data.shieldCount, double: data.doubleCount, expand: data.expandCount, xp: data.xpCount });
          })
          .catch(err => console.error("Failed to collect item on backend:", err));

        // XP bonus is instant
        if (stop.type.id === 'xp') {
          setDistance(d => d + 50);
          addToast(`⭐ +50m XP BONUS!`, 'xp');
        } else {
          addToast(`${stop.type.emoji} ${stop.type.label} collected!`, 'collect');
        }

        // Update quest: Explorer (visit stops)
        setQuests(prev => prev.map(q => {
          if (q.name === 'Explorer' && !q.completed) {
            const newProgress = q.progress + 1;
            const done = newProgress >= q.target;
            if (done) {
              addToast(`📜 Quest Complete: ${q.name}!`, 'quest');
              setInventory(inv => ({ ...inv, [q.rewardType]: (inv[q.rewardType] || 0) + 1 }));
            }
            return { ...q, progress: newProgress, completed: done, claimed: done };
          }
          return q;
        }));

        return { ...stop, cooldownUntil: now + 60000 }; // 60s cooldown
      }
      return stop;
    });

    if (collected) {
      setPowerStops(updatedStops);
    }
  }, [userPos, powerStops, addToast]);

  // Track distance quest
  useEffect(() => {
    setQuests(prev => prev.map(q => {
      if (q.name === 'Trail Blazer' && !q.completed) {
        const newProgress = distance / 1000 * 1000; // distance is in meters already
        const done = newProgress >= q.target;
        if (done && !q.completed) {
          addToast(`📜 Quest Complete: ${q.name}!`, 'quest');
          setInventory(inv => ({ ...inv, [q.rewardType]: (inv[q.rewardType] || 0) + 1 }));
        }
        return { ...q, progress: Math.min(newProgress, q.target), completed: done, claimed: done };
      }
      return q;
    }));
  }, [distance, addToast]);

  // Track territory quest
  useEffect(() => {
    const myTerritories = territories[userId] || [];
    setQuests(prev => prev.map(q => {
      if (q.name === 'Conqueror' && !q.completed) {
        const newProgress = myTerritories.length;
        const done = newProgress >= q.target;
        if (done && !q.completed) {
          addToast(`📜 Quest Complete: ${q.name}!`, 'quest');
          setInventory(inv => ({ ...inv, [q.rewardType]: (inv[q.rewardType] || 0) + 1 }));
        }
        return { ...q, progress: newProgress, completed: done, claimed: done };
      }
      return q;
    }));
  }, [territories, userId, addToast]);

  // Use a power-up item
  function useItem(typeId) {
    if (typeId === 'xp') return; // XP is instant, can't be "used"
    setInventory(prev => {
      if ((prev[typeId] || 0) <= 0) return prev;
      return { ...prev, [typeId]: prev[typeId] - 1 };
    });
    setActiveEffects(prev => ({ ...prev, [typeId]: Date.now() + 60000 })); // Optimistic 60s effect

    fetch(`${apiUrl}/api/player/${userId}/use/${typeId}`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        setInventory({ speed: data.speedCount, shield: data.shieldCount, double: data.doubleCount, expand: data.expandCount, xp: data.xpCount });
        setActiveEffects({ speed: data.speedEndTime, shield: data.shieldEndTime, double: data.doubleEndTime, expand: data.expandEndTime });
      })
      .catch(err => console.error("Failed to use item on backend:", err));

    const type = STOP_TYPES.find(t => t.id === typeId);
    addToast(`${type?.emoji} ${type?.label} activated! (60s)`, 'activate');
  }

  /* ===============================
RESET
=============================== */

  function resetSession() {

    setTrails(prev => {
      const updated = { ...prev };
      updated[userId] = [];
      return updated;
    });

    setTerritories(prev => {
      const updated = { ...prev };
      updated[userId] = [];
      return updated;
    });

    setDistance(0);

  }

  return (

    <Router>

      <Routes>

        <Route
          path="/"
          element={
            <ExplorerPage
              userPos={userPos}
              trails={trails}
              territories={territories}
              players={players}
              userId={userId}
              distance={distance}
              speed={speed}
              resetSession={resetSession}
              wsStatus={wsStatus}
              powerStops={powerStops}
              inventory={inventory}
              quests={quests}
              activeEffects={activeEffects}
              onCollectStop={() => { }}
              onUseItem={useItem}
              toasts={toasts}
              questPanelOpen={questPanelOpen}
              setQuestPanelOpen={setQuestPanelOpen}
              showSpeedWarning={showSpeedWarning}
            />
          }
        />

        <Route
          path="/world"
          element={
            <WorldViewPage
              territories={territories}
              userId={userId}
            />
          }
        />

      </Routes>

    </Router>
  );
}

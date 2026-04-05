import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ActiveCall } from '../types';

const AGENCY_COLORS: Record<string, string> = {
  RPD: '#3498db',
  RFD: '#e74c3c',
};

const STATUS_COLORS: Record<string, string> = {
  Dispatched: '#f39c12',
  Enroute: '#3498db',
  Arrived: '#2ecc71',
};

const RICHMOND_CENTER = { lat: 37.5407, lng: -77.436 };

function formatTimeAgo(timeReceived: string): { display: string; ago: string } {
  const parts = timeReceived.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)/);
  if (!parts) return { display: timeReceived, ago: '' };
  const [, month, day, year, hours, minutes] = parts.map(Number);
  const callDate = new Date(year, month - 1, day, hours, minutes);
  const diffMins = Math.round((Date.now() - callDate.getTime()) / 60000);
  const h = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const display = `${h}:${String(minutes).padStart(2, '0')} ${ampm}`;
  let ago: string;
  if (diffMins < 1) ago = 'just now';
  else if (diffMins < 60) ago = `~${diffMins} min ago`;
  else if (diffMins < 1440) ago = `~${Math.floor(diffMins / 60)}h ${diffMins % 60}m ago`;
  else ago = `~${Math.floor(diffMins / 1440)}d ago`;
  return { display, ago };
}

function loadLeaflet(): Promise<typeof import('leaflet')> {
  return new Promise((resolve, reject) => {
    if ((window as any).L) {
      resolve((window as any).L);
      return;
    }
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve((window as any).L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

interface Props {
  calls: ActiveCall[];
  userLocation: { coords: { latitude: number; longitude: number } } | null;
  focusCall?: { call: ActiveCall; key: number } | null;
}

export function MapScreen({ calls, userLocation, focusCall }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const [selectedCall, setSelectedCall] = useState<ActiveCall | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);

  const geolocatedCalls = useMemo(
    () => calls.filter((c) => c.latitude != null && c.longitude != null && !isNaN(c.latitude!) && !isNaN(c.longitude!)),
    [calls]
  );

  // Initialize Leaflet map
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return;
      const map = L.map(mapContainerRef.current).setView(
        [RICHMOND_CENTER.lat, RICHMOND_CENTER.lng],
        13
      );
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      setLeafletReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Show user location via browser Geolocation API (more reliable than expo-location on web)
  useEffect(() => {
    if (!mapRef.current || !leafletReady) return;
    if (!('geolocation' in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const L = (window as any).L;
        const { latitude, longitude } = pos.coords;

        mapRef.current!.setView([latitude, longitude], 14);

        if (userMarkerRef.current) userMarkerRef.current.remove();
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:16px;height:16px;border-radius:50%;background:#4285f4;border:3px solid #fff;box-shadow:0 0 8px rgba(66,133,244,0.6);"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        userMarkerRef.current = L.marker([latitude, longitude], {
          icon,
          zIndexOffset: 1000,
        })
          .addTo(mapRef.current!)
          .bindPopup('You are here');
      },
      () => {
        // Location denied or unavailable — stay centered on Richmond
      },
      { enableHighAccuracy: false, timeout: 15000 }
    );
  }, [leafletReady]);

  // Update markers when calls change
  useEffect(() => {
    if (!mapRef.current || !leafletReady) return;
    const L = (window as any).L;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    geolocatedCalls.forEach((call) => {
      const color = AGENCY_COLORS[call.agency] || '#95a5a6';
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.5);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([call.latitude!, call.longitude!], { icon })
        .addTo(mapRef.current!)
        .on('click', () => setSelectedCall(call));

      markersRef.current.push(marker);
    });
  }, [geolocatedCalls, leafletReady]);

  // Focus call
  useEffect(() => {
    if (focusCall && focusCall.call.latitude != null && focusCall.call.longitude != null && mapRef.current) {
      setSelectedCall(focusCall.call);
      mapRef.current.setView([focusCall.call.latitude, focusCall.call.longitude], 16, { animate: true });
    }
  }, [focusCall?.key]);

  return (
    <View style={styles.container}>
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
      />

      {selectedCall && (
        <View style={styles.detailCard}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedCall(null)}>
            <Text style={styles.closeText}>X</Text>
          </TouchableOpacity>
          <View style={styles.detailBadges}>
            <View style={[styles.badge, { backgroundColor: AGENCY_COLORS[selectedCall.agency] || '#95a5a6' }]}>
              <Text style={styles.badgeText}>{selectedCall.agency}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: STATUS_COLORS[selectedCall.status] || '#95a5a6' }]}>
              <Text style={styles.badgeText}>{selectedCall.status}</Text>
            </View>
          </View>
          <Text style={styles.detailType}>{selectedCall.callType}</Text>
          <Text style={styles.detailLocation}>
            {selectedCall.location}
            {selectedCall.distanceMiles != null && (
              <Text style={styles.detailDistanceInline}>
                {'  '}~{selectedCall.distanceMiles.toFixed(1)} mi away
              </Text>
            )}
          </Text>
          <Text style={styles.detailTime}>
            {formatTimeAgo(selectedCall.timeReceived).display}
            {'  '}
            <Text style={styles.detailAgo}>{formatTimeAgo(selectedCall.timeReceived).ago}</Text>
          </Text>
        </View>
      )}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3498db' }]} />
          <Text style={styles.legendText}>Police</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#e74c3c' }]} />
          <Text style={styles.legendText}>Fire/EMS</Text>
        </View>
        <Text style={styles.callCount}>{geolocatedCalls.length} calls</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  detailCard: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(20,20,40,0.95)',
    borderRadius: 12,
    padding: 14,
    zIndex: 1000,
  },
  closeButton: { position: 'absolute', top: 8, right: 12, zIndex: 1 },
  closeText: { color: '#7f8c8d', fontSize: 16, fontWeight: '700' },
  detailBadges: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  detailType: { color: '#ecf0f1', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  detailLocation: { color: '#bdc3c7', fontSize: 14, marginBottom: 4 },
  detailDistanceInline: { color: '#f39c12', fontSize: 14, fontWeight: '600' },
  detailTime: { color: '#ecf0f1', fontSize: 14, marginBottom: 2 },
  detailAgo: { color: '#f39c12', fontSize: 13, fontWeight: '600' },
  legend: {
    position: 'absolute',
    bottom: 20,
    left: 12,
    backgroundColor: 'rgba(20,20,40,0.9)',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 1000,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#ecf0f1', fontSize: 12 },
  callCount: { color: '#95a5a6', fontSize: 12, marginLeft: 8 },
});

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { ActiveCall } from '../types';
import * as Location from 'expo-location';

function formatTimeAgo(timeReceived: string): { display: string; ago: string } {
  // timeReceived format: "MM/DD/YYYY HH:mm"
  const parts = timeReceived.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)/);
  if (!parts) return { display: timeReceived, ago: '' };

  const [, month, day, year, hours, minutes] = parts.map(Number);
  const callDate = new Date(year, month - 1, day, hours, minutes);
  const now = new Date();
  const diffMs = now.getTime() - callDate.getTime();
  const diffMins = Math.round(diffMs / 60000);

  // Format display time like "1:15 PM"
  const h = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const display = `${h}:${String(minutes).padStart(2, '0')} ${ampm}`;

  let ago: string;
  if (diffMins < 1) {
    ago = 'just now';
  } else if (diffMins < 60) {
    ago = `~${diffMins} min ago`;
  } else if (diffMins < 1440) {
    const hrs = Math.floor(diffMins / 60);
    ago = `~${hrs}h ${diffMins % 60}m ago`;
  } else {
    const days = Math.floor(diffMins / 1440);
    ago = `~${days}d ago`;
  }

  return { display, ago };
}

const AGENCY_COLORS: Record<string, string> = {
  RPD: '#3498db',
  RFD: '#e74c3c',
};

const STATUS_COLORS: Record<string, string> = {
  Dispatched: '#f39c12',
  Enroute: '#3498db',
  Arrived: '#2ecc71',
};

// Richmond, VA center
const RICHMOND_REGION = {
  latitude: 37.5407,
  longitude: -77.436,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

interface Props {
  calls: ActiveCall[];
  userLocation: Location.LocationObject | null;
  focusCall?: { call: ActiveCall; key: number } | null;
}

export function MapScreen({ calls, userLocation, focusCall }: Props) {
  const mapRef = useRef<MapView>(null);
  const [selectedCall, setSelectedCall] = useState<ActiveCall | null>(null);

  useEffect(() => {
    console.log('[RVA] focusCall effect fired', {
      key: focusCall?.key,
      lat: focusCall?.call.latitude,
      lon: focusCall?.call.longitude,
      hasMapRef: !!mapRef.current,
    });
    if (
      focusCall &&
      focusCall.call.latitude != null &&
      focusCall.call.longitude != null
    ) {
      setSelectedCall(focusCall.call);
      setTimeout(() => {
        console.log('[RVA] animating to', focusCall.call.latitude, focusCall.call.longitude, 'mapRef:', !!mapRef.current);
        mapRef.current?.animateToRegion(
          {
            latitude: focusCall.call.latitude!,
            longitude: focusCall.call.longitude!,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          500
        );
      }, 300);
    }
  }, [focusCall?.key]);

  const geolocatedCalls = useMemo(
    () =>
      calls.filter(
        (c) =>
          c.latitude != null &&
          c.longitude != null &&
          !isNaN(c.latitude) &&
          !isNaN(c.longitude)
      ),
    [calls]
  );

  const initialRegion = useMemo(() => {
    if (userLocation) {
      return {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }
    return RICHMOND_REGION;
  }, [userLocation]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
        showsCompass
        mapType="standard"
      >
        {geolocatedCalls.map((call) => (
          <Marker
            key={call.id}
            coordinate={{
              latitude: call.latitude!,
              longitude: call.longitude!,
            }}
            pinColor={AGENCY_COLORS[call.agency] || '#95a5a6'}
            onSelect={() => setSelectedCall(call)}
            onDeselect={() => setSelectedCall(null)}
            tracksViewChanges={false}
          />
        ))}
      </MapView>

      {/* Selected call detail card */}
      {selectedCall && (
        <View style={styles.detailCard}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedCall(null)}
          >
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
            <Text style={styles.detailAgo}>
              {formatTimeAgo(selectedCall.timeReceived).ago}
            </Text>
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
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    flex: 1,
  },
  detailCard: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(20,20,40,0.95)',
    borderRadius: 12,
    padding: 14,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 12,
    zIndex: 1,
  },
  closeText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: '700',
  },
  detailBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  detailType: {
    color: '#ecf0f1',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailLocation: {
    color: '#bdc3c7',
    fontSize: 14,
    marginBottom: 4,
  },
  detailDistanceInline: {
    color: '#f39c12',
    fontSize: 14,
    fontWeight: '600',
  },
  detailTime: {
    color: '#ecf0f1',
    fontSize: 14,
    marginBottom: 2,
  },
  detailAgo: {
    color: '#f39c12',
    fontSize: 13,
    fontWeight: '600',
  },
  detailMeta: {
    color: '#7f8c8d',
    fontSize: 12,
  },
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
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: '#ecf0f1',
    fontSize: 12,
  },
  callCount: {
    color: '#95a5a6',
    fontSize: 12,
    marginLeft: 8,
  },
});

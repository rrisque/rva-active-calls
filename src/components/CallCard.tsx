import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ActiveCall } from '../types';

const STATUS_COLORS: Record<string, string> = {
  Dispatched: '#f39c12',
  Enroute: '#3498db',
  Arrived: '#2ecc71',
};

const AGENCY_COLORS: Record<string, string> = {
  RPD: '#3498db',
  RFD: '#e74c3c',
};

function formatTime(timeReceived: string): { display: string; ago: string } {
  const parts = timeReceived.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)/);
  if (!parts) return { display: timeReceived, ago: '' };
  const [, month, day, year, hours, minutes] = parts.map(Number);
  const h = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const display = `${month}/${day} ${h}:${String(minutes).padStart(2, '0')} ${ampm}`;

  const callDate = new Date(year, month - 1, day, hours, minutes);
  const diffMins = Math.round((Date.now() - callDate.getTime()) / 60000);

  let ago: string;
  if (diffMins < 1) ago = 'just now';
  else if (diffMins < 60) ago = `~${diffMins}m ago`;
  else if (diffMins < 1440) {
    const hrs = Math.floor(diffMins / 60);
    ago = `~${hrs}h ${diffMins % 60}m ago`;
  } else {
    ago = `~${Math.floor(diffMins / 1440)}d ago`;
  }

  return { display, ago };
}

interface Props {
  call: ActiveCall;
  onPress?: (call: ActiveCall) => void;
}

export function CallCard({ call, onPress }: Props) {
  const agencyColor = AGENCY_COLORS[call.agency] || '#95a5a6';
  const statusColor = STATUS_COLORS[call.status] || '#95a5a6';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(call)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={[styles.agencyBadge, { backgroundColor: agencyColor }]}>
          <Text style={styles.agencyText}>{call.agency}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{call.status}</Text>
        </View>
      </View>

      <Text style={styles.callType}>{call.callType}</Text>
      <Text style={styles.location}>{call.location}</Text>
      {call.distanceMiles != null && (
        <Text style={styles.distanceInline}>~{call.distanceMiles.toFixed(1)} mi away</Text>
      )}

      <View style={styles.footer}>
        <Text style={styles.meta}>
          {formatTime(call.timeReceived).display}
          {'  '}
          <Text style={styles.ago}>{formatTime(call.timeReceived).ago}</Text>
        </Text>
        <Text style={styles.meta}>
          {call.dispatchArea} • Unit {call.unit}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e1e30',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 12,
    marginVertical: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#3498db',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  agencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  agencyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  distance: {
    color: '#f1c40f',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  callType: {
    color: '#ecf0f1',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  location: {
    color: '#bdc3c7',
    fontSize: 13,
    marginBottom: 2,
  },
  distanceInline: {
    color: '#f39c12',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meta: {
    color: '#7f8c8d',
    fontSize: 11,
  },
  ago: {
    color: '#f39c12',
    fontSize: 11,
    fontWeight: '600',
  },
});

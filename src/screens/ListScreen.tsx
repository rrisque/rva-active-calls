import React, { useMemo } from 'react';
import { FlatList, StyleSheet, RefreshControl } from 'react-native';
import { ActiveCall } from '../types';
import { CallCard } from '../components/CallCard';

function parseCallTime(timeReceived: string): number {
  // "MM/DD/YYYY HH:mm"
  const parts = timeReceived.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)/);
  if (!parts) return 0;
  const [, month, day, year, hours, minutes] = parts.map(Number);
  return new Date(year, month - 1, day, hours, minutes).getTime();
}

interface Props {
  calls: ActiveCall[];
  refreshing: boolean;
  onRefresh: () => void;
  onSelectCall: (call: ActiveCall) => void;
}

export function ListScreen({ calls, refreshing, onRefresh, onSelectCall }: Props) {
  const sorted = useMemo(
    () => [...calls].sort((a, b) => parseCallTime(b.timeReceived) - parseCallTime(a.timeReceived)),
    [calls]
  );

  return (
    <FlatList
      data={sorted}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <CallCard call={item} onPress={onSelectCall} />}
      style={styles.list}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#3498db"
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#12121f',
  },
  content: {
    paddingVertical: 8,
  },
});

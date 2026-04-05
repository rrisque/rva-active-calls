import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import * as Location from 'expo-location';
import { useActiveCalls } from './src/hooks/useActiveCalls';
import { requestNotificationPermissions } from './src/services/notifications';
import { registerBackgroundFetch } from './src/services/backgroundTask';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MapScreen } from './src/screens/MapScreen';
import { ListScreen } from './src/screens/ListScreen';

type Tab = 'map' | 'list';

export default function App() {
  const [tab, setTab] = useState<Tab>('map');
  const [focusCall, setFocusCall] = useState<{ call: import('./src/types').ActiveCall; key: number } | null>(null);
  const focusCounter = useRef(0);
  const { calls, userLocation, loading, refreshing, error, lastUpdated, refresh } =
    useActiveCalls();

  function handleSelectCall(call: import('./src/types').ActiveCall) {
    focusCounter.current += 1;
    setFocusCall({ call, key: focusCounter.current });
    setTab('map');
  }

  // Request permissions in the background — don't block the UI
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      // Request background + notifications without blocking
      if (status === 'granted') {
        Location.requestBackgroundPermissionsAsync().catch(() => {});
      }
      requestNotificationPermissions().catch(() => {});
      registerBackgroundFetch().catch(() => {});
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>RVA Active Calls</Text>
          <View style={styles.headerRight}>
            {calls.length > 0 ? (
              <Text style={styles.callCount}>{calls.length} active</Text>
            ) : loading ? (
              <ActivityIndicator size="small" color="#f39c12" />
            ) : null}
            {lastUpdated && (
              <Text style={styles.updated}>
                {lastUpdated.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            )}
          </View>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, tab === 'map' && styles.tabActive]}
            onPress={() => setTab('map')}
          >
            <Text style={[styles.tabText, tab === 'map' && styles.tabTextActive]}>
              Map
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'list' && styles.tabActive]}
            onPress={() => setTab('list')}
          >
            <Text
              style={[styles.tabText, tab === 'list' && styles.tabTextActive]}
            >
              List
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content — both screens stay mounted so map keeps its ref */}
        {error && calls.length === 0 ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refresh}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.screenStack}>
            <View style={[styles.screenLayer, { zIndex: tab === 'map' ? 1 : 0 }]} pointerEvents={tab === 'map' ? 'auto' : 'none'}>
              <MapScreen calls={calls} userLocation={userLocation} focusCall={focusCall} />
            </View>
            <View style={[styles.screenLayer, { zIndex: tab === 'list' ? 1 : 0 }]} pointerEvents={tab === 'list' ? 'auto' : 'none'}>
              <ListScreen calls={calls} refreshing={refreshing} onRefresh={refresh} onSelectCall={handleSelectCall} />
            </View>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12121f',
  },
  screenStack: {
    flex: 1,
  },
  screenLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a2e',
  },
  title: {
    color: '#ecf0f1',
    fontSize: 20,
    fontWeight: '700',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  callCount: {
    color: '#f39c12',
    fontSize: 14,
    fontWeight: '600',
  },
  updated: {
    color: '#7f8c8d',
    fontSize: 11,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c4a',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3498db',
  },
  tabText: {
    color: '#7f8c8d',
    fontSize: 15,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#3498db',
  },
});

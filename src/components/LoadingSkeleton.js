// ============================================
// LOADING SKELETON COMPONENT - StudySync
// Migración de líneas 350-395 del frontend React
// ============================================

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Platform } from 'react-native';

const PulseBox = ({ style }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[style, { opacity }]} />;
};

export default function LoadingSkeleton() {
  return (
    <View style={styles.container}>
      {/* Header Skeleton */}
      <View style={styles.header}>
        <View>
          <PulseBox style={styles.headerTitle} />
          <PulseBox style={styles.headerSubtitle} />
        </View>
      </View>

      {/* Search Skeleton */}
      <View style={styles.searchContainer}>
        <PulseBox style={styles.searchBar} />
      </View>

      {/* Card Skeletons */}
      <View style={styles.cardsContainer}>
        {[1, 2, 3].map(i => (
          <View key={i} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardContent}>
                <PulseBox style={styles.cardTitle} />
                <PulseBox style={styles.cardSubtitle} />
                <PulseBox style={styles.cardBadge} />
              </View>
              <PulseBox style={styles.cardAvatar} />
            </View>
            <View style={styles.cardProgress}>
              <View style={styles.cardProgressHeader}>
                <PulseBox style={styles.progressLabel} />
                <PulseBox style={styles.progressValue} />
              </View>
              <View style={styles.progressBarBg}>
                <PulseBox style={styles.progressBarFill} />
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Bottom Nav Skeleton */}
      <View style={styles.bottomNav}>
        {[1, 2, 3].map(i => (
          <View key={i} style={styles.navItem}>
            <PulseBox style={styles.navIcon} />
            <PulseBox style={styles.navLabel} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#4F46E5',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    height: 24,
    width: 128,
    backgroundColor: '#818CF8',
    borderRadius: 6,
    marginBottom: 4,
  },
  headerSubtitle: {
    height: 12,
    width: 160,
    backgroundColor: '#6366F1',
    borderRadius: 6,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBar: {
    width: '100%',
    height: 36,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
  },
  cardsContainer: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardContent: {
    flex: 1,
    marginRight: 16,
  },
  cardTitle: {
    height: 20,
    width: '75%',
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
  },
  cardSubtitle: {
    height: 12,
    width: '50%',
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    marginBottom: 16,
  },
  cardBadge: {
    height: 20,
    width: 96,
    backgroundColor: '#FFF7ED',
    borderRadius: 6,
  },
  cardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
  },
  cardProgress: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cardProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    height: 12,
    width: 96,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
  progressValue: {
    height: 12,
    width: 48,
    backgroundColor: '#EEF2FF',
    borderRadius: 4,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
  },
  progressBarFill: {
    width: '50%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
  },
  bottomNav: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  navItem: {
    alignItems: 'center',
  },
  navIcon: {
    width: 20,
    height: 20,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 4,
  },
  navLabel: {
    width: 40,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
});

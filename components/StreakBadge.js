import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { describeStreak, milestoneReached } from '../services/streakUtils';

/**
 * The adherence streak, in the shape people already recognise from messaging
 * apps: a flame with a number beside it.
 *
 * The flame is lit only while the streak is alive. At zero it drops to grey and
 * loses its glow, which is the whole signal — you can tell at a glance whether
 * the run is intact without reading anything.
 */
export default function StreakBadge({ streak, loading }) {
  const alive = streak > 0;
  const milestone = milestoneReached(streak);

  return (
    <View style={styles.card}>
      <View style={[styles.flameWrap, alive && styles.flameWrapAlive]}>
        <Text style={[styles.flame, !alive && styles.flameCold]}>🔥</Text>
      </View>

      <View style={styles.text}>
        {loading ? (
          <ActivityIndicator size="small" color="#2563eb" style={styles.loader} />
        ) : (
          <>
            <View style={styles.countRow}>
              <Text style={[styles.count, !alive && styles.countCold]}>
                {streak}
              </Text>
              <Text style={[styles.unit, !alive && styles.unitCold]}>
                {streak === 1 ? 'day' : 'days'}
              </Text>

              {milestone ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{milestone}-day club</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.caption}>{describeStreak(streak)}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    marginBottom: 18,
  },
  flameWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  flameWrapAlive: {
    backgroundColor: '#fff7ed',
    borderWidth: 2,
    borderColor: '#fdba74',
  },
  flame: {
    fontSize: 30,
  },
  // Emoji cannot be recoloured, so a dead streak is shown by draining it
  // instead — the flame reads as grey next to the lit version.
  flameCold: {
    opacity: 0.32,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  loader: {
    alignSelf: 'flex-start',
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  count: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ea580c',
    letterSpacing: -0.5,
  },
  countCold: {
    color: '#94a3b8',
  },
  unit: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9a3412',
  },
  unitCold: {
    color: '#94a3b8',
  },
  badge: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginLeft: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9a3412',
  },
  caption: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#64748b',
  },
});

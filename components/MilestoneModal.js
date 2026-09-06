import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useThemedStyles } from '../hooks/use-themed-styles';

/**
 * Shown once when a streak first reaches 7, 30 or 100 days.
 *
 * Deliberately warm rather than clinical: this is the one place in a medication
 * app where the message is about the person rather than the medicine.
 */
export default function MilestoneModal({ milestone, visible, onClose }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(baseStyles);
  if (!milestone) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.flameWrap}>
            <Text style={styles.flame}>🔥</Text>
          </View>

          <Text style={styles.count}>{milestone}</Text>
          <Text style={styles.countUnit}>{t('daysInRow')}</Text>

          <Text style={styles.title}>{t('milestoneTitle')}</Text>
          <Text style={styles.body}>{t('milestoneBody', { days: milestone })}</Text>

          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>{t('keepGoing')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
  },
  flameWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#fff7ed',
    borderWidth: 2,
    borderColor: '#fdba74',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  flame: { fontSize: 42 },
  count: {
    fontSize: 46,
    fontWeight: '800',
    color: '#ea580c',
    letterSpacing: -1,
    lineHeight: 50,
  },
  countUnit: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9a3412',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 22,
  },
  button: {
    backgroundColor: '#ea580c',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});

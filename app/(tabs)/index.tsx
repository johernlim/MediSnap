import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../contexts/LanguageContext';
import { auth } from '../../firebaseConfig';
import { getUserProfile } from '../../services/settingsService';
import { useThemedStyles } from '../../hooks/use-themed-styles';

export default function HomeTabScreen() {
  const { t } = useLanguage();
  const styles = useThemedStyles(baseStyles);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return undefined;
    let active = true;
    getUserProfile(currentUser.uid, currentUser.email || '')
      .then((profile) => {
        if (active) setUsername(profile.username || currentUser.email?.split('@')[0] || '');
      })
      .catch((error) => console.error('Unable to load home username:', error));
    return () => { active = false; };
  }, []);
  const goToMedication = () => {
    router.push('/medications' as never);
  };

  const goToAIIdentification = () => {
    router.push('/ai-identification' as never);
  };

  const goToReminders = () => {
    router.push('/reminders' as never);
  };

  const goToChatbot = () => {
    router.push('/chatbot' as never);
  };

  const goToSettings = () => {
    router.push('/settings' as never);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('home')}</Text>
        <Text style={styles.subtitle}>{t('loginGreeting', {
          username: username || auth.currentUser?.email?.split('@')[0] || '',
        })}</Text>

        <TouchableOpacity
          style={styles.featureCard}
          onPress={goToMedication}
          activeOpacity={0.85}
        >
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>💊</Text>
          </View>
          <Text style={styles.featureText}>{t('medication')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.featureCard}
          onPress={goToAIIdentification}
          activeOpacity={0.85}
        >
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>📷</Text>
          </View>
          <Text style={styles.featureText}>{t('identification')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.featureCard}
          onPress={goToReminders}
          activeOpacity={0.85}
        >
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>⏰</Text>
          </View>
          <Text style={styles.featureText}>{t('reminder')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.featureCard}
          onPress={goToChatbot}
          activeOpacity={0.85}
        >
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>💬</Text>
          </View>
          <Text style={styles.featureText}>{t('chatbot')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.featureCard}
          onPress={goToSettings}
          activeOpacity={0.85}
        >
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>⚙️</Text>
          </View>
          <Text style={styles.featureText}>{t('settings')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 24,
    textAlign: 'center',
    color: '#64748b',
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 14,
    minHeight: 76,
    width: '100%',
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
  },
  iconText: {
    fontSize: 28,
  },
  featureText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
});

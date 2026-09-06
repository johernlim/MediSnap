import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NotificationSettingsCard from '../components/NotificationSettingsCard';
import StreakBadge from '../components/StreakBadge';
import ProfileEditForm from '../components/ProfileEditForm';
import ProfileViewCard from '../components/ProfileViewCard';
import LanguageSelector from '../components/LanguageSelector';
import ThemeSelector from '../components/ThemeSelector';
import { getStreak } from '../services/streakService';
import { auth } from '../firebaseConfig';
import {
    disableAllUserReminderNotifications,
    rescheduleAllUserReminderNotifications,
} from '../services/reminderService';
import {
    getDefaultProfile,
    getUserProfile,
    updateUserProfile,
    validateProfileData,
} from '../services/settingsService';
import { getLanguageOption } from '../services/languageService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';

export default function SettingsScreen() {
  const { changeLanguage, t } = useLanguage();
  const { theme, changeTheme } = useAppTheme();
  const styles = useThemedStyles(baseStyles);
  const [profile, setProfile] = useState(getDefaultProfile());
  const [streak, setStreak] = useState(0);
  const [streakLoading, setStreakLoading] = useState(true);
  const [formData, setFormData] = useState(getDefaultProfile());
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const userProfile = await getUserProfile(currentUser.uid, currentUser.email);
        setProfile(userProfile);
        setFormData(userProfile);
      } catch (error) {
        console.error('Failed to load profile:', error);
        Alert.alert(t('error'), t('unableLoadProfile'));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [t]);

  const handleEditProfile = () => {
    setFormData(profile);
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setFormData(profile);
    setEditing(false);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveProfile = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      Alert.alert(t('loginRequired'), t('pleaseLoginAgain'));
      return;
    }

    const validationMessage = validateProfileData(formData);

    if (validationMessage) {
      Alert.alert(t('invalidInput'), validationMessage);
      return;
    }

    setSavingProfile(true);

    try {
      const payload = {
        username: formData.username.trim(),
        email: profile.email || currentUser.email || '',
        full_name: formData.full_name.trim(),
        age: formData.age,
        gender: formData.gender,
        height: formData.height,
        weight: formData.weight,
      };

      await updateUserProfile(currentUser.uid, payload);

      const updatedProfile = {
        ...profile,
        ...payload,
      };

      setProfile(updatedProfile);
      setFormData(updatedProfile);
      setEditing(false);

      Alert.alert(t('success'), t('profileUpdated'));
    } catch (error) {
      console.error('Failed to save profile:', error);
      Alert.alert(t('error'), t('unableSaveProfile'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggleNotifications = async (value) => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      Alert.alert(t('loginRequired'), t('pleaseLoginAgain'));
      return;
    }

    const previousValue = !!profile.notifications_enabled;

    setProfile((prev) => ({
      ...prev,
      notifications_enabled: value,
    }));

    setSavingNotifications(true);

    try {
      await updateUserProfile(currentUser.uid, {
        notifications_enabled: value,
      });

      if (value) {
        await rescheduleAllUserReminderNotifications(currentUser.uid);
      } else {
        await disableAllUserReminderNotifications(currentUser.uid);
      }

      setFormData((prev) => ({
        ...prev,
        notifications_enabled: value,
      }));

      Alert.alert(
        t('success'),
        value
          ? t('notificationsOn')
          : t('notificationsOff')
      );
    } catch (error) {
      console.error('Failed to save notification settings:', error);

      setProfile((prev) => ({
        ...prev,
        notifications_enabled: previousValue,
      }));

      Alert.alert(t('error'), t('unableUpdateNotifications'));
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleLanguageChange = async (value) => {
    const currentUser = auth.currentUser;
    if (!currentUser || savingLanguage || value === profile.preferred_language) return;

    const previousValue = profile.preferred_language;
    setProfile((current) => ({ ...current, preferred_language: value }));
    setSavingLanguage(true);
    try {
      await changeLanguage(value, currentUser.uid);
      setFormData((current) => ({ ...current, preferred_language: value }));
      Alert.alert(t('success'), `${t('language')}: ${getLanguageOption(value).nativeLabel}`);
    } catch (error) {
      console.error('Failed to save language:', error);
      setProfile((current) => ({ ...current, preferred_language: previousValue }));
      Alert.alert(t('error'), t('languageSaveFailed'));
    } finally {
      setSavingLanguage(false);
    }
  };

  const handleThemeChange = async (value) => {
    const currentUser = auth.currentUser;
    if (!currentUser || savingTheme || value === (profile.preferred_theme || theme)) return;
    const previousValue = profile.preferred_theme || theme;
    setProfile((current) => ({ ...current, preferred_theme: value }));
    setSavingTheme(true);
    try {
      await changeTheme(value, currentUser.uid);
      setFormData((current) => ({ ...current, preferred_theme: value }));
    } catch (error) {
      console.error('Failed to save theme:', error);
      setProfile((current) => ({ ...current, preferred_theme: previousValue }));
      Alert.alert(t('error'), t('themeSaveFailed'));
    } finally {
      setSavingTheme(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert(t('error'), t('unableLogout'));
    }
  };

  const currentUser = auth.currentUser;

  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return;
    }

    getStreak(currentUser.uid)
      .then((result) => setStreak(result.streak))
      .catch((error) => console.error('Failed to load streak:', error))
      .finally(() => setStreakLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t('back')}</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>{t('settings')}</Text>

        <StreakBadge streak={streak} loading={streakLoading} />
        <Text style={styles.subtitle}>
          View profile, update personal details, manage notification preference, and log out.
        </Text>

        {!currentUser ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t('noUser')}</Text>
          </View>
        ) : loading ? (
          <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
        ) : (
          <>
            {editing ? (
              <ProfileEditForm
                formData={formData}
                saving={savingProfile}
                onChange={handleChange}
                onSave={handleSaveProfile}
                onCancel={handleCancelEdit}
              />
            ) : (
              <ProfileViewCard profile={profile} onEdit={handleEditProfile} />
            )}

            <NotificationSettingsCard
              enabled={!!profile.notifications_enabled}
              saving={savingNotifications}
              onToggle={handleToggleNotifications}
            />

            <View style={styles.languageCard}>
              <Text style={styles.cardTitle}>{t('language')}</Text>
              <Text style={styles.cardDescription}>{t('languageHelp')}</Text>
              <LanguageSelector
                value={profile.preferred_language}
                onChange={handleLanguageChange}
                disabled={savingLanguage}
              />
              {savingLanguage && <ActivityIndicator color="#2563eb" style={styles.languageLoader} />}
            </View>

            <View style={styles.languageCard}>
              <Text style={styles.cardTitle}>{t('appearance')}</Text>
              <Text style={styles.cardDescription}>{t('appearanceHelp')}</Text>
              <ThemeSelector value={profile.preferred_theme || theme}
                onChange={handleThemeChange} disabled={savingTheme} />
              {savingTheme && <ActivityIndicator color="#2563eb" style={styles.languageLoader} />}
            </View>

            <Pressable style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>{t('logout')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 0,
  },
  container: {
    padding: 18,
    paddingBottom: 36,
  },
  topBar: {
    marginTop: 6,
    marginBottom: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 22,
    lineHeight: 23,
  },
  loader: {
    marginTop: 24,
  },
  emptyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
  },
  languageCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 16,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  cardDescription: { fontSize: 14, lineHeight: 21, color: '#64748b', marginBottom: 14 },
  languageLoader: { marginTop: 12 },
  logoutButton: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 18,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
});

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
import ProfileEditForm from '../components/ProfileEditForm';
import ProfileViewCard from '../components/ProfileViewCard';
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

export default function SettingsScreen() {
  const [profile, setProfile] = useState(getDefaultProfile());
  const [formData, setFormData] = useState(getDefaultProfile());
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

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
        Alert.alert('Error', 'Unable to load profile right now.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

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
      Alert.alert('Login required', 'Please log in again.');
      return;
    }

    const validationMessage = validateProfileData(formData);

    if (validationMessage) {
      Alert.alert('Invalid Input', validationMessage);
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

      Alert.alert('Success', 'Profile updated successfully.');
    } catch (error) {
      console.error('Failed to save profile:', error);
      Alert.alert('Error', 'Unable to save profile right now.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggleNotifications = async (value) => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      Alert.alert('Login required', 'Please log in again.');
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
        'Success',
        value
          ? 'Notifications enabled and active reminders rescheduled.'
          : 'Notifications disabled and scheduled reminders canceled.'
      );
    } catch (error) {
      console.error('Failed to save notification settings:', error);

      setProfile((prev) => ({
        ...prev,
        notifications_enabled: previousValue,
      }));

      Alert.alert('Error', 'Unable to update notification settings right now.');
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Error', 'Unable to log out right now.');
    }
  };

  const currentUser = auth.currentUser;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          View profile, update personal details, manage notification preference, and log out.
        </Text>

        {!currentUser ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No authenticated user found.</Text>
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

            <Pressable style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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

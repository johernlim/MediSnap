import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { Auth } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import MilestoneModal from '../components/MilestoneModal';
import {
  getPendingMilestone,
  getStreak,
  markMilestoneCelebrated,
} from '../services/streakService';
import { logDoseTaken } from '../services/doseLogService';
import {
  ACTION_SNOOZE,
  ACTION_TAKEN,
  REMINDER_CATEGORY,
} from '../services/reminderService';

const { auth } = require('../firebaseConfig') as { auth: Auth };

/** Sends the user to the dose screen carrying everything the notification held. */
function openDoseScreen(data: any, snooze = false) {
  const query = new URLSearchParams({
    medId: String(data?.medId || ''),
    medName: String(data?.medName || ''),
    dosage: String(data?.dosage || ''),
    scheduledTime: String(data?.scheduledTime || ''),
    reminderTimes: Array.isArray(data?.reminderTimes)
      ? data.reminderTimes.join(',')
      : '',
    // How many reminders this dose has already used, so the screen can show
    // the remaining budget and mark it missed when there is none left.
    attempt: String(data?.attempt ?? 0),
    snooze: snooze ? '1' : '',
  }).toString();

  router.push(`/dose?${query}` as never);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [milestone, setMilestone] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setCheckingAuth(false);
    });

    return unsubscribe;
  }, []);


  // Checked once per app open rather than on the settings screen, so the
  // celebration finds the user wherever they happen to land.
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) {
      return;
    }

    const userId = auth.currentUser.uid;

    getStreak(userId)
      .then(({ streak }) => getPendingMilestone(userId, streak))
      .then((pending) => {
        if (pending) setMilestone(pending);
      })
      .catch((error) => {
        console.error('Failed to check streak milestone:', error);
      });
  }, [isLoggedIn]);

  const dismissMilestone = () => {
    const reached = milestone;
    setMilestone(null);

    if (reached && auth.currentUser) {
      markMilestoneCelebrated(auth.currentUser.uid, reached).catch((error) => {
        console.error('Failed to record milestone:', error);
      });
    }
  };

  // Reminder taps and action buttons are handled here rather than on a screen,
  // so they work no matter where the user happens to be in the app.
  useEffect(() => {
    if (!isLoggedIn) {
      return undefined;
    }

    const handleResponse = async (response: Notifications.NotificationResponse) => {
      const data: any = response?.notification?.request?.content?.data;

      if (data?.type !== REMINDER_CATEGORY) {
        return;
      }

      const identifier = response?.notification?.request?.identifier;

      // "I've taken it" never opens the app. The dose is logged here and the
      // notification is dismissed, which is what stops the alarm — these are
      // sticky notifications, so nothing clears them on its own.
      if (response.actionIdentifier === ACTION_TAKEN) {
        try {
          await logDoseTaken({
            userId: auth.currentUser?.uid,
            medId: data.medId,
            medName: data.medName,
            dosage: data.dosage,
            scheduledTime: data.scheduledTime,
          });
        } catch (error) {
          console.error('Failed to log dose from notification:', error);
        }

        try {
          if (identifier) {
            await Notifications.dismissNotificationAsync(identifier);
          }
        } catch (error) {
          console.error('Failed to dismiss notification:', error);
        }

        return;
      }

      // Everything else opens the app, so the sticky notification is cleared
      // on the way through — otherwise it would keep sitting in the tray.
      try {
        if (identifier) {
          await Notifications.dismissNotificationAsync(identifier);
        }
      } catch (error) {
        console.error('Failed to dismiss notification:', error);
      }

      openDoseScreen(data, response.actionIdentifier === ACTION_SNOOZE);
    };

    const subscription =
      Notifications.addNotificationResponseReceivedListener(handleResponse);

    // Covers the case where the app was closed and the notification is what
    // launched it — no live listener would have been attached in time.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleResponse(response);
      }
    });

    return () => subscription.remove();
  }, [isLoggedIn]);

  if (checkingAuth) {
    return (
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#ffffff',
            }}
          >
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={isLoggedIn}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="ai-identification" />
            <Stack.Screen name="chat" />
            <Stack.Screen name="chat-history" />
            <Stack.Screen name="chatbot" />
            <Stack.Screen name="dose" />
            <Stack.Screen name="home" />
            <Stack.Screen name="medications" />
            <Stack.Screen name="modal" />
            <Stack.Screen name="reminders" />
          </Stack.Protected>

          <Stack.Protected guard={!isLoggedIn}>
            <Stack.Screen name="index" />
            <Stack.Screen name="signup" />
          </Stack.Protected>
        </Stack>
        <StatusBar style="auto" />

        <MilestoneModal
          milestone={milestone}
          visible={milestone !== null}
          onClose={dismissMilestone}
        />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

import { router } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { validateEmail } from '../services/emailValidator';
import { sendResetEmailAndLog } from '../services/passwordResetService';
import { useLanguage } from '../contexts/LanguageContext';
import { useThemedStyles } from '../hooks/use-themed-styles';

export default function ForgotPasswordScreen() {
  const { t } = useLanguage();
  const styles = useThemedStyles(baseStyles);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendResetEmail = () => {
    const result = validateEmail(email);

    if (!result.valid) {
      Alert.alert(t('validationError'), t('invalidEmailMessage'));
      return;
    }

    // Format is fine, but the domain looks like a typo of a common provider
    // (gmail.cm, gmail.co, gmial.com...). Confirm before sending, because a
    // reset email delivered to the wrong address is lost silently.
    if (result.suggestion) {
      Alert.alert(
        t('checkEmailAddress'),
        t('didYouMean', { email: result.email, suggestion: result.suggestion }),
        [
          { text: t('editAddress'), style: 'cancel' },
          {
            text: t('useSuggestion', { suggestion: result.suggestion }),
            onPress: () => {
              setEmail(result.suggestion);
              sendResetEmail(result.suggestion);
            },
          },
          {
            text: t('useMine'),
            style: 'destructive',
            onPress: () => sendResetEmail(result.email),
          },
        ]
      );
      return;
    }

    sendResetEmail(result.email);
  };

  const sendResetEmail = async (trimmedEmail) => {
    setSending(true);

    try {
      const { registered } = await sendResetEmailAndLog(trimmedEmail);

      if (!registered) {
        Alert.alert(
          t('emailNotRegistered'),
          t('emailNotRegisteredMessage', { email: trimmedEmail }),
          [
            {
              text: t('ok'),
              onPress: () => router.replace('/signup'),
            },
          ]
        );
        return;
      }

      setEmail('');

      Alert.alert(
        t('checkEmail'),
        t('resetSent', { email: trimmedEmail }),
        [
          {
            text: t('ok'),
            onPress: () => router.replace('/'),
          },
        ]
      );
    } catch (error) {
      console.error('Password reset failed:', error);
      Alert.alert(
        t('resetFailed'),
        t('resetUnavailable')
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('forgotTitle')}</Text>
        <Text style={styles.subtitle}>
          {t('forgotHelp')}
        </Text>

        <TextInput
          style={styles.input}
          placeholder={t('emailAddress')}
          placeholderTextColor="#6b7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Pressable
          style={[styles.primaryButton, sending && styles.disabledButton]}
          onPress={handleSendResetEmail}
          disabled={sending}
        >
          <Text style={styles.primaryButtonText}>
            {sending ? t('sending') : t('sendReset')}
          </Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>{t('backToLogin')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
});

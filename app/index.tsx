import { router } from 'expo-router';
import type { Auth } from 'firebase/auth';
import { signInWithEmailAndPassword } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { useRef, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { validateEmail } from '../services/emailValidator';
import { getPreferredLanguage } from '../services/languageService';
import { useLanguage } from '../contexts/LanguageContext';
import { useThemedStyles } from '../hooks/use-themed-styles';

const { auth, db } = require('../firebaseConfig') as {
  auth: Auth;
  db: Firestore;
};

export default function LoginScreen() {
  const { t } = useLanguage();
  const styles = useThemedStyles(baseStyles);
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const loginInProgress = useRef(false);

  const getEmailFromUsername = async (username: string) => {
    // limit(1) is required by the security rules: a username lookup must run
    // before sign-in, so the only thing stopping the whole users collection
    // being downloaded is that unbounded queries are refused.
    const q = query(
      collection(db, 'users'),
      where('username', '==', username),
      limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const userData = querySnapshot.docs[0].data();
    return userData.email || null;
  };

  const handleLogin = () => {
    if (!loginInput || !password) {
      Alert.alert(t('error'), t('enterCredentials'));
      return;
    }

    const trimmedInput = loginInput.trim();

    // This field accepts an email OR a username. An "@" means the user meant
    // it as an email, so validate it as one instead of looking it up as a
    // username that could never exist.
    if (!trimmedInput.includes('@')) {
      signIn(trimmedInput, false);
      return;
    }

    const result = validateEmail(trimmedInput);

    if (!result.valid) {
      Alert.alert(t('invalidEmail'), t('invalidEmailMessage'));
      return;
    }

    if (result.suggestion) {
      Alert.alert(
        t('checkEmailAddress'),
        t('didYouMean', { email: result.email, suggestion: result.suggestion }),
        [
          { text: t('editAddress'), style: 'cancel' },
          {
            text: t('useSuggestion', { suggestion: result.suggestion }),
            onPress: () => {
              setLoginInput(result.suggestion as string);
              signIn(result.suggestion as string, true);
            },
          },
          {
            text: t('useMine'),
            style: 'destructive',
            onPress: () => signIn(result.email, true),
          },
        ]
      );
      return;
    }

    signIn(result.email, true);
  };

  const signIn = async (identifier: string, isEmailInput: boolean) => {
    if (loginInProgress.current) return;
    loginInProgress.current = true;
    setSigningIn(true);
    try {
      let emailToLogin = identifier;

      if (!isEmailInput) {
        const foundEmail = await getEmailFromUsername(identifier);
        if (!foundEmail) {
          Alert.alert(t('loginFailed'), t('usernameNotFound'));
          return;
        }
        emailToLogin = foundEmail;
      }

      const credential = await signInWithEmailAndPassword(auth, emailToLogin, password);
      try {
        await getPreferredLanguage(credential.user.uid);
      } catch (profileError) {
        console.error('Unable to load language preference after login:', profileError);
      }
      // Language onboarding happens immediately after signup. Returning users
      // never see it again; a saved preference is loaded above, and older
      // accounts can choose a language from Settings.
      router.replace('/(tabs)' as never);
    } catch (error: any) {
      const errorCode = error?.code || '';

      if (
        errorCode === 'auth/wrong-password' ||
        errorCode === 'auth/invalid-credential'
      ) {
        Alert.alert(
          t('loginFailed'),
          t('invalidPassword')
        );
        return;
      }

      if (errorCode === 'auth/user-not-found') {
        Alert.alert(t('loginFailed'), t('userNotFound'));
        return;
      }

      Alert.alert(t('loginFailed'), error?.message || t('unableLogin'));
    } finally {
      loginInProgress.current = false;
      setSigningIn(false);
    }
  };

  const goToForgotPassword = () => {
    router.push('/forgot-password' as never);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Image
          source={require('../assets/images/MediSnapLogo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>{t('loginTitle')}</Text>

        <TextInput
          style={styles.input}
          placeholder={t('emailOrUsername')}
          placeholderTextColor="#6b7280"
          value={loginInput}
          onChangeText={setLoginInput}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder={t('password')}
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={[styles.button, signingIn && styles.disabledButton]}
          disabled={signingIn} onPress={handleLogin}>
          <Text style={styles.buttonText}>{signingIn ? t('loading') : t('login')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/signup' as never)}>
          <Text style={styles.link}>{t('signUp')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={goToForgotPassword}>
          <Text style={styles.link}>{t('forgotPassword')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    backgroundColor: '#ffffff',
    color: '#111827',
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  disabledButton: { opacity: 0.65 },
  link: {
    textAlign: 'center',
    color: '#2563eb',
    marginTop: 10,
  },
});

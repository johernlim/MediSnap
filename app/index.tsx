import { router } from 'expo-router';
import type { Auth } from 'firebase/auth';
import { signInWithEmailAndPassword } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { auth, db } = require('../firebaseConfig') as {
  auth: Auth;
  db: Firestore;
};

export default function LoginScreen() {
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');

  const isEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const getEmailFromUsername = async (username: string) => {
    const q = query(collection(db, 'users'), where('username', '==', username));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const userData = querySnapshot.docs[0].data();
    return userData.email || null;
  };

  const handleLogin = async () => {
    if (!loginInput || !password) {
      Alert.alert('Error', 'Please enter registered email/username.');
      return;
    }

    try {
      let emailToLogin = loginInput.trim();

      if (!isEmail(emailToLogin)) {
        const foundEmail = await getEmailFromUsername(emailToLogin);
        if (!foundEmail) {
          Alert.alert('Login Failed', 'Username not found.');
          return;
        }
        emailToLogin = foundEmail;
      }

      await signInWithEmailAndPassword(auth, emailToLogin, password);
      Alert.alert('Success', 'Login successful.');
      router.replace('/(tabs)' as never);
    } catch (error: any) {
      const errorCode = error?.code || '';

      if (
        errorCode === 'auth/wrong-password' ||
        errorCode === 'auth/invalid-credential'
      ) {
        Alert.alert(
          'Login Failed',
          'Invalid password!!! Try again or Reset Password.'
        );
        return;
      }

      if (errorCode === 'auth/user-not-found') {
        Alert.alert('Login Failed', 'User account not found.');
        return;
      }

      Alert.alert('Login Failed', error?.message || 'Unable to login right now.');
    }
  };

  const goToForgotPassword = () => {
    router.push('/forgot-password' as never);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Image
          source={require('../assets/images/MediSnapLogo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>MediSnap Login</Text>

        <TextInput
          style={styles.input}
          placeholder="Email or Username"
          placeholderTextColor="#6b7280"
          value={loginInput}
          onChangeText={setLoginInput}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/signup' as never)}>
          <Text style={styles.link}>Sign Up</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={goToForgotPassword}>
          <Text style={styles.link}>Forgot Password?</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  link: {
    textAlign: 'center',
    color: '#2563eb',
    marginTop: 10,
  },
});

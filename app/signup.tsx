import { router } from 'expo-router';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  initializeAuth,
} from 'firebase/auth';
import { doc, getFirestore, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../firebaseConfig';
import { validateEmail } from '../services/emailValidator';

export default function SignupScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isValidPassword = (value: string) => {
    return /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);
  };

  const handleSignup = () => {
    if (!username || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    const emailResult = validateEmail(email);

    if (!emailResult.valid) {
      Alert.alert('Error', emailResult.message as string);
      return;
    }

    if (!isValidPassword(password)) {
      Alert.alert(
        'Error',
        'Password must be at least 8 characters and include at least 1 uppercase letter and numbers.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Password does not match.');
      return;
    }

    // The domain looks like a typo of a common provider. Catch it now: an
    // account registered on a wrong address can never receive a password
    // reset email.
    if (emailResult.suggestion) {
      Alert.alert(
        'Check Your Email Address',
        `You entered ${emailResult.email}. Did you mean ${emailResult.suggestion}?\n\n` +
          'You will need this address to reset your password later.',
        [
          { text: 'Edit', style: 'cancel' },
          {
            text: `Use ${emailResult.suggestion}`,
            onPress: () => {
              setEmail(emailResult.suggestion as string);
              createAccount(emailResult.suggestion as string);
            },
          },
          {
            text: 'Use mine anyway',
            style: 'destructive',
            onPress: () => createAccount(emailResult.email),
          },
        ]
      );
      return;
    }

    createAccount(emailResult.email);
  };

  const createAccount = async (normalizedEmail: string) => {
    let secondaryApp: any = null;

    try {
      const normalizedUsername = username.trim();

      secondaryApp = initializeApp(auth.app.options, `signup-${Date.now()}`);

      const secondaryAuth = initializeAuth(secondaryApp, {
        persistence: inMemoryPersistence,
      });

      const secondaryDb = getFirestore(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        normalizedEmail,
        password
      );
      const uid = userCredential.user.uid;

      await setDoc(doc(secondaryDb, 'users', uid), {
        user_id: uid,
        userId: uid,
        username: normalizedUsername,
        email: normalizedEmail,
      });

      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);
      secondaryApp = null;

      Alert.alert('Success', 'Account created successfully.', [
        {
          text: 'OK',
          onPress: () => router.replace('/' as never),
        },
      ]);
    } catch (error: any) {
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch {}
      }

      Alert.alert(
        'Signup Failed',
        error?.message || 'Unable to create account right now.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Create Account</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#94a3b8"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#94a3b8"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#94a3b8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor="#94a3b8"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleSignup}>
          <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/' as never)}>
          <Text style={styles.link}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
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
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    color: '#111827',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
  },
  link: {
    textAlign: 'center',
    color: '#2563eb',
    marginTop: 16,
    fontSize: 16,
  },
});

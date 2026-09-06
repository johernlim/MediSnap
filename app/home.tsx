import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../firebaseConfig';
import { useLanguage } from '../contexts/LanguageContext';
import { getUserProfile } from '../services/settingsService';
import { useThemedStyles } from '../hooks/use-themed-styles';

export default function HomeScreen() {
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
  const handleLogout = async () => {
    await signOut(auth);
  
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('home')}</Text>
      <Text style={styles.subtitle}>{t('loginGreeting', {
        username: username || auth.currentUser?.email?.split('@')[0] || '',
      })}</Text>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>{t('logout')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 12 },
  subtitle: { fontSize: 18, marginBottom: 24 },
  button: { backgroundColor: '#dc2626', padding: 14, borderRadius: 10, width: 180 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
});

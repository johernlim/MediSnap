import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import LanguageSelector from '../components/LanguageSelector';
import { auth } from '../firebaseConfig';
import { useLanguage } from '../contexts/LanguageContext';
import { useThemedStyles } from '../hooks/use-themed-styles';

export default function LanguageSelectionScreen() {
  const { language: appLanguage, changeLanguage, t } = useLanguage();
  const styles = useThemedStyles(baseStyles);
  const [language, setLanguage] = useState(appLanguage);
  const [saving, setSaving] = useState(false);

  const continueToApp = async () => {
    const user = auth.currentUser;
    if (!user) {
      router.replace('/');
      return;
    }
    if (!language) {
      Alert.alert(t('selectLanguage'), t('chooseLanguageHelp'));
      return;
    }

    setSaving(true);
    try {
      await changeLanguage(language, user.uid);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Failed to save language:', error);
      Alert.alert(t('unableSave'), t('checkConnection'));
    } finally {
      setSaving(false);
    }
  };

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      <Text style={styles.title}>{t('chooseLanguage')}</Text>
      <Text style={styles.subtitle}>{t('chooseLanguageHelp')}</Text>
      <LanguageSelector value={language} onChange={setLanguage} disabled={saving} />
      <Pressable accessibilityRole="button" disabled={saving || !language} onPress={continueToApp}
        style={[styles.button, (saving || !language) && styles.disabled]}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('saveContinue')}</Text>}
      </Pressable>
    </View>
  </SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 0 },
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { color: '#0f172a', fontSize: 29, fontWeight: '700', marginBottom: 10 },
  subtitle: { color: '#475569', fontSize: 16, lineHeight: 23, marginBottom: 22 },
  button: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 22 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.55 },
});

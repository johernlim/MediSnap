import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
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
import AIIdentificationForm from '../components/AIIdentificationForm';
import { identifyMedicineFromImage } from '../services/aiIdentificationService';
import { useLanguage } from '../contexts/LanguageContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { stopMedicineSpeech } from '../services/speechService';

export default function AIIdentificationScreen() {
  const { language: preferredLanguage, t } = useLanguage();
  const styles = useThemedStyles(baseStyles);
  const [selectedImage, setSelectedImage] = useState(null);
  const [predictedResult, setPredictedResult] = useState('');
  const [identifying, setIdentifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [refinementMode, setRefinementMode] = useState(false);
  const [refinementDismissed, setRefinementDismissed] = useState(false);

  const requestCameraPermission = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(t('permissionRequired'), t('cameraPermission'));
      return false;
    }

    return true;
  };

  const pickFromCamera = async () => {
    const hasPermission = await requestCameraPermission();

    if (!hasPermission) {
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
        await stopMedicineSpeech().catch(() => {});
      setSelectedImage(result.assets[0]);
      if (!refinementMode) setPredictedResult('');
      setErrorMessage('');
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
        await stopMedicineSpeech().catch(() => {});
      setSelectedImage(result.assets[0]);
      if (!refinementMode) setPredictedResult('');
      setErrorMessage('');
    }
  };

  const handleIdentify = async () => {
    if (!selectedImage?.uri) {
      Alert.alert(t('noImage'), t('selectImageFirst'));
      return;
    }

      await stopMedicineSpeech().catch(() => {});
    const previousEvidence = refinementMode
      ? predictedResult?.detections?.find((item) => item.visual_evidence)?.visual_evidence
      : null;
    setIdentifying(true);
    if (!refinementMode) setPredictedResult('');
    setErrorMessage('');

    try {
      const result = await identifyMedicineFromImage(selectedImage, preferredLanguage, previousEvidence);
      setPredictedResult(result);
      setRefinementMode(false);
      setRefinementDismissed(false);

    } catch (error) {
      setErrorMessage(error.message || t('identifyUnavailable'));
    } finally {
      setIdentifying(false);
    }
  };

  const startRefinement = () => {
    setRefinementMode(true);
    setRefinementDismissed(false);
    setSelectedImage(null);
    setErrorMessage('');
  };

  const finishWithoutRefinement = () => {
    setRefinementMode(false);
    setRefinementDismissed(true);
  };

  const safelyPick = async (picker) => {
    try { await picker(); } catch { setErrorMessage(t('pickerUnavailable')); }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t('back')}</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>{t('identification')}</Text>
        <Text style={styles.subtitle}>
          {t('recognitionSubtitle')}
        </Text>

          <>
            <AIIdentificationForm
              selectedImage={selectedImage}
              predictedResult={predictedResult}
              identifying={identifying}
              onPickCamera={() => safelyPick(pickFromCamera)}
              onPickGallery={() => safelyPick(pickFromGallery)}
              onIdentify={handleIdentify}
              preferredLanguage={preferredLanguage}
              refinementMode={refinementMode}
              refinementDismissed={refinementDismissed}
              onStartRefinement={startRefinement}
              onFinish={finishWithoutRefinement}
            />
            {!!errorMessage && <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text>}
          </>
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
  errorText: { color: '#b91c1c', fontSize: 16, marginBottom: 16, lineHeight: 23 },
});

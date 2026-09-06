import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import MedicineRecognitionResult from './MedicineRecognitionResult';
import { useLanguage } from '../contexts/LanguageContext';
import { useThemedStyles } from '../hooks/use-themed-styles';

export default function AIIdentificationForm({
  selectedImage,
  predictedResult,
  identifying,
  onPickCamera,
  onPickGallery,
  onIdentify,
  preferredLanguage,
  refinementMode = false,
  refinementDismissed = false,
  onStartRefinement,
  onFinish,
}) {
  const { t } = useLanguage();
  const styles = useThemedStyles(baseStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{refinementMode ? t('confirmMedicine') : t('identifyMedicine')}</Text>
      {refinementMode && <Text style={styles.helperText}>
        {t('packagePhotoPrompt')} {t('firstEvidenceKept')}
      </Text>}

      <View style={styles.previewBox}>
        {selectedImage?.uri ? (
          <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
        ) : (
          <Text style={styles.previewPlaceholder}>
            {refinementMode ? t('packagePhotoPrompt') : t('noImage')}
          </Text>
        )}
      </View>

      <Pressable accessibilityRole="button" disabled={identifying} style={styles.secondaryButton} onPress={onPickCamera}>
        <Text style={styles.secondaryButtonText}>{refinementMode ? t('capturePackage') : t('captureCamera')}</Text>
      </Pressable>

      <Pressable accessibilityRole="button" disabled={identifying} style={styles.secondaryButton} onPress={onPickGallery}>
        <Text style={styles.secondaryButtonText}>{refinementMode ? t('uploadPackage') : t('uploadGallery')}</Text>
      </Pressable>

      <Pressable
        style={[styles.primaryButton, identifying && styles.disabledButton]}
        onPress={onIdentify}
        disabled={identifying || !selectedImage}
        accessibilityRole="button"
      >
        <Text style={styles.primaryButtonText}>
          {identifying ? t('checking') : refinementMode ? t('confirmMedicine') : t('identifyMedicine')}
        </Text>
      </Pressable>

      {predictedResult ? <MedicineRecognitionResult result={predictedResult} language={preferredLanguage}
        refinementMode={refinementMode} refinementDismissed={refinementDismissed}
        onStartRefinement={onStartRefinement} onFinish={onFinish} /> : (
        <View style={styles.resultCard}>
          <Text style={styles.resultText}>{t('recognitionHelp')}</Text>
          <Text style={styles.resultText}>{t('recognitionSafety')}</Text>
        </View>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#dbe4f0',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  helperText: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  previewBox: {
    height: 240,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  previewPlaceholder: {
    color: '#64748b',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '600',
  },
  resultCard: {
    marginTop: 18,
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e3a8a',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 16,
    color: '#1e293b',
    lineHeight: 22,
  },
  disabledButton: {
    opacity: 0.7,
  },
});

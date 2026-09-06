import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { getLanguageOption } from '../services/languageService';
import { speakMedicineResult, stopMedicineSpeech } from '../services/speechService';
import { useLanguage } from '../contexts/LanguageContext';
import { useThemedStyles } from '../hooks/use-themed-styles';

function cleanIngredient(value) {
  return value?.replace(/\[[^\]]*\]/g, '').replace(/;+/g, ', ').trim() || '';
}

function findStrength(medicine) {
  const source = [medicine?.strength, medicine?.product_name, medicine?.active_ingredient]
    .filter(Boolean).join(' ');
  return source.match(/\b\d+(?:\.\d+)?\s*(?:mcg|mg|g|ml|iu)\b/i)?.[0] || '';
}

export default function MedicineRecognitionResult({
  result,
  language = 'en',
  autoSpeak = true,
  refinementMode = false,
  refinementDismissed = false,
  onStartRefinement,
  onFinish,
}) {
  const { t } = useLanguage();
  const styles = useThemedStyles(baseStyles);
  const [speaking, setSpeaking] = useState(false);

  const startSpeech = useCallback(async () => {
    // iOS can delay Expo Speech's onStart callback. Change the control
    // immediately so speech always has a visible stop action.
    setSpeaking(true);
    try {
      await speakMedicineResult(result, language, {
        onStart: () => setSpeaking(true),
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
        onError: () => {
          setSpeaking(false);
          Alert.alert(t('speechUnavailable'), t('speechVoiceHelp'));
        },
      });
    } catch {
      setSpeaking(false);
      Alert.alert(t('speechUnavailable'), t('speechFailed'));
    }
  }, [language, result, t]);

  useEffect(() => {
    const timer = result && autoSpeak ? setTimeout(startSpeech, 0) : null;
    return () => {
      if (timer) clearTimeout(timer);
      stopMedicineSpeech().catch(() => {});
    };
  }, [autoSpeak, result, startSpeech]);

  if (!result) return null;

  const detections = result.detections || [];
  const detection = detections.find((item) => item.match?.medicine)
    || detections.find((item) => item.preliminary_summary || item.ai_suggestion)
    || detections[0];
  const medicine = detection?.match?.medicine;
  const preliminary = detection?.preliminary_summary || (detection?.ai_suggestion?.product_name ? {
    possible_name: detection.ai_suggestion.product_name,
    active_ingredient: detection.ai_suggestion.active_ingredient || '',
    strength: detection.ai_suggestion.strength || '',
    common_uses: detection.ai_suggestion.common_uses || [],
  } : null);
  // No-result and poor-image messages are spoken too, so their speech control
  // must remain visible while the user listens.
  const hasSpeakableResult = Boolean(result);
  const guidance = detection?.general_guidance;
  const possibleGuidance = detection?.possible_guidance;
  const commonUses = medicine ? (guidance?.common_uses || detection?.common_uses || [])
    : (preliminary?.common_uses || []);

  const handleSpeech = async () => {
    if (speaking) {
      await stopMedicineSpeech();
      setSpeaking(false);
    } else {
      await startSpeech();
    }
  };

  const showRefinementActions = !medicine && !result.refinement_used
    && !refinementMode && !refinementDismissed;

  return <View accessibilityLiveRegion="polite" style={styles.container}>
    {hasSpeakableResult && <Pressable accessibilityRole="button"
      accessibilityLabel={speaking ? t('stopSpeaking') : t('speakResult')}
      onPress={handleSpeech} style={[styles.speechButton, speaking && styles.stopButton]}>
      <Text style={styles.speechButtonText}>{speaking ? t('stopSpeaking')
        : `${t('speakResult')} · ${getLanguageOption(language).nativeLabel}`}</Text>
    </Pressable>}

    {medicine ? <>
      <Text style={styles.title}>{t('medicineIdentified')}</Text>
      <View style={styles.resultCard}>
        <Text style={styles.name}>{medicine.product_name}</Text>
        <Text style={styles.text}><Text style={styles.bold}>{t('activeIngredient')}: </Text>
          {cleanIngredient(medicine.active_ingredient) || 'Not available'}</Text>
        <Text style={styles.text}><Text style={styles.bold}>{t('strength')}: </Text>
          {findStrength(medicine) || 'Not available'}</Text>
        <Text style={styles.heading}>{t('commonUsage')}</Text>
        {commonUses.length ? commonUses.map((item, index) =>
          <Text key={`${item}-${index}`} style={styles.text}>• {item}</Text>)
          : <Text style={styles.text}>{t('usageUnavailable')}</Text>}
      </View>

      <View style={styles.dosageCard}>
        <Text style={styles.heading}>{t('generalDosage')}</Text>
        <Text style={styles.text}><Text style={styles.bold}>{t('adults')}: </Text>
          {guidance?.adult_general_dosage || t('adultDoseHelp')}</Text>
        <Text style={styles.text}><Text style={styles.bold}>{t('children')}: </Text>
          {guidance?.child_general_dosage || t('childDoseHelp')}</Text>
        {guidance?.dosage_notes?.map((note, index) =>
          <Text key={`${note}-${index}`} style={styles.text}>• {note}</Text>)}
        <Text style={styles.dosageWarning}>{t('dosageDetailWarning')}</Text>
      </View>
    </> : preliminary ? <>
      <Text style={styles.title}>{result.refinement_used ? t('exactNotConfirmed') : t('possibleMedicine')}</Text>
      <View style={styles.resultCard}>
        <Text style={styles.name}>{preliminary.possible_name}</Text>
        {!!preliminary.active_ingredient && <Text style={styles.text}><Text style={styles.bold}>{t('activeIngredient')}: </Text>{preliminary.active_ingredient}</Text>}
        {!!preliminary.strength && <Text style={styles.text}><Text style={styles.bold}>{t('possibleStrength')}: </Text>{preliminary.strength}</Text>}
        <Text style={styles.heading}>{t('commonUsage')}</Text>
        {commonUses.length ? commonUses.map((item, index) =>
          <Text key={`${item}-${index}`} style={styles.text}>• {item}</Text>)
          : <Text style={styles.text}>{t('usageUnavailable')}</Text>}
        <Text style={styles.dosageUnavailable}>{t('dosageUnverified')}</Text>
      </View>
      {possibleGuidance && <View style={styles.dosageCard}>
        <Text style={styles.heading}>{t('possibleDosage')}</Text>
        <Text style={styles.text}><Text style={styles.bold}>{t('adults')}: </Text>
          {possibleGuidance.adult_general_dosage || t('adultDoseHelp')}</Text>
        <Text style={styles.text}><Text style={styles.bold}>{t('children')}: </Text>
          {possibleGuidance.child_general_dosage || t('childDoseHelp')}</Text>
        {possibleGuidance.dosage_notes?.map((note, index) =>
          <Text key={`${note}-${index}`} style={styles.text}>• {note}</Text>)}
        <Text style={styles.dosageWarning}>{t('possibleDosageWarning')}</Text>
      </View>}
    </> : <>
      <Text style={styles.title}>{result.refinement_used ? t('exactNotConfirmed') : t('noResult')}</Text>
      <Text style={styles.text}>{result.refinement_used
        ? t('unresolvedTwoPhotos') : t('unresolvedPhoto')}</Text>
    </>}

    {refinementMode && <Text style={styles.refinementNote}>
      {t('firstResultRetained')}
    </Text>}

    {showRefinementActions && <View style={styles.refinementCard}>
      <Text style={styles.heading}>{t('confirmQuestion')}</Text>
      <Text style={styles.text}>{t('secondPhotoHelp')}</Text>
      <Pressable accessibilityRole="button" onPress={onStartRefinement} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>{t('scanPackage')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onFinish} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>{t('finishWithoutPhoto')}</Text>
      </Pressable>
    </View>}

    {refinementDismissed && !medicine && <Text style={styles.refinementNote}>
      {t('pharmacistFinish')}
    </Text>}

    <Text style={styles.warning}>{t('safetyDisclaimer')}</Text>
  </View>;
}

const baseStyles = StyleSheet.create({
  container: { gap: 12, marginTop: 18 },
  title: { fontSize: 21, fontWeight: '700', color: '#0f172a' },
  name: { fontSize: 20, lineHeight: 27, fontWeight: '700', color: '#1e3a8a' },
  heading: { fontSize: 16, fontWeight: '700', color: '#1e3a8a', marginTop: 6 },
  text: { fontSize: 15, lineHeight: 22, color: '#334155' },
  bold: { fontWeight: '700' },
  resultCard: { borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', padding: 14, borderRadius: 12, gap: 7 },
  dosageCard: { backgroundColor: '#fff7ed', padding: 14, borderRadius: 12, gap: 8 },
  dosageUnavailable: { color: '#991b1b', fontSize: 15, lineHeight: 22, backgroundColor: '#fef2f2', padding: 10, borderRadius: 8, marginTop: 5 },
  dosageWarning: { color: '#991b1b', fontSize: 14, lineHeight: 21, backgroundColor: '#fef2f2', padding: 10, borderRadius: 8 },
  warning: { color: '#92400e', fontSize: 14, lineHeight: 22, backgroundColor: '#fffbeb', padding: 10, borderRadius: 8 },
  speechButton: { backgroundColor: '#0f766e', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  stopButton: { backgroundColor: '#b91c1c' },
  speechButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  refinementCard: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 14, gap: 10 },
  refinementNote: { color: '#334155', fontSize: 14, lineHeight: 21, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10 },
  primaryButton: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderColor: '#94a3b8', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  secondaryButtonText: { color: '#334155', fontSize: 15, fontWeight: '700' },
});

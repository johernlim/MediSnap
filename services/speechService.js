import * as Speech from 'expo-speech';
import { getLanguageOption } from './languageService';

const phrases = {
  en: {
    verified: 'NPRA evidence-supported result',
    possible: 'Possible medicine. The exact product and strength are not confirmed',
    medicine: 'Medicine',
    ingredient: 'Active ingredient',
    strength: 'Strength',
    uses: 'Common uses',
    noUses: 'Reliable general-use information is not available in this result',
    adultDosage: 'General adult dosage', childDosage: 'General child dosage', dosageNotes: 'Dosage notes',
    dosageDisclaimer: 'This is general dosage information. For detailed dosage, read the instructions on the box or patient leaflet, or ask a doctor or pharmacist',
    dosageUnavailable: 'Dosage is unavailable because the medicine identity has not been verified',
    guidanceUnavailable: 'General dosage information is unavailable. Read the product instructions or ask a doctor or pharmacist',
    safety: 'Do not take a medicine based only on image recognition',
    noResult: 'No medicine result was found. Take a clear photo of the printed foil or box and ask a pharmacist for help',
  },
  ms: {
    verified: 'Keputusan disokong oleh rekod NPRA',
    possible: 'Ubat yang mungkin. Produk dan kekuatan yang tepat belum disahkan',
    medicine: 'Ubat',
    ingredient: 'Bahan aktif',
    strength: 'Kekuatan',
    uses: 'Kegunaan umum',
    noUses: 'Maklumat kegunaan umum yang boleh dipercayai tidak tersedia dalam keputusan ini',
    adultDosage: 'Dos umum dewasa', childDosage: 'Dos umum kanak-kanak', dosageNotes: 'Nota dos',
    dosageDisclaimer: 'Ini ialah maklumat dos umum. Untuk dos terperinci, baca arahan pada kotak atau risalah pesakit, atau tanya doktor atau ahli farmasi',
    dosageUnavailable: 'Maklumat dos tidak tersedia kerana identiti ubat belum disahkan',
    guidanceUnavailable: 'Maklumat dos umum tidak tersedia. Baca arahan produk atau tanya doktor atau ahli farmasi',
    safety: 'Jangan ambil ubat berdasarkan pengecaman imej sahaja',
    noResult: 'Tiada keputusan ubat ditemui. Ambil gambar jelas pada kerajang bercetak atau kotak dan minta bantuan ahli farmasi',
  },
  zh: {
    verified: '这是有马来西亚国家药品监管局记录支持的结果',
    possible: '可能的药品。确切产品和规格尚未确认',
    medicine: '药品',
    ingredient: '活性成分',
    strength: '规格',
    uses: '常见用途',
    noUses: '此结果没有可靠的一般用途资料',
    adultDosage: '成人一般剂量', childDosage: '儿童一般剂量', dosageNotes: '剂量说明',
    dosageDisclaimer: '这是一般剂量资料。详细剂量请阅读药盒或患者说明书上的指示，或咨询医生或药剂师',
    dosageUnavailable: '由于药品身份尚未核实，因此无法提供剂量资料',
    guidanceUnavailable: '一般剂量资料暂时无法提供。请阅读产品说明或咨询医生或药剂师',
    safety: '请勿仅根据图像识别结果服用药品',
    noResult: '找不到药品结果。请清楚拍摄印有文字的药板背面或药盒，并咨询药剂师',
  },
};

function firstAvailable(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function cleanIngredient(value) {
  return value?.replace(/\[[^\]]*\]/g, '').replace(/;+/g, ', ').trim() || '';
}

function findStrength(medicine, suggestion) {
  const source = [medicine?.strength, medicine?.product_name, medicine?.active_ingredient,
    suggestion?.strength].filter(Boolean).join(' ');
  return source.match(/\b\d+(?:\.\d+)?\s*(?:mcg|mg|g|ml|iu)\b/i)?.[0] || '';
}

export function buildMedicineSpeech(result, languageCode = 'en') {
  const language = phrases[languageCode] ? languageCode : 'en';
  const text = phrases[language];
  const parts = [];

  for (const detection of result?.detections || []) {
    const verifiedMedicine = detection.match?.medicine;
    const suggestion = detection.ai_suggestion;
    const preliminary = detection.preliminary_summary;
    const name = firstAvailable(verifiedMedicine?.product_name, preliminary?.possible_name,
      suggestion?.product_name, suggestion?.active_ingredient);

    if (!name) continue;

    parts.push(verifiedMedicine ? text.verified : text.possible);
    parts.push(`${text.medicine}: ${name}`);

    const ingredient = cleanIngredient(firstAvailable(verifiedMedicine?.active_ingredient,
      suggestion?.active_ingredient));
    const strength = verifiedMedicine ? findStrength(verifiedMedicine, suggestion) : '';
    if (ingredient) parts.push(`${text.ingredient}: ${ingredient}`);
    if (strength) parts.push(`${text.strength}: ${strength}`);

    const uses = verifiedMedicine
      ? (detection.general_guidance?.common_uses || detection.common_uses || [])
      : (preliminary?.common_uses || suggestion?.common_uses || []);
    parts.push(uses.length ? `${text.uses}: ${uses.join('. ')}` : text.noUses);
    const guidance = detection.general_guidance;
    const possibleGuidance = detection.possible_guidance;
    if (verifiedMedicine && guidance) {
      if (guidance.adult_general_dosage) parts.push(`${text.adultDosage}: ${guidance.adult_general_dosage}`);
      if (guidance.child_general_dosage) parts.push(`${text.childDosage}: ${guidance.child_general_dosage}`);
      if (guidance.dosage_notes?.length) parts.push(`${text.dosageNotes}: ${guidance.dosage_notes.join('. ')}`);
      parts.push(text.dosageDisclaimer);
    } else if (verifiedMedicine) {
      parts.push(text.guidanceUnavailable);
    } else if (possibleGuidance) {
      if (possibleGuidance.adult_general_dosage) parts.push(`${text.adultDosage}: ${possibleGuidance.adult_general_dosage}`);
      if (possibleGuidance.child_general_dosage) parts.push(`${text.childDosage}: ${possibleGuidance.child_general_dosage}`);
      if (possibleGuidance.dosage_notes?.length) parts.push(`${text.dosageNotes}: ${possibleGuidance.dosage_notes.join('. ')}`);
      parts.push(text.dosageDisclaimer);
    } else {
      parts.push(text.dosageUnavailable);
    }
    parts.push(text.safety);
  }

  return parts.length ? parts.join('. ') : text.noResult;
}

export async function speakMedicineResult(result, languageCode, callbacks = {}) {
  await Speech.stop();
  const option = getLanguageOption(languageCode);
  const speechText = buildMedicineSpeech(result, option.code);
  const maximum = Number.isFinite(Speech.maxSpeechInputLength)
    ? Speech.maxSpeechInputLength
    : speechText.length;

  Speech.speak(speechText.slice(0, maximum), {
    language: option.speechCode,
    rate: 0.88,
    pitch: 1,
    volume: 1,
    useApplicationAudioSession: false,
    onStart: callbacks.onStart,
    onDone: callbacks.onDone,
    onStopped: callbacks.onStopped,
    onError: callbacks.onError,
  });
}

export function stopMedicineSpeech() {
  return Speech.stop();
}

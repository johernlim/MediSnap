import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

export async function identifyMedicineFromImage(imageAsset, language = 'en', previousEvidence = null) {
  const base = process.env.EXPO_PUBLIC_RECOGNITION_API_URL?.replace(/\/$/, '');
  if (!base) throw new Error('Set EXPO_PUBLIC_RECOGNITION_API_URL to the FastAPI backend address and restart Expo.');
  if (!imageAsset?.uri) throw new Error('Choose a medicine image first.');
  const form = new FormData();
  form.append('language', language);
  if (previousEvidence) form.append('previous_evidence', JSON.stringify(previousEvidence));
  const type = imageAsset.mimeType || 'image/jpeg';
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
  if (!extension) throw new Error('Choose a JPEG, PNG, or WEBP photo.');
  const name = imageAsset.fileName || `medicine.${extension}`;
  if (Platform.OS === 'web') {
    const blob = imageAsset.file || await (await fetch(imageAsset.uri)).blob();
    form.append('image', blob, name);
  } else {
    // Gallery providers can report JPEG metadata for PNG/WEBP/HEIC bytes.
    // Re-encoding also strips metadata and bounds upload size consistently.
    const context = ImageManipulator.manipulate(imageAsset.uri);
    const width = Number(imageAsset.width) || 0;
    const height = Number(imageAsset.height) || 0;
    if (Math.max(width, height) > 2048) {
      context.resize(width >= height ? { width: 2048, height: null } : { width: null, height: 2048 });
    }
    const rendered = await context.renderAsync();
    const normalized = await rendered.saveAsync({ compress: 0.95, format: SaveFormat.JPEG });
    // Expo's fetch accepts Blob-compatible File instances and rejects the
    // legacy React Native `{ uri, name, type }` FormData shape.
    form.append('image', new File(normalized.uri));
  }
  const controller = new AbortController();
  // Allow multiple independently processed crops; no automatic paid retries.
  const timeout = setTimeout(() => controller.abort(), 600000);
  try {
    const response = await fetch(`${base}/api/recognize`, {
      method: 'POST', body: form, signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Recognition is unavailable.');
    if (!result.status || !Array.isArray(result.detections)) throw new Error('Unexpected recognition response.');
    return result;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Recognition timed out. Try a photo with fewer medicines.');
    if (error instanceof TypeError) throw new Error('Cannot reach recognition. Check the backend address and connection.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

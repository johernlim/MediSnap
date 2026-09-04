import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Photo capture for medications.
 *
 * The image is stored as a base64 data URI inside the medication document
 * rather than in Cloud Storage, because Cloud Storage for Firebase requires
 * the Blaze billing plan since September 2024 and this project is on Spark.
 * That makes size the binding constraint: a Firestore document cannot exceed
 * 1 MB, so every photo is resized and compressed before it is encoded.
 */

// 500px is enough to recognise a tablet or a box on a phone screen, and keeps
// the encoded string well inside the document limit.
const TARGET_WIDTH = 500;
const COMPRESSION = 0.5;

// Base64 inflates bytes by about a third. 700 KB of string leaves comfortable
// headroom under Firestore's 1 MB document ceiling for the other fields.
const MAX_ENCODED_LENGTH = 700 * 1024;

async function toStoredPhoto(asset) {
  const result = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: TARGET_WIDTH } }],
    {
      compress: COMPRESSION,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!result.base64) {
    throw new Error('Could not read the selected image.');
  }

  const dataUri = `data:image/jpeg;base64,${result.base64}`;

  if (dataUri.length > MAX_ENCODED_LENGTH) {
    throw new Error(
      'That photo is too large even after compression. Please try a closer or simpler picture.'
    );
  }

  return dataUri;
}

/**
 * Opens the camera. Returns a data URI, or null when the user backs out.
 * Throws with a readable message when permission is refused.
 */
export async function captureMedicationPhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      'Camera access is needed to take a photo. You can allow it in your device settings.'
    );
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  return toStoredPhoto(result.assets[0]);
}

/** Opens the photo library. Returns a data URI, or null when cancelled. */
export async function pickMedicationPhoto() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      'Photo access is needed to choose a picture. You can allow it in your device settings.'
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  return toStoredPhoto(result.assets[0]);
}

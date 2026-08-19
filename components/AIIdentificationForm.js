import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

export default function AIIdentificationForm({
  selectedImage,
  predictedResult,
  identifying,
  onPickCamera,
  onPickGallery,
  onIdentify,
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Identify Medicine</Text>

      <View style={styles.previewBox}>
        {selectedImage?.uri ? (
          <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
        ) : (
          <Text style={styles.previewPlaceholder}>
            No image selected yet.
          </Text>
        )}
      </View>

      <Pressable style={styles.secondaryButton} onPress={onPickCamera}>
        <Text style={styles.secondaryButtonText}>Capture Image Using Camera</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={onPickGallery}>
        <Text style={styles.secondaryButtonText}>Upload Image From Gallery</Text>
      </Pressable>

      <Pressable
        style={[styles.primaryButton, identifying && styles.disabledButton]}
        onPress={onIdentify}
        disabled={identifying}
      >
        <Text style={styles.primaryButtonText}>
          {identifying ? 'Identifying...' : 'Identify Medicine'}
        </Text>
      </Pressable>

      <View style={styles.resultCard}>
        <Text style={styles.resultTitle}>Predicted Result</Text>
        <Text style={styles.resultText}>
          {predictedResult || 'No result yet. Select an image and press Identify Medicine.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    resizeMode: 'cover',
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

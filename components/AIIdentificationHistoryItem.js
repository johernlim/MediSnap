import { Image, StyleSheet, Text, View } from 'react-native';

export default function AIIdentificationHistoryItem({ item }) {
  const createdAtText = item.created_at?.seconds
    ? new Date(item.created_at.seconds * 1000).toLocaleString()
    : 'Just now';

  return (
    <View style={styles.card}>
      <View style={styles.imageWrapper}>
        {item.image_uri ? (
          <Image source={{ uri: item.image_uri }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>No image</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Predicted Result</Text>
        <Text style={styles.resultText}>{item.predicted_result}</Text>

        <Text style={styles.dateText}>{createdAtText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
  },
  imageWrapper: {
    width: 82,
    height: 82,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    marginRight: 14,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    color: '#64748b',
    fontSize: 12,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 13,
    color: '#64748b',
  },
});

import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import AIIdentificationHistoryItem from '../components/AIIdentificationHistoryItem';
import { auth } from '../firebaseConfig';
import {
  identifyMedicineFromImage,
  saveIdentificationResult,
  subscribeToUserIdentificationHistory,
} from '../services/aiIdentificationService';

export default function AIIdentificationScreen() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [predictedResult, setPredictedResult] = useState('');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [identifying, setIdentifying] = useState(false);

  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setLoadingHistory(false);
      return undefined;
    }

    const unsubscribe = subscribeToUserIdentificationHistory(
      currentUser.uid,
      (items) => {
        setHistory(items);
        setLoadingHistory(false);
      },
      (error) => {
        console.error('Failed to load identification history:', error);
        Alert.alert('Error', 'Unable to load identification history right now.');
        setLoadingHistory(false);
      }
    );

    return unsubscribe;
  }, []);

  const requestCameraPermission = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission required', 'Camera permission is needed to take a photo.');
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
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0]);
      setPredictedResult('');
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0]);
      setPredictedResult('');
    }
  };

  const handleIdentify = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      Alert.alert('Login required', 'Please log in to use AI identification.');
      return;
    }

    if (!selectedImage?.uri) {
      Alert.alert('No image selected', 'Please capture or upload an image first.');
      return;
    }

    setIdentifying(true);

    try {
      const result = await identifyMedicineFromImage(selectedImage);
      setPredictedResult(result);

      await saveIdentificationResult({
        user_id: currentUser.uid,
        image_uri: selectedImage.uri,
        predicted_result: result,
      });

      Alert.alert('Identification complete', 'Medicine result saved successfully.');
    } catch (error) {
      console.error('Failed to identify medicine:', error);
      Alert.alert('Error', 'Unable to identify the medicine right now.');
    } finally {
      setIdentifying(false);
    }
  };

  const currentUser = auth.currentUser;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>AI Medicine Identification</Text>
        <Text style={styles.subtitle}>
          Capture or upload a medicine image, preview it, identify it, and save the result.
        </Text>

        {!currentUser ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No authenticated user found.</Text>
          </View>
        ) : (
          <>
            <AIIdentificationForm
              selectedImage={selectedImage}
              predictedResult={predictedResult}
              identifying={identifying}
              onPickCamera={pickFromCamera}
              onPickGallery={pickFromGallery}
              onIdentify={handleIdentify}
            />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Identification History</Text>
              <Text style={styles.countText}>{history.length} item(s)</Text>
            </View>

            {loadingHistory ? (
              <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
            ) : history.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No identification history yet.</Text>
              </View>
            ) : (
              history.map((item) => (
                <AIIdentificationHistoryItem key={item.id} item={item} />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  countText: {
    fontSize: 14,
    color: '#64748b',
  },
  loader: {
    marginTop: 24,
  },
  emptyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
  },
});

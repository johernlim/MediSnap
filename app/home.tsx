import { signOut } from 'firebase/auth';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../firebaseConfig';

export default function HomeScreen() {
  const handleLogout = async () => {
    await signOut(auth);
  
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to MediSnap</Text>
      <Text style={styles.subtitle}>Login successful</Text>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 12 },
  subtitle: { fontSize: 18, marginBottom: 24 },
  button: { backgroundColor: '#dc2626', padding: 14, borderRadius: 10, width: 180 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
});
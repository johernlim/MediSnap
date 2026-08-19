import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function ProfileViewCard({ profile, onEdit }) {
  const renderRow = (label, value) => (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value ? String(value) : '-'}</Text>
    </View>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Profile Information</Text>

      {renderRow('Username', profile.username)}
      {renderRow('Email', profile.email)}
      {renderRow('Full Name', profile.full_name)}
      {renderRow('Age', profile.age)}
      {renderRow('Gender', profile.gender)}
      {renderRow('Height', profile.height ? `${profile.height} cm` : '')}
      {renderRow('Weight', profile.weight ? `${profile.weight} kg` : '')}

      <Pressable style={styles.editButton} onPress={onEdit}>
        <Text style={styles.editButtonText}>Edit Profile</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 14,
  },
  row: {
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
  },
  editButton: {
    marginTop: 12,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

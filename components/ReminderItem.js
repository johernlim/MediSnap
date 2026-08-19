import { Pressable, StyleSheet, Text, View } from 'react-native';

function formatCreatedAt(createdAt) {
  if (!createdAt) {
    return 'Just now';
  }

  if (createdAt.seconds) {
    return new Date(createdAt.seconds * 1000).toLocaleString();
  }

  return String(createdAt);
}

function formatStartDate(startDate) {
  if (!startDate) {
    return '-';
  }

  if (startDate.seconds) {
    return new Date(startDate.seconds * 1000).toLocaleDateString();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(startDate))) {
    const [year, month, day] = String(startDate).split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString();
  }

  return String(startDate);
}

function formatReminderTimes(reminderTimes) {
  if (!Array.isArray(reminderTimes) || reminderTimes.length === 0) {
    return '-';
  }

  return reminderTimes.join(', ');
}

function formatScheduleText(item) {
  if (item.repeat_type === 'Weekly') {
    return item.weekly_day ? `Every ${item.weekly_day}` : 'Every week';
  }

  if (item.repeat_type === 'Monthly') {
    return item.monthly_day ? `Every month on day ${item.monthly_day}` : 'Every month';
  }

  return 'Every day';
}

export default function ReminderItem({ item, medName, onEdit, onDelete }) {
  const createdAtText = formatCreatedAt(item.created_at);
  const isActive = item.reminder_status === 'Active';
  const scheduleText = formatScheduleText(item);

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.medName}>{medName}</Text>
        <View style={[styles.statusBadge, isActive ? styles.activeBadge : styles.inactiveBadge]}>
          <Text style={styles.statusText}>{item.reminder_status}</Text>
        </View>
      </View>

      <Text style={styles.detail}>Repeat: {item.repeat_type || '-'}</Text>
      <Text style={styles.detail}>Schedule: {scheduleText}</Text>
      <Text style={styles.detail}>Times per period: {item.times_per_period || '-'}</Text>
      <Text style={styles.detail}>Reminder times: {formatReminderTimes(item.reminder_times)}</Text>
      <Text style={styles.detail}>Start date: {formatStartDate(item.start_date)}</Text>
      <Text style={styles.dateText}>Created: {createdAtText}</Text>

      <View style={styles.actionRow}>
        <Pressable style={[styles.actionButton, styles.editButton]} onPress={() => onEdit(item)}>
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>

        <Pressable
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => onDelete(item)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activeBadge: {
    backgroundColor: '#dcfce7',
  },
  inactiveBadge: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  detail: {
    fontSize: 15,
    color: '#334155',
    marginTop: 10,
  },
  dateText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 10,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#dbeafe',
    marginRight: 10,
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
  },
  editButtonText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 15,
  },
  deleteButtonText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 15,
  },
});

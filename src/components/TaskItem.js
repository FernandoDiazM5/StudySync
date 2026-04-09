// ============================================
// TASK ITEM COMPONENT - StudySync
// Componente individual de tarea (extraído de L766-796)
// ============================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CheckSquare, Clock, Users, AlertCircle, Pencil } from 'lucide-react-native';
import { isOverdue, formatDate } from '../utils/dateUtils';
import { useTheme } from '../contexts/ThemeContext';

export default function TaskItem({ task, assigneeName, onToggleStatus, onEdit, isLeader }) {
  const { theme, isDark } = useTheme();
  const isCompleted = task.status === 'Completada';
  const isInProgress = task.status === 'En progreso';
  const overdue = !isCompleted && isOverdue(task.dueDate);

  const getBorderColor = () => {
    if (isCompleted) return '#BBF7D0';
    if (overdue) return '#F87171';
    return theme.border;
  };

  const getBgColor = () => {
    if (isCompleted) return isDark ? '#052e16' : '#F0FDF4';
    if (overdue) return isDark ? '#450a0a' : '#FEF2F2';
    return theme.card;
  };

  const getCheckboxStyle = () => {
    if (isCompleted) return { backgroundColor: '#22C55E', borderColor: '#22C55E' };
    if (isInProgress) return { backgroundColor: '#6366F1', borderColor: '#6366F1' };
    return { backgroundColor: 'transparent', borderColor: '#D1D5DB' };
  };

  return (
    <View style={[styles.container, { borderColor: getBorderColor(), backgroundColor: getBgColor() }]}>
      {/* Checkbox */}
      <TouchableOpacity
        onPress={() => onToggleStatus(task.id, task.status)}
        style={[styles.checkbox, getCheckboxStyle()]}
        activeOpacity={0.7}
      >
        {isCompleted && <CheckSquare color="#FFFFFF" size={16} />}
        {isInProgress && <Clock color="#FFFFFF" size={16} />}
        {!isCompleted && !isInProgress && (
          <View style={styles.emptyCheckbox} />
        )}
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[
            styles.title,
            { color: theme.text },
            isCompleted && styles.titleCompleted,
            overdue && styles.titleOverdue
          ]}>
            {task.title}
          </Text>
          {isLeader && (
            <TouchableOpacity onPress={() => onEdit?.(task)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Pencil color="#6B7280" size={14} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.assigneeBadge, { backgroundColor: theme.input, borderColor: theme.border }]}>
            <Users color={theme.textSecondary} size={12} />
            <Text style={[styles.assigneeText, { color: theme.textSecondary }]}>
              {assigneeName || 'Sin asignar'}
            </Text>
          </View>

          {!isCompleted && task.dueDate && task.dueDate !== 'Sin fecha' && (
            <View style={styles.dueDateContainer}>
              <AlertCircle
                color={overdue ? '#DC2626' : '#D97706'}
                size={12}
              />
              <Text style={[
                styles.dueDateText,
                overdue ? styles.dueDateOverdue : styles.dueDatePending
              ]}>
                {overdue ? 'Vencida: ' : 'Vence: '}{formatDate(task.dueDate)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  emptyCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  titleCompleted: {
    color: '#6B7280',
    textDecorationLine: 'line-through',
  },
  titleOverdue: {
    color: '#B91C1C',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  assigneeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  assigneeText: {
    fontSize: 11,
    color: '#4B5563',
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueDateText: {
    fontSize: 11,
    fontWeight: '500',
  },
  dueDateOverdue: {
    color: '#DC2626',
  },
  dueDatePending: {
    color: '#D97706',
  },
});

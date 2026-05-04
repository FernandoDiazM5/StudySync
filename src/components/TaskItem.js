// ============================================
// TASK ITEM COMPONENT - StudySync
// Tarea individual con subtareas y fechas
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import Text from './AppText';
import SwipeableRow from './SwipeableRow';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  CheckSquare,
  Clock,
  Users,
  AlertCircle,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Plus,
  X,
  Calendar,
  Flag,
} from 'lucide-react-native';
import { isOverdue, formatDate } from '../utils/dateUtils';
import { suggestSubtasks } from '../utils/subtaskSuggestions';
import { useTheme } from '../contexts/ThemeContext';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { useAuth } from '../contexts/AuthContext';

// ─── Prioridad ────────────────────────────────────────────────────────────────
const PRIORITY_COLORS = {
  alta:  { bg: '#FEE2E2', text: '#DC2626', accent: '#DC2626' },
  media: { bg: '#FEF3C7', text: '#B45309', accent: '#D97706' },
  baja:  { bg: '#DBEAFE', text: '#1D4ED8', accent: '#3B82F6' },
};
const PRIORITY_NEXT  = { alta: 'media', media: 'baja', baja: null };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** "2025-06-15" → "15 jun." (locale según idioma de la app) */
const fmtSubDate = (iso, locale = 'es-ES') => {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
};

/** Date → "YYYY-MM-DD" */
const toISO = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// ─── Componente ───────────────────────────────────────────────────────────────
export default function TaskItem({
  task,
  assigneeName,
  onToggleStatus,
  onEdit,
  onDelete,
  isLeader,
  /** Si no se pasa, equivale a isLeader (compatibilidad). */
  canToggleStatus: canToggleStatusProp,
  onSubtasksChange,
  onPriorityChange,
  /** Prioridad visible en este grupo solo si el líder del grupo tiene plan Personal (`leaderPlan`). */
  groupLeaderHasPersonalPlan = false,
  /** Líder: requiere plan Personal propio. Moderador: basta con que el líder del grupo tenga Personal. */
  canChangeTaskPriority = false,
}) {
  const { theme, isDark } = useTheme();
  const { t, language } = useAccessibility();
  const { userProfile, user } = useAuth();
  const isSubscriber = (userProfile?.plan || 'free') === 'personal';
  const isAssignee = Boolean(user?.uid && task.assigneeId === user.uid);
  const subDateLocale = language === 'en' ? 'en-US' : 'es-ES';
  const canToggleStatus =
    canToggleStatusProp !== undefined ? canToggleStatusProp : isLeader;

  useEffect(() => {
    if (!isSubscriber || !isAssignee) setSuggestions(null);
  }, [isSubscriber, isAssignee, task.id, task.assigneeId]);

  const priorityShort = (p) => {
    if (p === 'alta') return t('high').toUpperCase();
    if (p === 'media') return t('medium').toUpperCase();
    if (p === 'baja') return t('low').toUpperCase();
    return '';
  };

  const isCompleted = task.status === 'Completada';
  const isInProgress = task.status === 'En progreso';
  const overdue = !isCompleted && isOverdue(task.dueDate);

  // ── Estado de subtareas ───────────────────────────────────────────────────
  const subtasks = task.subtasks || [];
  const doneCount = subtasks.filter((s) => s.done).length;
  const subPct =
    subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;

  const [expanded, setExpanded] = useState(false);

  // Input nueva subtarea
  const [newText, setNewText] = useState('');
  const [newDate, setNewDate] = useState(null); // "YYYY-MM-DD" | null

  // Date pickers
  // 'new' = para la nueva subtarea | '<id>' = para la subtarea existente con ese id
  const [pickerTarget, setPickerTarget] = useState(null); // null = cerrado

  // Sugerencias
  const [suggestions, setSuggestions] = useState(null);

  // ── Handlers de subtareas ─────────────────────────────────────────────────
  const toggleSubtask = (subtaskId) => {
    const updated = subtasks.map((s) =>
      s.id === subtaskId ? { ...s, done: !s.done } : s,
    );
    onSubtasksChange?.(task.id, updated);
  };

  const addSubtask = () => {
    if (!isSubscriber || !isAssignee) return;
    const text = newText.trim();
    if (!text) return;
    const updated = [
      ...subtasks,
      {
        id: uid(),
        title: text,
        done: false,
        createdAt: new Date().toISOString(),
        ...(newDate ? { dueDate: newDate } : {}),
      },
    ];
    onSubtasksChange?.(task.id, updated);
    setNewText('');
    setNewDate(null);
  };

  const deleteSubtask = (subtaskId) => {
    onSubtasksChange?.(task.id, subtasks.filter((s) => s.id !== subtaskId));
  };

  const setSubtaskDate = (subtaskId, iso) => {
    const updated = subtasks.map((s) =>
      s.id === subtaskId ? { ...s, dueDate: iso || null } : s,
    );
    onSubtasksChange?.(task.id, updated);
  };

  // ── Date picker ───────────────────────────────────────────────────────────
  const openPicker = (target) => {
    setPickerTarget(target); // 'new' o un subtask id
  };

  const handlePickerChange = (event, selectedDate) => {
    // En Android se cierra solo; en iOS persiste
    const keepOpen = Platform.OS === 'ios';

    if (!keepOpen) setPickerTarget(null);

    if (!selectedDate) return;
    const iso = toISO(selectedDate);

    if (pickerTarget === 'new') {
      setNewDate(iso);
      if (!keepOpen) setPickerTarget(null);
    } else if (pickerTarget) {
      setSubtaskDate(pickerTarget, iso);
      setPickerTarget(null);
    }
  };

  // Fecha inicial del picker: fecha actual o la que ya tenga el target
  const pickerInitialDate = () => {
    if (!pickerTarget) return new Date();
    if (pickerTarget === 'new') {
      return newDate ? new Date(newDate + 'T00:00:00') : new Date();
    }
    const sub = subtasks.find((s) => s.id === pickerTarget);
    return sub?.dueDate ? new Date(sub.dueDate + 'T00:00:00') : new Date();
  };

  // ── Sugerencias (reglas locales) ──────────────────────────────────────────
  const showSuggestions = () => {
    if (!isSubscriber || !isAssignee) return;
    const titles = suggestSubtasks(task.title);
    const existing = new Set(subtasks.map((s) => s.title.toLowerCase()));
    const filtered = titles.filter((t) => !existing.has(t.toLowerCase()));
    if (!filtered.length) return;
    setSuggestions(filtered.map((title) => ({ id: uid(), title, selected: true })));
    if (!expanded) setExpanded(true);
  };

  const toggleSuggestion = (sugId) =>
    setSuggestions((prev) =>
      prev.map((s) => (s.id === sugId ? { ...s, selected: !s.selected } : s)),
    );

  const acceptSuggestions = () => {
    if (!isSubscriber || !isAssignee || !suggestions) return;
    const toAdd = suggestions
      .filter((s) => s.selected)
      .map((s) => ({ id: uid(), title: s.title, done: false, createdAt: new Date().toISOString() }));
    if (toAdd.length) onSubtasksChange?.(task.id, [...subtasks, ...toAdd]);
    setSuggestions(null);
  };

  // ── Estilos dinámicos ─────────────────────────────────────────────────────
  const getBorderColor = () => {
    if (isCompleted) return isDark ? '#2d6e42' : '#BBF7D0';
    if (overdue)     return isDark ? '#8c3030' : '#F87171';
    return theme.border;
  };
  const getBgColor = () => {
    if (isCompleted) return isDark ? '#132b1a' : '#F0FDF4';
    if (overdue)     return isDark ? '#2b1414' : '#FEF2F2';
    return theme.card;
  };
  const getCheckboxStyle = () => {
    if (isCompleted) return { backgroundColor: '#22C55E', borderColor: '#22C55E' };
    if (isInProgress) return { backgroundColor: '#6366F1', borderColor: '#6366F1' };
    return { backgroundColor: 'transparent', borderColor: '#D1D5DB' };
  };

  const swipeActions =
    isLeader && onDelete
      ? [
          {
            icon: <Trash2 color="#FFFFFF" size={20} />,
            label: t('delete') || 'Eliminar',
            bgColor: '#4338CA',
            onPress: () => onDelete(task.id, task.title),
          },
        ]
      : [];

  const divider = isDark ? '#1F2937' : '#F3F4F6';
  const hasSubtasks = subtasks.length > 0;
  /** Plan personal + tarea asignada a mí: sugerencias, subtareas y fechas (no en tareas de otros miembros). */
  const canManageSubtasks = isSubscriber && !isCompleted && isAssignee;
  const canSuggestOrCreateSubtasks = canManageSubtasks;
  const showPriorityInGroup = groupLeaderHasPersonalPlan;

  // ── JSX ───────────────────────────────────────────────────────────────────
  const content = (
    <View style={[styles.container, { borderColor: getBorderColor(), backgroundColor: getBgColor() }]}>

      {/* ════════════════════════════════════════════════════
          FILA PRINCIPAL
          ════════════════════════════════════════════════════ */}
      <View style={styles.mainRow}>
        <TouchableOpacity
          onPress={() => {
            if (canToggleStatus) onToggleStatus?.(task.id, task.status);
          }}
          disabled={!canToggleStatus}
          style={[
            styles.checkbox,
            getCheckboxStyle(),
            !canToggleStatus && { opacity: 0.45 },
          ]}
          activeOpacity={canToggleStatus ? 0.7 : 1}
          accessible
          accessibilityRole="button"
          accessibilityLabel={
            isCompleted ? `Tarea ${task.title}, completada`
            : isInProgress ? `Tarea ${task.title}, en progreso`
            : `Tarea ${task.title}, pendiente`
          }
          accessibilityState={{ checked: isCompleted, disabled: !canToggleStatus }}
        >
          {isCompleted && <CheckSquare color="#FFF" size={16} />}
          {isInProgress && <Clock color="#FFF" size={16} />}
          {!isCompleted && !isInProgress && <View style={[styles.emptyCheckbox, { borderColor: isDark ? '#4B5563' : '#D1D5DB' }]} />}
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[
              styles.title,
              { color: theme.text },
              isCompleted && { color: theme.textMuted, textDecorationLine: 'line-through' },
              overdue && { color: isDark ? '#F87171' : '#B91C1C' },
            ]}>
              {task.title}
            </Text>
            {/* Prioridad: visible si el líder del grupo tiene Personal; editar según canChangeTaskPriority */}
            {showPriorityInGroup && (task.priority ? (
              canChangeTaskPriority ? (
                <TouchableOpacity
                  onPress={() => onPriorityChange?.(task.id, PRIORITY_NEXT[task.priority] ?? null)}
                  style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[task.priority].bg }]}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Flag color={PRIORITY_COLORS[task.priority].text} size={10} strokeWidth={2.5} />
                  <Text style={[styles.priorityTxt, { color: PRIORITY_COLORS[task.priority].text }]} numberOfLines={1}>
                    {priorityShort(task.priority)}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View
                  style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[task.priority].bg }]}
                  accessibilityRole="text"
                >
                  <Flag color={PRIORITY_COLORS[task.priority].text} size={10} strokeWidth={2.5} />
                  <Text style={[styles.priorityTxt, { color: PRIORITY_COLORS[task.priority].text }]} numberOfLines={1}>
                    {priorityShort(task.priority)}
                  </Text>
                </View>
              )
            ) : canChangeTaskPriority ? (
              <TouchableOpacity
                onPress={() => onPriorityChange?.(task.id, 'alta')}
                style={[styles.priorityEmpty, {
                  borderColor: isDark ? '#374151' : '#E5E7EB',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
                }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.6}
              >
                <Flag color={isDark ? '#6B7280' : '#9CA3AF'} size={10} strokeWidth={2} />
                <Text style={[styles.priorityEmptyTxt, { color: isDark ? '#6B7280' : '#9CA3AF' }]} numberOfLines={1}>
                  {t('priority')}
                </Text>
              </TouchableOpacity>
            ) : null)}

            {isLeader && (
              <TouchableOpacity
                onPress={() => onEdit?.(task)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Editar tarea ${task.title}`}
              >
                <Pencil color="#6B7280" size={14} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.metaRow}>
            <View style={[styles.assigneeBadge, { backgroundColor: theme.input, borderColor: theme.border }]}>
              <Users color={theme.textSecondary} size={12} />
              <Text style={[styles.assigneeText, { color: theme.textSecondary }]}>
                {assigneeName || t('unassigned')}
              </Text>
            </View>
            {!isCompleted && task.dueDate && task.dueDate !== 'Sin fecha' && (
              <View style={styles.dueDateContainer}>
                <AlertCircle color={overdue ? '#DC2626' : '#D97706'} size={12} />
                <Text style={[styles.dueDateText, overdue ? styles.dueDateOverdue : styles.dueDatePending]}>
                  {overdue ? t('overdue') : t('dueBy')}: {formatDate(task.dueDate)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ════════════════════════════════════════════════════
          SECCIÓN DE SUBTAREAS (ancho completo)
          ════════════════════════════════════════════════════ */}
      {(hasSubtasks || canSuggestOrCreateSubtasks) && (
        <>
          {/* ── Divisor inset ── */}
          <View style={[styles.subDivider, { backgroundColor: divider }]} />

          {/* ── Barra resumen / toggle ── */}
          <View style={styles.subHeader}>
            <TouchableOpacity
              style={styles.subToggle}
              onPress={() => setExpanded((v) => !v)}
              activeOpacity={0.65}
              hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
            >
              {expanded
                ? <ChevronUp color={isDark ? '#6B7280' : '#9CA3AF'} size={15} />
                : <ChevronDown color={isDark ? '#6B7280' : '#9CA3AF'} size={15} />
              }
              <Text style={[styles.subLabel, { color: isDark ? '#818CF8' : '#6366F1' }]}>
                {hasSubtasks ? t('subtasks') : t('addSubtasksHint')}
              </Text>
              {hasSubtasks && (
                <>
                  <View style={[styles.subBarBg, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}>
                    <View style={[styles.subBarFill, {
                      width: `${subPct}%`,
                      backgroundColor: subPct === 100 ? '#22C55E' : '#6366F1',
                    }]} />
                  </View>
                  <Text style={[styles.subCount, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                    {doneCount}/{subtasks.length}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {canSuggestOrCreateSubtasks && (
              <TouchableOpacity
                style={[styles.suggestBtn, { backgroundColor: isDark ? 'rgba(124,58,237,0.18)' : '#F5F3FF' }]}
                onPress={showSuggestions}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t('suggestSubtasks')}
              >
                <Lightbulb color="#7C3AED" size={13} />
                <Text style={styles.suggestBtnTxt}>{t('suggestSubtasks')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Panel expandido ── */}
          {expanded && (
            <View style={styles.subPanel}>

              {/* Lista de subtareas existentes */}
              {subtasks.map((sub) => {
                const subOverdue = !sub.done && sub.dueDate && isOverdue(sub.dueDate);
                const dateTxt = fmtSubDate(sub.dueDate, subDateLocale);
                return (
                  <View key={sub.id} style={[
                    styles.subRow,
                    subOverdue && { backgroundColor: isDark ? 'rgba(220,38,38,0.06)' : '#FFF5F5', borderRadius: 6 },
                  ]}>
                    {/* Checkbox circular */}
                    <TouchableOpacity
                      onPress={() => isAssignee && toggleSubtask(sub.id)}
                      disabled={!isAssignee}
                      style={[
                        styles.subCheck,
                        sub.done
                          ? { backgroundColor: '#22C55E', borderColor: '#22C55E' }
                          : { backgroundColor: 'transparent', borderColor: isDark ? '#4B5563' : '#D1D5DB' },
                        !isAssignee && { opacity: 0.45 },
                      ]}
                      activeOpacity={isAssignee ? 0.7 : 1}
                    >
                      {sub.done && <View style={styles.subCheckInner} />}
                    </TouchableOpacity>

                    {/* Título */}
                    <Text style={[
                      styles.subTitle,
                      { color: theme.text, flex: 1 },
                      sub.done && styles.subTitleDone,
                    ]} numberOfLines={2}>
                      {sub.title}
                    </Text>

                    {/* Chip de fecha */}
                    <TouchableOpacity
                      onPress={() => canManageSubtasks && openPicker(sub.id)}
                      style={[
                        styles.subDateChip,
                        dateTxt
                          ? subOverdue
                            ? { backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#FEE2E2', borderColor: '#F87171' }
                            : { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF', borderColor: isDark ? '#4F46E5' : '#A5B4FC' }
                          : { backgroundColor: 'transparent', borderColor: isDark ? '#374151' : '#E5E7EB' },
                      ]}
                      activeOpacity={canManageSubtasks ? 0.7 : 1}
                    >
                      <Calendar
                        size={11}
                        color={dateTxt
                          ? subOverdue ? '#DC2626' : '#6366F1'
                          : isDark ? '#4B5563' : '#9CA3AF'
                        }
                      />
                      {dateTxt ? (
                        <>
                          <Text style={[
                            styles.subDateTxt,
                            { color: subOverdue ? '#DC2626' : isDark ? '#818CF8' : '#4F46E5' },
                          ]}>
                            {dateTxt}
                          </Text>
                          {canManageSubtasks && (
                            <TouchableOpacity
                              onPress={(e) => { e.stopPropagation?.(); setSubtaskDate(sub.id, null); }}
                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                            >
                              <X size={10} color={subOverdue ? '#DC2626' : isDark ? '#818CF8' : '#6366F1'} />
                            </TouchableOpacity>
                          )}
                        </>
                      ) : null}
                    </TouchableOpacity>

                    {/* Eliminar subtarea */}
                    {canManageSubtasks && (
                      <TouchableOpacity
                        onPress={() => deleteSubtask(sub.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X color={isDark ? '#6B7280' : '#9CA3AF'} size={13} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              {/* ── Input para agregar (plan personal) ── */}
              {canSuggestOrCreateSubtasks && (
                <View style={[styles.addRow, { borderTopColor: divider, marginTop: subtasks.length > 0 ? 4 : 0, borderTopWidth: subtasks.length > 0 ? 1 : 0 }]}>
                  <TextInput
                    style={[
                      styles.addInput,
                      { color: theme.text, backgroundColor: isDark ? '#1F2937' : '#F9FAFB', borderColor: isDark ? '#374151' : '#E5E7EB' },
                    ]}
                    placeholder={t('newSubtaskPlaceholder')}
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    value={newText}
                    onChangeText={setNewText}
                    onSubmitEditing={addSubtask}
                    returnKeyType="done"
                    maxLength={80}
                    blurOnSubmit={false}
                  />

                  {/* Botón fecha (nueva subtarea) */}
                  <TouchableOpacity
                    onPress={() => openPicker('new')}
                    style={[
                      styles.addDateBtn,
                      newDate
                        ? { backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#EEF2FF', borderColor: isDark ? '#4F46E5' : '#A5B4FC' }
                        : { backgroundColor: isDark ? '#1F2937' : '#F9FAFB', borderColor: isDark ? '#374151' : '#E5E7EB' },
                    ]}
                    activeOpacity={0.75}
                  >
                    <Calendar size={14} color={newDate ? '#6366F1' : isDark ? '#4B5563' : '#9CA3AF'} />
                    {newDate && (
                      <>
                        <Text style={[styles.addDateTxt, { color: isDark ? '#818CF8' : '#4F46E5' }]}>
                          {fmtSubDate(newDate, subDateLocale)}
                        </Text>
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation?.(); setNewDate(null); }}
                          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                        >
                          <X size={10} color={isDark ? '#818CF8' : '#6366F1'} />
                        </TouchableOpacity>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Botón agregar */}
                  <TouchableOpacity
                    onPress={addSubtask}
                    style={[
                      styles.addBtn,
                      { backgroundColor: newText.trim() ? '#6366F1' : isDark ? '#1F2937' : '#F3F4F6' },
                    ]}
                    activeOpacity={0.75}
                  >
                    <Plus color={newText.trim() ? '#FFF' : isDark ? '#4B5563' : '#9CA3AF'} size={16} />
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Sugerencias ── */}
              {suggestions && suggestions.length > 0 && (
                <View style={[styles.sugPanel, {
                  backgroundColor: isDark ? 'rgba(109,40,217,0.10)' : '#F5F3FF',
                  borderColor: isDark ? '#4C1D95' : '#DDD6FE',
                }]}>
                  <View style={styles.sugHead}>
                    <Lightbulb color="#7C3AED" size={13} />
                    <Text style={[styles.sugHeadTxt, { color: isDark ? '#A78BFA' : '#6D28D9' }]}>
                      {t('subtaskSuggestionsHint')}
                    </Text>
                  </View>

                  {suggestions.map((sug) => (
                    <TouchableOpacity
                      key={sug.id}
                      onPress={() => toggleSuggestion(sug.id)}
                      style={[styles.sugItem, {
                        backgroundColor: sug.selected ? (isDark ? 'rgba(109,40,217,0.25)' : '#EDE9FE') : 'transparent',
                        borderColor: sug.selected ? '#7C3AED' : isDark ? '#374151' : '#E5E7EB',
                      }]}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.sugCheck, sug.selected
                        ? { backgroundColor: '#7C3AED', borderColor: '#7C3AED' }
                        : { backgroundColor: 'transparent', borderColor: isDark ? '#6B7280' : '#D1D5DB' }
                      ]}>
                        {sug.selected && <View style={styles.sugCheckInner} />}
                      </View>
                      <Text style={[styles.sugItemTxt, {
                        color: sug.selected ? (isDark ? '#C4B5FD' : '#5B21B6') : (isDark ? '#6B7280' : '#9CA3AF'),
                      }]}>{sug.title}</Text>
                    </TouchableOpacity>
                  ))}

                  <View style={styles.sugFooter}>
                    <TouchableOpacity
                      onPress={acceptSuggestions}
                      style={[styles.sugAccept, !suggestions.some((s) => s.selected) && { opacity: 0.4 }]}
                      disabled={!suggestions.some((s) => s.selected)}
                    >
                      <Text style={styles.sugAcceptTxt}>
                        {(() => {
                          const n = suggestions.filter((s) => s.selected).length;
                          return n === 1
                            ? t('addSelectedSubtasksOne')
                            : t('addSelectedSubtasksMany', { n });
                        })()}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setSuggestions(null)}>
                      <Text style={[styles.sugDismiss, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                        {t('dismissSubtaskSuggestions')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </>
      )}

      {/* ── DateTimePicker (fuera del subPanel para no afectar layout en iOS) ── */}
      {pickerTarget !== null && (
        <DateTimePicker
          value={pickerInitialDate()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handlePickerChange}
        />
      )}
    </View>
  );

  if (swipeActions.length > 0) {
    return <SwipeableRow actions={swipeActions}>{content}</SwipeableRow>;
  }
  return content;
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ─ Prioridad ──────────────────────────────────────────────────────────────
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  priorityTxt: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  priorityEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
  },
  priorityEmptyTxt: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // ─ Tarjeta ────────────────────────────────────────────────────────────────
  container: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },

  // ─ Fila principal ─────────────────────────────────────────────────────────
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  emptyCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
  },
  content: { flex: 1, gap: 4 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: { fontSize: 14, fontWeight: '600', flex: 1, flexShrink: 1 },
  titleCompleted: { color: '#6B7280', textDecorationLine: 'line-through' },
  titleOverdue: { color: '#B91C1C' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  assigneeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  assigneeText: { fontSize: 11 },
  dueDateContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dueDateText: { fontSize: 11, fontWeight: '500' },
  dueDateOverdue: { color: '#DC2626' },
  dueDatePending: { color: '#D97706' },

  // ─ Cabecera de subtareas ──────────────────────────────────────────────────
  subDivider: {
    height: 1,
    marginHorizontal: 12,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  subToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  subLabel: { fontSize: 12, fontWeight: '600' },
  subBarBg: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden', marginLeft: 4 },
  subBarFill: { height: '100%', borderRadius: 3 },
  subCount: { fontSize: 11, fontWeight: '600', flexShrink: 0 },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  suggestBtnTxt: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },

  // ─ Panel expandido ────────────────────────────────────────────────────────
  subPanel: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 4,
  },

  // ─ Fila de cada subtarea ──────────────────────────────────────────────────
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  subCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  subCheckInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  subTitle: { fontSize: 13, lineHeight: 18 },
  subTitleDone: { textDecorationLine: 'line-through', opacity: 0.5 },

  // Chip de fecha por subtarea
  subDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
    minWidth: 22,
  },
  subDateTxt: { fontSize: 10, fontWeight: '600' },

  // ─ Fila de agregar ────────────────────────────────────────────────────────
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
  },
  addInput: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  addDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
  },
  addDateTxt: { fontSize: 11, fontWeight: '600' },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  // ─ Panel de sugerencias ───────────────────────────────────────────────────
  sugPanel: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 6,
    marginTop: 6,
  },
  sugHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sugHeadTxt: { fontSize: 11, fontWeight: '700' },
  sugItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sugCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  sugCheckInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  sugItemTxt: { flex: 1, fontSize: 13, lineHeight: 17 },
  sugFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 8,
  },
  sugAccept: {
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  sugAcceptTxt: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  sugDismiss: { fontSize: 12, fontWeight: '500', textDecorationLine: 'underline' },
});

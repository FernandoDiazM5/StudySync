import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  AccessibilityInfo,
} from 'react-native';
import * as Speech from 'expo-speech';
import {
  X,
  Type,
  Droplet,
  CaseSensitive,
  AlignJustify,
  Volume2,
  RotateCcw,
  Accessibility as AccessibilityIcon,
  ChevronDown,
  Check
} from 'lucide-react-native';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { useTheme } from '../contexts/ThemeContext';

const GridButton = ({ icon: Icon, label, levels, currentLevel, onPress, accessibilityLabel }) => {
  const { theme } = useTheme();
  const { textScaleMultiplier, globalFontFamily } = useAccessibility();

  const isActive = currentLevel > 0;
  const levelText = levels === 1 ? (isActive ? 'On' : 'Off') : `Level ${currentLevel + 1} of ${levels}`;

  return (
    <TouchableOpacity
      style={[
        styles.gridBtn,
        { backgroundColor: theme.card, borderColor: isActive ? theme.text : theme.border }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityLabel={`${label}: ${levelText}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: false }}
    >
      <Icon color={isActive ? theme.text : theme.textMuted} size={28} style={{ marginBottom: 8 }} />
      <Text style={[styles.gridLabel, { color: theme.text, fontFamily: globalFontFamily, fontSize: 13 * textScaleMultiplier }]}>
        {label}
      </Text>

      {/* Level indicators */}
      <View style={styles.levelIndicators}>
        {Array.from({ length: levels }).map((_, idx) => {
          // Simple and clear: a segment is filled if currentLevel >= idx
          const filled = currentLevel >= idx;
          return (
            <View
              key={idx}
              style={[
                styles.levelSegment,
                { backgroundColor: filled ? theme.text : theme.border }
              ]}
            />
          );
        })}
      </View>
    </TouchableOpacity>
  );
};

export default function AccessibilityMenu() {
  const {
    isMenuOpen, setIsMenuOpen,
    language, setLanguage, t,
    textLevel, setTextLevel,
    contrastActive, setContrastActive,
    dyslexiaFontActive, setDyslexiaFontActive,
    spacingLevel, setSpacingLevel,
    speechEnabled, setSpeechEnabled,
    resetAccessibility,
    textScaleMultiplier,
    globalFontFamily
  } = useAccessibility();

  const { theme } = useTheme();

  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  // Cycle handlers
  const handleTextSize = () => setTextLevel((prev) => (prev + 1) > 2 ? 0 : prev + 1);
  const handleSpacing = () => setSpacingLevel((prev) => (prev + 1) > 2 ? 0 : prev + 1);

  if (!isMenuOpen) return null;

  return (
    <Modal
      transparent
      animationType="slide"
      visible={isMenuOpen}
      onRequestClose={() => setIsMenuOpen(false)}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
            <View style={styles.headerLeft}>
              <AccessibilityIcon color="#FFF" size={24} />
              <Text style={[styles.headerTitle, { fontFamily: globalFontFamily, fontSize: 16 * textScaleMultiplier }]}>
                {t('accessibilityMenu')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setIsMenuOpen(false)} style={styles.closeBtn}>
              <X color="#FFF" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            
            {/* Language Selector */}
            <View style={styles.sectionRow}>
              <TouchableOpacity
                style={[styles.dropdownHeader, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => setLangDropdownOpen(!langDropdownOpen)}
              >
                <Text style={{ color: theme.text, fontSize: 16 * textScaleMultiplier, fontFamily: globalFontFamily }}>
                  {t('language')}: {language === 'es' ? t('spanish') : language === 'en' ? t('english') : t('quechua')}
                </Text>
                <ChevronDown color={theme.textMuted} size={20} />
              </TouchableOpacity>
              
              {langDropdownOpen && (
                <View style={[styles.dropdownContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  {['es', 'en', 'qu'].map((lng) => (
                    <TouchableOpacity
                      key={lng}
                      style={[styles.langOption, { borderBottomColor: theme.divider }]}
                      onPress={() => { setLanguage(lng); setLangDropdownOpen(false); }}
                    >
                      <Text style={{ color: theme.text, fontSize: 15 * textScaleMultiplier, fontFamily: globalFontFamily }}>
                        {lng === 'es' ? t('spanish') : lng === 'en' ? t('english') : t('quechua')}
                      </Text>
                      {language === lng && <Check color={theme.text} size={18} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Profile section label */}
            <View style={[styles.sectionLabel, { borderBottomColor: theme.border }]}>
              <Text style={{ color: theme.text, fontSize: 16 * textScaleMultiplier, fontFamily: globalFontFamily, fontWeight: '600' }}>
                {t('profile')}
              </Text>
            </View>

            {/* Grid */}
            <View style={styles.grid}>
              <GridButton
                icon={Type}
                label={t('textSize')}
                levels={3}
                currentLevel={textLevel}
                onPress={handleTextSize}
              />
              <GridButton
                icon={Droplet}
                label={t('contrasts')}
                levels={1}
                currentLevel={contrastActive ? 1 : 0}
                onPress={() => setContrastActive(!contrastActive)}
              />
              <GridButton
                icon={CaseSensitive}
                label={t('dyslexiaFriendly')}
                levels={1}
                currentLevel={dyslexiaFontActive ? 1 : 0}
                onPress={() => setDyslexiaFontActive(!dyslexiaFontActive)}
              />
              <GridButton
                icon={AlignJustify}
                label={t('lineSpacing')}
                levels={3}
                currentLevel={spacingLevel}
                onPress={handleSpacing}
              />
              <GridButton
                icon={Volume2}
                label={t('narrator')}
                levels={1}
                currentLevel={speechEnabled ? 1 : 0}
                onPress={() => {
                  const newState = !speechEnabled;
                  setSpeechEnabled(newState);
                  if (newState) {
                    // Feedback inmediato al activar el narrador
                    try {
                      const lang = language === 'en' ? 'en' : 'es';
                      const msg = language === 'en'
                        ? 'Narrator enabled. Long press any text to hear it.'
                        : 'Narrador activado. Mantén presionado cualquier texto para escucharlo.';
                      Speech.speak(msg, { language: lang });
                    } catch (e) {
                      console.warn('Speech error on enable:', e);
                    }
                  } else {
                    try {
                      Speech.stop().catch(() => {});
                    } catch (error) {
                      console.warn('Error stopping speech:', error);
                    }
                  }
                }}
              />
            </View>

            {/* Reset */}
            <TouchableOpacity style={styles.resetBtn} onPress={resetAccessibility}>
              <RotateCcw color={theme.textSecondary} size={20} />
              <Text style={[styles.resetText, { color: theme.textSecondary, fontFamily: globalFontFamily, fontSize: 16 * textScaleMultiplier }]}>
                {t('reset')}
              </Text>
            </TouchableOpacity>

          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    width: '90%',
    maxWidth: 400,
    height: '100%',
    alignSelf: 'flex-end', // slide from right mostly
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    color: '#FFF',
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionRow: {
    marginBottom: 20,
  },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  dropdownContent: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  langOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  gridBtn: {
    width: '48%',
    aspectRatio: 1.1,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  gridLabel: {
    textAlign: 'center',
    fontWeight: '600',
  },
  levelIndicators: {
    flexDirection: 'row',
    gap: 4,
    position: 'absolute',
    bottom: 12,
  },
  levelSegment: {
    height: 4,
    width: 16,
    borderRadius: 2,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  resetText: {
    fontWeight: '600',
  }
});

import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { FieldLabel } from '../components/InfoTip';
import { InputField } from '../components/InputField';
import { LoadShareChart } from '../components/LoadShareChart';
import { PrimaryButton } from '../components/PrimaryButton';
import { ResultCard } from '../components/ResultCard';
import { ScreenContainer } from '../components/ScreenContainer';
import { useTheme } from '../theme/ThemeContext';
import { formatNumber, parseLocaleNumber } from '../utils/calculations';
import {
  BatteryTech,
  BusVoltageV,
  calculateOffGridLoad,
  OffGridLoadInput,
  PhaseSystem,
  validateOffGridInput,
} from '../utils/offGridLoad';
import {
  buildOffGridReportHtml,
  describeBatteryBank,
  describeDod,
  describeTransformer,
} from '../utils/offGridReport';

const TIPS = {
  neutral:
    'Corrente no condutor neutro, lida com o alicate. Ela indica a parcela das cargas ligadas entre fase e neutro (127 V ou 110 V). Se o neutro estiver quase zerado, a carga é praticamente toda em 220 V.',
  fu:
    'Fator de ocupação: fração da potência do inversor que pode trabalhar em regime contínuo. 80% deixa 20% de folga para picos, temperatura e partida de motores.',
  dod:
    'Profundidade de descarga (Depth of Discharge): quanto da capacidade da bateria pode ser usado. Lítio LiFePO4 costuma ir a 80%; chumbo-ácido / gel, a cerca de 50%. Desligado, o cálculo usa 100% da capacidade nominal.',
} as const;

const FU_STEPS = [0.6, 0.7, 0.8, 0.9] as const;

type AutonomyUnit = 'hours' | 'days';

function parseNonNegative(text: string): number {
  if (text.trim() === '') return 0;
  return parseLocaleNumber(text);
}

export function LevantamentoScreen() {
  const { colors } = useTheme();
  const [system, setSystem] = useState<PhaseSystem>('biphasic');
  const [voltageFnText, setVoltageFnText] = useState('127');
  const [voltageFfText, setVoltageFfText] = useState('220');
  const [currentAText, setCurrentAText] = useState('');
  const [currentBText, setCurrentBText] = useState('');
  const [currentCText, setCurrentCText] = useState('');
  const [currentNeutralText, setCurrentNeutralText] = useState('');
  const [utilization, setUtilization] = useState(0.8);
  const [supportsMono220, setSupportsMono220] = useState(true);
  const [supportsNativeBiphasic, setSupportsNativeBiphasic] = useState(false);
  const [busVoltage, setBusVoltage] = useState<BusVoltageV>(48);
  const [autonomyText, setAutonomyText] = useState('12');
  const [autonomyUnit, setAutonomyUnit] = useState<AutonomyUnit>('hours');
  const [useDod, setUseDod] = useState(true);
  const [dodText, setDodText] = useState('80');
  const [batteryTech, setBatteryTech] = useState<BatteryTech>('lithium');
  const [efficiencyText, setEfficiencyText] = useState('92');
  const [exporting, setExporting] = useState(false);

  const draft = useMemo(() => {
    const autonomyRaw = parseLocaleNumber(autonomyText);
    const autonomyHours =
      Number.isFinite(autonomyRaw) && autonomyRaw > 0
        ? autonomyUnit === 'days'
          ? autonomyRaw * 24
          : autonomyRaw
        : NaN;
    const efficiencyPct = parseLocaleNumber(efficiencyText);
    const dodPct = parseLocaleNumber(dodText);
    const input: OffGridLoadInput = {
      system,
      voltageFn: parseLocaleNumber(voltageFnText),
      voltageFf: parseLocaleNumber(voltageFfText),
      currentA: parseNonNegative(currentAText),
      currentB: parseNonNegative(currentBText),
      currentC: parseNonNegative(currentCText),
      currentNeutral: parseNonNegative(currentNeutralText),
      utilizationFactor: utilization,
      supportsMono220,
      supportsNativeBiphasic,
      busVoltageV: busVoltage,
      autonomyHours,
      useDod,
      dod: Number.isFinite(dodPct) ? dodPct / 100 : NaN,
      batteryTech,
      inverterEfficiency: Number.isFinite(efficiencyPct) ? efficiencyPct / 100 : NaN,
    };
    return input;
  }, [
    autonomyText,
    autonomyUnit,
    batteryTech,
    busVoltage,
    currentAText,
    currentBText,
    currentCText,
    currentNeutralText,
    dodText,
    efficiencyText,
    supportsMono220,
    supportsNativeBiphasic,
    system,
    useDod,
    utilization,
    voltageFfText,
    voltageFnText,
  ]);

  const validationError = validateOffGridInput(draft);
  const result = validationError ? null : calculateOffGridLoad(draft);

  const onTech = (tech: BatteryTech) => {
    setBatteryTech(tech);
    setDodText(tech === 'lithium' ? '80' : '50');
    setUseDod(true);
  };

  const onExportPdf = async () => {
    if (!result) return;
    setExporting(true);
    try {
      const html = buildOffGridReportHtml(draft, result);
      const file = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Relatório técnico off-grid',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF gerado', 'O relatório foi criado, mas o compartilhamento não está disponível neste aparelho.');
      }
    } catch {
      Alert.alert('Não foi possível gerar o PDF', 'Tente novamente. Se o problema continuar, confira o espaço livre do aparelho.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenContainer
      title="Levantamento"
      subtitle="Medição com alicate e dimensionamento off-grid / retrofit."
    >
      <Section title="A · Medição de campo" hint="Correntes lidas no alicate amperímetro.">
        <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>Tipo de sistema</Text>
        <Segment
          options={[
            { key: 'biphasic', label: 'Bifásico' },
            { key: 'triphasic', label: 'Trifásico' },
          ]}
          value={system}
          onChange={setSystem}
        />
        <View style={styles.pair}>
          <View style={styles.pairItem}>
            <InputField
              label="Tensão fase-neutro (V)"
              value={voltageFnText}
              onChangeText={setVoltageFnText}
              keyboardType="decimal-pad"
              placeholder="127"
            />
          </View>
          <View style={styles.pairItem}>
            <InputField
              label="Tensão fase-fase (V)"
              value={voltageFfText}
              onChangeText={setVoltageFfText}
              keyboardType="decimal-pad"
              placeholder="220"
            />
          </View>
        </View>
        <View style={styles.pair}>
          <View style={styles.pairItem}>
            <InputField
              label="Corrente fase A (A)"
              value={currentAText}
              onChangeText={setCurrentAText}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </View>
          <View style={styles.pairItem}>
            <InputField
              label="Corrente fase B (A)"
              value={currentBText}
              onChangeText={setCurrentBText}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </View>
        </View>
        {system === 'triphasic' ? (
          <InputField
            label="Corrente fase C (A)"
            value={currentCText}
            onChangeText={setCurrentCText}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        ) : null}
        <InputField
          label="Corrente no neutro (A)"
          tip={TIPS.neutral}
          value={currentNeutralText}
          onChangeText={setCurrentNeutralText}
          keyboardType="decimal-pad"
          placeholder="Opcional — indica o consumo em 127 V"
        />
      </Section>

      <Section title="B · Inversor off-grid" hint="Folga de regime contínuo e tipo de saída.">
        <FieldLabel label="Fator de ocupação" tip={TIPS.fu} />
        <Segment
          options={FU_STEPS.map((step) => ({
            key: String(step),
            label: `${Math.round(step * 100)}%`,
          }))}
          value={String(utilization)}
          onChange={(key) => setUtilization(Number(key))}
        />
        <CheckRow
          label="Saída 220 V monofásica"
          checked={supportsMono220}
          onPress={() => setSupportsMono220((value) => !value)}
        />
        <CheckRow
          label="Saída bifásica nativa"
          checked={supportsNativeBiphasic}
          onPress={() => setSupportsNativeBiphasic((value) => !value)}
        />
      </Section>

      <Section title="C · Banco de baterias" hint="Autonomia, barramento e profundidade de descarga.">
        <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>Tensão do barramento CC</Text>
        <Segment
          options={[
            { key: '24', label: '24 V' },
            { key: '48', label: '48 V' },
          ]}
          value={String(busVoltage)}
          onChange={(key) => setBusVoltage(key === '24' ? 24 : 48)}
        />
        <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>Autonomia desejada</Text>
        <Segment
          options={[
            { key: 'hours', label: 'Horas' },
            { key: 'days', label: 'Dias' },
          ]}
          value={autonomyUnit}
          onChange={setAutonomyUnit}
        />
        <InputField
          label={autonomyUnit === 'days' ? 'Autonomia (dias)' : 'Autonomia (horas)'}
          value={autonomyText}
          onChangeText={setAutonomyText}
          keyboardType="decimal-pad"
          placeholder={autonomyUnit === 'days' ? '1' : '12'}
        />
        <FieldLabel label="Considerar DoD" tip={TIPS.dod} />
        <Segment
          options={[
            { key: 'yes', label: 'Sim' },
            { key: 'no', label: 'Não' },
          ]}
          value={useDod ? 'yes' : 'no'}
          onChange={(key) => setUseDod(key === 'yes')}
        />
        {useDod ? (
          <InputField
            label="Profundidade de descarga (%)"
            value={dodText}
            onChangeText={setDodText}
            keyboardType="decimal-pad"
            placeholder="80"
            hint="LiFePO4 típico 80%. Chumbo-ácido / gel típico 50%."
          />
        ) : null}
        <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>Tecnologia da bateria</Text>
        <Segment
          options={[
            { key: 'lithium', label: 'Lítio' },
            { key: 'lead', label: 'Chumbo' },
          ]}
          value={batteryTech}
          onChange={onTech}
        />
        <InputField
          label="Eficiência do inversor (%)"
          value={efficiencyText}
          onChangeText={setEfficiencyText}
          keyboardType="decimal-pad"
          placeholder="92"
        />
      </Section>

      {validationError ? (
        <Text style={[styles.pending, { color: colors.textSecondary }]}>{validationError}</Text>
      ) : null}

      {result ? (
        <>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>Diagnóstico da carga</Text>
            <LoadShareChart
              share127={result.share127}
              share220={result.share220}
              power127Kw={result.power127W / 1000}
              power220Kw={result.power220W / 1000}
            />
            <Metric label="Potência total medida" value={`${formatNumber(result.powerTotalW / 1000)} kW`} emphasize />
            <Metric
              label="Carga 127 V"
              value={`${formatNumber(result.power127W / 1000)} kW · ${formatNumber(result.share127 * 100, 0)}%`}
            />
            <Metric
              label="Carga 220 V"
              value={`${formatNumber(result.power220W / 1000)} kW · ${formatNumber(result.share220 * 100, 0)}%`}
            />
            <Metric
              label="Corrente nominal de saída em 220 V"
              value={`${formatNumber(result.currentInverterA)} A`}
            />
            {result.neutralInconsistent ? (
              <Banner
                tone="warning"
                text="A corrente de neutro supera a soma das fases. Revise a medição: a carga 220 V foi limitada a zero neste cálculo."
              />
            ) : null}
          </View>

          <ResultCard
            title="Inversor off-grid"
            rows={[
              {
                label: 'Potência mínima calculada',
                value: `${formatNumber(result.inverterMinW / 1000)} kW`,
              },
              {
                label: 'Potência nominal recomendada',
                value: `${formatNumber(result.inverterSuggestedKw)} kW`,
                emphasize: true,
              },
              {
                label: 'Fator de ocupação aplicado',
                value: `${formatNumber(result.utilizationFactor * 100, 0)}%`,
              },
            ]}
          />
          <Banner
            tone={result.surgeMarginTight ? 'warning' : 'info'}
            text={
              result.surgeMarginTight
                ? 'Folga apertada para motores e ar-condicionado. Com ocupação a partir de 85%, confirme se a potência de surto do inversor cobre a partida (em geral 2× por poucos segundos) ou suba um porte comercial.'
                : 'Folga técnica: motores e ar-condicionado pedem surto de partida. O fator de ocupação reserva essa margem no regime contínuo; confira a potência de surto no datasheet (tipicamente 2×).'
            }
          />

          <ResultCard
            title="Autotransformador de apoio (127 V)"
            rows={[
              {
                label: 'Situação',
                value:
                  result.transformerStatus === 'required'
                    ? `${formatNumber(result.transformerSuggestedKva)} kVA`
                    : result.transformerStatus === 'native_biphasic'
                      ? 'Não necessário'
                      : 'Sem carga 127 V',
                emphasize: result.transformerStatus === 'required',
              },
              {
                label: 'Potência calculada (30% de folga)',
                value:
                  result.transformerStatus === 'required'
                    ? `${formatNumber(result.transformerW / 1000)} kVA`
                    : '—',
              },
            ]}
          />
          <Text style={[styles.note, { color: colors.textSecondary }]}>{describeTransformer(result)}</Text>

          <ResultCard
            title="Banco de baterias"
            rows={[
              {
                label: 'Capacidade total',
                value: `${formatNumber(result.batteryGrossWh / 1000)} kWh`,
                emphasize: true,
              },
              {
                label: 'Capacidade no barramento',
                value: `${formatNumber(result.capacityAh, 0)} Ah @ ${draft.busVoltageV} V`,
              },
              {
                label: 'Critério',
                value: describeDod(result),
              },
              {
                label: 'Módulos sugeridos',
                value:
                  draft.batteryTech === 'lithium'
                    ? `${result.lithiumModules}× lítio 48 V 100 Ah`
                    : `${result.leadTotal}× chumbo 12 V 220 Ah`,
                emphasize: true,
              },
            ]}
          />
          <Text style={[styles.note, { color: colors.textSecondary }]}>
            {describeBatteryBank(draft, result)}
          </Text>

          <PrimaryButton
            label="Gerar relatório técnico em PDF"
            onPress={onExportPdf}
            loading={exporting}
            style={styles.exportBtn}
          />
        </>
      ) : null}
    </ScreenContainer>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {hint ? <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.key)}
            style={[
              styles.segmentItem,
              {
                backgroundColor: selected ? colors.primary : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: selected ? (colors.mode === 'light' ? '#FFFFFF' : colors.background) : colors.text },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CheckRow({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={styles.checkRow}
    >
      <Ionicons
        name={checked ? 'checkbox' : 'square-outline'}
        size={22}
        color={checked ? colors.primary : colors.textMuted}
      />
      <Text style={[styles.checkLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.metric, { borderTopColor: colors.border }]}>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          { color: emphasize ? colors.accent : colors.text },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function Banner({ tone, text }: { tone: 'warning' | 'info'; text: string }) {
  const { colors } = useTheme();
  const background = tone === 'warning' ? colors.accentSoft : colors.primarySoft;
  const icon = tone === 'warning' ? 'warning-outline' : 'information-circle-outline';
  return (
    <View style={[styles.banner, { backgroundColor: background, borderColor: colors.border }]}>
      <Ionicons name={icon} size={18} color={tone === 'warning' ? colors.warning : colors.primary} />
      <Text style={[styles.bannerText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 17,
  },
  sectionHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 12,
  },
  fieldCaption: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    marginBottom: 8,
  },
  pair: {
    flexDirection: 'row',
    gap: 12,
  },
  pairItem: { flex: 1 },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  segmentLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    textAlign: 'center',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  checkLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    flex: 1,
  },
  pending: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 17,
    marginBottom: 4,
  },
  metric: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  metricLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    flex: 1,
  },
  metricValue: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    textAlign: 'right',
  },
  banner: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  bannerText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  note: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginTop: -8,
    marginBottom: 16,
  },
  exportBtn: { marginBottom: 12 },
});

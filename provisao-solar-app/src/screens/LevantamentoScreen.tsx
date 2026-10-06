import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { FieldLabel } from '../components/InfoTip';
import { InputField } from '../components/InputField';
import { LoadShareChart } from '../components/LoadShareChart';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { useTheme } from '../theme/ThemeContext';
import { formatNumber, parseLocaleNumber } from '../utils/calculations';
import {
  AcOutputTopology,
  BatteryModelId,
  BatteryTech,
  BusVoltageV,
  calculateOffGridLoad,
  DOD_RANGE,
  modelsForTech,
  OffGridLoadInput,
  PhaseSystem,
  validateOffGridInput,
} from '../utils/offGridLoad';
import {
  acOutputTag,
  buildOffGridReportHtml,
  describeAssembly,
  describeTransformer,
  dodConsideredLabel,
  FIELD_HELP,
} from '../utils/offGridReport';

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
  const [acOutput, setAcOutput] = useState<AcOutputTopology>('mono220');
  const [inverterBus, setInverterBus] = useState<BusVoltageV>(48);
  const [busVoltage, setBusVoltage] = useState<BusVoltageV>(48);
  const [busTouched, setBusTouched] = useState(false);
  const [autonomyText, setAutonomyText] = useState('12');
  const [autonomyUnit, setAutonomyUnit] = useState<AutonomyUnit>('hours');
  const [useDod, setUseDod] = useState(true);
  const [dodText, setDodText] = useState('80');
  const [batteryModelId, setBatteryModelId] = useState<BatteryModelId>('li-48-100');
  const [showAlternative, setShowAlternative] = useState(false);
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
      acOutput,
      busVoltageV: busVoltage,
      autonomyHours,
      useDod,
      dod: Number.isFinite(dodPct) ? dodPct / 100 : NaN,
      batteryModelId,
      inverterEfficiency: Number.isFinite(efficiencyPct) ? efficiencyPct / 100 : NaN,
    };
    return input;
  }, [
    autonomyText,
    autonomyUnit,
    batteryModelId,
    busVoltage,
    currentAText,
    currentBText,
    currentCText,
    currentNeutralText,
    dodText,
    efficiencyText,
    acOutput,
    system,
    useDod,
    utilization,
    voltageFfText,
    voltageFnText,
  ]);

  const validationError = validateOffGridInput(draft);
  const result = validationError ? null : calculateOffGridLoad(draft);

  const batteryTech: BatteryTech = batteryModelId.startsWith('li-') ? 'lithium' : 'stationary';
  const dodRange = DOD_RANGE[batteryTech];

  const onInverterBus = (value: BusVoltageV) => {
    setInverterBus(value);
    if (!busTouched) setBusVoltage(value);
  };

  const onBankBus = (value: BusVoltageV) => {
    setBusTouched(true);
    setBusVoltage(value);
  };

  const onTech = (tech: BatteryTech) => {
    const next = modelsForTech(tech)[0];
    setBatteryModelId(next.id);
    setDodText(String(Math.round(DOD_RANGE[tech].default * 100)));
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
      <Section
        title="1. Dados do Quadro de Medição (Leituras de Campo)"
        hint="Correntes lidas com o alicate amperímetro em cada condutor do quadro."
      >
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
              icon="flash-outline"
              value={currentAText}
              onChangeText={setCurrentAText}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </View>
          <View style={styles.pairItem}>
            <InputField
              label="Corrente fase B (A)"
              icon="flash-outline"
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
            icon="flash-outline"
            value={currentCText}
            onChangeText={setCurrentCText}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        ) : null}
        <InputField
          label="Corrente no neutro (A)"
          icon="ellipse"
          highlight
          tip={FIELD_HELP.neutral}
          hint={FIELD_HELP.neutral}
          value={currentNeutralText}
          onChangeText={setCurrentNeutralText}
          keyboardType="decimal-pad"
          placeholder="Opcional — indica o consumo em 127 V"
        />
      </Section>

      <Section
        title="Especificação da Saída AC do Inversor (Alimentação da Casa)"
        hint={FIELD_HELP.inverterIntro}
      >
        <ChoiceCard
          selected={acOutput === 'mono220'}
          title="220V Monofásico (Fase + Neutro)"
          body={FIELD_HELP.mono220}
          onPress={() => setAcOutput('mono220')}
        />
        <ChoiceCard
          selected={acOutput === 'split_phase'}
          title="Bifásico Nativo / Split-Phase (Fase A + Fase B + Neutro)"
          body={FIELD_HELP.splitPhase}
          onPress={() => setAcOutput('split_phase')}
        />
        <ChoiceCard
          selected={acOutput === 'triphasic'}
          title="Trifásico Nativo (3 Fases + Neutro)"
          body={FIELD_HELP.triphasic}
          onPress={() => setAcOutput('triphasic')}
        />
        <FieldLabel label="Fator de ocupação" tip={FIELD_HELP.utilization} />
        <Segment
          options={FU_STEPS.map((step) => ({
            key: String(step),
            label: `${Math.round(step * 100)}%`,
          }))}
          value={String(utilization)}
          onChange={(key) => setUtilization(Number(key))}
        />
        <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>
          Barramento CC do inversor
        </Text>
        <Segment
          options={[
            { key: '24', label: '24 V' },
            { key: '48', label: '48 V' },
          ]}
          value={String(inverterBus)}
          onChange={(key) => onInverterBus(key === '24' ? 24 : 48)}
        />
      </Section>

      <Section
        title="3. Especificação do Banco de Baterias (Estoque)"
        hint="Escolha a tecnologia e o modelo que será instalado no cliente."
      >
        <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>Tecnologia</Text>
        <ChoiceCard
          selected={batteryTech === 'lithium'}
          title="Lítio (LiFePO4)"
          badge={FIELD_HELP.lithiumBadge}
          badgeTone="green"
          onPress={() => onTech('lithium')}
        />
        <ChoiceCard
          selected={batteryTech === 'stationary'}
          title="Estacionária (Chumbo-Ácido)"
          badge={FIELD_HELP.stationaryBadge}
          badgeTone="slate"
          onPress={() => onTech('stationary')}
        />
        <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>Modelo base</Text>
        <Segment
          options={modelsForTech(batteryTech).map((model) => ({
            key: model.id,
            label: model.shortLabel,
          }))}
          value={batteryModelId}
          onChange={setBatteryModelId}
        />
        <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>
          Barramento CC do banco
          {busVoltage === inverterBus ? ' · acompanha o inversor' : ' · ajuste manual'}
        </Text>
        <Segment
          options={[
            { key: '24', label: '24 V' },
            { key: '48', label: '48 V' },
          ]}
          value={String(busVoltage)}
          onChange={(key) => onBankBus(key === '24' ? 24 : 48)}
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
        <FieldLabel label="Profundidade de descarga" tip={FIELD_HELP.dod} />
        <Text style={[styles.dodLabel, { color: colors.primary, backgroundColor: colors.primarySoft }]}>
          {dodConsideredLabel(
            batteryTech,
            Number.isFinite(parseLocaleNumber(dodText)) ? parseLocaleNumber(dodText) : dodRange.default * 100,
            useDod,
          )}
        </Text>
        <Segment
          options={[
            { key: 'yes', label: 'Considerar DoD' },
            { key: 'no', label: 'Ignorar DoD' },
          ]}
          value={useDod ? 'yes' : 'no'}
          onChange={(key) => setUseDod(key === 'yes')}
        />
        {useDod ? (
          <>
            <Segment
              options={dodSteps(batteryTech).map((step) => ({
                key: String(step),
                label: `${step}%`,
              }))}
              value={dodText}
              onChange={setDodText}
            />
            <InputField
              label="DoD manual (%)"
              value={dodText}
              onChangeText={setDodText}
              keyboardType="decimal-pad"
              placeholder={String(Math.round(dodRange.default * 100))}
              hint={
                batteryTech === 'lithium'
                  ? 'Lítio: ajuste entre 70% e 90%. Padrão 80%.'
                  : 'Estacionária: ajuste entre 30% e 60%. Padrão 50%.'
              }
            />
          </>
        ) : null}
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

          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>Inversor recomendado</Text>
            <Text style={[styles.headline, { color: colors.accent }]}>
              Inversor Recomendado: {formatNumber(result.inverterSuggestedKw)} kW
            </Text>
            <View style={[styles.tag, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.tagText, { color: colors.primary }]}>{acOutputTag(acOutput)}</Text>
            </View>
            <Metric
              label="Potência mínima calculada"
              value={`${formatNumber(result.inverterMinW / 1000)} kW`}
            />
            <Metric
              label="Fator de ocupação aplicado"
              value={`${formatNumber(result.utilizationFactor * 100, 0)}%`}
            />
          </View>
          <Banner
            tone={result.surgeMarginTight ? 'warning' : 'info'}
            text={
              result.surgeMarginTight
                ? 'Folga apertada para motores e ar-condicionado. Com ocupação a partir de 85%, confirme se a potência de surto do inversor cobre a partida (em geral 2× por poucos segundos) ou suba um porte comercial.'
                : 'Folga técnica: motores e ar-condicionado pedem surto de partida. O fator de ocupação reserva essa margem no regime contínuo; confira a potência de surto no datasheet (tipicamente 2×).'
            }
          />

          {result.transformerStatus === 'required' ? (
            <View style={[styles.alertCard, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Autotransformador de Apoio Necessário</Text>
              <Text style={[styles.alertDetail, { color: colors.text }]}>{describeTransformer(result)}</Text>
              <Text style={[styles.wiring, { color: colors.textSecondary }]}>{FIELD_HELP.mono220}</Text>
            </View>
          ) : (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>Autotransformador de apoio</Text>
              <Text style={[styles.wiring, { color: colors.textSecondary }]}>{describeTransformer(result)}</Text>
            </View>
          )}

          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>Banco de baterias</Text>
            <Text style={[styles.headline, { color: colors.accent }]}>{result.bank.headline}</Text>
            <Text style={[styles.assembly, { color: colors.text }]}>{describeAssembly(result)}</Text>
            <Text style={[styles.wiring, { color: colors.textSecondary }]}>{result.bank.wiring}</Text>
            {result.bank.compatible ? (
              <>
                <Metric
                  label="Capacidade útil entregue"
                  value={`${formatNumber(result.bank.installedUsefulWh / 1000)} kWh`}
                  emphasize
                />
                <Metric
                  label="Capacidade bruta do banco"
                  value={`${formatNumber(result.bank.installedGrossWh / 1000)} kWh`}
                />
                <Metric
                  label="DoD"
                  value={dodConsideredLabel(
                    batteryTech,
                    Number.isFinite(parseLocaleNumber(dodText))
                      ? parseLocaleNumber(dodText)
                      : dodRange.default * 100,
                    useDod,
                  )}
                />
                <Metric
                  label="Energia pedida"
                  value={`${formatNumber(result.energyWh / 1000)} kWh úteis · ${formatNumber(result.batteryGrossWh / 1000)} kWh brutos`}
                />
              </>
            ) : (
              <Banner tone="warning" text={result.bank.wiring} />
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAlternative((value) => !value)}
              style={[styles.altToggle, { borderColor: colors.border }]}
            >
              <Text style={[styles.altToggleText, { color: colors.primary }]}>
                {showAlternative
                  ? 'Ocultar opção alternativa'
                  : 'Ver opção alternativa (lítio vs estacionária)'}
              </Text>
            </Pressable>
            {showAlternative ? (
              <View style={styles.compareRow}>
                <CompareCard
                  title="Opção A · Lítio"
                  headline={result.comparison.lithium.headline}
                  detail={`${formatNumber(result.comparison.lithium.installedGrossWh / 1000)} kWh brutos · ~${result.comparison.lithium.model.cycles} ciclos`}
                  note="Peso menor"
                  selected={batteryTech === 'lithium'}
                />
                <CompareCard
                  title="Opção B · Estacionária"
                  headline={result.comparison.stationary.headline}
                  detail={`${formatNumber(result.comparison.stationary.installedGrossWh / 1000)} kWh brutos · ~${result.comparison.stationary.model.cycles} ciclos`}
                  note="Maior ocupação de espaço"
                  selected={batteryTech === 'stationary'}
                />
              </View>
            ) : null}
          </View>

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

function dodSteps(tech: BatteryTech): number[] {
  return tech === 'lithium' ? [70, 75, 80, 85, 90] : [30, 40, 50, 60];
}

function CompareCard({
  title,
  headline,
  detail,
  note,
  selected,
}: {
  title: string;
  headline: string;
  detail: string;
  note: string;
  selected: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.compareCard,
        {
          backgroundColor: selected ? colors.primarySoft : colors.inputBg,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.compareTitle, { color: colors.textSecondary }]}>{title}</Text>
      <Text style={[styles.compareHeadline, { color: colors.text }]}>{headline}</Text>
      <Text style={[styles.compareDetail, { color: colors.textSecondary }]}>{detail}</Text>
      <Text style={[styles.compareDetail, { color: colors.text }]}>{note}</Text>
    </View>
  );
}

function ChoiceCard({
  title,
  body,
  badge,
  badgeTone = 'green',
  selected,
  onPress,
}: {
  title: string;
  body?: string;
  badge?: string;
  badgeTone?: 'green' | 'slate';
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const badgeBg = badgeTone === 'green' ? colors.primarySoft : colors.backgroundAlt;
  const badgeFg = badgeTone === 'green' ? colors.primary : colors.textSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.choiceTitle, { color: colors.text }]}>{title}</Text>
      {badge ? (
        <Text style={[styles.badge, { backgroundColor: badgeBg, color: badgeFg }]}>{badge}</Text>
      ) : null}
      {body ? <Text style={[styles.choiceBody, { color: colors.textSecondary }]}>{body}</Text> : null}
    </Pressable>
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
    fontSize: 16,
    lineHeight: 22,
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
  choice: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  choiceTitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
  },
  choiceBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
  },
  dodLabel: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
  },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 10,
  },
  tagText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
  },
  alertCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  alertDetail: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
  },
  assembly: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
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
  wiring: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  headline: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    lineHeight: 28,
    marginTop: 8,
  },
  altToggle: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 14,
    alignItems: 'center',
  },
  altToggleText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    textAlign: 'center',
  },
  compareRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  compareCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  compareTitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    marginBottom: 6,
  },
  compareHeadline: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    lineHeight: 18,
  },
  compareDetail: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  exportBtn: { marginBottom: 12 },
});

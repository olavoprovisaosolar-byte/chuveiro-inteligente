import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AiReviewCard } from '../components/AiReviewCard';
import { HelpCard } from '../components/HelpCard';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { ResultCard } from '../components/ResultCard';
import { ScreenContainer } from '../components/ScreenContainer';
import { FACTOR_333_EXPLANATION } from '../constants/modules';
import { useAiConfig } from '../hooks/useAiConfig';
import { useTheme } from '../theme/ThemeContext';
import {
  calculateFromDaily,
  calculateFromMonthly,
  formatNumber,
  parseLocaleNumber,
} from '../utils/calculations';

type Mode = 'monthly' | 'daily';

export function DimensionamentoScreen() {
  const { colors } = useTheme();
  const { review, hasApiKey } = useAiConfig();
  const [mode, setMode] = useState<Mode>('monthly');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [monthlyResult, setMonthlyResult] = useState<ReturnType<typeof calculateFromMonthly> | null>(
    null,
  );
  const [dailyResult, setDailyResult] = useState<ReturnType<typeof calculateFromDaily> | null>(null);

  const onCalculate = () => {
    const value = parseLocaleNumber(input);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Informe um valor numérico maior que zero.');
      return;
    }
    setError(undefined);
    if (mode === 'monthly') {
      setMonthlyResult(calculateFromMonthly(value));
      setDailyResult(null);
    } else {
      setDailyResult(calculateFromDaily(value));
      setMonthlyResult(null);
    }
  };

  const activeResult = mode === 'monthly' ? monthlyResult : dailyResult;

  const rows = useMemo(() => {
    if (mode === 'monthly' && monthlyResult) {
      return [
        { label: 'Consumo mensal', value: `${formatNumber(monthlyResult.monthlyKwh)} kWh/mês` },
        { label: 'Média diária', value: `${formatNumber(monthlyResult.dailyKwh)} kWh/dia` },
        {
          label: 'Potência estimada',
          value: `${formatNumber(monthlyResult.powerKwp)} kWp`,
          emphasize: true,
        },
        {
          label: 'Inversor sugerido (FDI 1,15–1,30)',
          value: `${formatNumber(monthlyResult.inverterMinKw)} – ${formatNumber(monthlyResult.inverterMaxKw)} kW`,
        },
      ];
    }
    if (mode === 'daily' && dailyResult) {
      return [
        { label: 'Consumo diário', value: `${formatNumber(dailyResult.dailyKwh)} kWh/dia` },
        {
          label: 'Consumo mensal convertido',
          value: `${formatNumber(dailyResult.monthlyKwh)} kWh/mês`,
        },
        {
          label: 'Potência estimada (÷ 3,33)',
          value: `${formatNumber(dailyResult.powerKwp)} kWp`,
          emphasize: true,
        },
        {
          label: 'Inversor sugerido (FDI 1,15–1,30)',
          value: `${formatNumber(dailyResult.inverterMinKw)} – ${formatNumber(dailyResult.inverterMaxKw)} kW`,
        },
      ];
    }
    return [];
  }, [mode, monthlyResult, dailyResult]);

  return (
    <ScreenContainer
      title="Dimensionamento"
      subtitle="Calcule a potência do sistema a partir do consumo mensal ou diário."
    >
      <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(
          [
            { key: 'monthly', label: 'Mensal' },
            { key: 'daily', label: 'Diário' },
          ] as const
        ).map((item) => {
          const selected = mode === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                setMode(item.key);
                setError(undefined);
              }}
              style={[
                styles.segmentItem,
                {
                  backgroundColor: selected ? colors.primary : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: 'Outfit_600SemiBold',
                  color: selected
                    ? colors.mode === 'light'
                      ? '#fff'
                      : colors.background
                    : colors.textSecondary,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <InputField
        label={mode === 'monthly' ? 'Consumo mensal (kWh/mês)' : 'Consumo diário (kWh/dia)'}
        value={input}
        onChangeText={setInput}
        keyboardType="decimal-pad"
        placeholder={mode === 'monthly' ? 'Ex: 450' : 'Ex: 15'}
        error={error}
        hint={
          mode === 'monthly'
            ? 'Potência (kWp) = Consumo Mensal ÷ 100'
            : 'Potência (kWp) = Consumo Diário ÷ 3,33'
        }
      />

      <PrimaryButton label="Calcular dimensionamento" onPress={onCalculate} style={styles.cta} />

      <HelpCard title="Por que o fator 3,33?" body={FACTOR_333_EXPLANATION} />

      {activeResult && rows.length > 0 ? (
        <>
          <ResultCard title="Resultados do dimensionamento" rows={rows} />
          <AiReviewCard
            payload={
              mode === 'monthly' && monthlyResult
                ? { kind: 'monthly', result: monthlyResult }
                : dailyResult
                  ? { kind: 'daily', result: dailyResult }
                  : null
            }
            onReview={review}
            disabledReason={
              hasApiKey ? undefined : 'Configure a API Key na aba Config. IA para habilitar a revisão.'
            }
          />
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    minHeight: 42,
  },
  cta: { marginBottom: 16 },
});

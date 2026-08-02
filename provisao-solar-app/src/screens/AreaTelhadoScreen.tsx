import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AiReviewCard } from '../components/AiReviewCard';
import { HelpCard } from '../components/HelpCard';
import { InputField } from '../components/InputField';
import { ModulePicker } from '../components/ModulePicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { ResultCard } from '../components/ResultCard';
import { ScreenContainer } from '../components/ScreenContainer';
import { DEFAULT_AREA_MARGIN } from '../constants/modules';
import { useAiConfig } from '../hooks/useAiConfig';
import { useModules } from '../hooks/useModules';
import { useTheme } from '../theme/ThemeContext';
import {
  calculateRoofDirect,
  calculateRoofInverse,
  formatNumber,
  parseLocaleNumber,
} from '../utils/calculations';

type Mode = 'direct' | 'inverse';

export function AreaTelhadoScreen() {
  const { colors } = useTheme();
  const { allModules } = useModules();
  const { review, hasApiKey } = useAiConfig();
  const [mode, setMode] = useState<Mode>('direct');
  const [selectedId, setSelectedId] = useState(allModules[0]?.id ?? '');
  const [quantityText, setQuantityText] = useState('12');
  const [roofAreaText, setRoofAreaText] = useState('40');
  const [marginText, setMarginText] = useState(String(DEFAULT_AREA_MARGIN * 100));
  const [error, setError] = useState<string | undefined>();
  const [directResult, setDirectResult] = useState<ReturnType<typeof calculateRoofDirect> | null>(
    null,
  );
  const [inverseResult, setInverseResult] = useState<ReturnType<
    typeof calculateRoofInverse
  > | null>(null);

  useEffect(() => {
    if (!allModules.find((m) => m.id === selectedId) && allModules[0]) {
      setSelectedId(allModules[0].id);
    }
  }, [allModules, selectedId]);

  const selected = useMemo(
    () => allModules.find((m) => m.id === selectedId) ?? allModules[0],
    [allModules, selectedId],
  );

  const onCalculate = () => {
    if (!selected) {
      setError('Selecione um módulo.');
      return;
    }
    const marginPercent = parseLocaleNumber(marginText);
    if (!Number.isFinite(marginPercent) || marginPercent < 0 || marginPercent >= 100) {
      setError('Informe uma margem entre 0 e 99%.');
      return;
    }
    const margin = marginPercent / 100;
    setError(undefined);

    if (mode === 'direct') {
      const qty = parseLocaleNumber(quantityText);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError('Informe a quantidade de placas.');
        return;
      }
      setDirectResult(calculateRoofDirect(Math.floor(qty), selected, margin));
      setInverseResult(null);
      return;
    }

    const roofArea = parseLocaleNumber(roofAreaText);
    if (!Number.isFinite(roofArea) || roofArea <= 0) {
      setError('Informe a área disponível do telhado.');
      return;
    }
    setInverseResult(calculateRoofInverse(roofArea, selected, margin));
    setDirectResult(null);
  };

  return (
    <ScreenContainer
      title="Área de Telhado"
      subtitle="Cálculo bidirecional: do sistema para o telhado ou do telhado para as placas."
    >
      <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(
          [
            { key: 'direct', label: 'Sistema → Telhado' },
            { key: 'inverse', label: 'Telhado → Placas' },
          ] as const
        ).map((item) => {
          const selectedMode = mode === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                setMode(item.key);
                setError(undefined);
              }}
              style={[
                styles.segmentItem,
                { backgroundColor: selectedMode ? colors.primary : 'transparent' },
              ]}
            >
              <Text
                style={{
                  fontFamily: 'Outfit_600SemiBold',
                  fontSize: 13,
                  textAlign: 'center',
                  color: selectedMode
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

      <ModulePicker
        modules={allModules}
        selectedId={selected?.id}
        onSelect={(module) => setSelectedId(module.id)}
      />

      {mode === 'direct' ? (
        <InputField
          label="Quantidade de placas"
          value={quantityText}
          onChangeText={setQuantityText}
          keyboardType="number-pad"
          placeholder="Ex: 12"
        />
      ) : (
        <InputField
          label="Área disponível no telhado (m²)"
          value={roofAreaText}
          onChangeText={setRoofAreaText}
          keyboardType="decimal-pad"
          placeholder="Ex: 40"
        />
      )}

      <InputField
        label={mode === 'direct' ? 'Margem de segurança (%)' : 'Margem de desconto (%)'}
        value={marginText}
        onChangeText={setMarginText}
        keyboardType="decimal-pad"
        placeholder="10"
        hint="Padrão: 10%"
        error={error}
      />

      <PrimaryButton label="Calcular área" onPress={onCalculate} style={styles.cta} />

      <HelpCard
        title="Como funciona o cálculo bidirecional?"
        body={
          mode === 'direct'
            ? 'Área Bruta = Qtd × Área Unitária. Área Recomendada = Área Bruta × (1 + margem).'
            : 'Área Útil = Área Telhado × (1 − margem). Qtd Máxima = piso(Área Útil ÷ Área Unitária). Potência Máxima e geração mensal estimada (× 100 kWh/mês por kWp) são derivadas dessa quantidade.'
        }
      />

      {mode === 'direct' && directResult ? (
        <>
          <ResultCard
            title="Do sistema para o telhado"
            rows={[
              {
                label: 'Módulo',
                value: `${directResult.module.powerWp} Wp · ${formatNumber(directResult.module.areaM2)} m²`,
              },
              { label: 'Quantidade', value: String(directResult.quantity) },
              { label: 'Área bruta', value: `${formatNumber(directResult.grossAreaM2)} m²` },
              {
                label: 'Área recomendada',
                value: `${formatNumber(directResult.recommendedAreaM2)} m²`,
                emphasize: true,
              },
              {
                label: 'Potência total',
                value: `${formatNumber(directResult.totalPowerKwp)} kWp`,
              },
            ]}
          />
          <AiReviewCard
            payload={{ kind: 'roof_direct', result: directResult }}
            onReview={review}
            disabledReason={
              hasApiKey ? undefined : 'Configure a API Key na aba Config. IA para habilitar a revisão.'
            }
          />
        </>
      ) : null}

      {mode === 'inverse' && inverseResult ? (
        <>
          <ResultCard
            title="Do telhado para as placas"
            rows={[
              {
                label: 'Área útil disponível',
                value: `${formatNumber(inverseResult.usefulAreaM2)} m²`,
              },
              {
                label: 'Qtd máxima de placas',
                value: String(inverseResult.maxModules),
                emphasize: true,
              },
              {
                label: 'Potência máxima',
                value: `${formatNumber(inverseResult.maxPowerKwp)} kWp`,
              },
              {
                label: 'Geração mensal estimada',
                value: `${formatNumber(inverseResult.estimatedMonthlyGenerationKwh)} kWh/mês`,
              },
            ]}
          />
          <AiReviewCard
            payload={{ kind: 'roof_inverse', result: inverseResult }}
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
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    minHeight: 46,
    paddingHorizontal: 6,
  },
  cta: { marginBottom: 16 },
});

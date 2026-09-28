import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AiReviewCard } from '../components/AiReviewCard';
import { HelpCard } from '../components/HelpCard';
import { InputField } from '../components/InputField';
import { ModulePicker } from '../components/ModulePicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { ResultCard } from '../components/ResultCard';
import { RoofLayoutCanvas } from '../components/RoofLayoutCanvas';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  DEFAULT_AREA_MARGIN,
  DEFAULT_EDGE_MARGIN_M,
} from '../constants/modules';
import { useAiConfig } from '../hooks/useAiConfig';
import { useModules } from '../hooks/useModules';
import { useTheme } from '../theme/ThemeContext';
import { RoofLayoutOption } from '../types';
import {
  calculateRoofDirect,
  calculateRoofInverse,
  formatNumber,
  parseLocaleNumber,
} from '../utils/calculations';
import { computeRoofLayouts } from '../utils/roofLayout';

type Mode = 'direct' | 'inverse';

export function AreaTelhadoScreen() {
  const { colors } = useTheme();
  const { allModules, refresh } = useModules();
  const { review, hasApiKey } = useAiConfig();
  const [mode, setMode] = useState<Mode>('inverse');
  const [selectedId, setSelectedId] = useState(allModules[0]?.id ?? '');
  const [quantityText, setQuantityText] = useState('12');
  const [roofWidthText, setRoofWidthText] = useState('');
  const [roofLengthText, setRoofLengthText] = useState('');
  const [roofAreaText, setRoofAreaText] = useState('40');
  const [areaManual, setAreaManual] = useState(false);
  const [marginText, setMarginText] = useState(String(DEFAULT_AREA_MARGIN * 100));
  const [edgeMarginText, setEdgeMarginText] = useState(String(DEFAULT_EDGE_MARGIN_M));
  const [error, setError] = useState<string | undefined>();
  const [directResult, setDirectResult] = useState<ReturnType<typeof calculateRoofDirect> | null>(
    null,
  );
  const [inverseResult, setInverseResult] = useState<ReturnType<
    typeof calculateRoofInverse
  > | null>(null);
  const [layoutOptions, setLayoutOptions] = useState<RoofLayoutOption[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (!allModules.find((m) => m.id === selectedId) && allModules[0]) {
      setSelectedId(allModules[0].id);
    }
  }, [allModules, selectedId]);

  const selected = useMemo(
    () => allModules.find((m) => m.id === selectedId) ?? allModules[0],
    [allModules, selectedId],
  );

  const roofWidth = parseLocaleNumber(roofWidthText);
  const roofLength = parseLocaleNumber(roofLengthText);
  const hasRoofDimensions =
    Number.isFinite(roofWidth) &&
    roofWidth > 0 &&
    Number.isFinite(roofLength) &&
    roofLength > 0;

  // Área automática = Largura × Comprimento (quando não estiver em modo manual)
  useEffect(() => {
    if (mode !== 'inverse' || areaManual) return;
    if (!hasRoofDimensions) return;
    const autoArea = Math.round(roofWidth * roofLength * 100) / 100;
    setRoofAreaText(String(autoArea).replace('.', ','));
  }, [mode, areaManual, hasRoofDimensions, roofWidth, roofLength]);

  // Preview reativo do arranjo (sem precisar apertar calcular)
  const liveLayouts = useMemo(() => {
    if (mode !== 'inverse' || !selected || !hasRoofDimensions) return null;
    const edge = parseLocaleNumber(edgeMarginText);
    const edgeMarginM =
      Number.isFinite(edge) && edge >= 0 ? edge : DEFAULT_EDGE_MARGIN_M;
    return computeRoofLayouts({
      roofWidthM: roofWidth,
      roofLengthM: roofLength,
      module: selected,
      edgeMarginM,
    });
  }, [
    mode,
    selected,
    hasRoofDimensions,
    roofWidth,
    roofLength,
    edgeMarginText,
  ]);

  useEffect(() => {
    if (!liveLayouts) {
      setLayoutOptions([]);
      setSelectedLayoutId(null);
      return;
    }
    setLayoutOptions(liveLayouts.options);
    setSelectedLayoutId((current) => {
      if (current && liveLayouts.options.some((o) => o.id === current)) {
        return current;
      }
      return liveLayouts.bestOptionId;
    });
  }, [liveLayouts]);

  const activeLayout =
    layoutOptions.find((o) => o.id === selectedLayoutId) ?? layoutOptions[0] ?? null;

  const onChangeWidth = (text: string) => {
    setRoofWidthText(text);
    setAreaManual(false);
  };

  const onChangeLength = (text: string) => {
    setRoofLengthText(text);
    setAreaManual(false);
  };

  const onChangeArea = (text: string) => {
    setRoofAreaText(text);
    setAreaManual(true);
  };

  const onCalculate = () => {
    if (!selected) {
      setError('Selecione um módulo.');
      return;
    }
    const marginPercent = parseLocaleNumber(marginText);
    if (!Number.isFinite(marginPercent) || marginPercent < 0 || marginPercent >= 100) {
      setError('Informe uma margem percentual entre 0 e 99%.');
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
      setError('Informe a área disponível do telhado ou preencha largura e comprimento.');
      return;
    }

    // Se houver dimensões, o arranjo gráfico já está em liveLayouts;
    // o resultado numérico clássico permanece baseado na área (com margem %).
    setInverseResult(calculateRoofInverse(roofArea, selected, margin));
    setDirectResult(null);

    if (liveLayouts) {
      setLayoutOptions(liveLayouts.options);
      setSelectedLayoutId(liveLayouts.bestOptionId);
    }
  };

  return (
    <ScreenContainer
      title="Área de Telhado"
      subtitle="Dimensões do telhado, arranjo dinâmico das placas e visualização do layout."
    >
      <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(
          [
            { key: 'inverse', label: 'Telhado → Placas' },
            { key: 'direct', label: 'Sistema → Telhado' },
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
        <>
          <Text style={[styles.section, { color: colors.text }]}>Dimensões do telhado</Text>
          <View style={styles.dimRow}>
            <View style={styles.dimCol}>
              <InputField
                label="Largura do Telhado (m)"
                value={roofWidthText}
                onChangeText={onChangeWidth}
                keyboardType="decimal-pad"
                placeholder="Ex: 8"
              />
            </View>
            <View style={styles.dimCol}>
              <InputField
                label="Comprimento do Telhado (m)"
                value={roofLengthText}
                onChangeText={onChangeLength}
                keyboardType="decimal-pad"
                placeholder="Ex: 12"
              />
            </View>
          </View>

          <InputField
            label="Área Disponível (m²)"
            value={roofAreaText}
            onChangeText={onChangeArea}
            keyboardType="decimal-pad"
            placeholder="Ex: 96"
            hint={
              hasRoofDimensions && !areaManual
                ? `Calculada automaticamente: ${formatNumber(roofWidth)} × ${formatNumber(roofLength)} = ${formatNumber(roofWidth * roofLength)} m²`
                : 'Pode digitar a área manualmente, sem preencher largura/comprimento.'
            }
          />

          <InputField
            label="Folga de borda / manutenção (m)"
            value={edgeMarginText}
            onChangeText={setEdgeMarginText}
            keyboardType="decimal-pad"
            placeholder="0,5"
            hint="Usada no arranjo gráfico (padrão 0,5 m em cada borda)."
          />
        </>
      )}

      <InputField
        label={mode === 'direct' ? 'Margem de segurança (%)' : 'Margem de desconto de área (%)'}
        value={marginText}
        onChangeText={setMarginText}
        keyboardType="decimal-pad"
        placeholder="10"
        hint="Padrão: 10% (cálculo clássico por área)."
        error={error}
      />

      <PrimaryButton label="Calcular área" onPress={onCalculate} style={styles.cta} />

      <HelpCard
        title="Como funciona o arranjo dinâmico?"
        body={
          mode === 'direct'
            ? 'Área Bruta = Qtd × Área Unitária. Área Recomendada = Área Bruta × (1 + margem).'
            : 'Com largura e comprimento, o app testa arranjos em retrato, paisagem e misto (com folga de borda) e mostra até 2 layouts. A área também pode ser digitada manualmente para o cálculo clássico por m².'
        }
      />

      {mode === 'inverse' && layoutOptions.length > 0 ? (
        <>
          <Text style={[styles.section, { color: colors.text }]}>Layouts sugeridos</Text>
          <View style={styles.layoutTabs}>
            {layoutOptions.map((option) => {
              const active = option.id === activeLayout?.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setSelectedLayoutId(option.id)}
                  style={[
                    styles.layoutTab,
                    {
                      backgroundColor: active ? colors.primarySoft : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.layoutTabTitle, { color: colors.text }]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.layoutTabMeta, { color: colors.textSecondary }]}>
                    {option.panelCount} placas · {option.orientationSummary}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <RoofLayoutCanvas
            option={activeLayout}
            interactive={false}
            // Preparado: onPanelPress / interactive=true para drag-rotate futuro
          />

          {activeLayout ? (
            <ResultCard
              title="Resumo do arranjo selecionado"
              rows={[
                {
                  label: 'Placas no layout',
                  value: String(activeLayout.panelCount),
                  emphasize: true,
                },
                {
                  label: 'Orientação',
                  value: activeLayout.orientationSummary,
                },
                {
                  label: 'Potência do arranjo',
                  value: `${formatNumber(activeLayout.totalPowerKwp)} kWp`,
                },
                {
                  label: 'Geração mensal estimada',
                  value: `${formatNumber(activeLayout.estimatedMonthlyGenerationKwh)} kWh/mês`,
                },
                {
                  label: 'Área útil do telhado',
                  value: `${formatNumber(activeLayout.usableWidthM)} × ${formatNumber(activeLayout.usableLengthM)} m`,
                },
              ]}
            />
          ) : null}
        </>
      ) : null}

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
            title="Cálculo clássico por área (m²)"
            rows={[
              {
                label: 'Área útil disponível',
                value: `${formatNumber(inverseResult.usefulAreaM2)} m²`,
              },
              {
                label: 'Qtd máxima por área',
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
  section: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 17,
    marginBottom: 8,
  },
  dimRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dimCol: { flex: 1 },
  cta: { marginBottom: 16 },
  layoutTabs: { gap: 10, marginBottom: 12 },
  layoutTab: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  layoutTabTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
  },
  layoutTabMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    marginTop: 4,
  },
});

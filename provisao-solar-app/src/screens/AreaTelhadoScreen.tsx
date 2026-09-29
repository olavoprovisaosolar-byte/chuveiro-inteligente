import React, { useCallback, useState } from 'react';
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
import { SelectedModuleDims } from '../components/SelectedModuleDims';
import { useAiConfig } from '../hooks/useAiConfig';
import {
  RoofCalcMode,
  RoofSubTab,
  RoofWorkspaceProvider,
  useRoofWorkspace,
} from '../hooks/RoofWorkspaceContext';
import { useTheme } from '../theme/ThemeContext';
import {
  calculateRoofDirect,
  calculateRoofInverse,
  formatNumber,
  parseLocaleNumber,
} from '../utils/calculations';
import { formatOptimizedArrangement } from '../utils/roofLayout';

function SubTabBar() {
  const { colors } = useTheme();
  const { subTab, setSubTab, hasRoofDimensions, bestLayout } = useRoofWorkspace();

  const tabs: Array<{ key: RoofSubTab; label: string; badge?: string }> = [
    { key: 'calc', label: 'Cálculo' },
    {
      key: 'layout',
      label: 'Layout 2D',
      badge:
        hasRoofDimensions && bestLayout && bestLayout.panelCount > 0
          ? String(bestLayout.panelCount)
          : undefined,
    },
  ];

  return (
    <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {tabs.map((item) => {
        const active = subTab === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => setSubTab(item.key)}
            style={[
              styles.segmentItem,
              { backgroundColor: active ? colors.primary : 'transparent' },
            ]}
          >
            <View style={styles.subTabInner}>
              <Text
                style={{
                  fontFamily: 'Outfit_600SemiBold',
                  fontSize: 14,
                  textAlign: 'center',
                  color: active
                    ? colors.mode === 'light'
                      ? '#fff'
                      : colors.background
                    : colors.textSecondary,
                }}
              >
                {item.label}
              </Text>
              {item.badge ? (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: active
                        ? colors.mode === 'light'
                          ? 'rgba(255,255,255,0.25)'
                          : 'rgba(0,0,0,0.2)'
                        : colors.primarySoft,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: 'Outfit_700Bold',
                      fontSize: 11,
                      color: active
                        ? colors.mode === 'light'
                          ? '#fff'
                          : colors.background
                        : colors.primary,
                    }}
                  >
                    {item.badge}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function CalcModeBar({
  mode,
  onChange,
}: {
  mode: RoofCalcMode;
  onChange: (mode: RoofCalcMode) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {(
        [
          { key: 'inverse' as const, label: 'Telhado → Placas' },
          { key: 'direct' as const, label: 'Sistema → Telhado' },
        ] as const
      ).map((item) => {
        const selectedMode = mode === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
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
  );
}

function CalcPanel() {
  const { colors } = useTheme();
  const { review, hasApiKey } = useAiConfig();
  const ws = useRoofWorkspace();
  const [error, setError] = useState<string | undefined>();
  const [directResult, setDirectResult] = useState<ReturnType<typeof calculateRoofDirect> | null>(
    null,
  );
  const [inverseResult, setInverseResult] = useState<ReturnType<
    typeof calculateRoofInverse
  > | null>(null);

  const onCalculate = () => {
    if (!ws.selectedModule) {
      setError('Selecione um módulo.');
      return;
    }
    const marginPercent = parseLocaleNumber(ws.marginText);
    if (!Number.isFinite(marginPercent) || marginPercent < 0 || marginPercent >= 100) {
      setError('Informe uma margem percentual entre 0 e 99%.');
      return;
    }
    const margin = marginPercent / 100;
    setError(undefined);

    if (ws.calcMode === 'direct') {
      const qty = parseLocaleNumber(ws.quantityText);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError('Informe a quantidade de placas.');
        return;
      }
      setDirectResult(calculateRoofDirect(Math.floor(qty), ws.selectedModule, margin));
      setInverseResult(null);
      return;
    }

    const roofArea = parseLocaleNumber(ws.roofAreaText);
    if (!Number.isFinite(roofArea) || roofArea <= 0) {
      setError('Informe a área disponível do telhado ou preencha largura e comprimento.');
      return;
    }

    setInverseResult(calculateRoofInverse(roofArea, ws.selectedModule, margin));
    setDirectResult(null);
  };

  return (
    <>
      <CalcModeBar
        mode={ws.calcMode}
        onChange={(mode) => {
          ws.setCalcMode(mode);
          setError(undefined);
        }}
      />

      <ModulePicker
        modules={ws.allModules}
        selectedId={ws.selectedModule?.id}
        onSelect={(module) => ws.setSelectedId(module.id)}
        showDimensions
      />
      <SelectedModuleDims module={ws.selectedModule} />

      {ws.calcMode === 'direct' ? (
        <InputField
          label="Quantidade de placas"
          value={ws.quantityText}
          onChangeText={ws.setQuantityText}
          keyboardType="number-pad"
          placeholder="Ex: 12"
        />
      ) : (
        <>
          <Text style={[styles.section, { color: colors.text }]}>Dimensões do telhado</Text>
          <View style={styles.dimRow}>
            <View style={styles.dimCol}>
              <InputField
                label="Largura do Espaço (m)"
                value={ws.roofWidthText}
                onChangeText={ws.onChangeWidth}
                keyboardType="decimal-pad"
                placeholder="Ex: 8"
              />
            </View>
            <View style={styles.dimCol}>
              <InputField
                label="Comprimento do Espaço (m)"
                value={ws.roofLengthText}
                onChangeText={ws.onChangeLength}
                keyboardType="decimal-pad"
                placeholder="Ex: 12"
              />
            </View>
          </View>

          <InputField
            label="Área Disponível (m²)"
            value={ws.roofAreaText}
            onChangeText={ws.onChangeArea}
            keyboardType="decimal-pad"
            placeholder="Ex: 96"
            hint={
              ws.hasRoofDimensions && !ws.areaManual
                ? `Calculada automaticamente: ${formatNumber(ws.roofWidth)} × ${formatNumber(ws.roofLength)} = ${formatNumber(ws.roofWidth * ws.roofLength)} m²`
                : 'Pode digitar a área manualmente, sem preencher largura/comprimento.'
            }
          />

          <InputField
            label="Folga de borda / manutenção (m)"
            value={ws.edgeMarginText}
            onChangeText={ws.setEdgeMarginText}
            keyboardType="decimal-pad"
            placeholder="0,5"
            hint="Usada no Layout 2D (padrão 0,5 m em cada borda)."
          />

          {ws.hasRoofDimensions && ws.bestLayout ? (
            <Pressable
              onPress={() => ws.setSubTab('layout')}
              style={[
                styles.layoutHint,
                { backgroundColor: colors.primarySoft, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.layoutHintTitle, { color: colors.text }]}>
                {formatOptimizedArrangement(ws.bestLayout)}
              </Text>
              <Text style={[styles.layoutHintCta, { color: colors.primary }]}>
                Abrir Layout 2D →
              </Text>
            </Pressable>
          ) : null}
        </>
      )}

      <InputField
        label={
          ws.calcMode === 'direct' ? 'Margem de segurança (%)' : 'Margem de desconto de área (%)'
        }
        value={ws.marginText}
        onChangeText={ws.setMarginText}
        keyboardType="decimal-pad"
        placeholder="10"
        hint="Padrão: 10% (cálculo clássico por área)."
        error={error}
      />

      <PrimaryButton label="Calcular área" onPress={onCalculate} style={styles.cta} />

      <HelpCard
        title="Cálculo elétrico e por área"
        body={
          ws.calcMode === 'direct'
            ? 'Área Bruta = Qtd × Área Unitária. Área Recomendada = Área Bruta × (1 + margem). O arranjo físico das placas fica na sub-aba Layout 2D.'
            : 'Mantenha aqui o cálculo clássico por m² (com margem %). Para o desenho dinâmico e o máximo de placas no espaço, use a sub-aba Layout 2D.'
        }
      />

      {ws.calcMode === 'direct' && directResult ? (
        <>
          <ResultCard
            title="Do sistema para o telhado"
            rows={[
              {
                label: 'Módulo',
                value: `${directResult.module.powerWp} Wp · ${formatNumber(directResult.module.areaM2)} m²`,
              },
              {
                label: 'Dimensões da placa',
                value: `${formatNumber(directResult.module.lengthM)} × ${formatNumber(directResult.module.widthM)} m`,
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

      {ws.calcMode === 'inverse' && inverseResult ? (
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
    </>
  );
}

function LayoutPanel() {
  const { colors } = useTheme();
  const ws = useRoofWorkspace();

  return (
    <>
      <Text style={[styles.section, { color: colors.text }]}>Distribuição de Placas</Text>
      <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
        O algoritmo testa Vertical, Horizontal e Misto (com folga de borda) e sugere o arranjo com
        a maior quantidade de placas possível.
      </Text>

      <ModulePicker
        modules={ws.allModules}
        selectedId={ws.selectedModule?.id}
        onSelect={(module) => ws.setSelectedId(module.id)}
        showDimensions
      />
      <SelectedModuleDims module={ws.selectedModule} />

      <View style={styles.dimRow}>
        <View style={styles.dimCol}>
          <InputField
            label="Largura do Espaço (m)"
            value={ws.roofWidthText}
            onChangeText={ws.onChangeWidth}
            keyboardType="decimal-pad"
            placeholder="Ex: 8"
          />
        </View>
        <View style={styles.dimCol}>
          <InputField
            label="Comprimento do Espaço (m)"
            value={ws.roofLengthText}
            onChangeText={ws.onChangeLength}
            keyboardType="decimal-pad"
            placeholder="Ex: 12"
          />
        </View>
      </View>

      <InputField
        label="Folga de borda / manutenção (m)"
        value={ws.edgeMarginText}
        onChangeText={ws.setEdgeMarginText}
        keyboardType="decimal-pad"
        placeholder="0,5"
        hint="Descontada em cada borda antes do encaixe das placas."
      />

      {!ws.hasRoofDimensions ? (
        <HelpCard
          title="Informe as dimensões"
          body="Preencha largura e comprimento do espaço livre no telhado para gerar o desenho dinâmico. As dimensões da placa vêm do modelo selecionado (ou do cadastro customizado em Módulos)."
        />
      ) : null}

      {ws.layoutOptions.length > 0 ? (
        <>
          <View
            style={[
              styles.optimizedBanner,
              { backgroundColor: colors.primarySoft, borderColor: colors.primary },
            ]}
          >
            <Text style={[styles.optimizedLabel, { color: colors.primary }]}>
              Resultado do layout
            </Text>
            <Text style={[styles.optimizedTitle, { color: colors.text }]}>
              {formatOptimizedArrangement(ws.activeLayout ?? ws.bestLayout)}
            </Text>
            {(ws.activeLayout ?? ws.bestLayout) ? (
              <Text style={[styles.optimizedMeta, { color: colors.textSecondary }]}>
                {(ws.activeLayout ?? ws.bestLayout)!.panelCount} placas no espaço · potência{' '}
                {formatNumber((ws.activeLayout ?? ws.bestLayout)!.totalPowerKwp)} kWp
              </Text>
            ) : null}
          </View>

          <Text style={[styles.section, { color: colors.text }]}>Layouts sugeridos</Text>
          <View style={styles.layoutTabs}>
            {ws.layoutOptions.map((option) => {
              const active = option.id === ws.activeLayout?.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => ws.setSelectedLayoutId(option.id)}
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

          <RoofLayoutCanvas option={ws.activeLayout} interactive={false} />

          {ws.activeLayout ? (
            <ResultCard
              title="Resumo do arranjo selecionado"
              rows={[
                {
                  label: 'Total de placas',
                  value: String(ws.activeLayout.panelCount),
                  emphasize: true,
                },
                {
                  label: 'Orientação sugerida',
                  value: ws.activeLayout.orientationSummary,
                },
                {
                  label: 'Placa (C × L)',
                  value: ws.selectedModule
                    ? `${formatNumber(ws.selectedModule.lengthM)} × ${formatNumber(ws.selectedModule.widthM)} m`
                    : '—',
                },
                {
                  label: 'Potência do arranjo',
                  value: `${formatNumber(ws.activeLayout.totalPowerKwp)} kWp`,
                },
                {
                  label: 'Geração mensal estimada',
                  value: `${formatNumber(ws.activeLayout.estimatedMonthlyGenerationKwh)} kWh/mês`,
                },
                {
                  label: 'Área útil do telhado',
                  value: `${formatNumber(ws.activeLayout.usableWidthM)} × ${formatNumber(ws.activeLayout.usableLengthM)} m`,
                },
              ]}
            />
          ) : null}
        </>
      ) : null}

      <HelpCard
        title="Como o Layout 2D otimiza?"
        body="Combina largura/comprimento do espaço com comprimento/largura da placa, desconta a folga de manutenção e compara retrato (vertical), paisagem (horizontal) e misto. O desenho atualiza ao mudar qualquer dimensão."
      />
    </>
  );
}

function AreaTelhadoBody() {
  const { subTab, refreshModules } = useRoofWorkspace();

  useFocusEffect(
    useCallback(() => {
      refreshModules();
    }, [refreshModules]),
  );

  return (
    <ScreenContainer
      title="Área de Telhado"
      subtitle={
        subTab === 'calc'
          ? 'Cálculo elétrico e por área — o desenho das placas fica em Layout 2D.'
          : 'Distribuição espacial otimizada das placas no telhado.'
      }
    >
      <SubTabBar />
      {subTab === 'calc' ? <CalcPanel /> : <LayoutPanel />}
    </ScreenContainer>
  );
}

export function AreaTelhadoScreen() {
  return (
    <RoofWorkspaceProvider>
      <AreaTelhadoBody />
    </RoofWorkspaceProvider>
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
  subTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  section: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 17,
    marginBottom: 8,
  },
  sectionHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  dimRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dimCol: { flex: 1 },
  cta: { marginBottom: 16 },
  layoutHint: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  layoutHintTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
  layoutHintCta: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    marginTop: 6,
  },
  optimizedBanner: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  optimizedLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  optimizedTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    lineHeight: 22,
  },
  optimizedMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 6,
  },
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

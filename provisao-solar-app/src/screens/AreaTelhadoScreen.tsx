import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AiReviewCard } from '../components/AiReviewCard';
import { HelpCard } from '../components/HelpCard';
import { InputField } from '../components/InputField';
import { ModulePicker } from '../components/ModulePicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { ResultCard } from '../components/ResultCard';
import { RoofLayoutCanvas, RoofPolygonSketch } from '../components/RoofLayoutCanvas';
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
import { ObstacleKind } from '../types';
import {
  calculateRoofDirect,
  calculateRoofInverse,
  formatNumber,
  parseLocaleNumber,
} from '../utils/calculations';
import { OBSTACLE_KIND_LABELS } from '../utils/roofGeometry';
import { formatOptimizedArrangement } from '../utils/roofLayout';

function SubTabBar() {
  const { colors } = useTheme();
  const { subTab, setSubTab, hasRoofGeometry, bestLayout } = useRoofWorkspace();

  const tabs: Array<{ key: RoofSubTab; label: string; badge?: string }> = [
    { key: 'calc', label: 'Cálculo' },
    {
      key: 'layout',
      label: 'Layout 2D',
      badge:
        hasRoofGeometry && bestLayout && bestLayout.panelCount > 0
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

          {ws.hasRoofGeometry && ws.bestLayout ? (
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
                Abrir Editor de Layout 2D →
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
  const [obsKind, setObsKind] = useState<ObstacleKind>('chimney');
  const [obsShape, setObsShape] = useState<'rect' | 'circle'>('rect');
  const [obsW, setObsW] = useState('1,0');
  const [obsH, setObsH] = useState('1,0');

  const onAddObstacle = () => {
    const widthM = parseLocaleNumber(obsW);
    const heightM = parseLocaleNumber(obsH);
    if (!Number.isFinite(widthM) || widthM <= 0 || !Number.isFinite(heightM) || heightM <= 0) {
      return;
    }
    ws.addObstacle({
      kind: obsKind,
      shape: obsShape,
      widthM,
      heightM,
      radiusM: Math.min(widthM, heightM) / 2,
    });
  };

  return (
    <>
      <Text style={[styles.section, { color: colors.text }]}>Editor de Layout 2D</Text>
      <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
        Telhado retangular ou irregular, obstáculos (zonas de exclusão) e arranjo Vertical /
        Horizontal / Misto com grampos intermediários (2 cm) e finais.
      </Text>

      <ModulePicker
        modules={ws.allModules}
        selectedId={ws.selectedModule?.id}
        onSelect={(module) => ws.setSelectedId(module.id)}
        showDimensions
      />
      <SelectedModuleDims module={ws.selectedModule} />

      <Text style={[styles.section, { color: colors.text }]}>Forma do telhado</Text>
      <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(
          [
            { key: 'rectangle' as const, label: 'Retangular' },
            { key: 'polygon' as const, label: 'Irregular' },
          ] as const
        ).map((item) => {
          const active = ws.shapeMode === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => ws.setShapeMode(item.key)}
              style={[
                styles.segmentItem,
                { backgroundColor: active ? colors.primary : 'transparent' },
              ]}
            >
              <Text
                style={{
                  fontFamily: 'Outfit_600SemiBold',
                  fontSize: 13,
                  color: active
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

      {ws.shapeMode === 'rectangle' ? (
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
      ) : (
        <>
          <RoofPolygonSketch
            draftVertices={ws.draftVertices}
            closed={ws.polygonClosed}
            onAddVertex={ws.addDraftVertex}
            onUndo={ws.undoDraftVertex}
            onClear={ws.clearDraftPolygon}
            onClosePolygon={ws.closePolygon}
          />
          {ws.polygonClosed && ws.draftVertices.length >= 3 ? (
            <>
              <Text style={[styles.section, { color: colors.text }]}>
                Comprimento real dos lados (m)
              </Text>
              <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
                Informe ao menos um lado para calibrar a escala. Os demais ajustam a proporção.
              </Text>
              {ws.draftVertices.map((_, i) => (
                <Pressable
                  key={`edge-${i}`}
                  onPress={() => ws.setCalibrateEdgeIndex(i)}
                >
                  <InputField
                    label={`Lado ${i + 1} → ${((i + 1) % ws.draftVertices.length) + 1}${
                      ws.calibrateEdgeIndex === i ? ' ★ calibração' : ''
                    }`}
                    value={ws.edgeLengthTexts[i] ?? ''}
                    onChangeText={(t) => ws.setEdgeLengthAt(i, t)}
                    keyboardType="decimal-pad"
                    placeholder="Ex: 6,5"
                  />
                </Pressable>
              ))}
            </>
          ) : null}
        </>
      )}

      <Text style={[styles.section, { color: colors.text }]}>Espaçamentos mecânicos</Text>
      <InputField
        label="Folga de borda / manutenção (m)"
        value={ws.edgeMarginText}
        onChangeText={ws.setEdgeMarginText}
        keyboardType="decimal-pad"
        placeholder="0,5"
        hint="Margem ao redor do perímetro do telhado."
      />
      <View style={styles.dimRow}>
        <View style={styles.dimCol}>
          <InputField
            label="Entre placas — mid clamp (m)"
            value={ws.panelGapText}
            onChangeText={ws.setPanelGapText}
            keyboardType="decimal-pad"
            placeholder="0,02"
            hint="Padrão 2 cm."
          />
        </View>
        <View style={styles.dimCol}>
          <InputField
            label="Pontas — end clamp (m)"
            value={ws.endClampText}
            onChangeText={ws.setEndClampText}
            keyboardType="decimal-pad"
            placeholder="0,03"
            hint="2 a 5 cm nas pontas."
          />
        </View>
      </View>

      <Text style={[styles.section, { color: colors.text }]}>Obstáculos / exclusão</Text>
      <InputField
        label="Afastamento de segurança (m)"
        value={ws.obstacleClearanceText}
        onChangeText={ws.setObstacleClearanceText}
        keyboardType="decimal-pad"
        placeholder="0,4"
        hint="Raio de afastamento ao redor de cada obstáculo (0,3–0,5 m)."
      />
      <View style={styles.obsKinds}>
        {(Object.keys(OBSTACLE_KIND_LABELS) as ObstacleKind[]).map((kind) => {
          const active = obsKind === kind;
          return (
            <Pressable
              key={kind}
              onPress={() => setObsKind(kind)}
              style={[
                styles.obsChip,
                {
                  backgroundColor: active ? colors.primarySoft : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={{ color: colors.text, fontFamily: 'DMSans_500Medium', fontSize: 12 }}>
                {OBSTACLE_KIND_LABELS[kind]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(
          [
            { key: 'rect' as const, label: 'Retângulo' },
            { key: 'circle' as const, label: 'Círculo' },
          ] as const
        ).map((item) => {
          const active = obsShape === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setObsShape(item.key)}
              style={[
                styles.segmentItem,
                { backgroundColor: active ? colors.primary : 'transparent' },
              ]}
            >
              <Text
                style={{
                  fontFamily: 'Outfit_600SemiBold',
                  fontSize: 13,
                  color: active
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
      <View style={styles.dimRow}>
        <View style={styles.dimCol}>
          <InputField
            label={obsShape === 'circle' ? 'Diâmetro X (m)' : 'Largura (m)'}
            value={obsW}
            onChangeText={setObsW}
            keyboardType="decimal-pad"
            placeholder="1,0"
          />
        </View>
        <View style={styles.dimCol}>
          <InputField
            label={obsShape === 'circle' ? 'Diâmetro Y (m)' : 'Comprimento (m)'}
            value={obsH}
            onChangeText={setObsH}
            keyboardType="decimal-pad"
            placeholder="1,0"
          />
        </View>
      </View>
      <PrimaryButton label="Adicionar obstáculo" onPress={onAddObstacle} style={styles.cta} />
      {ws.obstacles.length > 0 ? (
        <View style={{ marginBottom: 12, gap: 8 }}>
          {ws.obstacles.map((o) => {
            const active = o.id === ws.selectedObstacleId;
            return (
              <Pressable
                key={o.id}
                onPress={() => ws.setSelectedObstacleId(o.id)}
                style={[
                  styles.obsRow,
                  {
                    backgroundColor: active ? colors.primarySoft : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontFamily: 'DMSans_400Regular',
                    fontSize: 13,
                  }}
                >
                  {o.label} · {o.shape === 'circle' ? '⌀' : ''}
                  {formatNumber(o.widthM)}×{formatNumber(o.heightM)} m · X{' '}
                  {formatNumber(o.x)} Y {formatNumber(o.y)}
                  {(o.rotationDeg ?? 0) !== 0 ? ` · ${formatNumber(o.rotationDeg ?? 0, 0)}°` : ''}
                </Text>
                <Pressable onPress={() => ws.removeObstacle(o.id)}>
                  <Text
                    style={{ color: colors.primary, fontFamily: 'Outfit_600SemiBold', fontSize: 13 }}
                  >
                    Remover
                  </Text>
                </Pressable>
              </Pressable>
            );
          })}
          <Pressable onPress={ws.clearObstacles}>
            <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_500Medium', fontSize: 13 }}>
              Limpar todos os obstáculos
            </Text>
          </Pressable>
        </View>
      ) : null}

      {ws.selectedObstacle ? (
        <View
          style={[
            styles.toolbar,
            { backgroundColor: colors.surface, borderColor: colors.primary },
          ]}
        >
          <Text style={[styles.section, { color: colors.text, marginBottom: 4 }]}>
            Obstáculo selecionado · {ws.selectedObstacle.label}
          </Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary, marginBottom: 10 }]}>
            Arraste no canvas ou ajuste finamente abaixo. O arranjo de placas atualiza em tempo real.
          </Text>
          <View style={styles.dimRow}>
            <View style={styles.dimCol}>
              <InputField
                label="Posição X (m)"
                value={String(ws.selectedObstacle.x).replace('.', ',')}
                onChangeText={(t) => {
                  const v = parseLocaleNumber(t);
                  if (Number.isFinite(v)) ws.moveObstacle(ws.selectedObstacle!.id, v, ws.selectedObstacle!.y);
                }}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </View>
            <View style={styles.dimCol}>
              <InputField
                label="Posição Y (m)"
                value={String(ws.selectedObstacle.y).replace('.', ',')}
                onChangeText={(t) => {
                  const v = parseLocaleNumber(t);
                  if (Number.isFinite(v)) ws.moveObstacle(ws.selectedObstacle!.id, ws.selectedObstacle!.x, v);
                }}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </View>
          </View>
          <View style={styles.dimRow}>
            <View style={styles.dimCol}>
              <InputField
                label="Largura (m)"
                value={String(ws.selectedObstacle.widthM).replace('.', ',')}
                onChangeText={(t) => {
                  const v = parseLocaleNumber(t);
                  if (Number.isFinite(v) && v > 0) {
                    ws.updateObstacle(ws.selectedObstacle!.id, {
                      widthM: v,
                      radiusM:
                        ws.selectedObstacle!.shape === 'circle'
                          ? v / 2
                          : ws.selectedObstacle!.radiusM,
                    });
                  }
                }}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.dimCol}>
              <InputField
                label="Comprimento (m)"
                value={String(ws.selectedObstacle.heightM).replace('.', ',')}
                onChangeText={(t) => {
                  const v = parseLocaleNumber(t);
                  if (Number.isFinite(v) && v > 0) {
                    ws.updateObstacle(ws.selectedObstacle!.id, { heightM: v });
                  }
                }}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <View style={styles.rotateRow}>
            <Pressable
              onPress={() => ws.rotateObstacle(ws.selectedObstacle!.id, -15)}
              style={[styles.rotateBtn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.text, fontFamily: 'Outfit_600SemiBold' }}>↺ −15°</Text>
            </Pressable>
            <Text style={{ color: colors.textSecondary, fontFamily: 'DMSans_500Medium', fontSize: 13 }}>
              Rotação {formatNumber(ws.selectedObstacle.rotationDeg ?? 0, 0)}°
            </Text>
            <Pressable
              onPress={() => ws.rotateObstacle(ws.selectedObstacle!.id, 15)}
              style={[styles.rotateBtn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.text, fontFamily: 'Outfit_600SemiBold' }}>↻ +15°</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {!ws.hasRoofGeometry ? (
        <HelpCard
          title="Defina o telhado"
          body="No modo Retangular, informe largura e comprimento. No modo Irregular, toque os cantos, feche o polígono e calibre pelo menos um lado em metros."
        />
      ) : null}

      {ws.layoutOptions.length > 0 || ws.hasRoofGeometry ? (
        <>
          <View
            style={[
              styles.optimizedBanner,
              { backgroundColor: colors.primarySoft, borderColor: colors.primary },
            ]}
          >
            <Text style={[styles.optimizedLabel, { color: colors.primary }]}>
              Resultado do layout (ao vivo)
            </Text>
            <Text style={[styles.optimizedTitle, { color: colors.text }]}>
              {formatOptimizedArrangement(ws.activeLayout ?? ws.bestLayout)}
            </Text>
            <Text style={[styles.optimizedMeta, { color: colors.textSecondary }]}>
              Área total {formatNumber(ws.totalRoofAreaM2)} m² · útil{' '}
              {formatNumber(ws.usefulAreaM2)} m² ·{' '}
              {(ws.activeLayout ?? ws.bestLayout)?.panelCount ?? 0} placas ·{' '}
              {formatNumber((ws.activeLayout ?? ws.bestLayout)?.totalPowerKwp ?? 0)} kWp
            </Text>
          </View>

          {ws.layoutOptions.length > 0 ? (
            <>
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
            </>
          ) : null}

          <RoofLayoutCanvas
            option={ws.activeLayout}
            polygon={ws.polygonMeters ?? undefined}
            obstacles={ws.obstacles}
            selectedObstacleId={ws.selectedObstacleId}
            onSelectObstacle={ws.setSelectedObstacleId}
            onMoveObstacle={ws.moveObstacle}
            onResizeObstacle={(id, w, h) =>
              ws.updateObstacle(id, {
                widthM: w,
                heightM: h,
                radiusM: w / 2,
              })
            }
            interactive
          />

          {ws.activeLayout ? (
            <ResultCard
              title="Resumo do arranjo"
              rows={[
                {
                  label: 'Área total do telhado',
                  value: `${formatNumber(ws.totalRoofAreaM2)} m²`,
                },
                {
                  label: 'Área útil aproveitável',
                  value: `${formatNumber(ws.usefulAreaM2)} m²`,
                },
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
                  emphasize: true,
                },
                {
                  label: 'Geração mensal estimada',
                  value: `${formatNumber(ws.activeLayout.estimatedMonthlyGenerationKwh)} kWh/mês`,
                },
                {
                  label: 'Obstáculos',
                  value: String(ws.obstacles.length),
                },
              ]}
            />
          ) : null}
        </>
      ) : null}

      <HelpCard
        title="Como o Layout 2D otimiza?"
        body="Arraste obstáculos pelo telhado (touch ou mouse). Ao mover, o packing recalcula Vertical/Horizontal/Misto em tempo real, contornando keep-outs com mid/end clamps."
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
          : 'Editor de Layout 2D: polígono, obstáculos e arranjo otimizado.'
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
  obsKinds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  obsChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  obsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  toolbar: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  rotateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  rotateBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});

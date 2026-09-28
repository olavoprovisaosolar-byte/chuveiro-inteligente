import React, { useMemo } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { PanelPlacement, RoofLayoutOption } from '../types';
import { formatNumber } from '../utils/calculations';

type Props = {
  option: RoofLayoutOption | null;
  /**
   * Preparado para interação futura: toque em uma placa.
   * Hoje apenas propaga o id; drag/rotate virão depois.
   */
  onPanelPress?: (placement: PanelPlacement) => void;
  /**
   * Reservado: futuro modo de edição (arrastar / rotacionar).
   */
  interactive?: boolean;
};

/**
 * Visualização gráfica do arranjo no telhado.
 * Usa Views absolutas (em vez de SVG) para facilitar toque/drag futuro.
 */
export function RoofLayoutCanvas({
  option,
  onPanelPress,
  interactive = false,
}: Props) {
  const { colors } = useTheme();
  const [canvasWidth, setCanvasWidth] = React.useState(320);

  const onLayout = (event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - canvasWidth) > 1) {
      setCanvasWidth(w);
    }
  };

  const geometry = useMemo(() => {
    if (!option || option.roofWidthM <= 0 || option.roofLengthM <= 0) {
      return null;
    }
    const padding = 12;
    const available = Math.max(120, canvasWidth - padding * 2);
    const aspect = option.roofLengthM / option.roofWidthM;
    let drawW = available;
    let drawH = drawW * aspect;
    const maxH = 280;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH / aspect;
    }
    const scale = drawW / option.roofWidthM;
    const marginPx = option.edgeMarginM * scale;
    return { drawW, drawH, scale, marginPx, padding };
  }, [option, canvasWidth]);

  if (!option || !geometry) {
    return (
      <View
        style={[
          styles.empty,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Informe largura e comprimento do telhado e selecione uma placa para ver o arranjo.
        </Text>
      </View>
    );
  }

  const { drawW, drawH, scale, marginPx, padding } = geometry;

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onLayout={onLayout}
    >
      <View style={styles.metaRow}>
        <Text style={[styles.metaTitle, { color: colors.text }]}>{option.label}</Text>
        <Text style={[styles.metaCount, { color: colors.accent }]}>
          {option.panelCount} placas
        </Text>
      </View>
      <Text style={[styles.metaSub, { color: colors.textSecondary }]}>
        {option.orientationSummary} · útil {formatNumber(option.usableWidthM)} ×{' '}
        {formatNumber(option.usableLengthM)} m
      </Text>

      <View style={[styles.stage, { padding }]}>
        <View
          style={[
            styles.roof,
            {
              width: drawW,
              height: drawH,
              backgroundColor: colors.mode === 'light' ? '#D9C3A5' : '#4A3B2A',
              borderColor: colors.border,
            },
          ]}
          // Âncora para futuro overlay de edição (drag layer)
          accessibilityLabel="canvas-telhado"
          testID="roof-layout-canvas"
        >
          {/* Área útil (dentro da margem de borda) */}
          <View
            pointerEvents="none"
            style={[
              styles.usable,
              {
                left: marginPx,
                top: marginPx,
                width: Math.max(0, drawW - marginPx * 2),
                height: Math.max(0, drawH - marginPx * 2),
                borderColor: colors.primary,
              },
            ]}
          />

          {option.placements.map((panel) => {
            const left = marginPx + panel.x * scale;
            const top = marginPx + panel.y * scale;
            const width = Math.max(2, panel.width * scale);
            const height = Math.max(2, panel.height * scale);
            const isLandscape = panel.orientation === 'landscape';
            const fill = isLandscape
              ? colors.mode === 'light'
                ? '#1F7A5A'
                : '#3FA87A'
              : colors.mode === 'light'
                ? '#0B3D2E'
                : '#8FD4B0';

            return (
              <Pressable
                key={panel.id}
                disabled={!interactive}
                onPress={() => onPanelPress?.(panel)}
                // Props reservadas para gesto futuro (drag/rotate)
                accessibilityRole="button"
                accessibilityLabel={`placa-${panel.id}-${panel.orientation}`}
                style={[
                  styles.panel,
                  {
                    left,
                    top,
                    width,
                    height,
                    backgroundColor: fill,
                    borderColor: colors.mode === 'light' ? '#F5D78A' : '#E8A317',
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.primary }]} />
          <Text style={{ color: colors.textSecondary, fontFamily: 'DMSans_400Regular', fontSize: 12 }}>
            Retrato
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.swatch,
              {
                backgroundColor:
                  colors.mode === 'light' ? '#1F7A5A' : '#3FA87A',
              },
            ]}
          />
          <Text style={{ color: colors.textSecondary, fontFamily: 'DMSans_400Regular', fontSize: 12 }}>
            Paisagem
          </Text>
        </View>
        <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular', fontSize: 11 }}>
          Folga de borda {formatNumber(option.edgeMarginM)} m
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  empty: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  emptyText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  metaTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    flex: 1,
  },
  metaCount: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
  metaSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  roof: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  usable: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  panel: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 2,
  },
  legend: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
});

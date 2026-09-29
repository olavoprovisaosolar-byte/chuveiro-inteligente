import React, { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Point2D, RoofLayoutOption, RoofObstacle } from '../types';
import { formatNumber } from '../utils/calculations';
import { boundingBox, dist } from '../utils/roofGeometry';

type Props = {
  option: RoofLayoutOption | null;
  /** Vértices em metros; se omitido, usa option.polygon ou retângulo. */
  polygon?: Point2D[];
  obstacles?: RoofObstacle[];
  onPanelPress?: (id: string) => void;
  interactive?: boolean;
};

function EdgeLine({
  a,
  b,
  scale,
  color,
}: {
  a: Point2D;
  b: Point2D;
  scale: number;
  color: string;
}) {
  const x1 = a.x * scale;
  const y1 = a.y * scale;
  const x2 = b.x * scale;
  const y2 = b.y * scale;
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: (x1 + x2) / 2 - length / 2,
        top: (y1 + y2) / 2 - 1,
        width: length,
        height: 2,
        backgroundColor: color,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

/**
 * Visualização do arranjo: polígono, obstáculos e placas.
 * Coordenadas em metros a partir da origem do bounding box (0,0).
 */
export function RoofLayoutCanvas({
  option,
  polygon: polygonProp,
  obstacles: obstaclesProp,
  onPanelPress,
  interactive = false,
}: Props) {
  const { colors } = useTheme();
  const [canvasWidth, setCanvasWidth] = useState(320);

  const onLayout = (event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - canvasWidth) > 1) setCanvasWidth(w);
  };

  const polygon =
    polygonProp ??
    option?.polygon ??
    (option && option.roofWidthM > 0 && option.roofLengthM > 0
      ? [
          { x: 0, y: 0 },
          { x: option.roofWidthM, y: 0 },
          { x: option.roofWidthM, y: option.roofLengthM },
          { x: 0, y: option.roofLengthM },
        ]
      : []);

  const obstacles = obstaclesProp ?? option?.obstacles ?? [];

  const geometry = useMemo(() => {
    if (polygon.length < 3 && (!option || option.roofWidthM <= 0)) return null;
    const box =
      polygon.length >= 3
        ? boundingBox(polygon)
        : {
            minX: 0,
            minY: 0,
            maxX: option!.roofWidthM,
            maxY: option!.roofLengthM,
            width: option!.roofWidthM,
            height: option!.roofLengthM,
          };
    if (box.width <= 0 || box.height <= 0) return null;
    const padding = 12;
    const available = Math.max(120, canvasWidth - padding * 2);
    const aspect = box.height / box.width;
    let drawW = available;
    let drawH = drawW * aspect;
    const maxH = 320;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH / aspect;
    }
    const scale = drawW / box.width;
    return { drawW, drawH, scale, padding, box };
  }, [polygon, option, canvasWidth]);

  if (!geometry) {
    return (
      <View
        style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Informe o telhado (retângulo ou polígono) e selecione uma placa para ver o arranjo.
        </Text>
      </View>
    );
  }

  const { drawW, drawH, scale, padding, box } = geometry;
  const polyDraw = polygon.map((p) => ({
    x: p.x - box.minX,
    y: p.y - box.minY,
  }));

  return (
    <View
      style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onLayout={onLayout}
    >
      {option ? (
        <>
          <View style={styles.metaRow}>
            <Text style={[styles.metaTitle, { color: colors.text }]}>{option.label}</Text>
            <Text style={[styles.metaCount, { color: colors.accent }]}>
              {option.panelCount} placas
            </Text>
          </View>
          <Text style={[styles.metaSub, { color: colors.textSecondary }]}>
            {option.orientationSummary}
            {option.totalRoofAreaM2 != null
              ? ` · área ${formatNumber(option.totalRoofAreaM2)} m²`
              : ''}
            {option.usefulAreaM2 != null
              ? ` · útil ${formatNumber(option.usefulAreaM2)} m²`
              : ''}
          </Text>
        </>
      ) : null}

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
          testID="roof-layout-canvas"
        >
          {/* Contorno do polígono */}
          {polyDraw.length >= 2
            ? polyDraw.map((p, i) => (
                <EdgeLine
                  key={`e-${i}`}
                  a={p}
                  b={polyDraw[(i + 1) % polyDraw.length]}
                  scale={scale}
                  color={colors.primary}
                />
              ))
            : null}

          {/* Vértices */}
          {polyDraw.map((p, i) => (
            <View
              key={`v-${i}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: p.x * scale - 4,
                top: p.y * scale - 4,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.primary,
              }}
            />
          ))}

          {/* Obstáculos */}
          {obstacles.map((o) => {
            const clear = o.clearanceM || 0;
            if (o.shape === 'circle') {
              const r = ((o.radiusM ?? Math.min(o.widthM, o.heightM) / 2) + clear) * scale;
              const cx = (o.x - box.minX) * scale;
              const cy = (o.y - box.minY) * scale;
              return (
                <View
                  key={o.id}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: cx - r,
                    top: cy - r,
                    width: r * 2,
                    height: r * 2,
                    borderRadius: r,
                    backgroundColor: 'rgba(180,40,40,0.45)',
                    borderWidth: 1,
                    borderColor: '#B02828',
                  }}
                />
              );
            }
            return (
              <View
                key={o.id}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: (o.x - clear - box.minX) * scale,
                  top: (o.y - clear - box.minY) * scale,
                  width: (o.widthM + 2 * clear) * scale,
                  height: (o.heightM + 2 * clear) * scale,
                  backgroundColor: 'rgba(180,40,40,0.4)',
                  borderWidth: 1,
                  borderColor: '#B02828',
                }}
              />
            );
          })}

          {/* Placas */}
          {(option?.placements ?? []).map((panel) => {
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
                onPress={() => onPanelPress?.(panel.id)}
                style={{
                  position: 'absolute',
                  left: (panel.x - box.minX) * scale,
                  top: (panel.y - box.minY) * scale,
                  width: Math.max(2, panel.width * scale),
                  height: Math.max(2, panel.height * scale),
                  backgroundColor: fill,
                  borderWidth: 1,
                  borderColor: colors.mode === 'light' ? '#F5D78A' : '#E8A317',
                  borderRadius: 2,
                }}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>Vertical</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.swatch,
              { backgroundColor: colors.mode === 'light' ? '#1F7A5A' : '#3FA87A' },
            ]}
          />
          <Text style={styles.legendText}>Horizontal</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: 'rgba(180,40,40,0.7)' }]} />
          <Text style={styles.legendText}>Obstáculo</Text>
        </View>
      </View>
    </View>
  );
}

/** Editor de polígono: toque para adicionar vértices. */
export function RoofPolygonSketch({
  draftVertices,
  onAddVertex,
  onUndo,
  onClear,
  onClosePolygon,
  closed,
}: {
  draftVertices: Point2D[];
  onAddVertex: (p: Point2D) => void;
  onUndo: () => void;
  onClear: () => void;
  onClosePolygon: () => void;
  closed: boolean;
}) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ w: 300, h: 260 });

  const onTap = (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (closed) return;
    const { locationX, locationY } = evt.nativeEvent;
    // Coordenadas normalizadas 0–1 no sketch; conversão para metros ocorre na calibração
    onAddVertex({
      x: locationX / size.w,
      y: locationY / size.h,
    });
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Pressable
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0) setSize({ w: width, h: height });
        }}
        onPress={onTap}
        style={[
          styles.sketch,
          {
            backgroundColor: colors.mode === 'light' ? '#E8DCC8' : '#3A2F22',
            borderColor: colors.border,
          },
        ]}
      >
        {draftVertices.map((p, i) => {
          const next = draftVertices[(i + 1) % draftVertices.length];
          const showEdge = i < draftVertices.length - 1 || closed;
          if (!showEdge || draftVertices.length < 2) return null;
          if (!closed && i === draftVertices.length - 1) return null;
          return (
            <EdgeLine
              key={`sk-e-${i}`}
              a={{ x: p.x * size.w, y: p.y * size.h }}
              b={{ x: next.x * size.w, y: next.y * size.h }}
              scale={1}
              color={colors.primary}
            />
          );
        })}
        {draftVertices.length >= 2 && !closed ? (
          <EdgeLine
            a={{
              x: draftVertices[draftVertices.length - 2].x * size.w,
              y: draftVertices[draftVertices.length - 2].y * size.h,
            }}
            b={{
              x: draftVertices[draftVertices.length - 1].x * size.w,
              y: draftVertices[draftVertices.length - 1].y * size.h,
            }}
            scale={1}
            color={colors.primary}
          />
        ) : null}
        {draftVertices.map((p, i) => (
          <View
            key={`sk-v-${i}`}
            style={{
              position: 'absolute',
              left: p.x * size.w - 6,
              top: p.y * size.h - 6,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.primary,
              borderWidth: 2,
              borderColor: '#fff',
            }}
          />
        ))}
        {draftVertices.length === 0 ? (
          <Text style={[styles.sketchHint, { color: colors.textMuted }]}>
            Toque na área para marcar os cantos do telhado
          </Text>
        ) : null}
      </Pressable>
      <View style={styles.sketchActions}>
        <Pressable onPress={onUndo} style={[styles.chipBtn, { borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontFamily: 'DMSans_500Medium', fontSize: 13 }}>
            Desfazer
          </Text>
        </Pressable>
        <Pressable onPress={onClear} style={[styles.chipBtn, { borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontFamily: 'DMSans_500Medium', fontSize: 13 }}>
            Limpar
          </Text>
        </Pressable>
        <Pressable
          onPress={onClosePolygon}
          disabled={draftVertices.length < 3 || closed}
          style={[
            styles.chipBtn,
            {
              borderColor: colors.primary,
              backgroundColor: colors.primarySoft,
              opacity: draftVertices.length < 3 || closed ? 0.5 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.primary, fontFamily: 'Outfit_600SemiBold', fontSize: 13 }}>
            Fechar polígono
          </Text>
        </Pressable>
      </View>
      {draftVertices.length >= 2 ? (
        <Text style={{ color: colors.textSecondary, fontFamily: 'DMSans_400Regular', fontSize: 12 }}>
          Vértices: {draftVertices.length}
          {closed
            ? ` · perímetro relativo ${formatNumber(
                draftVertices.reduce((s, p, i) => {
                  const n = draftVertices[(i + 1) % draftVertices.length];
                  return s + dist(p, n);
                }, 0),
                3,
              )} (unid. sketch)`
            : ''}
        </Text>
      ) : null}
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
  stage: { alignItems: 'center', justifyContent: 'center' },
  roof: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  legend: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#666' },
  swatch: { width: 12, height: 12, borderRadius: 2 },
  sketch: {
    height: 260,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
  },
  sketchHint: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  sketchActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chipBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});

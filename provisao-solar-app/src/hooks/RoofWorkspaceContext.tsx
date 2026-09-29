import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_AREA_MARGIN,
  DEFAULT_EDGE_MARGIN_M,
  DEFAULT_END_CLAMP_M,
  DEFAULT_OBSTACLE_CLEARANCE_M,
  DEFAULT_PANEL_GAP_M,
} from '../constants/modules';
import { useModules } from '../hooks/useModules';
import {
  ObstacleKind,
  ObstacleShape,
  Point2D,
  RoofLayoutOption,
  RoofObstacle,
  RoofShapeMode,
  SolarModule,
} from '../types';
import { parseLocaleNumber } from '../utils/calculations';
import {
  OBSTACLE_KIND_LABELS,
  boundingBox,
  normalizePolygonOrigin,
  polygonArea,
  scalePolygonToEdge,
} from '../utils/roofGeometry';
import { computeRoofLayouts } from '../utils/roofLayout';

export type RoofSubTab = 'calc' | 'layout';
export type RoofCalcMode = 'direct' | 'inverse';

type RoofWorkspaceValue = {
  subTab: RoofSubTab;
  setSubTab: (tab: RoofSubTab) => void;
  calcMode: RoofCalcMode;
  setCalcMode: (mode: RoofCalcMode) => void;
  selectedModule: SolarModule | undefined;
  selectedId: string | undefined;
  setSelectedId: (id: string) => void;
  allModules: SolarModule[];
  quantityText: string;
  setQuantityText: (v: string) => void;
  roofWidthText: string;
  setRoofWidthText: (v: string) => void;
  roofLengthText: string;
  setRoofLengthText: (v: string) => void;
  roofAreaText: string;
  setRoofAreaText: (v: string) => void;
  areaManual: boolean;
  setAreaManual: (v: boolean) => void;
  marginText: string;
  setMarginText: (v: string) => void;
  edgeMarginText: string;
  setEdgeMarginText: (v: string) => void;
  endClampText: string;
  setEndClampText: (v: string) => void;
  panelGapText: string;
  setPanelGapText: (v: string) => void;
  obstacleClearanceText: string;
  setObstacleClearanceText: (v: string) => void;
  shapeMode: RoofShapeMode;
  setShapeMode: (m: RoofShapeMode) => void;
  draftVertices: Point2D[];
  polygonClosed: boolean;
  polygonMeters: Point2D[] | null;
  edgeLengthTexts: string[];
  setEdgeLengthAt: (index: number, text: string) => void;
  calibrateEdgeIndex: number;
  setCalibrateEdgeIndex: (i: number) => void;
  addDraftVertex: (p: Point2D) => void;
  undoDraftVertex: () => void;
  clearDraftPolygon: () => void;
  closePolygon: () => void;
  obstacles: RoofObstacle[];
  addObstacle: (input: {
    kind: ObstacleKind;
    shape: ObstacleShape;
    widthM: number;
    heightM: number;
    radiusM?: number;
    x?: number;
    y?: number;
  }) => void;
  removeObstacle: (id: string) => void;
  clearObstacles: () => void;
  hasRoofGeometry: boolean;
  hasRoofDimensions: boolean;
  roofWidth: number;
  roofLength: number;
  totalRoofAreaM2: number;
  usefulAreaM2: number;
  layoutOptions: RoofLayoutOption[];
  selectedLayoutId: string | null;
  setSelectedLayoutId: (id: string) => void;
  activeLayout: RoofLayoutOption | null;
  bestLayout: RoofLayoutOption | null;
  onChangeWidth: (text: string) => void;
  onChangeLength: (text: string) => void;
  onChangeArea: (text: string) => void;
  refreshModules: () => Promise<void>;
};

const RoofWorkspaceContext = createContext<RoofWorkspaceValue | undefined>(undefined);

let obstacleSeq = 1;

export function RoofWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { allModules, refresh } = useModules();
  const [subTab, setSubTab] = useState<RoofSubTab>('calc');
  const [calcMode, setCalcMode] = useState<RoofCalcMode>('inverse');
  const [selectedId, setSelectedId] = useState<string | undefined>(allModules[0]?.id);
  const [quantityText, setQuantityText] = useState('12');
  const [roofWidthText, setRoofWidthText] = useState('');
  const [roofLengthText, setRoofLengthText] = useState('');
  const [roofAreaText, setRoofAreaText] = useState('40');
  const [areaManual, setAreaManual] = useState(false);
  const [marginText, setMarginText] = useState(String(DEFAULT_AREA_MARGIN * 100));
  const [edgeMarginText, setEdgeMarginText] = useState(String(DEFAULT_EDGE_MARGIN_M));
  const [endClampText, setEndClampText] = useState(String(DEFAULT_END_CLAMP_M));
  const [panelGapText, setPanelGapText] = useState(String(DEFAULT_PANEL_GAP_M));
  const [obstacleClearanceText, setObstacleClearanceText] = useState(
    String(DEFAULT_OBSTACLE_CLEARANCE_M),
  );
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);

  const [shapeMode, setShapeMode] = useState<RoofShapeMode>('rectangle');
  const [draftVertices, setDraftVertices] = useState<Point2D[]>([]);
  const [polygonClosed, setPolygonClosed] = useState(false);
  const [edgeLengthTexts, setEdgeLengthTexts] = useState<string[]>([]);
  const [calibrateEdgeIndex, setCalibrateEdgeIndex] = useState(0);
  const [obstacles, setObstacles] = useState<RoofObstacle[]>([]);

  useEffect(() => {
    if (!allModules.find((m) => m.id === selectedId) && allModules[0]) {
      setSelectedId(allModules[0].id);
    }
  }, [allModules, selectedId]);

  const selectedModule = useMemo(
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

  const polygonMeters = useMemo(() => {
    if (shapeMode !== 'polygon' || !polygonClosed || draftVertices.length < 3) return null;
    const edgeLen = parseLocaleNumber(edgeLengthTexts[calibrateEdgeIndex] ?? '');
    const fallback =
      Number.isFinite(edgeLen) && edgeLen > 0
        ? edgeLen
        : hasRoofDimensions
          ? roofWidth
          : 5;
    let scaled = scalePolygonToEdge(draftVertices, calibrateEdgeIndex, fallback);
    // Se outras arestas tiverem comprimento, reescala pela média dos fatores
    const factors: number[] = [];
    for (let i = 0; i < scaled.length; i += 1) {
      const entered = parseLocaleNumber(edgeLengthTexts[i] ?? '');
      if (!Number.isFinite(entered) || entered <= 0) continue;
      const a = draftVertices[i];
      const b = draftVertices[(i + 1) % draftVertices.length];
      const sketchLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (sketchLen > 0) factors.push(entered / sketchLen);
    }
    if (factors.length > 0) {
      const avg = factors.reduce((s, f) => s + f, 0) / factors.length;
      const cx = draftVertices.reduce((s, p) => s + p.x, 0) / draftVertices.length;
      const cy = draftVertices.reduce((s, p) => s + p.y, 0) / draftVertices.length;
      scaled = draftVertices.map((p) => ({
        x: cx + (p.x - cx) * avg,
        y: cy + (p.y - cy) * avg,
      }));
      // Reposiciona origem
      scaled = scalePolygonToEdge(scaled, calibrateEdgeIndex, fallback);
    }
    return normalizePolygonOrigin(scaled);
  }, [
    shapeMode,
    polygonClosed,
    draftVertices,
    edgeLengthTexts,
    calibrateEdgeIndex,
    hasRoofDimensions,
    roofWidth,
  ]);

  const hasRoofGeometry =
    shapeMode === 'rectangle'
      ? hasRoofDimensions
      : Boolean(polygonMeters && polygonMeters.length >= 3);

  useEffect(() => {
    if (calcMode !== 'inverse' || areaManual) return;
    if (shapeMode === 'rectangle' && hasRoofDimensions) {
      const autoArea = Math.round(roofWidth * roofLength * 100) / 100;
      setRoofAreaText(String(autoArea).replace('.', ','));
      return;
    }
    if (shapeMode === 'polygon' && polygonMeters) {
      const area = Math.round(polygonArea(polygonMeters) * 100) / 100;
      setRoofAreaText(String(area).replace('.', ','));
    }
  }, [
    calcMode,
    areaManual,
    shapeMode,
    hasRoofDimensions,
    roofWidth,
    roofLength,
    polygonMeters,
  ]);

  const liveLayouts = useMemo(() => {
    if (!selectedModule || !hasRoofGeometry) return null;
    const edge = parseLocaleNumber(edgeMarginText);
    const edgeMarginM =
      Number.isFinite(edge) && edge >= 0 ? edge : DEFAULT_EDGE_MARGIN_M;
    const gap = parseLocaleNumber(panelGapText);
    const panelGapM = Number.isFinite(gap) && gap >= 0 ? gap : DEFAULT_PANEL_GAP_M;
    const end = parseLocaleNumber(endClampText);
    const endClampM = Number.isFinite(end) && end >= 0 ? end : DEFAULT_END_CLAMP_M;

    if (shapeMode === 'polygon' && polygonMeters) {
      return computeRoofLayouts({
        polygon: polygonMeters,
        obstacles,
        module: selectedModule,
        edgeMarginM,
        panelGapM,
        endClampM,
      });
    }
    return computeRoofLayouts({
      roofWidthM: roofWidth,
      roofLengthM: roofLength,
      obstacles,
      module: selectedModule,
      edgeMarginM,
      panelGapM,
      endClampM,
    });
  }, [
    selectedModule,
    hasRoofGeometry,
    shapeMode,
    polygonMeters,
    obstacles,
    roofWidth,
    roofLength,
    edgeMarginText,
    panelGapText,
    endClampText,
  ]);

  const layoutOptions = liveLayouts?.options ?? [];
  const totalRoofAreaM2 = liveLayouts?.totalRoofAreaM2 ?? 0;
  const usefulAreaM2 = liveLayouts?.usefulAreaM2 ?? 0;

  useEffect(() => {
    if (!liveLayouts) {
      setSelectedLayoutId(null);
      return;
    }
    setSelectedLayoutId((current) => {
      if (current && liveLayouts.options.some((o) => o.id === current)) return current;
      return liveLayouts.bestOptionId;
    });
  }, [liveLayouts]);

  const activeLayout =
    layoutOptions.find((o) => o.id === selectedLayoutId) ?? layoutOptions[0] ?? null;
  const bestLayout = layoutOptions[0] ?? null;

  const onChangeWidth = useCallback((text: string) => {
    setRoofWidthText(text);
    setAreaManual(false);
  }, []);

  const onChangeLength = useCallback((text: string) => {
    setRoofLengthText(text);
    setAreaManual(false);
  }, []);

  const onChangeArea = useCallback((text: string) => {
    setRoofAreaText(text);
    setAreaManual(true);
  }, []);

  const addDraftVertex = useCallback(
    (p: Point2D) => {
      if (polygonClosed) return;
      setDraftVertices((prev) => [...prev, p]);
    },
    [polygonClosed],
  );

  const undoDraftVertex = useCallback(() => {
    setPolygonClosed(false);
    setDraftVertices((prev) => prev.slice(0, -1));
    setEdgeLengthTexts((prev) => prev.slice(0, -1));
  }, []);

  const clearDraftPolygon = useCallback(() => {
    setDraftVertices([]);
    setPolygonClosed(false);
    setEdgeLengthTexts([]);
    setCalibrateEdgeIndex(0);
  }, []);

  const closePolygon = useCallback(() => {
    setDraftVertices((prev) => {
      if (prev.length < 3) return prev;
      setPolygonClosed(true);
      setEdgeLengthTexts(Array.from({ length: prev.length }, () => ''));
      return prev;
    });
  }, []);

  const setEdgeLengthAt = useCallback((index: number, text: string) => {
    setEdgeLengthTexts((prev) => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  }, []);

  const addObstacle = useCallback(
    (input: {
      kind: ObstacleKind;
      shape: ObstacleShape;
      widthM: number;
      heightM: number;
      radiusM?: number;
      x?: number;
      y?: number;
    }) => {
      const clearance = parseLocaleNumber(obstacleClearanceText);
      const clearanceM =
        Number.isFinite(clearance) && clearance >= 0
          ? clearance
          : DEFAULT_OBSTACLE_CLEARANCE_M;
      const box = polygonMeters
        ? boundingBox(polygonMeters)
        : hasRoofDimensions
          ? { minX: 0, minY: 0, width: roofWidth, height: roofLength }
          : { minX: 0, minY: 0, width: 8, height: 10 };
      const id = `obs-${obstacleSeq++}`;
      const cx = input.x ?? box.width / 2 - input.widthM / 2;
      const cy = input.y ?? box.height / 2 - input.heightM / 2;
      setObstacles((prev) => [
        ...prev,
        {
          id,
          kind: input.kind,
          label: OBSTACLE_KIND_LABELS[input.kind] ?? 'Obstáculo',
          shape: input.shape,
          x: input.shape === 'circle' ? cx + input.widthM / 2 : Math.max(0, cx),
          y: input.shape === 'circle' ? cy + input.heightM / 2 : Math.max(0, cy),
          widthM: input.widthM,
          heightM: input.heightM,
          radiusM: input.radiusM ?? Math.min(input.widthM, input.heightM) / 2,
          clearanceM,
        },
      ]);
    },
    [obstacleClearanceText, polygonMeters, hasRoofDimensions, roofWidth, roofLength],
  );

  const removeObstacle = useCallback((id: string) => {
    setObstacles((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const clearObstacles = useCallback(() => setObstacles([]), []);

  const value = useMemo<RoofWorkspaceValue>(
    () => ({
      subTab,
      setSubTab,
      calcMode,
      setCalcMode,
      selectedModule,
      selectedId,
      setSelectedId,
      allModules,
      quantityText,
      setQuantityText,
      roofWidthText,
      setRoofWidthText,
      roofLengthText,
      setRoofLengthText,
      roofAreaText,
      setRoofAreaText,
      areaManual,
      setAreaManual,
      marginText,
      setMarginText,
      edgeMarginText,
      setEdgeMarginText,
      endClampText,
      setEndClampText,
      panelGapText,
      setPanelGapText,
      obstacleClearanceText,
      setObstacleClearanceText,
      shapeMode,
      setShapeMode,
      draftVertices,
      polygonClosed,
      polygonMeters,
      edgeLengthTexts,
      setEdgeLengthAt,
      calibrateEdgeIndex,
      setCalibrateEdgeIndex,
      addDraftVertex,
      undoDraftVertex,
      clearDraftPolygon,
      closePolygon,
      obstacles,
      addObstacle,
      removeObstacle,
      clearObstacles,
      hasRoofGeometry,
      hasRoofDimensions,
      roofWidth,
      roofLength,
      totalRoofAreaM2,
      usefulAreaM2,
      layoutOptions,
      selectedLayoutId,
      setSelectedLayoutId,
      activeLayout,
      bestLayout,
      onChangeWidth,
      onChangeLength,
      onChangeArea,
      refreshModules: refresh,
    }),
    [
      subTab,
      calcMode,
      selectedModule,
      selectedId,
      allModules,
      quantityText,
      roofWidthText,
      roofLengthText,
      roofAreaText,
      areaManual,
      marginText,
      edgeMarginText,
      endClampText,
      panelGapText,
      obstacleClearanceText,
      shapeMode,
      draftVertices,
      polygonClosed,
      polygonMeters,
      edgeLengthTexts,
      setEdgeLengthAt,
      calibrateEdgeIndex,
      addDraftVertex,
      undoDraftVertex,
      clearDraftPolygon,
      closePolygon,
      obstacles,
      addObstacle,
      removeObstacle,
      clearObstacles,
      hasRoofGeometry,
      hasRoofDimensions,
      roofWidth,
      roofLength,
      totalRoofAreaM2,
      usefulAreaM2,
      layoutOptions,
      selectedLayoutId,
      activeLayout,
      bestLayout,
      onChangeWidth,
      onChangeLength,
      onChangeArea,
      refresh,
    ],
  );

  return (
    <RoofWorkspaceContext.Provider value={value}>{children}</RoofWorkspaceContext.Provider>
  );
}

export function useRoofWorkspace() {
  const ctx = useContext(RoofWorkspaceContext);
  if (!ctx) {
    throw new Error('useRoofWorkspace must be used within RoofWorkspaceProvider');
  }
  return ctx;
}

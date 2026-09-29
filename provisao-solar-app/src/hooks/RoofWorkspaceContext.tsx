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
} from '../constants/modules';
import { useModules } from '../hooks/useModules';
import { RoofLayoutOption, SolarModule } from '../types';
import { parseLocaleNumber } from '../utils/calculations';
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
  hasRoofDimensions: boolean;
  roofWidth: number;
  roofLength: number;
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
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);

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

  useEffect(() => {
    if (calcMode !== 'inverse' || areaManual || !hasRoofDimensions) return;
    const autoArea = Math.round(roofWidth * roofLength * 100) / 100;
    setRoofAreaText(String(autoArea).replace('.', ','));
  }, [calcMode, areaManual, hasRoofDimensions, roofWidth, roofLength]);

  const liveLayouts = useMemo(() => {
    if (!selectedModule || !hasRoofDimensions) return null;
    const edge = parseLocaleNumber(edgeMarginText);
    const edgeMarginM =
      Number.isFinite(edge) && edge >= 0 ? edge : DEFAULT_EDGE_MARGIN_M;
    return computeRoofLayouts({
      roofWidthM: roofWidth,
      roofLengthM: roofLength,
      module: selectedModule,
      edgeMarginM,
    });
  }, [selectedModule, hasRoofDimensions, roofWidth, roofLength, edgeMarginText]);

  const layoutOptions = liveLayouts?.options ?? [];

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
      hasRoofDimensions,
      roofWidth,
      roofLength,
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
      hasRoofDimensions,
      roofWidth,
      roofLength,
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

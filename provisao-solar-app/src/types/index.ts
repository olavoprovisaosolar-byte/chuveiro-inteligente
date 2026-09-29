export type ThemeMode = 'light' | 'dark' | 'system';

export type AiProvider = 'openai' | 'gemini';

export interface SolarModule {
  id: string;
  manufacturer: string;
  model: string;
  powerWp: number;
  widthM: number;
  lengthM: number;
  areaM2: number;
  isCustom: boolean;
}

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

export interface ConsumptionMonthlyResult {
  monthlyKwh: number;
  dailyKwh: number;
  powerKwp: number;
  inverterMinKw: number;
  inverterMaxKw: number;
}

export interface ConsumptionDailyResult {
  dailyKwh: number;
  monthlyKwh: number;
  powerKwp: number;
  inverterMinKw: number;
  inverterMaxKw: number;
}

export interface RoofDirectResult {
  quantity: number;
  module: SolarModule;
  grossAreaM2: number;
  safetyMargin: number;
  recommendedAreaM2: number;
  totalPowerKwp: number;
}

export interface RoofInverseResult {
  roofAreaM2: number;
  module: SolarModule;
  discountMargin: number;
  usefulAreaM2: number;
  maxModules: number;
  maxPowerKwp: number;
  estimatedMonthlyGenerationKwh: number;
}

/** Orientação física da placa no telhado. */
export type PanelOrientation = 'portrait' | 'landscape';

/**
 * Posição de uma placa no plano do telhado (metros, origem = canto útil).
 * Preparado para interação futura (drag / rotate).
 */
export interface PanelPlacement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: PanelOrientation;
  /** Ângulo em graus (0 ou 90). Base para rotação horária/anti-horária futura. */
  rotationDeg: number;
  selectable?: boolean;
}

export type RoofLayoutStrategy = 'uniform_portrait' | 'uniform_landscape' | 'mixed' | 'max';

export interface RoofLayoutOption {
  id: string;
  label: string;
  strategy: RoofLayoutStrategy;
  panelCount: number;
  orientationSummary: string;
  usableWidthM: number;
  usableLengthM: number;
  edgeMarginM: number;
  panelGapM: number;
  roofWidthM: number;
  roofLengthM: number;
  placements: PanelPlacement[];
  totalPowerKwp: number;
  estimatedMonthlyGenerationKwh: number;
}

export interface RoofLayoutComputation {
  options: RoofLayoutOption[];
  bestOptionId: string;
}

export interface AiReviewResult {
  coherent: boolean;
  summary: string;
  observations: string[];
  suggestions: string[];
  rawText: string;
}

export type AiReviewPayload =
  | { kind: 'monthly'; result: ConsumptionMonthlyResult }
  | { kind: 'daily'; result: ConsumptionDailyResult }
  | { kind: 'roof_direct'; result: RoofDirectResult }
  | { kind: 'roof_inverse'; result: RoofInverseResult };

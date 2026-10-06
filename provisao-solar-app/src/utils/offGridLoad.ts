/**
 * Levantamento de carga (alicate) e dimensionamento off-grid / retrofit.
 * Potências em W, tensões em V, correntes em A, energia em Wh.
 */

export type PhaseSystem = 'biphasic' | 'triphasic';
export type BatteryTech = 'lithium' | 'lead';
export type BusVoltageV = 24 | 48;
export type TransformerStatus = 'required' | 'native_biphasic' | 'no_127_load';

/** Portes comerciais de inversor off-grid (kW), do menor para o maior. */
export const COMMERCIAL_INVERTER_KW = [3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50] as const;

/** Portes comerciais de autotransformador (kVA). */
export const COMMERCIAL_TRAFO_KVA = [1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 30, 45, 75] as const;

/** Folga de 30% no trafo: P_trafo = P_127 / 0,70. */
export const TRAFO_LOAD_FACTOR = 0.7;

/** Módulo de lítio citado no levantamento: 48 V × 100 Ah ≈ 5,12 kWh. */
export const LITHIUM_MODULE_V = 48;
export const LITHIUM_MODULE_AH = 100;
export const LITHIUM_MODULE_KWH = 5.12;

/** Bateria de chumbo-ácido / gel usada na sugestão de arranjo. */
export const LEAD_BATTERY_V = 12;
export const LEAD_BATTERY_AH = 220;

export type OffGridLoadInput = {
  system: PhaseSystem;
  voltageFn: number;
  voltageFf: number;
  currentA: number;
  currentB: number;
  currentC: number;
  currentNeutral: number;
  /** 0,60 a 0,90. */
  utilizationFactor: number;
  supportsMono220: boolean;
  supportsNativeBiphasic: boolean;
  busVoltageV: BusVoltageV;
  autonomyHours: number;
  useDod: boolean;
  /** Fração 0–1. Ignorado quando useDod é falso. */
  dod: number;
  batteryTech: BatteryTech;
  /** Fração 0–1 (ex.: 0,92). */
  inverterEfficiency: number;
};

export type OffGridLoadResult = {
  power127W: number;
  powerTotalW: number;
  power220W: number;
  share127: number;
  share220: number;
  currentInverterA: number;
  inverterMinW: number;
  inverterSuggestedKw: number;
  utilizationFactor: number;
  surgeMarginTight: boolean;
  transformerStatus: TransformerStatus;
  transformerW: number;
  transformerSuggestedKva: number;
  energyWh: number;
  batteryGrossWh: number;
  capacityAh: number;
  /** null quando o DoD foi ignorado. */
  dodApplied: number | null;
  lithiumModules: number;
  leadSeries: number;
  leadParallel: number;
  leadTotal: number;
  neutralInconsistent: boolean;
};

export function nextCommercialSize(value: number, steps: readonly number[]): number {
  if (!Number.isFinite(value) || value <= 1e-9) return 0;
  for (const step of steps) {
    if (value <= step + 1e-9) return step;
  }
  const last = steps[steps.length - 1];
  const increment = last >= 10 ? 5 : 1;
  return Math.ceil((value - 1e-9) / increment) * increment;
}

function ceilCount(total: number, unit: number): number {
  if (!Number.isFinite(total) || total <= 1e-9 || unit <= 0) return 0;
  return Math.ceil(total / unit - 1e-9);
}

export function validateOffGridInput(input: OffGridLoadInput): string | null {
  if (!(input.voltageFn > 0)) return 'Informe a tensão fase-neutro (V).';
  if (!(input.voltageFf > 0)) return 'Informe a tensão fase-fase (V).';
  const currents = [input.currentA, input.currentB, input.currentNeutral];
  if (input.system === 'triphasic') currents.push(input.currentC);
  if (currents.some((c) => !Number.isFinite(c) || c < 0)) {
    return 'As correntes medidas não podem ser negativas.';
  }
  const phaseSum =
    input.currentA + input.currentB + (input.system === 'triphasic' ? input.currentC : 0);
  if (phaseSum <= 0) return 'Informe ao menos uma corrente de fase maior que zero.';
  if (input.utilizationFactor < 0.6 - 1e-9 || input.utilizationFactor > 0.9 + 1e-9) {
    return 'O fator de ocupação deve ficar entre 60% e 90%.';
  }
  if (!(input.autonomyHours > 0)) return 'Informe a autonomia desejada.';
  if (!(input.inverterEfficiency > 0) || input.inverterEfficiency > 1) {
    return 'A eficiência do inversor deve estar entre 1% e 100%.';
  }
  if (input.useDod && (!(input.dod > 0) || input.dod > 1)) {
    return 'O DoD deve estar entre 1% e 100%.';
  }
  if (input.busVoltageV !== 24 && input.busVoltageV !== 48) {
    return 'O barramento CC deve ser 24 V ou 48 V.';
  }
  return null;
}

/**
 * Separa carga 127 V (pelo neutro) e 220 V, dimensiona inversor, trafo e banco.
 * P_127 = I_neutro × V_FN
 * P_total = (Σ I_fases) × V_FN
 * P_220 = P_total − P_127
 * I_220 = P_total / V_FF
 * P_inv = P_total / FU
 * E_Wh = P_total × horas / η_inv
 */
export function calculateOffGridLoad(input: OffGridLoadInput): OffGridLoadResult {
  const currentC = input.system === 'triphasic' ? Math.max(0, input.currentC) : 0;
  const currentA = Math.max(0, input.currentA);
  const currentB = Math.max(0, input.currentB);
  const currentNeutral = Math.max(0, input.currentNeutral);
  const phaseSum = currentA + currentB + currentC;

  const power127W = currentNeutral * input.voltageFn;
  const powerTotalW = phaseSum * input.voltageFn;
  const raw220 = powerTotalW - power127W;
  const neutralInconsistent = raw220 < -1e-6;
  const power220W = Math.max(0, raw220);
  const chart127 = Math.min(Math.max(0, power127W), powerTotalW);
  const share127 = powerTotalW > 0 ? chart127 / powerTotalW : 0;
  const share220 = powerTotalW > 0 ? 1 - share127 : 0;

  const currentInverterA = input.voltageFf > 0 ? powerTotalW / input.voltageFf : 0;
  const inverterMinW =
    input.utilizationFactor > 0 ? powerTotalW / input.utilizationFactor : 0;
  const inverterSuggestedKw = nextCommercialSize(inverterMinW / 1000, COMMERCIAL_INVERTER_KW);

  const transformerW = power127W / TRAFO_LOAD_FACTOR;
  let transformerStatus: TransformerStatus = 'required';
  if (power127W <= 1e-6) transformerStatus = 'no_127_load';
  else if (input.supportsNativeBiphasic) transformerStatus = 'native_biphasic';
  const transformerSuggestedKva =
    transformerStatus === 'required'
      ? nextCommercialSize(transformerW / 1000, COMMERCIAL_TRAFO_KVA)
      : 0;

  const energyWh =
    input.inverterEfficiency > 0
      ? (powerTotalW * input.autonomyHours) / input.inverterEfficiency
      : 0;
  const dodApplied = input.useDod ? input.dod : null;
  const batteryGrossWh = dodApplied && dodApplied > 0 ? energyWh / dodApplied : energyWh;
  const capacityAh = input.busVoltageV > 0 ? batteryGrossWh / input.busVoltageV : 0;

  const lithiumModules = ceilCount(batteryGrossWh / 1000, LITHIUM_MODULE_KWH);
  const leadSeries = Math.max(1, Math.round(input.busVoltageV / LEAD_BATTERY_V));
  const leadParallel = ceilCount(capacityAh, LEAD_BATTERY_AH);
  const leadTotal = leadSeries * leadParallel;

  return {
    power127W,
    powerTotalW,
    power220W,
    share127,
    share220,
    currentInverterA,
    inverterMinW,
    inverterSuggestedKw,
    utilizationFactor: input.utilizationFactor,
    surgeMarginTight: input.utilizationFactor >= 0.85 - 1e-9,
    transformerStatus,
    transformerW,
    transformerSuggestedKva,
    energyWh,
    batteryGrossWh,
    capacityAh,
    dodApplied,
    lithiumModules,
    leadSeries,
    leadParallel,
    leadTotal,
    neutralInconsistent,
  };
}

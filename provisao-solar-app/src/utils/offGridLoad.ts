/**
 * Levantamento de carga (alicate) e dimensionamento off-grid / retrofit.
 * Potências em W, tensões em V, correntes em A, energia em Wh.
 */

export type PhaseSystem = 'biphasic' | 'triphasic';
export type BatteryTech = 'lithium' | 'stationary';
export type BatteryModelId = 'li-48-100' | 'li-24-100' | 'st-12-240' | 'st-12-150';
export type BusVoltageV = 24 | 48;
export type TransformerStatus = 'required' | 'native_biphasic' | 'no_127_load';

/** Portes comerciais de inversor off-grid (kW), do menor para o maior. */
export const COMMERCIAL_INVERTER_KW = [3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50] as const;

/** Portes comerciais de autotransformador (kVA). */
export const COMMERCIAL_TRAFO_KVA = [1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 30, 45, 75] as const;

/** Folga de 30% no trafo: P_trafo = P_127 / 0,70. */
export const TRAFO_LOAD_FACTOR = 0.7;

export type BatteryModel = {
  id: BatteryModelId;
  tech: BatteryTech;
  voltageV: number;
  capacityAh: number;
  energyWh: number;
  /** Nome comercial completo. */
  name: string;
  /** Rótulo curto do seletor. */
  shortLabel: string;
  cycles: number;
};

/** Catálogo de estoque: lítio 48 V/24 V e estacionárias 12 V. */
export const BATTERY_MODELS: readonly BatteryModel[] = [
  {
    id: 'li-48-100',
    tech: 'lithium',
    voltageV: 48,
    capacityAh: 100,
    energyWh: 4800,
    name: 'Módulo Lítio 48V 100Ah',
    shortLabel: '48V 100Ah',
    cycles: 6000,
  },
  {
    id: 'li-24-100',
    tech: 'lithium',
    voltageV: 24,
    capacityAh: 100,
    energyWh: 2400,
    name: 'Módulo Lítio 24V 100Ah',
    shortLabel: '24V 100Ah',
    cycles: 6000,
  },
  {
    id: 'st-12-240',
    tech: 'stationary',
    voltageV: 12,
    capacityAh: 240,
    energyWh: 2880,
    name: 'Bateria Estacionária 12V 240Ah',
    shortLabel: '12V 240Ah',
    cycles: 600,
  },
  {
    id: 'st-12-150',
    tech: 'stationary',
    voltageV: 12,
    capacityAh: 150,
    energyWh: 1800,
    name: 'Bateria Estacionária 12V 150Ah',
    shortLabel: '12V 150Ah',
    cycles: 600,
  },
];

/** Faixa de DoD permitida e o valor sugerido de cada tecnologia. */
export const DOD_RANGE: Record<BatteryTech, { min: number; max: number; default: number }> = {
  lithium: { min: 0.7, max: 0.9, default: 0.8 },
  stationary: { min: 0.3, max: 0.6, default: 0.5 },
};

export function batteryModelById(id: BatteryModelId): BatteryModel {
  const model = BATTERY_MODELS.find((item) => item.id === id);
  if (!model) {
    throw new Error(`Modelo de bateria desconhecido: ${id}`);
  }
  return model;
}

export function modelsForTech(tech: BatteryTech): BatteryModel[] {
  return BATTERY_MODELS.filter((item) => item.tech === tech);
}

export type BatteryArrangement = {
  model: BatteryModel;
  compatible: boolean;
  series: number;
  parallel: number;
  total: number;
  /** Energia de um ramo em série (Wh). */
  branchWh: number;
  /** Energia bruta pedida antes de arredondar os ramos. */
  requiredGrossWh: number;
  /** Energia bruta do banco já arredondado. */
  installedGrossWh: number;
  /** Energia útil que o banco instalado entrega com o DoD deste arranjo. */
  installedUsefulWh: number;
  dodApplied: number | null;
  headline: string;
  wiring: string;
};

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
  batteryModelId: BatteryModelId;
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
  bank: BatteryArrangement;
  comparison: {
    lithium: BatteryArrangement;
    stationary: BatteryArrangement;
  };
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

function unitWord(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Fecha série/paralelo de um modelo no barramento.
 * N_série = V_barramento / V_módulo (inteiro).
 * C_ramo = energia do módulo × N_série.
 * N_paralelo = ceil(E_bruta / C_ramo).
 */
export function arrangeBatteryBank(params: {
  model: BatteryModel;
  busVoltageV: BusVoltageV;
  requiredGrossWh: number;
  dodApplied: number | null;
}): BatteryArrangement {
  const { model, busVoltageV, requiredGrossWh, dodApplied } = params;
  const seriesExact = busVoltageV / model.voltageV;
  const compatible = seriesExact >= 1 && Math.abs(seriesExact - Math.round(seriesExact)) < 1e-9;
  const series = compatible ? Math.round(seriesExact) : 0;
  const branchWh = compatible ? model.energyWh * series : 0;
  const parallel = compatible ? ceilCount(requiredGrossWh, branchWh) : 0;
  const total = series * parallel;
  const installedGrossWh = parallel * branchWh;
  const installedUsefulWh =
    dodApplied && dodApplied > 0 ? installedGrossWh * dodApplied : installedGrossWh;
  const feminine = model.tech === 'stationary';
  const piece = feminine
    ? unitWord(total, 'Bateria Estacionária', 'Baterias Estacionárias')
    : unitWord(total, 'Módulo de Lítio', 'Módulos de Lítio');
  const volts = `${model.voltageV}V ${model.capacityAh}Ah`;
  const branchNote =
    series > 1 && parallel > 1
      ? ` (${parallel} ${unitWord(parallel, 'ramo', 'ramos')} de ${series} em série)`
      : '';
  const noun = feminine ? 'baterias' : 'módulos';
  const oneNoun = feminine ? 'bateria' : 'módulo';
  const linked = (count: number) =>
    feminine ? (count === 1 ? 'ligada' : 'ligadas') : count === 1 ? 'ligado' : 'ligados';

  let wiring = `O ${oneNoun} de ${model.voltageV} V não fecha no barramento de ${busVoltageV} V.`;
  if (compatible && series === 1) {
    wiring = `${total} ${unitWord(total, oneNoun, noun)} de ${volts} ${linked(total)} em PARALELO`;
  } else if (compatible && parallel <= 1) {
    wiring = `${series} ${unitWord(series, oneNoun, noun)} de ${volts} ${linked(series)} em SÉRIE`;
  } else if (compatible) {
    wiring = `${series} ${noun} em SÉRIE por ramo, com ${parallel} ramos em PARALELO`;
  }

  return {
    model,
    compatible,
    series,
    parallel,
    total,
    branchWh,
    requiredGrossWh,
    installedGrossWh,
    installedUsefulWh,
    dodApplied,
    headline: compatible ? `${total}x ${piece} ${volts}${branchNote}` : 'Arranjo incompatível com o barramento',
    wiring,
  };
}

function lithiumModelForBus(busVoltageV: BusVoltageV): BatteryModel {
  return batteryModelById(busVoltageV === 48 ? 'li-48-100' : 'li-24-100');
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
  if (input.useDod) {
    const range = DOD_RANGE[batteryModelById(input.batteryModelId).tech];
    const minPct = Math.round(range.min * 100);
    const maxPct = Math.round(range.max * 100);
    if (!(input.dod >= range.min - 1e-9) || input.dod > range.max + 1e-9) {
      const techLabel = range === DOD_RANGE.lithium ? 'lítio' : 'estacionária';
      return `O DoD de ${techLabel} deve ficar entre ${minPct}% e ${maxPct}%.`;
    }
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
  const selectedModel = batteryModelById(input.batteryModelId);
  const dodApplied = input.useDod ? input.dod : null;
  const batteryGrossWh = dodApplied && dodApplied > 0 ? energyWh / dodApplied : energyWh;
  const capacityAh = input.busVoltageV > 0 ? batteryGrossWh / input.busVoltageV : 0;

  const arrangeWith = (model: BatteryModel, grossWh: number, dod: number | null) =>
    arrangeBatteryBank({
      model,
      busVoltageV: input.busVoltageV,
      requiredGrossWh: grossWh,
      dodApplied: dod,
    });

  const bank = arrangeWith(selectedModel, batteryGrossWh, dodApplied);
  const lithiumModel =
    selectedModel.tech === 'lithium' ? selectedModel : lithiumModelForBus(input.busVoltageV);
  const stationaryModel =
    selectedModel.tech === 'stationary' ? selectedModel : batteryModelById('st-12-240');
  const grossFor = (model: BatteryModel, dod: number | null) =>
    model.id === selectedModel.id ? batteryGrossWh : dod && dod > 0 ? energyWh / dod : energyWh;
  const dodFor = (model: BatteryModel) =>
    model.id === selectedModel.id ? dodApplied : DOD_RANGE[model.tech].default;

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
    bank,
    comparison: {
      lithium: arrangeWith(lithiumModel, grossFor(lithiumModel, dodFor(lithiumModel)), dodFor(lithiumModel)),
      stationary: arrangeWith(
        stationaryModel,
        grossFor(stationaryModel, dodFor(stationaryModel)),
        dodFor(stationaryModel),
      ),
    },
    neutralInconsistent,
  };
}

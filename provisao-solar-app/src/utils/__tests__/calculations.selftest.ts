/**
 * Auto-verificação das fórmulas de negócio (sem framework de testes).
 * Execute: npx tsx src/utils/__tests__/calculations.selftest.ts
 */
import {
  calculateFromDaily,
  calculateFromMonthly,
  calculateModulesForPower,
  calculateRoofDirect,
  calculateRoofInverse,
  computeModuleArea,
  suggestInverterRange,
} from '../calculations';
import { computeRoofLayouts } from '../roofLayout';
import { PRESET_MODULES } from '../../constants/modules';
import { buildOffGridReportHtml } from '../offGridReport';
import {
  calculateOffGridLoad,
  nextCommercialSize,
  validateOffGridInput,
  type OffGridLoadInput,
} from '../offGridLoad';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function almostEqual(a: number, b: number, eps = 0.011) {
  return Math.abs(a - b) <= eps;
}

const monthly = calculateFromMonthly(450);
assert(almostEqual(monthly.dailyKwh, 15), 'Média diária mensal/30');
assert(almostEqual(monthly.powerKwp, 4.5), 'Potência mensal/100');

const daily = calculateFromDaily(15);
assert(almostEqual(daily.monthlyKwh, 450), 'Mensal = diário*30');
assert(almostEqual(daily.powerKwp, 4.5), 'Potência diário/3.33');

const inverter = suggestInverterRange(4.5);
assert(almostEqual(inverter.inverterMinKw, 4.5 / 1.3), 'Inversor min FDI 1.30');
assert(almostEqual(inverter.inverterMaxKw, 4.5 / 1.15), 'Inversor max FDI 1.15');

const module550 = PRESET_MODULES.find((m) => m.powerWp === 550)!;
const direct = calculateRoofDirect(10, module550, 0.1);
assert(almostEqual(direct.grossAreaM2, 25.6), 'Área bruta');
assert(almostEqual(direct.recommendedAreaM2, 28.16), 'Área recomendada +10%');
assert(almostEqual(direct.totalPowerKwp, 5.5), 'Potência total');

const inverse = calculateRoofInverse(40, module550, 0.1);
assert(almostEqual(inverse.usefulAreaM2, 36), 'Área útil');
assert(inverse.maxModules === 14, `Qtd máx esperada 14, veio ${inverse.maxModules}`);
assert(almostEqual(inverse.maxPowerKwp, 7.7), 'Potência máxima');
assert(almostEqual(inverse.estimatedMonthlyGenerationKwh, 770), 'Geração mensal');

assert(
  almostEqual(computeModuleArea(2.27, 1.13), 2.57) ||
    almostEqual(computeModuleArea(2.27, 1.13), 2.56),
  'Área unitária',
);

const sizing = calculateModulesForPower(4.5, module550);
assert(sizing.quantity === 9, `Qtd placas esperada 9, veio ${sizing.quantity}`);
assert(almostEqual(sizing.installedPowerKwp, 4.95), 'Potência instalada 9x550');
assert(almostEqual(sizing.grossAreaM2, 23.04), 'Área bruta 9x2.56');
assert(almostEqual(sizing.requiredInstallAreaM2, 25.34), 'Área necessária +10%');
assert(almostEqual(sizing.inverterMinKw, 4.95 / 1.3), 'Inversor min pela potência instalada');

const layouts = computeRoofLayouts({
  roofWidthM: 8,
  roofLengthM: 12,
  module: module550,
  edgeMarginM: 0.5,
  panelGapM: 0.02,
  endClampM: 0.03,
});
assert(layouts.options.length === 2, 'Duas opções de layout');
assert(layouts.options[0].panelCount > 0, 'Opção A deve caber placas');
assert(
  layouts.options[0].panelCount >= layouts.options[1].panelCount,
  'Opção A (máximo) >= Opção B (padronizado)',
);
assert(
  layouts.options[0].placements.length === layouts.options[0].panelCount,
  'Placements sync',
);
assert(
  layouts.options[0].orientationSummary.includes('Vertical') ||
    layouts.options[0].orientationSummary.includes('Horizontal'),
  'Resumo de orientação Vertical/Horizontal',
);
assert(layouts.totalRoofAreaM2 > 0, 'Área total do telhado');

// Polígono L-shape + obstáculo: deve caber menos que o retângulo pleno
const polyLayouts = computeRoofLayouts({
  polygon: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 6 },
    { x: 4, y: 6 },
    { x: 4, y: 10 },
    { x: 0, y: 10 },
  ],
  obstacles: [
    {
      id: 'chimney-1',
      kind: 'chimney',
      label: 'Chaminé',
      shape: 'rect',
      x: 1,
      y: 1,
      widthM: 1.2,
      heightM: 1.2,
      clearanceM: 0.4,
    },
  ],
  module: module550,
  edgeMarginM: 0.3,
  panelGapM: 0.02,
  endClampM: 0.03,
});
assert(polyLayouts.options[0].panelCount > 0, 'Polígono irregular deve caber placas');
assert(
  polyLayouts.options[0].placements.every(
    (p) =>
      !(p.x < 2.6 && p.y < 2.6 && p.x + p.width > 0.6 && p.y + p.height > 0.6),
  ),
  'Nenhuma placa sobre obstáculo+clearance',
);

// Obstáculo rotacionado deve continuar bloqueando a área (AABB expandido)
const rotated = computeRoofLayouts({
  roofWidthM: 8,
  roofLengthM: 8,
  module: module550,
  edgeMarginM: 0.3,
  obstacles: [
    {
      id: 'rot-1',
      kind: 'custom',
      label: 'Bloco',
      shape: 'rect',
      x: 3,
      y: 3,
      widthM: 2,
      heightM: 1,
      clearanceM: 0.3,
      rotationDeg: 45,
    },
  ],
});
const plain = computeRoofLayouts({
  roofWidthM: 8,
  roofLengthM: 8,
  module: module550,
  edgeMarginM: 0.3,
  obstacles: [],
});
assert(
  rotated.options[0].panelCount < plain.options[0].panelCount,
  'Obstáculo rotacionado reduz placas vs telhado livre',
);

// 5×8 m / folga 0,1 m: 12 verticais deixam ~0,95 m; deve emprestar borda
// (borda zero) e encaixar +2 horizontais na faixa inferior → 14 placas.
const fillStrip = computeRoofLayouts({
  roofWidthM: 5,
  roofLengthM: 8,
  module: module550,
  edgeMarginM: 0.1,
  panelGapM: 0.02,
  endClampM: 0.03,
});
assert(
  fillStrip.options[0].panelCount >= 14,
  `5×8 deve caber ≥14 com misto/borda zero, veio ${fillStrip.options[0].panelCount}`,
);
assert(
  fillStrip.options[0].placements.some((p) => p.orientation === 'landscape'),
  'Faixa residual deve usar placas na Horizontal',
);
assert(
  fillStrip.options[0].placements.some((p) => p.orientation === 'portrait'),
  'Arranjo misto mantém placas na Vertical',
);
const stripMaxY = Math.max(
  ...fillStrip.options[0].placements.map((p) => p.y + p.height),
);
assert(
  stripMaxY >= 7.99,
  `Placas devem chegar à borda inferior (y≈8), veio ${stripMaxY}`,
);

console.log('✅ Self-test de cálculos OK');
console.log(
  `   Layout 8×12 m / 550 Wp: máx ${layouts.options[0].panelCount} placas (${layouts.options[0].orientationSummary})`,
);
console.log(
  `   Polígono L + chaminé: máx ${polyLayouts.options[0].panelCount} placas · área ${polyLayouts.totalRoofAreaM2} m²`,
);
console.log(
  `   Layout 5×8 m / folga 0,1: máx ${fillStrip.options[0].panelCount} placas (${fillStrip.options[0].orientationSummary}) · base y=${stripMaxY}`,
);

const offGridBase: OffGridLoadInput = {
  system: 'biphasic',
  voltageFn: 127,
  voltageFf: 220,
  currentA: 20,
  currentB: 15,
  currentC: 40,
  currentNeutral: 8,
  utilizationFactor: 0.8,
  supportsMono220: true,
  supportsNativeBiphasic: false,
  busVoltageV: 48,
  autonomyHours: 12,
  useDod: true,
  dod: 0.8,
  batteryModelId: 'li-48-100',
  inverterEfficiency: 0.92,
};
assert(validateOffGridInput(offGridBase) === null, 'Entrada off-grid de referência é válida');
const offGrid = calculateOffGridLoad(offGridBase);
assert(almostEqual(offGrid.power127W, 8 * 127), 'P127 = Ineutro × Vfn');
assert(almostEqual(offGrid.powerTotalW, (20 + 15) * 127), 'Ptotal bifásico ignora fase C');
assert(almostEqual(offGrid.power220W, offGrid.powerTotalW - offGrid.power127W), 'P220 = Ptotal − P127');
assert(almostEqual(offGrid.currentInverterA, offGrid.powerTotalW / 220), 'I220 = Ptotal / Vff');
assert(almostEqual(offGrid.inverterMinW, offGrid.powerTotalW / 0.8), 'Pinv = Ptotal / FU');
assert(offGrid.inverterSuggestedKw === 8, `Inversor comercial esperado 8 kW, veio ${offGrid.inverterSuggestedKw}`);
assert(almostEqual(offGrid.transformerW, offGrid.power127W / 0.7), 'Trafo com 30% de folga');
assert(offGrid.transformerSuggestedKva === 1.5, `Trafo comercial esperado 1,5 kVA, veio ${offGrid.transformerSuggestedKva}`);
const energyWh = (offGrid.powerTotalW * 12) / 0.92;
assert(almostEqual(offGrid.energyWh, energyWh, 0.02), 'Energia Wh com eficiência');
assert(almostEqual(offGrid.batteryGrossWh, energyWh / 0.8, 0.05), 'Banco corrige DoD');
assert(almostEqual(offGrid.capacityAh, energyWh / 0.8 / 48, 0.05), 'Ah no barramento 48 V');
assert(offGrid.bank.model.energyWh === 4800, 'Módulo lítio 48 V 100 Ah = 4,8 kWh');
assert(offGrid.bank.series === 1, 'Lítio 48 V no barramento 48 V fica em paralelo');
assert(offGrid.bank.parallel === 16, `Módulos lítio esperados 16, veio ${offGrid.bank.parallel}`);
assert(offGrid.bank.total === 16, 'Total de módulos = ramos em paralelo');
assert(offGrid.bank.branchWh === 4800, 'Ramo de um módulo 48 V = 4800 Wh');
assert(
  almostEqual(offGrid.bank.installedGrossWh, 16 * 4800, 0.1),
  'Capacidade bruta instalada',
);
assert(
  almostEqual(offGrid.bank.installedUsefulWh, 16 * 4800 * 0.8, 0.1),
  'Capacidade útil entregue com DoD 80%',
);
assert(offGrid.dodApplied === 0.8, 'DoD aplicado 80%');
assert(offGrid.bank.headline.startsWith('16x Módulos de Lítio 48V 100Ah'), offGrid.bank.headline);

const noDod = calculateOffGridLoad({ ...offGridBase, useDod: false });
assert(almostEqual(noDod.batteryGrossWh, energyWh, 0.02), 'Sem DoD a capacidade bruta é a energia útil');
assert(noDod.dodApplied === null, 'DoD ignorado');

const tri = calculateOffGridLoad({ ...offGridBase, system: 'triphasic' });
assert(almostEqual(tri.powerTotalW, (20 + 15 + 40) * 127), 'Ptotal trifásico soma fase C');

const stationary48 = calculateOffGridLoad({
  ...offGridBase,
  batteryModelId: 'st-12-240',
  busVoltageV: 48,
});
assert(stationary48.bank.model.energyWh === 2880, 'Estacionária 12 V 240 Ah = 2,88 kWh');
assert(stationary48.bank.series === 4, '48 V pede 4 baterias de 12 V em série');
assert(stationary48.bank.branchWh === 12 * 4 * 240, 'Ramo 48 V = 12 V × 4 × 240 Ah');
assert(
  stationary48.bank.parallel === Math.ceil((energyWh / 0.8) / stationary48.bank.branchWh - 1e-9),
  'Ramos em paralelo arredondam para cima',
);
assert(
  stationary48.bank.total === stationary48.bank.series * stationary48.bank.parallel,
  'Total = série × paralelo',
);
assert(stationary48.bank.wiring.includes('SÉRIE'), stationary48.bank.wiring);
assert(stationary48.bank.wiring.includes('PARALELO'), stationary48.bank.wiring);

const stationary24 = calculateOffGridLoad({
  ...offGridBase,
  batteryModelId: 'st-12-150',
  busVoltageV: 24,
  useDod: false,
});
assert(stationary24.bank.model.energyWh === 1800, 'Estacionária 12 V 150 Ah = 1,8 kWh');
assert(stationary24.bank.series === 2, '24 V pede 2 baterias de 12 V em série');
assert(stationary24.bank.branchWh === 1800 * 2, 'Ramo 24 V com 150 Ah');
assert(stationary24.bank.wiring.includes('SÉRIE'), stationary24.bank.wiring);
assert(stationary24.dodApplied === null, 'DoD ignorado na estacionária');

const lithium24on48 = calculateOffGridLoad({
  ...offGridBase,
  batteryModelId: 'li-24-100',
  busVoltageV: 48,
});
assert(lithium24on48.bank.series === 2, 'Dois módulos de 24 V em série no barramento de 48 V');
assert(lithium24on48.bank.branchWh === 4800, 'Ramo de dois módulos de 24 V = 4800 Wh');
assert(
  lithium24on48.bank.total === lithium24on48.bank.series * lithium24on48.bank.parallel,
  'Total de módulos 24 V',
);

const incompatible = calculateOffGridLoad({
  ...offGridBase,
  batteryModelId: 'li-48-100',
  busVoltageV: 24,
});
assert(!incompatible.bank.compatible, 'Módulo 48 V não fecha em barramento 24 V');

assert(
  validateOffGridInput({ ...offGridBase, dod: 0.65 }) !== null,
  'DoD de lítio abaixo de 70% é inválido',
);
assert(
  validateOffGridInput({ ...offGridBase, batteryModelId: 'st-12-240', dod: 0.5 }) === null,
  'DoD 50% é válido na estacionária',
);
assert(
  validateOffGridInput({ ...offGridBase, batteryModelId: 'st-12-240', dod: 0.2 }) !== null,
  'DoD de estacionária abaixo de 30% é inválido',
);

const inconsistent = calculateOffGridLoad({ ...offGridBase, currentNeutral: 80, currentA: 5, currentB: 5 });
assert(inconsistent.neutralInconsistent, 'Neutro acima das fases deve alertar');
assert(inconsistent.power220W === 0, 'Carga 220 V não fica negativa');

assert(nextCommercialSize(12, [3, 5, 8, 10, 12]) === 12, 'Porte exato não sobe de faixa');
assert(validateOffGridInput({ ...offGridBase, currentA: 0, currentB: 0 }) !== null, 'Sem corrente de fase é inválido');

const report = buildOffGridReportHtml(offGridBase, offGrid);
assert(report.includes('8 kW') || report.includes('8kW'), 'Relatório cita o inversor sugerido');
assert(report.includes('16x Módulos de Lítio 48V 100Ah'), 'Relatório cita o arranjo de lítio');
console.log(
  `   Off-grid 20+15 A / neutro 8 A: ${offGrid.inverterSuggestedKw} kW · ${offGrid.bank.headline}`,
);

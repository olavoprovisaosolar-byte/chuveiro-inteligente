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

console.log('✅ Self-test de cálculos OK');
console.log(
  `   Layout 8×12 m / 550 Wp: máx ${layouts.options[0].panelCount} placas (${layouts.options[0].orientationSummary})`,
);
console.log(
  `   Polígono L + chaminé: máx ${polyLayouts.options[0].panelCount} placas · área ${polyLayouts.totalRoofAreaM2} m²`,
);

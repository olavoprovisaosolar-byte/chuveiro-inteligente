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

assert(almostEqual(computeModuleArea(2.27, 1.13), 2.57) || almostEqual(computeModuleArea(2.27, 1.13), 2.56), 'Área unitária');

const sizing = calculateModulesForPower(4.5, module550);
assert(sizing.quantity === 9, `Qtd placas esperada 9, veio ${sizing.quantity}`);
assert(almostEqual(sizing.installedPowerKwp, 4.95), 'Potência instalada 9x550');
assert(almostEqual(sizing.inverterMinKw, 4.95 / 1.3), 'Inversor min pela potência instalada');

console.log('✅ Self-test de cálculos OK');

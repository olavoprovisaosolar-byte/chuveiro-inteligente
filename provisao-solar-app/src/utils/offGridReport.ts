import { formatNumber } from './calculations';
import {
  LEAD_BATTERY_AH,
  LEAD_BATTERY_V,
  LITHIUM_MODULE_AH,
  LITHIUM_MODULE_KWH,
  LITHIUM_MODULE_V,
  OffGridLoadInput,
  OffGridLoadResult,
} from './offGridLoad';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function kw(watts: number): string {
  return `${formatNumber(watts / 1000)} kW`;
}

function pct(fraction: number): string {
  return `${formatNumber(fraction * 100, 1)}%`;
}

export function describeTransformer(result: OffGridLoadResult): string {
  if (result.transformerStatus === 'no_127_load') {
    return 'Sem carga 127 V medida no neutro. Autotransformador não é necessário.';
  }
  if (result.transformerStatus === 'native_biphasic') {
    return 'Inversor com saída bifásica nativa: o 127 V pode ser obtido sem autotransformador.';
  }
  return `Autotransformador 127/220 V sugerido: ${formatNumber(result.transformerSuggestedKva)} kVA (potência calculada ${kw(result.transformerW)}, com 30% de folga).`;
}

export function describeBatteryBank(input: OffGridLoadInput, result: OffGridLoadResult): string {
  if (input.batteryTech === 'lithium') {
    const busNote =
      input.busVoltageV === LITHIUM_MODULE_V
        ? ''
        : ` Os módulos são de ${LITHIUM_MODULE_V} V; o barramento selecionado é ${input.busVoltageV} V.`;
    return `${result.lithiumModules}× módulos lítio ${LITHIUM_MODULE_V} V ${LITHIUM_MODULE_AH} Ah (${formatNumber(LITHIUM_MODULE_KWH)} kWh).${busNote}`;
  }
  return `${result.leadTotal}× baterias ${LEAD_BATTERY_V} V ${LEAD_BATTERY_AH} Ah · arranjo ${result.leadSeries}S${result.leadParallel}P (${result.leadParallel} strings de ${result.leadSeries} em série).`;
}

export function describeDod(result: OffGridLoadResult): string {
  if (result.dodApplied == null) return 'Capacidade bruta (DoD ignorado)';
  return `Considerando DoD de ${formatNumber(result.dodApplied * 100, 0)}%`;
}

/** HTML imprimível do relatório técnico de campo. */
export function buildOffGridReportHtml(input: OffGridLoadInput, result: OffGridLoadResult): string {
  const systemLabel = input.system === 'triphasic' ? 'Trifásico (3F+N)' : 'Bifásico (F-F-N)';
  const outputs = [
    input.supportsMono220 ? 'Saída 220 V monofásica' : null,
    input.supportsNativeBiphasic ? 'Saída bifásica nativa' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const tech = input.batteryTech === 'lithium' ? 'Lítio (LiFePO4)' : 'Chumbo-ácido / gel';
  const materials = [
    `Inversor off-grid ${formatNumber(result.inverterSuggestedKw)} kW (mínimo calculado ${kw(result.inverterMinW)}, ocupação ${pct(result.utilizationFactor)})`,
    describeTransformer(result),
    describeBatteryBank(input, result),
  ];

  const rows: Array<[string, string]> = [
    ['Sistema', systemLabel],
    ['Tensão fase-neutro', `${formatNumber(input.voltageFn, 0)} V`],
    ['Tensão fase-fase', `${formatNumber(input.voltageFf, 0)} V`],
    ['Corrente fase A', `${formatNumber(input.currentA)} A`],
    ['Corrente fase B', `${formatNumber(input.currentB)} A`],
    ...(input.system === 'triphasic'
      ? [['Corrente fase C', `${formatNumber(input.currentC)} A`] as [string, string]]
      : []),
    ['Corrente de neutro', `${formatNumber(input.currentNeutral)} A`],
    ['Potência total', kw(result.powerTotalW)],
    ['Carga 127 V', `${kw(result.power127W)} (${pct(result.share127)})`],
    ['Carga 220 V', `${kw(result.power220W)} (${pct(result.share220)})`],
    ['Corrente equivalente em 220 V', `${formatNumber(result.currentInverterA)} A`],
    ['Inversor sugerido', `${formatNumber(result.inverterSuggestedKw)} kW`],
    ['Autonomia', `${formatNumber(input.autonomyHours)} h`],
    ['Eficiência do inversor', pct(input.inverterEfficiency)],
    ['Barramento CC', `${input.busVoltageV} V`],
    ['Tecnologia', tech],
    ['Banco', `${formatNumber(result.batteryGrossWh / 1000)} kWh · ${formatNumber(result.capacityAh, 0)} Ah`],
    ['DoD', describeDod(result)],
  ];

  const table = rows
    .map(
      ([label, value]) =>
        `<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`,
    )
    .join('');
  const list = materials.map((item) => `<li>${esc(item)}</li>`).join('');
  const warning = result.neutralInconsistent
    ? '<p class="warn">A corrente de neutro implica mais potência em 127 V do que a soma das fases. Revise a medição antes de fechar o orçamento.</p>'
    : '';
  const surge = result.surgeMarginTight
    ? '<p class="warn">Fator de ocupação alto: a folga para partida de motores e ar-condicionado fica apertada. Confirme a potência de surto do inversor.</p>'
    : '<p>Motores e ar-condicionado pedem surto de partida (em geral 2× por poucos segundos). Confirme essa capacidade no datasheet do inversor.</p>';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório de levantamento off-grid</title>
  <style>
    body { font-family: sans-serif; color: #14201B; margin: 28px; }
    h1 { color: #0B3D2E; font-size: 22px; margin-bottom: 4px; }
    h2 { color: #145C45; font-size: 16px; margin-top: 22px; }
    p, li { font-size: 13px; line-height: 1.45; }
    .brand { color: #E8A317; letter-spacing: 1px; font-size: 12px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    td { border-bottom: 1px solid #D5DFD9; padding: 7px 4px; font-size: 13px; vertical-align: top; }
    td:first-child { color: #5A6B62; width: 46%; }
    td:last-child { text-align: right; font-weight: 600; }
    .warn { background: #FFF4D6; border: 1px solid #F5D78A; padding: 10px 12px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="brand">SOLAR CALCULATOR</div>
  <h1>Levantamento de carga e dimensionamento off-grid</h1>
  <p>Relatório de campo para retrofit / sistema isolado. Valores a partir das correntes medidas com alicate amperímetro.</p>
  ${warning}
  <h2>Medição e diagnóstico</h2>
  <table>${table}</table>
  <h2>Lista de materiais sugerida</h2>
  <ul>${list}</ul>
  ${surge}
  <p>Saídas marcadas no inversor: ${esc(outputs || 'não informadas')}.</p>
</body>
</html>`;
}

import { formatNumber } from './calculations';
import {
  AcOutputTopology,
  batteryModelById,
  BatteryTech,
  OffGridLoadInput,
  OffGridLoadResult,
  SupplyStandard,
  supplyVoltages,
} from './offGridLoad';

/** Textos de apoio exibidos na tela e repetidos no PDF. */
export const FIELD_HELP = {
  neutral:
    'A corrente medida no Neutro indica a parcela de carga operando exclusivamente em 127V na residência.',
  utilization:
    'Fator de ocupação: fração da potência do inversor que pode trabalhar em regime contínuo. 80% deixa 20% de folga para picos, temperatura e partida de motores.',
  dod:
    'Profundidade de descarga: parcela da capacidade que pode ser usada. Lítio LiFePO4 fica entre 70% e 90% (padrão 80%). Estacionária fica entre 30% e 60% (padrão 50%). Desligado, o cálculo usa 100% da capacidade nominal.',
  inverterIntro:
    'Defina como o inversor entregará a energia para o quadro de distribuição e como se conecta à rede/bypass.',
  mono220:
    'Saída em 220V com 2 fios. Requer Autotransformador externo para atender circuitos de 127V.',
  splitPhase:
    'Saída em 127V/220V com 3 fios. Alimenta tomadas 127V e cargas 220V diretamente sem Autotransformador.',
  triphasic:
    'Saída industrial/comercial (380V/220V ou 220V/127V). Atende motores e quadros trifásicos.',
  lithiumBadge: 'Alta durabilidade / Menor espaço',
  stationaryBadge: 'Custo inicial reduzido',
  supplyMono:
    'Um condutor de fase e o neutro. Informe só a corrente da fase A e a tensão da rede (127 V ou 220 V).',
  supplyBi:
    'Duas fases e o neutro em 127 V/220 V. A corrente do neutro separa a carga de 127 V da carga de 220 V.',
  supplyTri:
    'Três fases e o neutro. 127 V/220 V no padrão residencial ou 220 V/380 V no padrão industrial.',
  nativeNeutral: 'Topologia com Neutro Nativo. Dispensa Autotransformador.',
} as const;

export function supplyTitle(supply: SupplyStandard): string {
  if (supply === 'mono') return 'Monofásico Fase + Neutro (127V ou 220V)';
  if (supply === 'biphasic') return 'Bifásico Fase + Fase + Neutro (127V/220V)';
  return 'Trifásico 3 Fases + Neutro (127V/220V ou 220V/380V)';
}

export function supplyHelp(supply: SupplyStandard): string {
  if (supply === 'mono') return FIELD_HELP.supplyMono;
  if (supply === 'biphasic') return FIELD_HELP.supplyBi;
  return FIELD_HELP.supplyTri;
}

export function acOutputTag(output: AcOutputTopology): string {
  if (output === 'mono220') return 'Saída AC: 220V Monofásica';
  if (output === 'split_phase') return 'Saída AC: Bifásica Nativa (127V/220V)';
  return 'Saída AC: Trifásica Nativa (3F+N)';
}

export function acOutputTitle(output: AcOutputTopology): string {
  if (output === 'mono220') return 'Saída 220V Monofásica (Fase + Neutro)';
  if (output === 'split_phase') return 'Saída Bifásica Nativa (Split-Phase: Fase A + Fase B + Neutro)';
  return 'Saída Trifásica Nativa (3 Fases + Neutro)';
}

/** Rótulos da rosca. No trifásico 220/380 a parcela do neutro é 220 V, não 127 V. */
export function loadSplitLabels(input: OffGridLoadInput): { low: string; high: string } {
  const { voltageFn, voltageFf } = supplyVoltages(input);
  if (input.supply === 'triphasic' && input.triPair === '220_380') {
    return { low: `${voltageFn} V (F-N)`, high: `${voltageFf} V (F-F)` };
  }
  return { low: '127 V', high: '220 V' };
}

export function dodConsideredLabel(tech: BatteryTech, dodPercent: number, useDod: boolean): string {
  if (!useDod) return 'DoD ignorado: 100% da capacidade bruta';
  const name = tech === 'lithium' ? 'Lítio' : 'Estacionária';
  return `DoD Considerado: ${formatNumber(dodPercent, 0)}% (${name})`;
}

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
  if (result.transformerStatus === 'native_neutral') return FIELD_HELP.nativeNeutral;
  if (result.transformerStatus === 'not_applicable') {
    return 'Padrão monofásico: a carga inteira está na tensão selecionada. Autotransformador de apoio não se aplica.';
  }
  const loadName = result.voltageFn === 127 ? '127V' : `${formatNumber(result.voltageFn, 0)}V fase-neutro`;
  return `Potência do Trafo: ${formatNumber(result.transformerSuggestedKva)} kVA (Para atender a carga ${loadName} de ${kw(result.power127W)})`;
}

/** Guia rápido de ligação do banco instalado. */
export function describeAssembly(result: OffGridLoadResult): string {
  const bank = result.bank;
  if (!bank.compatible) return bank.wiring;
  const many = bank.model.tech === 'lithium' ? 'módulos' : 'baterias';
  const one = bank.model.tech === 'lithium' ? 'módulo' : 'bateria';
  const noun = bank.total === 1 ? one : many;
  if (bank.series <= 1) {
    return `Montagem: ${bank.total} ${noun} no total (ligação em paralelo)`;
  }
  const seriesNoun = bank.series === 1 ? one : many;
  const branches = bank.parallel === 1 ? 'ramo' : 'ramos';
  return `Montagem: ${bank.total} ${noun} no total (${bank.parallel} ${branches} de ${bank.series} ${seriesNoun} em série)`;
}

export function describeBatteryBank(_input: OffGridLoadInput, result: OffGridLoadResult): string {
  if (!result.bank.compatible) return result.bank.wiring;
  return `${result.bank.headline}. ${result.bank.wiring}.`;
}

export function describeDod(result: OffGridLoadResult): string {
  if (result.dodApplied == null) return 'Capacidade bruta máx. / DoD ignorado';
  return `${formatNumber(result.dodApplied * 100, 0)}% DoD aplicado`;
}

/** HTML imprimível do relatório técnico de campo. */
export function buildOffGridReportHtml(input: OffGridLoadInput, result: OffGridLoadResult): string {
  const { voltageFn, voltageFf } = supplyVoltages(input);
  const systemLabel = `${supplyTitle(input.supply)}. ${supplyHelp(input.supply)}`;
  const outputLabel = `${acOutputTitle(input.acOutput)} · ${acOutputTag(input.acOutput)}`;
  const split = loadSplitLabels(input);
  const model = batteryModelById(input.batteryModelId);
  const tech = model.tech === 'lithium' ? 'Lítio (LiFePO4)' : 'Estacionária (chumbo-ácido)';
  const materials = [
    `Inversor Recomendado: ${formatNumber(result.inverterSuggestedKw)} kW (${acOutputTag(input.acOutput)}; mínimo calculado ${kw(result.inverterMinW)}, ocupação ${pct(result.utilizationFactor)})`,
    result.transformerStatus === 'required'
      ? `Autotransformador de Apoio Necessário. ${describeTransformer(result)}`
      : result.transformerStatus === 'native_neutral'
        ? FIELD_HELP.nativeNeutral
        : describeTransformer(result),
    `${describeBatteryBank(input, result)} ${describeAssembly(result)}`,
  ];

  const rows: Array<[string, string]> = [
    ['Padrão da rede', systemLabel],
    ['Tensão fase-neutro', `${formatNumber(voltageFn, 0)} V`],
    ['Tensão fase-fase', `${formatNumber(voltageFf, 0)} V`],
    ['Corrente fase A', `${formatNumber(input.currentA)} A`],
    ...(input.supply === 'mono'
      ? []
      : [['Corrente fase B', `${formatNumber(input.currentB)} A`] as [string, string]]),
    ...(input.supply === 'triphasic'
      ? [['Corrente fase C', `${formatNumber(input.currentC)} A`] as [string, string]]
      : []),
    ...(input.supply === 'mono'
      ? []
      : [['Corrente de neutro', `${formatNumber(input.currentNeutral)} A`] as [string, string]]),
    ['Potência total', kw(result.powerTotalW)],
    [`Carga ${split.low}`, `${kw(result.power127W)} (${pct(result.share127)})`],
    [`Carga ${split.high}`, `${kw(result.power220W)} (${pct(result.share220)})`],
    [`Corrente equivalente em ${formatNumber(voltageFf, 0)} V`, `${formatNumber(result.currentInverterA)} A`],
    ['Inversor Recomendado', `${formatNumber(result.inverterSuggestedKw)} kW`],
    ['Saída AC', acOutputTag(input.acOutput)],
    ['Montagem do banco', describeAssembly(result)],
    ['Autonomia', `${formatNumber(input.autonomyHours)} h`],
    ['Eficiência do inversor', pct(input.inverterEfficiency)],
    ['Barramento CC', `${input.busVoltageV} V`],
    ['Tecnologia', tech],
    ['Modelo', model.name],
    ['Banco', result.bank.headline],
    ['Ligação', result.bank.wiring],
    ['Energia útil requerida', `${formatNumber(result.energyWh / 1000)} kWh`],
    ['Energia bruta requerida', `${formatNumber(result.batteryGrossWh / 1000)} kWh`],
    ['Banco instalado', `${formatNumber(result.bank.installedGrossWh / 1000)} kWh brutos · ${formatNumber(result.bank.installedUsefulWh / 1000)} kWh úteis`],
    ['DoD', describeDod(result)],
    ['Alternativa lítio', result.comparison.lithium.headline],
    ['Alternativa estacionária', result.comparison.stationary.headline],
  ];

  const table = rows
    .map(
      ([label, value]) =>
        `<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`,
    )
    .join('');
  const list = materials.map((item) => `<li>${esc(item)}</li>`).join('');
  const warning = result.neutralInconsistent
    ? '<p class="warn">A corrente de neutro implica mais potência fase-neutro do que a soma das fases. Revise a medição antes de fechar o orçamento.</p>'
    : '';
  const nativeNotice =
    result.transformerStatus === 'native_neutral'
      ? `<p class="ok">${esc(FIELD_HELP.nativeNeutral)}</p>`
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
    .ok { background: #E5F6EC; border: 1px solid #1B8A55; padding: 10px 12px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="brand">SOLAR CALCULATOR</div>
  <h1>Levantamento de carga e dimensionamento off-grid</h1>
  <p>Relatório de campo para retrofit / sistema isolado. Valores a partir das correntes medidas com alicate amperímetro.</p>
  ${warning}
  ${nativeNotice}
  <h2>Medição e diagnóstico</h2>
  <table>${table}</table>
  <h2>Lista de materiais sugerida</h2>
  <ul>${list}</ul>
  ${surge}
  <h2>Textos de apoio</h2>
  <ul>
    <li>${esc(supplyTitle(input.supply))}: ${esc(supplyHelp(input.supply))}</li>
    <li>${esc(FIELD_HELP.supplyMono)}</li>
    <li>${esc(FIELD_HELP.supplyBi)}</li>
    <li>${esc(FIELD_HELP.supplyTri)}</li>
    <li>${esc(FIELD_HELP.neutral)}</li>
    <li>${esc(FIELD_HELP.inverterIntro)}</li>
    <li>${esc(acOutputTitle(input.acOutput))}: ${esc(input.acOutput === 'mono220' ? FIELD_HELP.mono220 : input.acOutput === 'split_phase' ? FIELD_HELP.splitPhase : FIELD_HELP.triphasic)}</li>
    <li>${esc(FIELD_HELP.nativeNeutral)}</li>
    <li>${esc(FIELD_HELP.utilization)}</li>
    <li>${esc(FIELD_HELP.dod)}</li>
    <li>Lítio (LiFePO4): ${esc(FIELD_HELP.lithiumBadge)}. Estacionária: ${esc(FIELD_HELP.stationaryBadge)}.</li>
  </ul>
  <p>Topologia selecionada: ${esc(outputLabel)}.</p>
</body>
</html>`;
}

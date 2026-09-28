import {
  DEFAULT_EDGE_MARGIN_M,
  DEFAULT_PANEL_GAP_M,
  KWH_PER_KWP_MONTH,
} from '../constants/modules';
import {
  PanelOrientation,
  PanelPlacement,
  RoofLayoutComputation,
  RoofLayoutOption,
  SolarModule,
} from '../types';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function panelSize(
  module: SolarModule,
  orientation: PanelOrientation,
): { w: number; h: number } {
  // portrait = lado menor na horizontal (largura da placa); landscape = placa deitada
  if (orientation === 'portrait') {
    return { w: module.widthM, h: module.lengthM };
  }
  return { w: module.lengthM, h: module.widthM };
}

function buildGridPlacements(
  cols: number,
  rows: number,
  panelW: number,
  panelH: number,
  gap: number,
  orientation: PanelOrientation,
  idPrefix: string,
  offsetX = 0,
  offsetY = 0,
): PanelPlacement[] {
  const placements: PanelPlacement[] = [];
  let index = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      placements.push({
        id: `${idPrefix}-${index}`,
        x: offsetX + c * (panelW + gap),
        y: offsetY + r * (panelH + gap),
        width: panelW,
        height: panelH,
        orientation,
        rotationDeg: orientation === 'landscape' ? 90 : 0,
        selectable: true,
      });
      index += 1;
    }
  }
  return placements;
}

function packUniform(
  usableW: number,
  usableL: number,
  module: SolarModule,
  orientation: PanelOrientation,
  gap: number,
  idPrefix: string,
): { count: number; placements: PanelPlacement[]; cols: number; rows: number } {
  const { w: panelW, h: panelH } = panelSize(module, orientation);
  if (panelW <= 0 || panelH <= 0) {
    return { count: 0, placements: [], cols: 0, rows: 0 };
  }
  const cols = Math.floor((usableW + gap) / (panelW + gap));
  const rows = Math.floor((usableL + gap) / (panelH + gap));
  if (cols <= 0 || rows <= 0) {
    return { count: 0, placements: [], cols: 0, rows: 0 };
  }
  const placements = buildGridPlacements(cols, rows, panelW, panelH, gap, orientation, idPrefix);
  return { count: cols * rows, placements, cols, rows };
}

/**
 * Arranjo misto: preenche o máximo possível em uma orientação e
 * tenta encaixar filas da outra no espaço restante.
 */
function packMixed(
  usableW: number,
  usableL: number,
  module: SolarModule,
  primary: PanelOrientation,
  gap: number,
): { count: number; placements: PanelPlacement[] } {
  const secondary: PanelOrientation = primary === 'portrait' ? 'landscape' : 'portrait';
  const primarySize = panelSize(module, primary);
  const secondarySize = panelSize(module, secondary);

  let bestCount = 0;
  let bestPlacements: PanelPlacement[] = [];

  // Estratégia A: N filas primárias no eixo Y, resto com secundárias
  const maxPrimaryRows = Math.floor((usableL + gap) / (primarySize.h + gap));
  for (let primaryRows = maxPrimaryRows; primaryRows >= 0; primaryRows -= 1) {
    const primaryCols = Math.floor((usableW + gap) / (primarySize.w + gap));
    if (primaryRows > 0 && primaryCols <= 0) continue;

    const usedL = primaryRows > 0 ? primaryRows * (primarySize.h + gap) - gap : 0;
    const remainL = usableL - (primaryRows > 0 ? usedL + gap : 0);

    const primaryPlacements =
      primaryRows > 0 && primaryCols > 0
        ? buildGridPlacements(
            primaryCols,
            primaryRows,
            primarySize.w,
            primarySize.h,
            gap,
            primary,
            `mix-${primary}-y`,
          )
        : [];

    let secondaryPlacements: PanelPlacement[] = [];
    if (remainL >= secondarySize.h) {
      const secCols = Math.floor((usableW + gap) / (secondarySize.w + gap));
      const secRows = Math.floor((remainL + gap) / (secondarySize.h + gap));
      if (secCols > 0 && secRows > 0) {
        const offsetY = primaryRows > 0 ? usedL + gap : 0;
        secondaryPlacements = buildGridPlacements(
          secCols,
          secRows,
          secondarySize.w,
          secondarySize.h,
          gap,
          secondary,
          `mix-${secondary}-y`,
          0,
          offsetY,
        );
      }
    }

    const total = primaryPlacements.length + secondaryPlacements.length;
    if (total > bestCount) {
      bestCount = total;
      bestPlacements = [...primaryPlacements, ...secondaryPlacements];
    }
  }

  // Estratégia B: N colunas primárias no eixo X, resto com secundárias
  const maxPrimaryCols = Math.floor((usableW + gap) / (primarySize.w + gap));
  for (let primaryCols = maxPrimaryCols; primaryCols >= 0; primaryCols -= 1) {
    const primaryRows = Math.floor((usableL + gap) / (primarySize.h + gap));
    if (primaryCols > 0 && primaryRows <= 0) continue;

    const usedW = primaryCols > 0 ? primaryCols * (primarySize.w + gap) - gap : 0;
    const remainW = usableW - (primaryCols > 0 ? usedW + gap : 0);

    const primaryPlacements =
      primaryCols > 0 && primaryRows > 0
        ? buildGridPlacements(
            primaryCols,
            primaryRows,
            primarySize.w,
            primarySize.h,
            gap,
            primary,
            `mix-${primary}-x`,
          )
        : [];

    let secondaryPlacements: PanelPlacement[] = [];
    if (remainW >= secondarySize.w) {
      const secCols = Math.floor((remainW + gap) / (secondarySize.w + gap));
      const secRows = Math.floor((usableL + gap) / (secondarySize.h + gap));
      if (secCols > 0 && secRows > 0) {
        const offsetX = primaryCols > 0 ? usedW + gap : 0;
        secondaryPlacements = buildGridPlacements(
          secCols,
          secRows,
          secondarySize.w,
          secondarySize.h,
          gap,
          secondary,
          `mix-${secondary}-x`,
          offsetX,
          0,
        );
      }
    }

    const total = primaryPlacements.length + secondaryPlacements.length;
    if (total > bestCount) {
      bestCount = total;
      bestPlacements = [...primaryPlacements, ...secondaryPlacements];
    }
  }

  return { count: bestCount, placements: bestPlacements };
}

function summarizeOrientations(placements: PanelPlacement[]): string {
  const portrait = placements.filter((p) => p.orientation === 'portrait').length;
  const landscape = placements.filter((p) => p.orientation === 'landscape').length;
  if (portrait > 0 && landscape > 0) {
    return `${portrait} retrato + ${landscape} paisagem`;
  }
  if (landscape > 0) return 'Todas em paisagem';
  if (portrait > 0) return 'Todas em retrato';
  return 'Sem placas';
}

function toOption(params: {
  id: string;
  label: string;
  strategy: RoofLayoutOption['strategy'];
  placements: PanelPlacement[];
  usableW: number;
  usableL: number;
  edgeMarginM: number;
  panelGapM: number;
  roofWidthM: number;
  roofLengthM: number;
  module: SolarModule;
}): RoofLayoutOption {
  const panelCount = params.placements.length;
  const totalPowerKwp = round2((panelCount * params.module.powerWp) / 1000);
  return {
    id: params.id,
    label: params.label,
    strategy: params.strategy,
    panelCount,
    orientationSummary: summarizeOrientations(params.placements),
    usableWidthM: round2(params.usableW),
    usableLengthM: round2(params.usableL),
    edgeMarginM: params.edgeMarginM,
    panelGapM: params.panelGapM,
    roofWidthM: params.roofWidthM,
    roofLengthM: params.roofLengthM,
    placements: params.placements,
    totalPowerKwp,
    estimatedMonthlyGenerationKwh: round2(totalPowerKwp * KWH_PER_KWP_MONTH),
  };
}

/**
 * Calcula sugestões de arranjo dinâmico no telhado.
 * Opção A = máximo de placas (melhor entre retrato, paisagem e misto).
 * Opção B = arranjo padronizado (melhor entre só retrato e só paisagem).
 */
export function computeRoofLayouts(params: {
  roofWidthM: number;
  roofLengthM: number;
  module: SolarModule;
  edgeMarginM?: number;
  panelGapM?: number;
}): RoofLayoutComputation {
  const edgeMarginM = params.edgeMarginM ?? DEFAULT_EDGE_MARGIN_M;
  const panelGapM = params.panelGapM ?? DEFAULT_PANEL_GAP_M;
  const { roofWidthM, roofLengthM, module } = params;

  const usableW = Math.max(0, roofWidthM - 2 * edgeMarginM);
  const usableL = Math.max(0, roofLengthM - 2 * edgeMarginM);

  // Também avalia eixos trocados (usuário pode inverter largura/comprimento)
  const candidates: Array<{
    usableW: number;
    usableL: number;
    roofW: number;
    roofL: number;
    axisKey: string;
  }> = [
    { usableW, usableL, roofW: roofWidthM, roofL: roofLengthM, axisKey: 'wl' },
    {
      usableW: usableL,
      usableL: usableW,
      roofW: roofLengthM,
      roofL: roofWidthM,
      axisKey: 'lw',
    },
  ];

  let bestUniformPortrait: RoofLayoutOption | null = null;
  let bestUniformLandscape: RoofLayoutOption | null = null;
  let bestMixed: RoofLayoutOption | null = null;

  for (const axis of candidates) {
    const portrait = packUniform(
      axis.usableW,
      axis.usableL,
      module,
      'portrait',
      panelGapM,
      `p-${axis.axisKey}`,
    );
    const landscape = packUniform(
      axis.usableW,
      axis.usableL,
      module,
      'landscape',
      panelGapM,
      `l-${axis.axisKey}`,
    );
    const mixedA = packMixed(axis.usableW, axis.usableL, module, 'portrait', panelGapM);
    const mixedB = packMixed(axis.usableW, axis.usableL, module, 'landscape', panelGapM);
    const mixed = mixedA.count >= mixedB.count ? mixedA : mixedB;

    const portraitOpt = toOption({
      id: `uniform-portrait-${axis.axisKey}`,
      label: 'Arranjo padronizado (retrato)',
      strategy: 'uniform_portrait',
      placements: portrait.placements,
      usableW: axis.usableW,
      usableL: axis.usableL,
      edgeMarginM,
      panelGapM,
      roofWidthM: axis.roofW,
      roofLengthM: axis.roofL,
      module,
    });
    const landscapeOpt = toOption({
      id: `uniform-landscape-${axis.axisKey}`,
      label: 'Arranjo padronizado (paisagem)',
      strategy: 'uniform_landscape',
      placements: landscape.placements,
      usableW: axis.usableW,
      usableL: axis.usableL,
      edgeMarginM,
      panelGapM,
      roofWidthM: axis.roofW,
      roofLengthM: axis.roofL,
      module,
    });
    const mixedOpt = toOption({
      id: `mixed-${axis.axisKey}`,
      label: 'Arranjo misto',
      strategy: 'mixed',
      placements: mixed.placements,
      usableW: axis.usableW,
      usableL: axis.usableL,
      edgeMarginM,
      panelGapM,
      roofWidthM: axis.roofW,
      roofLengthM: axis.roofL,
      module,
    });

    if (!bestUniformPortrait || portraitOpt.panelCount > bestUniformPortrait.panelCount) {
      bestUniformPortrait = portraitOpt;
    }
    if (!bestUniformLandscape || landscapeOpt.panelCount > bestUniformLandscape.panelCount) {
      bestUniformLandscape = landscapeOpt;
    }
    if (!bestMixed || mixedOpt.panelCount > bestMixed.panelCount) {
      bestMixed = mixedOpt;
    }
  }

  const uniformBest =
    (bestUniformPortrait?.panelCount ?? 0) >= (bestUniformLandscape?.panelCount ?? 0)
      ? bestUniformPortrait
      : bestUniformLandscape;

  const maxCandidate = [bestUniformPortrait, bestUniformLandscape, bestMixed]
    .filter((o): o is RoofLayoutOption => Boolean(o))
    .sort((a, b) => b.panelCount - a.panelCount)[0];

  const optionA: RoofLayoutOption = {
    ...(maxCandidate ??
      toOption({
        id: 'max-empty',
        label: 'Opção A: Máximo de placas',
        strategy: 'max',
        placements: [],
        usableW,
        usableL,
        edgeMarginM,
        panelGapM,
        roofWidthM,
        roofLengthM,
        module,
      })),
    id: 'option-a-max',
    label: 'Opção A: Máximo de placas',
    strategy: 'max',
  };

  const optionB: RoofLayoutOption = {
    ...(uniformBest ??
      toOption({
        id: 'uniform-empty',
        label: 'Opção B: Arranjo padronizado',
        strategy: 'uniform_portrait',
        placements: [],
        usableW,
        usableL,
        edgeMarginM,
        panelGapM,
        roofWidthM,
        roofLengthM,
        module,
      })),
    id: 'option-b-uniform',
    label: 'Opção B: Arranjo padronizado',
  };

  // Se A e B forem iguais em contagem e layout, ainda mostramos as duas opções com rótulos claros
  return {
    options: [optionA, optionB],
    bestOptionId: optionA.id,
  };
}

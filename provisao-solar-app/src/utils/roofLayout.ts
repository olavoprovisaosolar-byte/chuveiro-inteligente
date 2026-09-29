import {
  DEFAULT_EDGE_MARGIN_M,
  DEFAULT_END_CLAMP_M,
  DEFAULT_PANEL_GAP_M,
  KWH_PER_KWP_MONTH,
} from '../constants/modules';
import {
  PanelOrientation,
  PanelPlacement,
  Point2D,
  RoofLayoutComputation,
  RoofLayoutOption,
  RoofObstacle,
  SolarModule,
} from '../types';
import {
  anyObstacleHits,
  boundingBox,
  normalizePolygonOrigin,
  obstaclesArea,
  polygonArea,
  rectInsidePolygon,
  rectanglePolygon,
  round2,
} from './roofGeometry';

function panelSize(
  module: SolarModule,
  orientation: PanelOrientation,
): { w: number; h: number } {
  if (orientation === 'portrait') {
    return { w: module.widthM, h: module.lengthM };
  }
  return { w: module.lengthM, h: module.widthM };
}

function summarizeOrientations(placements: PanelPlacement[]): string {
  const portrait = placements.filter((p) => p.orientation === 'portrait').length;
  const landscape = placements.filter((p) => p.orientation === 'landscape').length;
  if (portrait > 0 && landscape > 0) {
    return `${portrait} na Vertical + ${landscape} na Horizontal`;
  }
  if (landscape > 0) {
    return landscape === 1
      ? '1 placa na Horizontal'
      : `Todas as ${landscape} placas na Horizontal`;
  }
  if (portrait > 0) {
    return portrait === 1
      ? '1 placa na Vertical'
      : `Todas as ${portrait} placas na Vertical`;
  }
  return 'Sem placas';
}

/** Texto de destaque do arranjo otimizado. */
export function formatOptimizedArrangement(option: RoofLayoutOption | null): string {
  if (!option || option.panelCount <= 0) {
    return 'Arranjo Otimizado: nenhuma placa encaixou com as dimensões atuais';
  }
  return `Arranjo Otimizado: ${option.panelCount} placas · ${option.orientationSummary}`;
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
  endClampM: number;
  roofWidthM: number;
  roofLengthM: number;
  totalRoofAreaM2: number;
  usefulAreaM2: number;
  module: SolarModule;
  polygon: Point2D[];
  obstacles: RoofObstacle[];
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
    endClampM: params.endClampM,
    roofWidthM: params.roofWidthM,
    roofLengthM: params.roofLengthM,
    totalRoofAreaM2: round2(params.totalRoofAreaM2),
    usefulAreaM2: round2(params.usefulAreaM2),
    placements: params.placements,
    totalPowerKwp,
    estimatedMonthlyGenerationKwh: round2(totalPowerKwp * KWH_PER_KWP_MONTH),
    polygon: params.polygon,
    obstacles: params.obstacles,
  };
}

/**
 * Empacota placas em malha regular, aceitando só células 100% dentro do polígono
 * e fora dos obstáculos (com clearance).
 */
function packUniformInPolygon(params: {
  polygon: Point2D[];
  obstacles: RoofObstacle[];
  module: SolarModule;
  orientation: PanelOrientation;
  gap: number;
  endClampM: number;
  edgeMarginM: number;
  idPrefix: string;
}): { count: number; placements: PanelPlacement[] } {
  const { w: panelW, h: panelH } = panelSize(params.module, params.orientation);
  if (panelW <= 0 || panelH <= 0) return { count: 0, placements: [] };

  const box = boundingBox(params.polygon);
  const startX = box.minX + params.edgeMarginM + params.endClampM;
  const startY = box.minY + params.edgeMarginM;
  const endX = box.maxX - params.edgeMarginM - params.endClampM;
  const endY = box.maxY - params.edgeMarginM;
  const stepX = panelW + params.gap;
  const stepY = panelH + params.gap;

  if (endX - startX < panelW || endY - startY < panelH) {
    return { count: 0, placements: [] };
  }

  const placements: PanelPlacement[] = [];
  let index = 0;
  for (let y = startY; y + panelH <= endY + 1e-9; y += stepY) {
    for (let x = startX; x + panelW <= endX + 1e-9; x += stepX) {
      if (!rectInsidePolygon(x, y, panelW, panelH, params.polygon)) continue;
      if (anyObstacleHits(params.obstacles, x, y, panelW, panelH)) continue;
      placements.push({
        id: `${params.idPrefix}-${index}`,
        x: round2(x),
        y: round2(y),
        width: panelW,
        height: panelH,
        orientation: params.orientation,
        rotationDeg: params.orientation === 'landscape' ? 90 : 0,
        selectable: true,
      });
      index += 1;
    }
  }
  return { count: placements.length, placements };
}

/**
 * Misto: preenche com orientação primária e tenta encaixar secundária nas falhas
 * da malha (varredura fina).
 */
function packMixedInPolygon(params: {
  polygon: Point2D[];
  obstacles: RoofObstacle[];
  module: SolarModule;
  primary: PanelOrientation;
  gap: number;
  endClampM: number;
  edgeMarginM: number;
}): { count: number; placements: PanelPlacement[] } {
  const primary = packUniformInPolygon({
    ...params,
    orientation: params.primary,
    idPrefix: `mix-${params.primary}`,
  });
  const secondary: PanelOrientation =
    params.primary === 'portrait' ? 'landscape' : 'portrait';
  const { w: panelW, h: panelH } = panelSize(params.module, secondary);
  const box = boundingBox(params.polygon);
  const occupied = primary.placements.map((p) => ({
    x: p.x,
    y: p.y,
    w: p.width,
    h: p.height,
  }));

  const startX = box.minX + params.edgeMarginM + params.endClampM;
  const startY = box.minY + params.edgeMarginM;
  const endX = box.maxX - params.edgeMarginM - params.endClampM;
  const endY = box.maxY - params.edgeMarginM;
  const step = Math.min(panelW, panelH, 0.25);

  const extras: PanelPlacement[] = [];
  let index = 0;
  for (let y = startY; y + panelH <= endY + 1e-9; y += step) {
    for (let x = startX; x + panelW <= endX + 1e-9; x += step) {
      if (!rectInsidePolygon(x, y, panelW, panelH, params.polygon)) continue;
      if (anyObstacleHits(params.obstacles, x, y, panelW, panelH)) continue;
      const hitsOccupied = occupied.some(
        (o) =>
          x < o.x + o.w && x + panelW > o.x && y < o.y + o.h && y + panelH > o.y,
      );
      if (hitsOccupied) continue;
      const hitsExtra = extras.some(
        (o) =>
          x < o.x + o.width &&
          x + panelW > o.x &&
          y < o.y + o.height &&
          y + panelH > o.y,
      );
      if (hitsExtra) continue;
      extras.push({
        id: `mix-${secondary}-${index}`,
        x: round2(x),
        y: round2(y),
        width: panelW,
        height: panelH,
        orientation: secondary,
        rotationDeg: secondary === 'landscape' ? 90 : 0,
        selectable: true,
      });
      index += 1;
    }
  }

  const placements = [...primary.placements, ...extras];
  return { count: placements.length, placements };
}

/**
 * Calcula sugestões de arranjo dinâmico.
 * Suporta retângulo clássico ou polígono irregular + obstáculos.
 */
export function computeRoofLayouts(params: {
  roofWidthM?: number;
  roofLengthM?: number;
  polygon?: Point2D[];
  obstacles?: RoofObstacle[];
  module: SolarModule;
  edgeMarginM?: number;
  panelGapM?: number;
  endClampM?: number;
}): RoofLayoutComputation {
  const edgeMarginM = params.edgeMarginM ?? DEFAULT_EDGE_MARGIN_M;
  const panelGapM = params.panelGapM ?? DEFAULT_PANEL_GAP_M;
  const endClampM = params.endClampM ?? DEFAULT_END_CLAMP_M;
  const obstacles = params.obstacles ?? [];

  let polygon: Point2D[];
  if (params.polygon && params.polygon.length >= 3) {
    polygon = normalizePolygonOrigin(params.polygon);
  } else {
    const w = params.roofWidthM ?? 0;
    const l = params.roofLengthM ?? 0;
    polygon = rectanglePolygon(w, l);
  }

  const box = boundingBox(polygon);
  const roofWidthM = box.width;
  const roofLengthM = box.height;
  const totalRoofAreaM2 = polygonArea(polygon);
  const usefulAreaM2 = Math.max(
    0,
    totalRoofAreaM2 - obstaclesArea(obstacles) - estimateMarginBand(polygon, edgeMarginM),
  );

  const base = {
    polygon,
    obstacles,
    module: params.module,
    gap: panelGapM,
    endClampM,
    edgeMarginM,
  };

  const portrait = packUniformInPolygon({
    ...base,
    orientation: 'portrait',
    idPrefix: 'p',
  });
  const landscape = packUniformInPolygon({
    ...base,
    orientation: 'landscape',
    idPrefix: 'l',
  });
  const mixedA = packMixedInPolygon({ ...base, primary: 'portrait' });
  const mixedB = packMixedInPolygon({ ...base, primary: 'landscape' });
  const mixed = mixedA.count >= mixedB.count ? mixedA : mixedB;

  const usableW = Math.max(0, roofWidthM - 2 * edgeMarginM - 2 * endClampM);
  const usableL = Math.max(0, roofLengthM - 2 * edgeMarginM);

  const common = {
    usableW,
    usableL,
    edgeMarginM,
    panelGapM,
    endClampM,
    roofWidthM,
    roofLengthM,
    totalRoofAreaM2,
    usefulAreaM2,
    module: params.module,
    polygon,
    obstacles,
  };

  const portraitOpt = toOption({
    id: 'uniform-portrait',
    label: 'Arranjo padronizado (Vertical)',
    strategy: 'uniform_portrait',
    placements: portrait.placements,
    ...common,
  });
  const landscapeOpt = toOption({
    id: 'uniform-landscape',
    label: 'Arranjo padronizado (Horizontal)',
    strategy: 'uniform_landscape',
    placements: landscape.placements,
    ...common,
  });
  const mixedOpt = toOption({
    id: 'mixed',
    label: 'Arranjo misto',
    strategy: 'mixed',
    placements: mixed.placements,
    ...common,
  });

  const uniformBest =
    portraitOpt.panelCount >= landscapeOpt.panelCount ? portraitOpt : landscapeOpt;
  const maxCandidate = [portraitOpt, landscapeOpt, mixedOpt].sort(
    (a, b) => b.panelCount - a.panelCount,
  )[0];

  const optionA: RoofLayoutOption = {
    ...maxCandidate,
    id: 'option-a-max',
    label: 'Opção A: Máximo de placas',
    strategy: 'max',
  };
  const optionB: RoofLayoutOption = {
    ...uniformBest,
    id: 'option-b-uniform',
    label: 'Opção B: Arranjo padronizado',
  };

  return {
    options: [optionA, optionB],
    bestOptionId: optionA.id,
    totalRoofAreaM2: round2(totalRoofAreaM2),
    usefulAreaM2: round2(usefulAreaM2),
  };
}

/** Estimativa da faixa de margem de borda (área do anel ≈ perímetro × margem). */
function estimateMarginBand(polygon: Point2D[], edgeMarginM: number): number {
  if (polygon.length < 2 || edgeMarginM <= 0) return 0;
  let peri = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    peri += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return peri * edgeMarginM;
}

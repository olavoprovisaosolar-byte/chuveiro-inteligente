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

function overlapsAny(
  x: number,
  y: number,
  w: number,
  h: number,
  rects: Array<{ x: number; y: number; w: number; h: number }>,
): boolean {
  return rects.some(
    (o) => x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y,
  );
}

/** Empacota uma fileira (shelf) de placas na orientação dada, em y fixo. */
function packShelfRow(params: {
  y: number;
  panelW: number;
  panelH: number;
  orientation: PanelOrientation;
  startX: number;
  endX: number;
  gap: number;
  polygon: Point2D[];
  obstacles: RoofObstacle[];
  blocked: Array<{ x: number; y: number; w: number; h: number }>;
  idPrefix: string;
  indexStart: number;
}): PanelPlacement[] {
  const stepX = params.panelW + params.gap;
  const placements: PanelPlacement[] = [];
  let index = params.indexStart;
  for (let x = params.startX; x + params.panelW <= params.endX + 1e-9; x += stepX) {
    if (!rectInsidePolygon(x, params.y, params.panelW, params.panelH, params.polygon)) {
      continue;
    }
    if (anyObstacleHits(params.obstacles, x, params.y, params.panelW, params.panelH)) {
      continue;
    }
    if (overlapsAny(x, params.y, params.panelW, params.panelH, params.blocked)) {
      continue;
    }
    placements.push({
      id: `${params.idPrefix}-${index}`,
      x: round2(x),
      y: round2(params.y),
      width: params.panelW,
      height: params.panelH,
      orientation: params.orientation,
      rotationDeg: params.orientation === 'landscape' ? 90 : 0,
      selectable: true,
    });
    index += 1;
  }
  return placements;
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
  /** Permite sobrescrever a banda útil (ex.: após “emprestar” folga de borda). */
  bounds?: { startX: number; endX: number; startY: number; endY: number };
}): { count: number; placements: PanelPlacement[] } {
  const { w: panelW, h: panelH } = panelSize(params.module, params.orientation);
  if (panelW <= 0 || panelH <= 0) return { count: 0, placements: [] };

  const box = boundingBox(params.polygon);
  const startX = params.bounds?.startX ?? box.minX + params.edgeMarginM + params.endClampM;
  const startY = params.bounds?.startY ?? box.minY + params.edgeMarginM;
  const endX = params.bounds?.endX ?? box.maxX - params.edgeMarginM - params.endClampM;
  const endY = params.bounds?.endY ?? box.maxY - params.edgeMarginM;
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

type ShelfOrient = PanelOrientation;

/**
 * Packing por prateleiras (shelves): escolhe a sequência de fileiras
 * Vertical/Horizontal que maximiza a quantidade de placas.
 * Também tenta preencher a faixa residual inferior com a outra orientação.
 */
function packShelfMixed(params: {
  polygon: Point2D[];
  obstacles: RoofObstacle[];
  module: SolarModule;
  gap: number;
  endClampM: number;
  edgeMarginM: number;
  /** Se true, pode reduzir a folga de borda o mínimo para caber +1 fileira residual. */
  borrowEdgeForRemainder?: boolean;
}): { count: number; placements: PanelPlacement[]; edgeUsedM: number } {
  const box = boundingBox(params.polygon);
  const gap = params.gap;

  const tryWithEdges = (edgeTop: number, edgeBottom: number, edgeX: number) => {
    const startX = box.minX + edgeX + params.endClampM;
    const endX = box.maxX - edgeX - params.endClampM;
    const startY = box.minY + edgeTop;
    const endY = box.maxY - edgeBottom;
    const usableL = endY - startY;
    const usableW = endX - startX;
    if (usableL <= 0 || usableW <= 0) {
      return { count: 0, placements: [] as PanelPlacement[], edgeUsedM: edgeX };
    }

    const sizes: Record<ShelfOrient, { w: number; h: number }> = {
      portrait: panelSize(params.module, 'portrait'),
      landscape: panelSize(params.module, 'landscape'),
    };

    // DP: melhor contagem para altura exata usada (discretizada em mm)
    const scale = 1000;
    const H = Math.max(0, Math.floor(usableL * scale + 1e-6));
    const shelfHeights: Array<{ orient: ShelfOrient; h: number; cols: number }> = [];
    (['portrait', 'landscape'] as ShelfOrient[]).forEach((orient) => {
      const { w, h } = sizes[orient];
      const cols = Math.floor((usableW + gap) / (w + gap));
      if (cols > 0 && h > 0) {
        shelfHeights.push({ orient, h, cols });
      }
    });

    const bestCount = new Array(H + 1).fill(-1);
    const parent: Array<{ prev: number; orient: ShelfOrient; h: number } | null> = new Array(
      H + 1,
    ).fill(null);
    bestCount[0] = 0;

    for (let h = 0; h <= H; h += 1) {
      if (bestCount[h] < 0) continue;
      for (const shelf of shelfHeights) {
        const shelfMm = Math.ceil(shelf.h * scale - 1e-6);
        const gapMm = h === 0 ? 0 : Math.ceil(gap * scale - 1e-6);
        const next = h + gapMm + shelfMm;
        if (next > H) continue;
        const cand = bestCount[h] + shelf.cols;
        // >= permite que fileiras posteriores (ex.: Horizontal na base) substituam
        // caminhos equivalentes, privilegiando Vertical no topo + residual embaixo.
        if (cand >= bestCount[next]) {
          bestCount[next] = cand;
          parent[next] = { prev: h, orient: shelf.orient, h: shelf.h };
        }
      }
    }

    // Escolhe a altura usada com maior contagem (prefere preencher mais o vão)
    let bestH = 0;
    for (let h = 0; h <= H; h += 1) {
      if (bestCount[h] > bestCount[bestH]) bestH = h;
      else if (bestCount[h] === bestCount[bestH] && h > bestH) bestH = h;
    }

    // Reconstrói sequência de prateleiras (do fim para o início)
    const sequence: Array<{ orient: ShelfOrient; h: number }> = [];
    let cur = bestH;
    while (cur > 0 && parent[cur]) {
      const p = parent[cur]!;
      sequence.push({ orient: p.orient, h: p.h });
      cur = p.prev;
    }
    sequence.reverse();

    // Materializa placements (topo → base). Se sobrar vão no fim, tenta +1 fileira residual.
    const placements: PanelPlacement[] = [];
    const blocked: Array<{ x: number; y: number; w: number; h: number }> = [];
    let y = startY;
    let index = 0;
    for (let i = 0; i < sequence.length; i += 1) {
      if (i > 0) y += gap;
      const { orient, h: shelfH } = sequence[i];
      const { w: panelW, h: panelH } = sizes[orient];
      const row = packShelfRow({
        y,
        panelW,
        panelH,
        orientation: orient,
        startX,
        endX,
        gap,
        polygon: params.polygon,
        obstacles: params.obstacles,
        blocked,
        idPrefix: `shelf-${orient}`,
        indexStart: index,
      });
      for (const p of row) {
        placements.push(p);
        blocked.push({ x: p.x, y: p.y, w: p.width, h: p.height });
      }
      index += row.length;
      y += shelfH;
    }

    // Preenche faixa residual inferior (e laterais via scan fino) com ambas orientações
    const fillRemainder = (orient: ShelfOrient) => {
      const { w: panelW, h: panelH } = sizes[orient];
      // Alinha a fileira residual na base útil quando possível
      const bottomY = endY - panelH;
      const candidateYs = [bottomY, y + (sequence.length > 0 ? gap : 0)];
      for (const cy of candidateYs) {
        if (cy < startY - 1e-9 || cy + panelH > endY + 1e-9) continue;
        const row = packShelfRow({
          y: cy,
          panelW,
          panelH,
          orientation: orient,
          startX,
          endX,
          gap,
          polygon: params.polygon,
          obstacles: params.obstacles,
          blocked,
          idPrefix: `rem-${orient}`,
          indexStart: index,
        });
        if (row.length === 0) continue;
        for (const p of row) {
          placements.push(p);
          blocked.push({ x: p.x, y: p.y, w: p.width, h: p.height });
        }
        index += row.length;
      }
      // Scan fino no retângulo residual para nichos (obstáculos / polígono)
      const scanStart = Math.min(y, bottomY);
      const step = Math.min(panelW, panelH, 0.2);
      for (let sy = Math.max(startY, scanStart); sy + panelH <= endY + 1e-9; sy += step) {
        for (let sx = startX; sx + panelW <= endX + 1e-9; sx += step) {
          if (!rectInsidePolygon(sx, sy, panelW, panelH, params.polygon)) continue;
          if (anyObstacleHits(params.obstacles, sx, sy, panelW, panelH)) continue;
          if (overlapsAny(sx, sy, panelW, panelH, blocked)) continue;
          const p: PanelPlacement = {
            id: `scan-${orient}-${index}`,
            x: round2(sx),
            y: round2(sy),
            width: panelW,
            height: panelH,
            orientation: orient,
            rotationDeg: orient === 'landscape' ? 90 : 0,
            selectable: true,
          };
          placements.push(p);
          blocked.push({ x: p.x, y: p.y, w: p.width, h: p.height });
          index += 1;
        }
      }
    };

    fillRemainder('landscape');
    fillRemainder('portrait');

    return {
      count: placements.length,
      placements,
      edgeUsedM: edgeX,
    };
  };

  // Tentativa com a folga configurada
  let best = tryWithEdges(params.edgeMarginM, params.edgeMarginM, params.edgeMarginM);

  if (params.borrowEdgeForRemainder && params.edgeMarginM > 0) {
    const landH = panelSize(params.module, 'landscape').h;
    const portH = panelSize(params.module, 'portrait').h;
    const minShelf = Math.min(landH, portH);
    // Empresta o mínimo da folga vertical para caber +1 fileira residual
    for (const shelfH of [landH, portH, minShelf]) {
      const startY = box.minY + params.edgeMarginM;
      const endY = box.maxY - params.edgeMarginM;
      // Estima vão residual após preencher com prateleiras da outra altura
      const otherH = shelfH === landH ? portH : landH;
      const nOther = Math.floor((endY - startY + gap) / (otherH + gap));
      const used =
        nOther > 0 ? nOther * otherH + (nOther - 1) * gap : 0;
      const leftover = endY - startY - used - (nOther > 0 ? gap : 0);
      if (leftover + 1e-9 >= shelfH) continue; // já cabe sem emprestar
      const shortfall = shelfH - Math.max(0, leftover);
      if (shortfall <= 0) continue;
      // Reduz folga inferior (e superior se preciso); pode zerar as duas bordas
      let edgeBottom = params.edgeMarginM - shortfall;
      let edgeTop = params.edgeMarginM;
      if (edgeBottom < 0) {
        edgeTop = Math.max(0, edgeTop + edgeBottom);
        edgeBottom = 0;
      }
      const cand = tryWithEdges(edgeTop, edgeBottom, params.edgeMarginM);
      if (cand.count > best.count) best = cand;
    }

    // Folga zero nas bordas: máximo absoluto (borda justamente zero)
    const tight = tryWithEdges(0, 0, 0);
    if (tight.count > best.count) best = tight;
  }

  return best;
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

  // Mistura por prateleiras + preenchimento da faixa inferior (com empréstimo mínimo de borda)
  const mixed = packShelfMixed({
    ...base,
    borrowEdgeForRemainder: true,
  });

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
    label: 'Arranjo misto (preenche faixas)',
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

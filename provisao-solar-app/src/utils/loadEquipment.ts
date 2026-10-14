export type LoadPhase = 'A' | 'B' | 'C';

export type LoadEquipment = {
  id: string;
  name: string;
  powerW: number;
  quantity: number;
  hoursPerDay: number;
  phase: LoadPhase;
};

export type LoadSurveyRecord = {
  id: string;
  savedAt: string;
  clientName: string;
  clientLocation: string;
  surveyDate: string;
  supply: string;
  monoVoltage: number;
  triPair: string;
  currentAText: string;
  currentBText: string;
  currentCText: string;
  currentNeutralText: string;
  utilization: number;
  acOutput: string;
  inverterBus: number;
  busVoltage: number;
  busTouched: boolean;
  autonomyText: string;
  autonomyUnit: 'hours' | 'days';
  useDod: boolean;
  dodText: string;
  batteryModelId: string;
  efficiencyText: string;
  equipment: LoadEquipment[];
};

export const PHASE_COLORS: Record<
  LoadPhase,
  { label: string; background: string; border: string; ink: string; chip: string }
> = {
  A: {
    label: 'Fase A',
    background: '#DBEAFE',
    border: '#1D4ED8',
    ink: '#1E3A8A',
    chip: '#1D4ED8',
  },
  B: {
    label: 'Fase B',
    background: '#FFEDD5',
    border: '#C2410C',
    ink: '#9A3412',
    chip: '#EA580C',
  },
  C: {
    label: 'Fase C',
    background: '#DCFCE7',
    border: '#15803D',
    ink: '#14532D',
    chip: '#16A34A',
  },
};

export function activePhases(supply: string): LoadPhase[] {
  if (supply === 'mono') return ['A'];
  if (supply === 'biphasic') return ['A', 'B'];
  return ['A', 'B', 'C'];
}

export function phaseVoltageV(supply: string, monoVoltage: number, triPair: string): number {
  if (supply === 'mono') return monoVoltage === 220 ? 220 : 127;
  if (supply === 'triphasic' && triPair === '220_380') return 220;
  return 127;
}

export type PhaseTotal = {
  phase: LoadPhase;
  count: number;
  powerW: number;
  dailyWh: number;
};

export function phaseTotals(equipment: LoadEquipment[], phase: LoadPhase): PhaseTotal {
  const rows = equipment.filter((item) => item.phase === phase);
  return {
    phase,
    count: rows.length,
    powerW: rows.reduce((sum, item) => sum + item.powerW * item.quantity, 0),
    dailyWh: rows.reduce((sum, item) => sum + item.powerW * item.quantity * item.hoursPerDay, 0),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function positive(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function normalizeEquipment(value: unknown): LoadEquipment[] {
  if (!Array.isArray(value)) return [];
  const rows: LoadEquipment[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    const phase = record.phase === 'A' || record.phase === 'B' || record.phase === 'C' ? record.phase : null;
    const powerW = positive(record.powerW);
    const quantity = positive(record.quantity);
    const hoursRaw = typeof record.hoursPerDay === 'number' ? record.hoursPerDay : Number(record.hoursPerDay);
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (!phase || !powerW || !quantity || !name || !id) continue;
    if (!Number.isFinite(hoursRaw) || hoursRaw < 0) continue;
    rows.push({
      id,
      name,
      phase,
      powerW,
      quantity,
      hoursPerDay: Math.min(hoursRaw, 24),
    });
  }
  return rows;
}

export function normalizeLoadHistory(value: unknown): LoadSurveyRecord[] {
  if (!Array.isArray(value)) return [];
  const rows: LoadSurveyRecord[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const clientName = typeof record.clientName === 'string' ? record.clientName.trim() : '';
    const savedAt = typeof record.savedAt === 'string' ? record.savedAt : '';
    if (!id || !clientName || !savedAt) continue;
    rows.push({
      id,
      savedAt,
      clientName,
      clientLocation: typeof record.clientLocation === 'string' ? record.clientLocation : '',
      surveyDate: typeof record.surveyDate === 'string' ? record.surveyDate : '',
      supply: typeof record.supply === 'string' ? record.supply : 'biphasic',
      monoVoltage: record.monoVoltage === 220 ? 220 : 127,
      triPair: record.triPair === '220_380' ? '220_380' : '127_220',
      currentAText: typeof record.currentAText === 'string' ? record.currentAText : '',
      currentBText: typeof record.currentBText === 'string' ? record.currentBText : '',
      currentCText: typeof record.currentCText === 'string' ? record.currentCText : '',
      currentNeutralText: typeof record.currentNeutralText === 'string' ? record.currentNeutralText : '',
      utilization: typeof record.utilization === 'number' ? record.utilization : 0.8,
      acOutput: typeof record.acOutput === 'string' ? record.acOutput : 'mono220',
      inverterBus: record.inverterBus === 24 ? 24 : 48,
      busVoltage: record.busVoltage === 24 ? 24 : 48,
      busTouched: Boolean(record.busTouched),
      autonomyText: typeof record.autonomyText === 'string' ? record.autonomyText : '12',
      autonomyUnit: record.autonomyUnit === 'days' ? 'days' : 'hours',
      useDod: record.useDod !== false,
      dodText: typeof record.dodText === 'string' ? record.dodText : '80',
      batteryModelId: typeof record.batteryModelId === 'string' ? record.batteryModelId : 'li-48-100',
      efficiencyText: typeof record.efficiencyText === 'string' ? record.efficiencyText : '92',
      equipment: normalizeEquipment(record.equipment),
    });
  }
  return mergeLoadHistory(rows, []);
}

export function mergeLoadHistory(current: LoadSurveyRecord[], incoming: LoadSurveyRecord[]): LoadSurveyRecord[] {
  const byId = new Map<string, LoadSurveyRecord>();
  for (const item of [...current, ...incoming]) {
    const previous = byId.get(item.id);
    if (!previous || Date.parse(item.savedAt) >= (Date.parse(previous.savedAt) || 0)) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort((a, b) => (Date.parse(b.savedAt) || 0) - (Date.parse(a.savedAt) || 0));
}

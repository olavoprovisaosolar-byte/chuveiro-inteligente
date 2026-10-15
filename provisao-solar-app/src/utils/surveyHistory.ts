export type SurveyRecord = {
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
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function foldClientName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizeSurveyHistory(value: unknown): SurveyRecord[] {
  if (!Array.isArray(value)) return [];
  const rows: SurveyRecord[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    const id = text(record.id).trim();
    const clientName = text(record.clientName).trim();
    const savedAt = text(record.savedAt);
    if (!id || !clientName || !savedAt) continue;
    rows.push({
      id,
      savedAt,
      clientName,
      clientLocation: text(record.clientLocation),
      surveyDate: text(record.surveyDate),
      supply: text(record.supply, 'biphasic'),
      monoVoltage: record.monoVoltage === 220 ? 220 : 127,
      triPair: record.triPair === '220_380' ? '220_380' : '127_220',
      currentAText: text(record.currentAText),
      currentBText: text(record.currentBText),
      currentCText: text(record.currentCText),
      currentNeutralText: text(record.currentNeutralText),
      utilization: typeof record.utilization === 'number' ? record.utilization : 0.8,
      acOutput: text(record.acOutput, 'mono220'),
      inverterBus: record.inverterBus === 24 ? 24 : 48,
      busVoltage: record.busVoltage === 24 ? 24 : 48,
      busTouched: Boolean(record.busTouched),
      autonomyText: text(record.autonomyText, '12'),
      autonomyUnit: record.autonomyUnit === 'days' ? 'days' : 'hours',
      useDod: record.useDod !== false,
      dodText: text(record.dodText, '80'),
      batteryModelId: text(record.batteryModelId, 'li-48-100'),
      efficiencyText: text(record.efficiencyText, '92'),
    });
  }
  return mergeSurveyHistory(rows, []);
}

export function mergeSurveyHistory(current: SurveyRecord[], incoming: SurveyRecord[]): SurveyRecord[] {
  const byId = new Map<string, SurveyRecord>();
  for (const item of [...current, ...incoming]) {
    const previous = byId.get(item.id);
    if (!previous || Date.parse(item.savedAt) >= (Date.parse(previous.savedAt) || 0)) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort((a, b) => (Date.parse(b.savedAt) || 0) - (Date.parse(a.savedAt) || 0));
}

export function searchSurveys(records: SurveyRecord[], query: string): SurveyRecord[] {
  const needle = foldClientName(query);
  if (!needle) return records;
  return records.filter((item) => foldClientName(item.clientName).includes(needle));
}

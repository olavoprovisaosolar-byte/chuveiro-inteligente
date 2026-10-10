import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { SolarModule } from '../types';
import { normalizeModules } from './storage';

export const APP_BACKUP_KEY = '@solar_calculator/app_backup_v2';
export const APP_BACKUP_FILE = 'solar-calculator-backup.json';
export const APP_BACKUP_SCHEMA = 'solar-calculator.backup.v2';

export type RoofWorkspaceDraft = {
  selectedId?: string;
  quantityText: string;
  roofWidthText: string;
  roofLengthText: string;
  roofAreaText: string;
  areaManual: boolean;
  marginText: string;
  edgeMarginText: string;
  endClampText: string;
  panelGapText: string;
  corridorEnabled: boolean;
  corridorWidthText: string;
  corridorEveryText: string;
  obstacleClearanceText: string;
  shapeMode: 'rectangle' | 'polygon';
  draftVertices: Array<{ x: number; y: number }>;
  polygonClosed: boolean;
  edgeLengthTexts: string[];
  calibrateEdgeIndex: number;
  obstacles: unknown[];
};

export type OffGridDraft = {
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
  clientName: string;
  clientLocation: string;
  surveyDate: string;
};

export type CalculationDraft = {
  mode: 'monthly' | 'daily';
  input: string;
};

export type AppBackup = {
  schema: typeof APP_BACKUP_SCHEMA;
  app: 'Solar Calculator';
  savedAt: string;
  modules: SolarModule[];
  roof: RoofWorkspaceDraft | null;
  offGrid: OffGridDraft | null;
  calculation: CalculationDraft | null;
};

const listeners = new Set<() => void>();

let memory: AppBackup | null = null;
let loadingPromise: Promise<AppBackup> | null = null;

function emptyBackup(): AppBackup {
  return {
    schema: APP_BACKUP_SCHEMA,
    app: 'Solar Calculator',
    savedAt: new Date().toISOString(),
    modules: [],
    roof: null,
    offGrid: null,
    calculation: null,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseAppBackup(raw: string): AppBackup {
  const parsed = JSON.parse(raw) as Record<string, unknown> | SolarModule[];
  if (Array.isArray(parsed)) {
    return { ...emptyBackup(), modules: normalizeModules(parsed) };
  }
  const record = asRecord(parsed) ?? {};
  const modules = Array.isArray(record.modules) ? normalizeModules(record.modules) : [];
  return {
    ...emptyBackup(),
    savedAt: typeof record.savedAt === 'string' ? record.savedAt : new Date().toISOString(),
    modules,
    roof: (asRecord(record.roof) as RoofWorkspaceDraft | null) ?? null,
    offGrid: (asRecord(record.offGrid) as OffGridDraft | null) ?? null,
    calculation: (asRecord(record.calculation) as CalculationDraft | null) ?? null,
  };
}

function fileUri(): string | null {
  const base = FileSystem.documentDirectory;
  if (!base) return null;
  return `${base}${APP_BACKUP_FILE}`;
}

async function writeFile(backup: AppBackup): Promise<void> {
  const uri = fileUri();
  if (!uri) return;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

async function readFile(): Promise<AppBackup | null> {
  try {
    const uri = fileUri();
    if (!uri) return null;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return parseAppBackup(raw);
  } catch {
    return null;
  }
}

export async function loadAppBackup(): Promise<AppBackup> {
  if (memory) return memory;
  if (!loadingPromise) {
    loadingPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(APP_BACKUP_KEY);
        if (raw) {
          memory = parseAppBackup(raw);
          return memory;
        }
      } catch {
        // segue para o arquivo interno
      }
      const fromFile = await readFile();
      memory = fromFile ?? emptyBackup();
      return memory;
    })().finally(() => {
      loadingPromise = null;
    });
  }
  return loadingPromise;
}

export async function patchAppBackup(
  partial: Partial<Pick<AppBackup, 'modules' | 'roof' | 'offGrid' | 'calculation'>>,
): Promise<AppBackup> {
  const current = await loadAppBackup();
  memory = {
    ...current,
    ...partial,
    schema: APP_BACKUP_SCHEMA,
    app: 'Solar Calculator',
    savedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(APP_BACKUP_KEY, JSON.stringify(memory));
  await writeFile(memory).catch(() => undefined);
  return memory;
}

export function subscribeAppBackup(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyAppBackupImported(): void {
  listeners.forEach((listener) => listener());
}

export async function appBackupFileUri(): Promise<string> {
  const backup = await loadAppBackup();
  await writeFile(backup);
  const uri = fileUri();
  if (!uri) {
    throw new Error('Armazenamento interno indisponível neste dispositivo.');
  }
  return uri;
}

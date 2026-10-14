import AsyncStorage from '@react-native-async-storage/async-storage';
import { patchAppBackup } from './appBackup';
import { LoadSurveyRecord, mergeLoadHistory, normalizeLoadHistory } from '../utils/loadEquipment';

export const LOAD_HISTORY_KEY = '@solar_calculator/load_history_v1';

export async function loadLoadHistory(): Promise<LoadSurveyRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(LOAD_HISTORY_KEY);
    if (!raw) return [];
    return normalizeLoadHistory(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function persist(history: LoadSurveyRecord[]): Promise<LoadSurveyRecord[]> {
  const next = mergeLoadHistory(history, []);
  await AsyncStorage.setItem(LOAD_HISTORY_KEY, JSON.stringify(next));
  await patchAppBackup({ loadHistory: next }).catch(() => undefined);
  return next;
}

export async function rememberLoadSurvey(record: LoadSurveyRecord): Promise<LoadSurveyRecord[]> {
  const current = await loadLoadHistory();
  return persist(mergeLoadHistory(current, [record]));
}

export async function replaceLoadHistory(records: LoadSurveyRecord[]): Promise<LoadSurveyRecord[]> {
  const current = await loadLoadHistory();
  return persist(mergeLoadHistory(current, normalizeLoadHistory(records)));
}

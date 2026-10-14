import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { mergeLoadHistory } from '../utils/loadEquipment';
import { loadAppBackup, notifyAppBackupImported, parseAppBackup, patchAppBackup } from './appBackup';
import { mergeBackups } from './backupMerge';
import { loadLoadHistory, replaceLoadHistory } from './loadHistory';

export function driveBackupFileName(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `solar-calculator-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.json`;
}

async function readPickedText(uri: string): Promise<string> {
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error('Não foi possível ler o arquivo de backup.');
    }
    return response.text();
  }
}

export async function shareBackupToDrive(): Promise<'shared' | 'downloaded'> {
  const backup = await loadAppBackup();
  const localHistory = await loadLoadHistory();
  const payload = {
    ...backup,
    loadHistory: mergeLoadHistory(backup.loadHistory ?? [], localHistory),
    savedAt: new Date().toISOString(),
  };
  const json = JSON.stringify(payload, null, 2);
  const filename = driveBackupFileName();

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const nav = globalThis.navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
    };
    const file = typeof File === 'function' ? new File([blob], filename, { type: 'application/json' }) : null;
    if (file && nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: 'Backup Solar Calculator' });
      return 'shared';
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return 'downloaded';
  }

  const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!base) {
    throw new Error('Armazenamento indisponível neste aparelho.');
  }
  const uri = `${base}${filename}`;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Compartilhamento indisponível. O backup interno foi mantido neste aparelho.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Salvar backup no Google Drive',
    UTI: 'public.json',
  });
  return 'shared';
}

export async function restoreBackupFromDrive(): Promise<{ surveys: number }> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) {
    throw new Error('Restauração cancelada.');
  }
  const raw = await readPickedText(result.assets[0].uri);
  const backup = parseAppBackup(raw);
  const current = await loadAppBackup();
  const merged = mergeBackups(current, backup);
  const history = await replaceLoadHistory(backup.loadHistory);
  await patchAppBackup({
    modules: merged.modules,
    roof: merged.roof,
    offGrid: merged.offGrid,
    calculation: merged.calculation,
    loadHistory: history,
  });
  notifyAppBackupImported();
  return { surveys: history.length };
}

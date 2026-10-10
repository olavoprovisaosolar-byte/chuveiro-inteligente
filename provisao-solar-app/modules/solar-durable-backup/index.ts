import { requireOptionalNativeModule } from 'expo-modules-core';

type SolarDurableBackupNative = {
  requestSystemBackup: () => boolean;
  writePublicBackup: (json: string) => string;
  readPublicBackup: () => string | null;
};

const native = requireOptionalNativeModule<SolarDurableBackupNative>('SolarDurableBackup');

export function requestSystemBackup(): void {
  try {
    native?.requestSystemBackup();
  } catch {
    // Web e aparelhos sem o módulo seguem só com o backup interno.
  }
}

export async function writePublicBackup(json: string): Promise<string> {
  try {
    return native?.writePublicBackup(json) ?? 'interno';
  } catch {
    return 'interno';
  }
}

export async function readPublicBackup(): Promise<string | null> {
  try {
    const raw = native?.readPublicBackup();
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SolarModule } from '../types';

const CUSTOM_MODULES_KEY = '@solar_calculator/custom_modules';

export async function loadCustomModules(): Promise<SolarModule[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_MODULES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SolarModule[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveCustomModules(modules: SolarModule[]): Promise<void> {
  await AsyncStorage.setItem(CUSTOM_MODULES_KEY, JSON.stringify(modules));
}

export async function addCustomModule(module: SolarModule): Promise<SolarModule[]> {
  const current = await loadCustomModules();
  const next = [module, ...current];
  await saveCustomModules(next);
  return next;
}

export async function removeCustomModule(id: string): Promise<SolarModule[]> {
  const current = await loadCustomModules();
  const next = current.filter((m) => m.id !== id);
  await saveCustomModules(next);
  return next;
}

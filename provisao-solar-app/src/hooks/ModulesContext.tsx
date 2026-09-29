import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { PRESET_MODULES } from '../constants/modules';
import {
  exportModulesBackup,
  importModulesBackupFromPicker,
  restoreModulesFromLocalBackupIfNeeded,
  writeLocalModulesBackup,
} from '../services/moduleBackup';
import {
  addCustomModule,
  loadCustomModules,
  removeCustomModule,
} from '../services/storage';
import { SolarModule } from '../types';
import { computeModuleArea } from '../utils/calculations';

type ModulesContextValue = {
  loading: boolean;
  customModules: SolarModule[];
  presetModules: SolarModule[];
  allModules: SolarModule[];
  createCustom: (input: {
    manufacturer: string;
    model: string;
    powerWp: number;
    widthM: number;
    lengthM: number;
  }) => Promise<SolarModule>;
  removeCustom: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  exportBackup: () => Promise<void>;
  importBackup: () => Promise<{ count: number }>;
};

const ModulesContext = createContext<ModulesContextValue | undefined>(undefined);

export function ModulesProvider({ children }: { children: React.ReactNode }) {
  const [customModules, setCustomModules] = useState<SolarModule[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      let stored = await loadCustomModules();
      if (stored.length === 0) {
        stored = await restoreModulesFromLocalBackupIfNeeded();
      } else {
        await writeLocalModulesBackup(stored).catch(() => undefined);
      }
      setCustomModules(stored);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const allModules = useMemo(
    () => [...customModules, ...PRESET_MODULES],
    [customModules],
  );

  const createCustom = useCallback(
    async (input: {
      manufacturer: string;
      model: string;
      powerWp: number;
      widthM: number;
      lengthM: number;
    }) => {
      const module: SolarModule = {
        id: `custom-${Date.now()}`,
        manufacturer: input.manufacturer.trim() || 'Customizado',
        model: input.model.trim() || `${input.powerWp} Wp`,
        powerWp: input.powerWp,
        widthM: input.widthM,
        lengthM: input.lengthM,
        areaM2: computeModuleArea(input.lengthM, input.widthM),
        isCustom: true,
      };
      const next = await addCustomModule(module);
      setCustomModules(next);
      await writeLocalModulesBackup(next).catch(() => undefined);
      return module;
    },
    [],
  );

  const removeCustom = useCallback(async (id: string) => {
    const next = await removeCustomModule(id);
    setCustomModules(next);
    await writeLocalModulesBackup(next).catch(() => undefined);
  }, []);

  const exportBackup = useCallback(async () => {
    const current = customModules.length > 0 ? customModules : await loadCustomModules();
    await exportModulesBackup(current);
  }, [customModules]);

  const importBackup = useCallback(async () => {
    const result = await importModulesBackupFromPicker();
    setCustomModules(result.modules);
    return { count: result.modules.length };
  }, []);

  const value = useMemo<ModulesContextValue>(
    () => ({
      loading,
      customModules,
      presetModules: PRESET_MODULES,
      allModules,
      createCustom,
      removeCustom,
      refresh,
      exportBackup,
      importBackup,
    }),
    [
      loading,
      customModules,
      allModules,
      createCustom,
      removeCustom,
      refresh,
      exportBackup,
      importBackup,
    ],
  );

  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}

export function useModules() {
  const ctx = useContext(ModulesContext);
  if (!ctx) {
    throw new Error('useModules must be used within ModulesProvider');
  }
  return ctx;
}

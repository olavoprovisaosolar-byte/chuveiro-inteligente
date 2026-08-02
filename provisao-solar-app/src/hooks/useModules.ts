import { useCallback, useEffect, useMemo, useState } from 'react';
import { PRESET_MODULES } from '../constants/modules';
import { addCustomModule, loadCustomModules, removeCustomModule } from '../services/storage';
import { SolarModule } from '../types';
import { computeModuleArea } from '../utils/calculations';

export function useModules() {
  const [customModules, setCustomModules] = useState<SolarModule[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const stored = await loadCustomModules();
    setCustomModules(stored);
    setLoading(false);
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
      return module;
    },
    [],
  );

  const removeCustom = useCallback(async (id: string) => {
    const next = await removeCustomModule(id);
    setCustomModules(next);
  }, []);

  return {
    loading,
    customModules,
    presetModules: PRESET_MODULES,
    allModules,
    createCustom,
    removeCustom,
    refresh,
  };
}

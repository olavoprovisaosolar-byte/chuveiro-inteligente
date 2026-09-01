import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { HelpCard } from '../components/HelpCard';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { ResultCard } from '../components/ResultCard';
import { ScreenContainer } from '../components/ScreenContainer';
import { INVERTER_FDI_MAX, INVERTER_FDI_MIN } from '../constants/modules';
import { useModules } from '../hooks/useModules';
import { useTheme } from '../theme/ThemeContext';
import {
  formatNumber,
  parseLocaleNumber,
  suggestInverterRange,
} from '../utils/calculations';

export function ModulosScreen() {
  const { colors } = useTheme();
  const {
    allModules,
    customModules,
    createCustom,
    removeCustom,
    exportBackup,
    importBackup,
  } = useModules();
  const [selectedId, setSelectedId] = useState<string>(allModules[0]?.id ?? '');
  const [quantityText, setQuantityText] = useState('10');
  const [backupBusy, setBackupBusy] = useState(false);

  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [powerText, setPowerText] = useState('');
  const [widthText, setWidthText] = useState('');
  const [lengthText, setLengthText] = useState('');
  const [formError, setFormError] = useState<string | undefined>();

  const selected = useMemo(
    () => allModules.find((m) => m.id === selectedId) ?? allModules[0],
    [allModules, selectedId],
  );

  const quantity = parseLocaleNumber(quantityText);
  const validQty = Number.isFinite(quantity) && quantity > 0;

  const sizing = useMemo(() => {
    if (!selected || !validQty) return null;
    const totalWp = quantity * selected.powerWp;
    const totalKwp = totalWp / 1000;
    const totalArea = quantity * selected.areaM2;
    const inverter = suggestInverterRange(totalKwp);
    return { totalWp, totalKwp, totalArea, inverter };
  }, [selected, quantity, validQty]);

  const autoArea = useMemo(() => {
    const w = parseLocaleNumber(widthText);
    const l = parseLocaleNumber(lengthText);
    if (!Number.isFinite(w) || !Number.isFinite(l) || w <= 0 || l <= 0) return null;
    return w * l;
  }, [widthText, lengthText]);

  const onSaveCustom = async () => {
    const powerWp = parseLocaleNumber(powerText);
    const widthM = parseLocaleNumber(widthText);
    const lengthM = parseLocaleNumber(lengthText);

    if (!Number.isFinite(powerWp) || powerWp <= 0) {
      setFormError('Informe a potência em Wp.');
      return;
    }
    if (!Number.isFinite(widthM) || widthM <= 0 || !Number.isFinite(lengthM) || lengthM <= 0) {
      setFormError('Informe largura e comprimento válidos (metros).');
      return;
    }

    setFormError(undefined);
    const created = await createCustom({
      manufacturer,
      model,
      powerWp,
      widthM,
      lengthM,
    });
    setSelectedId(created.id);
    setManufacturer('');
    setModel('');
    setPowerText('');
    setWidthText('');
    setLengthText('');
    Alert.alert(
      'Placa salva',
      'A placa ficou disponível na aba Cálculo, Telhado e Módulos. Faça um backup para não perder em reinstalação.',
    );
  };

  const onExportBackup = async () => {
    setBackupBusy(true);
    try {
      await exportBackup();
      Alert.alert(
        'Backup pronto',
        'Escolha Pasta Download, Drive ou outro local para guardar o arquivo JSON das placas cadastradas.',
      );
    } catch (error) {
      Alert.alert(
        'Falha no backup',
        error instanceof Error ? error.message : 'Não foi possível exportar o backup.',
      );
    } finally {
      setBackupBusy(false);
    }
  };

  const onImportBackup = async () => {
    setBackupBusy(true);
    try {
      const result = await importBackup();
      Alert.alert(
        'Backup restaurado',
        `${result.count} placa(s) customizada(s) disponíveis em Cálculo, Telhado e Módulos.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível importar.';
      if (message !== 'Importação cancelada.') {
        Alert.alert('Falha na restauração', message);
      }
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <ScreenContainer
      title="Módulos & Inversor"
      subtitle="Cadastre placas aqui: elas entram no Cálculo e no Telhado automaticamente."
    >
      <Text style={[styles.section, { color: colors.text }]}>Catálogo de módulos</Text>
      <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
        Customizadas aparecem primeiro. Toque para selecionar · segure para remover customizadas.
      </Text>
      <View style={styles.list}>
        {allModules.map((module) => {
          const selectedModule = module.id === selected?.id;
          return (
            <Pressable
              key={module.id}
              onPress={() => setSelectedId(module.id)}
              onLongPress={() => {
                if (!module.isCustom) return;
                Alert.alert('Remover módulo', `Excluir ${module.model}?`, [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Remover',
                    style: 'destructive',
                    onPress: () => removeCustom(module.id),
                  },
                ]);
              }}
              style={[
                styles.moduleCard,
                {
                  backgroundColor: selectedModule ? colors.primarySoft : colors.surface,
                  borderColor: selectedModule ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={styles.moduleTop}>
                <Text style={[styles.moduleTitle, { color: colors.text }]}>
                  {module.powerWp} Wp · {module.model}
                </Text>
                {module.isCustom ? (
                  <Text style={[styles.badge, { color: colors.accent }]}>Custom</Text>
                ) : null}
              </View>
              <Text style={[styles.moduleMeta, { color: colors.textSecondary }]}>
                {module.manufacturer} · {formatNumber(module.lengthM)} ×{' '}
                {formatNumber(module.widthM)} m · {formatNumber(module.areaM2)} m²
              </Text>
            </Pressable>
          );
        })}
      </View>

      <InputField
        label="Quantidade de placas"
        value={quantityText}
        onChangeText={setQuantityText}
        keyboardType="number-pad"
        placeholder="Ex: 12"
      />

      {sizing && selected ? (
        <ResultCard
          title="Resumo do arranjo"
          rows={[
            {
              label: 'Módulo',
              value: `${selected.powerWp} Wp (${formatNumber(selected.areaM2)} m²)`,
            },
            {
              label: 'Potência total',
              value: `${formatNumber(sizing.totalKwp)} kWp`,
              emphasize: true,
            },
            {
              label: 'Área bruta das placas',
              value: `${formatNumber(sizing.totalArea)} m²`,
            },
            {
              label: `Inversor sugerido (FDI ${INVERTER_FDI_MIN}–${INVERTER_FDI_MAX})`,
              value: `${formatNumber(sizing.inverter.inverterMinKw)} – ${formatNumber(sizing.inverter.inverterMaxKw)} kW`,
            },
          ]}
        />
      ) : null}

      <HelpCard
        title="Fator de Dimensionamento do Inversor (FDI)"
        body="O overboarding considera FDI entre 1,15 e 1,30. A faixa sugerida do inversor é Potência do Sistema (kWp) ÷ 1,30 até Potência do Sistema (kWp) ÷ 1,15."
      />

      <Text style={[styles.section, { color: colors.text }]}>Cadastrar placa customizada</Text>
      <InputField
        label="Fabricante"
        value={manufacturer}
        onChangeText={setManufacturer}
        placeholder="Ex: Canadian Solar"
      />
      <InputField
        label="Modelo / Potência (Wp)"
        value={model}
        onChangeText={setModel}
        placeholder="Ex: HiKu6 550"
      />
      <InputField
        label="Potência (Wp)"
        value={powerText}
        onChangeText={setPowerText}
        keyboardType="decimal-pad"
        placeholder="Ex: 550"
      />
      <InputField
        label="Largura (m)"
        value={widthText}
        onChangeText={setWidthText}
        keyboardType="decimal-pad"
        placeholder="Ex: 1.13"
      />
      <InputField
        label="Comprimento (m)"
        value={lengthText}
        onChangeText={setLengthText}
        keyboardType="decimal-pad"
        placeholder="Ex: 2.27"
        hint={
          autoArea
            ? `Área unitária automática: ${formatNumber(autoArea)} m²`
            : 'Área (m²) = Comprimento × Largura'
        }
        error={formError}
      />
      <PrimaryButton label="Salvar módulo localmente" onPress={onSaveCustom} style={styles.cta} />

      <Text style={[styles.section, { color: colors.text }]}>Backup das placas cadastradas</Text>
      <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
        Atualizar o app mantém as placas. Em reinstalação, restaure pelo arquivo JSON de backup
        (Download/Drive). Também há cópia automática interna.
      </Text>
      <Text style={[styles.backupCount, { color: colors.text }]}>
        Customizadas salvas: {customModules.length}
      </Text>
      <PrimaryButton
        label="Exportar backup (JSON)"
        onPress={onExportBackup}
        loading={backupBusy}
        style={styles.cta}
      />
      <PrimaryButton
        label="Restaurar backup"
        onPress={onImportBackup}
        loading={backupBusy}
        variant="secondary"
        style={styles.cta}
      />
      {customModules.length > 0 ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Toque e segure um módulo customizado para removê-lo.
        </Text>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  list: { gap: 10, marginBottom: 16 },
  moduleCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  moduleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  },
  moduleTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    flex: 1,
  },
  badge: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
  },
  moduleMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 6,
  },
  cta: { marginBottom: 10 },
  backupCount: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    marginBottom: 10,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    marginBottom: 20,
  },
});

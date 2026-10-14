import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { formatNumber, parseLocaleNumber } from '../utils/calculations';
import {
  activePhases,
  LoadEquipment,
  LoadPhase,
  PHASE_COLORS,
  phaseTotals,
  phaseVoltageV,
} from '../utils/loadEquipment';
import { InputField } from './InputField';
import { PrimaryButton } from './PrimaryButton';

type Props = {
  supply: string;
  monoVoltage: number;
  triPair: string;
  currentA: number;
  currentB: number;
  currentC: number;
  equipment: LoadEquipment[];
  onChange: (equipment: LoadEquipment[]) => void;
};

function newEquipmentId(): string {
  return `eq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PhaseLoadBoard({
  supply,
  monoVoltage,
  triPair,
  currentA,
  currentB,
  currentC,
  equipment,
  onChange,
}: Props) {
  const { colors } = useTheme();
  const phases = activePhases(supply);
  const extra = (['A', 'B', 'C'] as LoadPhase[]).filter(
    (phase) => !phases.includes(phase) && equipment.some((item) => item.phase === phase),
  );
  const shown = [...phases, ...extra];
  const [name, setName] = useState('');
  const [powerText, setPowerText] = useState('');
  const [qtyText, setQtyText] = useState('1');
  const [hoursText, setHoursText] = useState('');
  const [phase, setPhase] = useState<LoadPhase>(phases[0] ?? 'A');
  const [error, setError] = useState('');
  const selectedPhase = phases.includes(phase) ? phase : (phases[0] ?? 'A');
  const voltage = phaseVoltageV(supply, monoVoltage, triPair);
  const currents: Record<LoadPhase, number> = { A: currentA, B: currentB, C: currentC };
  const totals = shown.map((item) => phaseTotals(equipment, item));
  const positive = totals.filter((item) => item.powerW > 0);
  const maxPower = positive.reduce((max, item) => Math.max(max, item.powerW), 0);
  const leaders = positive.filter((item) => item.powerW === maxPower);

  function addEquipment() {
    const powerW = parseLocaleNumber(powerText);
    const quantity = parseLocaleNumber(qtyText);
    const hoursPerDay = hoursText.trim() === '' ? NaN : parseLocaleNumber(hoursText);
    if (!name.trim()) {
      setError('Informe o nome do equipamento.');
      return;
    }
    if (!Number.isFinite(powerW) || powerW <= 0) {
      setError('Informe a potência em watts.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Informe a quantidade.');
      return;
    }
    if (!Number.isFinite(hoursPerDay) || hoursPerDay < 0 || hoursPerDay > 24) {
      setError('Informe as horas de uso por dia, de 0 a 24.');
      return;
    }
    onChange([
      ...equipment,
      {
        id: newEquipmentId(),
        name: name.trim(),
        powerW,
        quantity,
        hoursPerDay,
        phase: selectedPhase,
      },
    ]);
    setName('');
    setPowerText('');
    setQtyText('1');
    setHoursText('');
    setError('');
  }

  return (
    <View>
      {positive.length > 1 && leaders.length === 1 ? (
        <Text style={[styles.balance, { color: colors.text }]}>
          {PHASE_COLORS[leaders[0].phase].label} está com mais potência: {formatNumber(leaders[0].powerW)} W.
        </Text>
      ) : null}
      {positive.length > 1 && leaders.length > 1 ? (
        <Text style={[styles.balance, { color: colors.text }]}>
          {leaders.map((item) => PHASE_COLORS[item.phase].label).join(' e ')} estão equilibradas em{' '}
          {formatNumber(maxPower)} W.
        </Text>
      ) : null}
      {shown.map((item) => {
        const palette = PHASE_COLORS[item];
        const total = phaseTotals(equipment, item);
        const rows = equipment.filter((entry) => entry.phase === item);
        const amps = currents[item];
        const outside = !phases.includes(item);
        return (
          <View
            key={item}
            accessibilityLabel={palette.label}
            style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}
          >
            <View style={styles.cardHead}>
              <Text style={[styles.phaseTitle, { color: palette.ink }]}>{palette.label}</Text>
              <Text style={[styles.countChip, { backgroundColor: palette.chip }]}>
                {total.count} {total.count === 1 ? 'equipamento' : 'equipamentos'}
              </Text>
            </View>
            <Text style={[styles.power, { color: palette.ink }]}>{formatNumber(total.powerW)} W</Text>
            <Text style={[styles.energy, { color: palette.ink }]}>
              {formatNumber(total.dailyWh / 1000)} kWh/dia
            </Text>
            <Text style={[styles.clamp, { color: palette.ink }]}>
              Alicate: {formatNumber(amps, 1)} A · {formatNumber((amps * voltage) / 1000)} kW
            </Text>
            {outside ? (
              <Text style={[styles.outside, { color: palette.ink }]}>
                Esta fase não faz parte do padrão selecionado. O equipamento continua salvo.
              </Text>
            ) : null}
            {rows.map((row) => (
              <View key={row.id} style={styles.item}>
                <Text style={styles.itemName}>{row.name}</Text>
                <Text style={styles.itemMeta}>
                  {formatNumber(row.powerW)} W × {formatNumber(row.quantity)} · {formatNumber(row.hoursPerDay)} h/dia
                  {' · '}
                  {formatNumber(row.powerW * row.quantity)} W
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${row.name}`}
                  onPress={() => onChange(equipment.filter((entry) => entry.id !== row.id))}
                >
                  <Text style={[styles.remove, { color: palette.chip }]}>Remover</Text>
                </Pressable>
              </View>
            ))}
            {rows.length === 0 ? (
              <Text style={[styles.empty, { color: palette.ink }]}>Nenhum equipamento nesta fase.</Text>
            ) : null}
          </View>
        );
      })}

      <Text style={[styles.formTitle, { color: colors.text }]}>Novo equipamento</Text>
      <InputField
        label="Equipamento"
        value={name}
        onChangeText={setName}
        placeholder="Ex.: Chuveiro"
        autoCapitalize="sentences"
      />
      <View style={styles.pair}>
        <View style={styles.pairItem}>
          <InputField
            label="Potência (W)"
            value={powerText}
            onChangeText={setPowerText}
            keyboardType="decimal-pad"
            placeholder="1000"
          />
        </View>
        <View style={styles.pairItem}>
          <InputField
            label="Quantidade"
            value={qtyText}
            onChangeText={setQtyText}
            keyboardType="decimal-pad"
            placeholder="1"
          />
        </View>
      </View>
      <InputField
        label="Horas de uso por dia"
        value={hoursText}
        onChangeText={setHoursText}
        keyboardType="decimal-pad"
        placeholder="4"
        hint="De 0 a 24 horas."
      />
      <Text style={[styles.formTitle, { color: colors.text }]}>Fase do equipamento</Text>
      <View style={styles.chips}>
        {phases.map((item) => {
          const palette = PHASE_COLORS[item];
          const selected = item === selectedPhase;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={palette.label}
              onPress={() => setPhase(item)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? palette.chip : palette.background,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text style={[styles.chipLabel, { color: selected ? '#FFFFFF' : palette.ink }]}>
                {palette.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton label="Adicionar equipamento" onPress={addEquipment} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  balance: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  card: {
    borderWidth: 3,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  phaseTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    lineHeight: 28,
  },
  countChip: {
    overflow: 'hidden',
    color: '#FFFFFF',
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  power: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 28,
    lineHeight: 34,
    marginTop: 8,
  },
  energy: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    lineHeight: 22,
  },
  clamp: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  outside: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  item: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  itemName: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: '#111827',
  },
  itemMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#374151',
    marginTop: 2,
  },
  remove: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    marginTop: 6,
  },
  empty: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 10,
  },
  formTitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 4,
  },
  pair: {
    flexDirection: 'row',
    gap: 12,
  },
  pairItem: { flex: 1 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipLabel: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
  },
  error: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: '#B91C1C',
    marginBottom: 8,
  },
});

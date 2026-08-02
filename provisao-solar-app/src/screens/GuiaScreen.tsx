import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HelpCard } from '../components/HelpCard';
import { ScreenContainer } from '../components/ScreenContainer';
import { FACTOR_333_EXPLANATION } from '../constants/modules';
import { useTheme } from '../theme/ThemeContext';

const TERMS = [
  {
    term: 'kWh',
    definition:
      'Quilowatt-hora: unidade de energia consumida ou gerada. É o valor que aparece na fatura de energia.',
  },
  {
    term: 'kWp',
    definition:
      'Quilowatt-pico: potência nominal do sistema fotovoltaico sob condições padrão de teste (STC).',
  },
  {
    term: 'Módulo / Placa',
    definition:
      'Unidade geradora fotovoltaica. Neste app, cada módulo possui potência (Wp), dimensões e área unitária.',
  },
  {
    term: 'Inversor',
    definition:
      'Equipamento que converte a corrente contínua (CC) dos módulos em corrente alternada (CA) para a rede.',
  },
  {
    term: 'FDI / Overboarding',
    definition:
      'Fator de Dimensionamento do Inversor. Relação entre a potência dos módulos e a potência do inversor. Faixa usada: 1,15 a 1,30.',
  },
  {
    term: 'Área bruta',
    definition: 'Soma das áreas unitárias dos módulos, sem margem de circulação ou sombreamento.',
  },
  {
    term: 'Área útil / margem',
    definition:
      'Área do telhado após descontar margem de segurança (obstáculos, bordas, manutenção). Padrão: 10%.',
  },
];

const FORMULAS = [
  {
    title: 'Consumo mensal → potência',
    body: 'Consumo Diário (kWh/dia) = Consumo Mensal / 30\nPotência (kWp) = Consumo Mensal / 100',
  },
  {
    title: 'Consumo diário → potência',
    body: 'Consumo Mensal (kWh/mês) = Consumo Diário × 30\nPotência (kWp) = Consumo Diário / 3,33',
  },
  {
    title: 'Sugestão de inversor',
    body: 'Inversor mín. (kW) = Potência kWp / 1,30\nInversor máx. (kW) = Potência kWp / 1,15',
  },
  {
    title: 'Área — sistema para telhado',
    body: 'Área Bruta = Qtd × Área Unitária\nÁrea Recomendada = Área Bruta × (1 + margem)',
  },
  {
    title: 'Área — telhado para placas',
    body: 'Área Útil = Área Telhado × (1 − margem)\nQtd Máx. = piso(Área Útil / Área Unitária)\nPotência Máx. (kWp) = (Qtd × Wp) / 1000\nGeração Mensal ≈ Potência Máx. × 100 kWh/mês',
  },
];

export function GuiaScreen() {
  const { colors } = useTheme();

  return (
    <ScreenContainer
      title="Guia & Dicionário"
      subtitle="Explicações das fórmulas, do fator 3,33 e dos termos técnicos usados no app."
    >
      <HelpCard title="Fator 3,33 — explicação completa" body={FACTOR_333_EXPLANATION} initiallyOpen />

      <Text style={[styles.section, { color: colors.text }]}>Fórmulas do app</Text>
      {FORMULAS.map((item) => (
        <View
          key={item.title}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.formula, { color: colors.textSecondary }]}>{item.body}</Text>
        </View>
      ))}

      <Text style={[styles.section, { color: colors.text }]}>Dicionário técnico</Text>
      {TERMS.map((item) => (
        <View
          key={item.term}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.accent }]}>{item.term}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{item.definition}</Text>
        </View>
      ))}

      <View
        style={[
          styles.note,
          { backgroundColor: colors.primarySoft, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.noteTitle, { color: colors.text }]}>Aviso técnico</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Os cálculos deste aplicativo são estimativas rápidas para pré-dimensionamento. Irradiação
          local, orientação, inclinação, sombreamento, perdas e normas locais devem ser validados
          por um profissional habilitado antes da instalação.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    marginBottom: 12,
    marginTop: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    marginBottom: 8,
  },
  formula: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  body: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
  },
  note: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    marginBottom: 20,
  },
  noteTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    marginBottom: 6,
  },
});

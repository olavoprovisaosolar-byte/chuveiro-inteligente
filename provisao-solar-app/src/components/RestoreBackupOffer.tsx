import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import appJson from '../../app.json';
import {
  applyBackupJson,
  CloudBackupFile,
  listCloudBackups,
  pickLocalBackup,
  readCloudBackup,
} from '../services/driveSync';
import { useTheme } from '../theme/ThemeContext';
import { ActionDialog } from './ActionDialog';

const PROMPT_KEY = '@solar_calculator/restore_prompt_version';
const APP_VERSION = appJson.expo.version;

export function RestoreBackupOffer() {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [files, setFiles] = useState<CloudBackupFile[]>([]);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const seen = await AsyncStorage.getItem(PROMPT_KEY);
      if (cancelled) return;
      if (seen !== APP_VERSION) setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function dismiss() {
    await AsyncStorage.setItem(PROMPT_KEY, APP_VERSION);
    setVisible(false);
    setFiles([]);
  }

  async function finish(raw: string) {
    const restored = await applyBackupJson(raw);
    setNotice(`Backup restaurado. ${restored.surveys} cliente(s) no histórico.`);
    await dismiss();
  }

  async function fromCloud() {
    try {
      const found = await listCloudBackups();
      if (found.length === 0) {
        setNotice('Nenhum backup encontrado na pasta do Google Drive.');
        return;
      }
      if (found.length === 1) {
        await finish(await readCloudBackup(found[0]));
        return;
      }
      setFiles(found);
      setVisible(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível buscar o backup na nuvem.';
      if (message !== 'Vinculação cancelada.') setNotice(message);
    }
  }

  async function fromLocal() {
    try {
      await finish(await pickLocalBackup());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível ler o arquivo local.';
      if (message !== 'Restauração cancelada.') setNotice(message);
    }
  }

  return (
    <>
      <ActionDialog
        visible={visible}
        title="Restaurar Backup"
        message="Este aplicativo está em uma versão nova ou ainda sem cadastros. Deseja restaurar um backup da nuvem (Google Drive) ou de um arquivo local?"
        primary={{ label: 'Nuvem (Google Drive)', onPress: () => void fromCloud() }}
        secondary={{ label: 'Arquivo local', onPress: () => void fromLocal() }}
        tertiary={{ label: 'Agora não', onPress: () => void dismiss() }}
      />
      <Modal visible={files.length > 0} transparent animationType="fade" onRequestClose={() => void dismiss()}>
        <View style={styles.backdrop}>
          <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Escolha o backup na nuvem</Text>
            {files.map((file) => (
              <Pressable
                key={file.id}
                accessibilityRole="button"
                onPress={() => void readCloudBackup(file).then(finish)}
                style={[styles.file, { borderColor: colors.border }]}
              >
                <Text style={[styles.fileLabel, { color: colors.text }]}>{file.label}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={() => void dismiss()}>
              <Text style={[styles.cancel, { color: colors.primary }]}>Agora não</Text>
            </Pressable>
            {notice ? <Text style={[styles.notice, { color: colors.text }]}>{notice}</Text> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  list: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    marginBottom: 8,
  },
  file: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  fileLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
  },
  cancel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  notice: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    marginTop: 8,
  },
});

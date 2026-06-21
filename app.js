/**
 * Chuveiro Elétrico Inteligente - App Mobile
 * Comunicação via MQTT (WebSocket) com ESP32
 */

(function () {
  'use strict';

  // ===== Configuração MQTT =====
  const TOPICS = {
    status: (id) => `chuveiro/${id}/status`,
    command: (id) => `chuveiro/${id}/command`,
    telemetry: (id) => `chuveiro/${id}/telemetry`,
    alert: (id) => `chuveiro/${id}/alert`,
  };

  const STORAGE_KEYS = {
    onboarding: 'chuveiro_onboarding_done',
    settings: 'chuveiro_settings',
  };

  // ===== Estado da Aplicação =====
  const state = {
    connected: false,
    simulation: true,
    mqttClient: null,
    deviceId: 'chuveiro_01',
    power: false,
    powerLevel: 50,
    autoTempEnabled: false,
    tempLimit: 30,
    protectionActive: false,
    protectionReason: '',
    telemetry: {
      resistance: 0,
      current: 0,
      leakage: 0,
      temperature: 0,
    },
  };

  let simulationInterval = null;

  // ===== Referências DOM =====
  const $ = (sel) => document.querySelector(sel);

  const dom = {
    onboardingModal: $('#onboardingModal'),
    dontShowAgain: $('#dontShowAgain'),
    btnCloseOnboarding: $('#btnCloseOnboarding'),
    btnHelp: $('#btnHelp'),
    connectionStatus: $('#connectionStatus'),
    protectionAlert: $('#protectionAlert'),
    protectionReason: $('#protectionReason'),
    btnResetProtection: $('#btnResetProtection'),
    btnPower: $('#btnPower'),
    powerLabel: $('#powerLabel'),
    powerSlider: $('#powerSlider'),
    powerValue: $('#powerValue'),
    gaugeFill: $('#gaugeFill'),
    gaugeValue: $('#gaugeValue'),
    liveIndicator: $('#liveIndicator'),
    metricResistance: $('#metricResistance'),
    metricCurrent: $('#metricCurrent'),
    metricLeakage: $('#metricLeakage'),
    metricTemp: $('#metricTemp'),
    statusResistance: $('#statusResistance'),
    statusCurrent: $('#statusCurrent'),
    statusLeakage: $('#statusLeakage'),
    statusTemp: $('#statusTemp'),
    autoTempEnabled: $('#autoTempEnabled'),
    tempControl: $('#tempControl'),
    tempLimit: $('#tempLimit'),
    tempSlider: $('#tempSlider'),
    btnTempDown: $('#btnTempDown'),
    btnTempUp: $('#btnTempUp'),
    mqttBroker: $('#mqttBroker'),
    mqttPort: $('#mqttPort'),
    deviceId: $('#deviceId'),
    simulationMode: $('#simulationMode'),
    btnConnect: $('#btnConnect'),
  };

  // ===== Utilitários =====
  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.settings);
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.broker) dom.mqttBroker.value = settings.broker;
        if (settings.port) dom.mqttPort.value = settings.port;
        if (settings.deviceId) {
          dom.deviceId.value = settings.deviceId;
          state.deviceId = settings.deviceId;
        }
        if (settings.simulation !== undefined) {
          dom.simulationMode.checked = settings.simulation;
          state.simulation = settings.simulation;
        }
        if (settings.powerLevel !== undefined) {
          state.powerLevel = settings.powerLevel;
          dom.powerSlider.value = settings.powerLevel;
        }
        if (settings.autoTempEnabled !== undefined) {
          state.autoTempEnabled = settings.autoTempEnabled;
          dom.autoTempEnabled.checked = settings.autoTempEnabled;
        }
        if (settings.tempLimit !== undefined) {
          state.tempLimit = settings.tempLimit;
          dom.tempLimit.value = settings.tempLimit;
          dom.tempSlider.value = settings.tempLimit;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar configurações:', e);
    }
  }

  function saveSettings() {
    const settings = {
      broker: dom.mqttBroker.value,
      port: parseInt(dom.mqttPort.value, 10),
      deviceId: dom.deviceId.value,
      simulation: dom.simulationMode.checked,
      powerLevel: state.powerLevel,
      autoTempEnabled: state.autoTempEnabled,
      tempLimit: state.tempLimit,
    };
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }

  function setConnectionStatus(text, type) {
    dom.connectionStatus.textContent = text;
    dom.connectionStatus.className = 'header__status';
    if (type === 'connected') dom.connectionStatus.classList.add('header__status--connected');
    if (type === 'disconnected') dom.connectionStatus.classList.add('header__status--disconnected');
  }

  function updateGauge(value) {
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (value / 100) * circumference;
    dom.gaugeFill.style.strokeDashoffset = offset;

    if (value < 33) dom.gaugeFill.style.stroke = '#22c55e';
    else if (value < 66) dom.gaugeFill.style.stroke = '#3b82f6';
    else dom.gaugeFill.style.stroke = '#f97316';

    dom.gaugeValue.textContent = value;
    dom.powerValue.textContent = `${value}%`;
  }

  function setMetricStatus(el, status, text) {
    el.className = 'metric__status';
    el.classList.add(`metric__status--${status}`);
    el.textContent = text;
  }

  function updateTelemetryUI(data) {
    const t = { ...state.telemetry, ...data };
    state.telemetry = t;

    dom.metricResistance.textContent = `${t.resistance.toFixed(1)} Ω`;
    dom.metricCurrent.textContent = `${t.current.toFixed(2)} A`;
    dom.metricLeakage.textContent = `${t.leakage.toFixed(1)} mA`;
    dom.metricTemp.textContent = `${t.temperature.toFixed(1)} °C`;

    // Status da resistência (baseado na potência)
    if (state.power) {
      const expectedR = 22 - (state.powerLevel / 100) * 10;
      const diff = Math.abs(t.resistance - expectedR);
      if (diff < 2) setMetricStatus(dom.statusResistance, 'ok', 'Normal');
      else if (diff < 5) setMetricStatus(dom.statusResistance, 'warn', 'Atenção');
      else setMetricStatus(dom.statusResistance, 'danger', 'Anormal');
    } else {
      setMetricStatus(dom.statusResistance, 'ok', 'Desligada');
    }

    // Status da corrente (limite seguro: 30A)
    if (t.current > 28) setMetricStatus(dom.statusCurrent, 'danger', 'Sobrecarga');
    else if (t.current > 22) setMetricStatus(dom.statusCurrent, 'warn', 'Alta');
    else setMetricStatus(dom.statusCurrent, 'ok', 'Normal');

    // Status da fuga (limite: 30mA)
    if (t.leakage > 30) setMetricStatus(dom.statusLeakage, 'danger', 'Fuga!');
    else if (t.leakage > 15) setMetricStatus(dom.statusLeakage, 'warn', 'Atenção');
    else setMetricStatus(dom.statusLeakage, 'ok', 'Normal');

    // Status da temperatura
    if (state.autoTempEnabled && t.temperature >= state.tempLimit) {
      setMetricStatus(dom.statusTemp, 'warn', 'Limite');
    } else if (t.temperature > 45) {
      setMetricStatus(dom.statusTemp, 'danger', 'Alta');
    } else {
      setMetricStatus(dom.statusTemp, 'ok', 'Normal');
    }
  }

  function updatePowerUI() {
    dom.btnPower.setAttribute('aria-pressed', state.power.toString());
    dom.powerLabel.textContent = state.power ? 'LIGADO' : 'DESLIGADO';
    dom.btnPower.disabled = state.protectionActive;
    dom.powerSlider.disabled = !state.power || state.protectionActive;
  }

  function showProtectionAlert(reason) {
    state.protectionActive = true;
    state.protectionReason = reason;
    state.power = false;
    dom.protectionAlert.classList.remove('alert-banner--hidden');
    dom.protectionReason.textContent = reason;
    updatePowerUI();
    sendCommand({ power: false });
  }

  function hideProtectionAlert() {
    state.protectionActive = false;
    state.protectionReason = '';
    dom.protectionAlert.classList.add('alert-banner--hidden');
    updatePowerUI();
    sendCommand({ reset_protection: true });
  }

  function updateTempControlUI() {
    if (state.autoTempEnabled) {
      dom.tempControl.classList.add('temp-control--active');
    } else {
      dom.tempControl.classList.remove('temp-control--active');
    }
  }

  // ===== Comunicação MQTT =====
  function publishCommand(payload) {
    if (state.simulation) return;

    const topic = TOPICS.command(state.deviceId);
    const message = JSON.stringify(payload);

    if (state.mqttClient && state.mqttClient.connected) {
      state.mqttClient.publish(topic, message, { qos: 1 });
    }
  }

  function sendCommand(overrides = {}) {
    const payload = {
      power: state.power,
      power_level: state.powerLevel,
      auto_temp_enabled: state.autoTempEnabled,
      temp_limit: state.tempLimit,
      ...overrides,
    };

    publishCommand(payload);
    saveSettings();
  }

  function handleTelemetryMessage(message) {
    try {
      const data = JSON.parse(message.toString());

      updateTelemetryUI({
        resistance: parseFloat(data.resistance) || 0,
        current: parseFloat(data.current) || 0,
        leakage: parseFloat(data.leakage) || 0,
        temperature: parseFloat(data.temperature) || 0,
      });

      if (data.power !== undefined) {
        state.power = !!data.power;
        updatePowerUI();
      }

      if (data.power_level !== undefined) {
        state.powerLevel = data.power_level;
        dom.powerSlider.value = data.power_level;
        updateGauge(data.power_level);
      }

      if (data.protection_active) {
        showProtectionAlert(data.protection_reason || 'Desarmamento por segurança');
      }
    } catch (e) {
      console.warn('Erro ao processar telemetria:', e);
    }
  }

  function handleAlertMessage(message) {
    try {
      const data = JSON.parse(message.toString());
      showProtectionAlert(data.reason || 'Alerta de proteção');
    } catch (e) {
      showProtectionAlert(message.toString());
    }
  }

  function connectMQTT() {
    if (state.simulation) {
      startSimulation();
      return;
    }

    stopSimulation();

    const broker = dom.mqttBroker.value.trim();
    const port = parseInt(dom.mqttPort.value, 10) || 8000;
    state.deviceId = dom.deviceId.value.trim() || 'chuveiro_01';

    if (state.mqttClient) {
      state.mqttClient.end(true);
      state.mqttClient = null;
    }

    setConnectionStatus('Conectando...', '');

    const url = `ws://${broker}:${port}/mqtt`;

    try {
      state.mqttClient = mqtt.connect(url, {
        clientId: `app_${state.deviceId}_${Math.random().toString(16).slice(2, 8)}`,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
      });

      state.mqttClient.on('connect', () => {
        state.connected = true;
        setConnectionStatus('Conectado via MQTT', 'connected');

        const topics = [
          TOPICS.telemetry(state.deviceId),
          TOPICS.status(state.deviceId),
          TOPICS.alert(state.deviceId),
        ];

        topics.forEach((topic) => {
          state.mqttClient.subscribe(topic, { qos: 1 });
        });

        sendCommand();
      });

      state.mqttClient.on('message', (topic, message) => {
        if (topic.includes('/telemetry') || topic.includes('/status')) {
          handleTelemetryMessage(message);
        } else if (topic.includes('/alert')) {
          handleAlertMessage(message);
        }
      });

      state.mqttClient.on('error', (err) => {
        console.error('MQTT Error:', err);
        setConnectionStatus('Erro na conexão', 'disconnected');
      });

      state.mqttClient.on('close', () => {
        state.connected = false;
        setConnectionStatus('Desconectado', 'disconnected');
      });

      state.mqttClient.on('reconnect', () => {
        setConnectionStatus('Reconectando...', '');
      });
    } catch (e) {
      console.error('Falha ao conectar MQTT:', e);
      setConnectionStatus('Falha na conexão', 'disconnected');
    }
  }

  function disconnectMQTT() {
    if (state.mqttClient) {
      state.mqttClient.end(true);
      state.mqttClient = null;
    }
    state.connected = false;
    setConnectionStatus('Desconectado', 'disconnected');
  }

  // ===== Modo Simulação =====
  function startSimulation() {
    stopSimulation();
    state.simulation = true;
    state.connected = true;
    setConnectionStatus('Modo Simulação', 'connected');

    simulationInterval = setInterval(() => {
      if (state.power && !state.protectionActive) {
        const baseCurrent = (state.powerLevel / 100) * 25 + 2;
        const noise = (Math.random() - 0.5) * 2;

        const telemetry = {
          resistance: 22 - (state.powerLevel / 100) * 10 + (Math.random() - 0.5),
          current: Math.max(0, baseCurrent + noise),
          leakage: Math.random() * 8,
          temperature: 22 + (state.powerLevel / 100) * 18 + Math.random() * 3,
        };

        // Simular proteção por sobrecarga (corrente > 28A com potência máxima)
        if (telemetry.current > 28 && state.powerLevel > 90) {
          showProtectionAlert('Sobrecarga detectada — corrente acima do limite seguro');
          return;
        }

        // Simular desligamento por temperatura
        if (state.autoTempEnabled && telemetry.temperature >= state.tempLimit) {
          state.power = false;
          updatePowerUI();
          setMetricStatus(dom.statusTemp, 'warn', 'Limite atingido');
        }

        updateTelemetryUI(telemetry);
      } else if (!state.power) {
        updateTelemetryUI({
          resistance: 0,
          current: 0,
          leakage: Math.random() * 2,
          temperature: 22 + Math.random() * 2,
        });
      }
    }, 1500);

    updateTelemetryUI({
      resistance: 0,
      current: 0,
      leakage: 0,
      temperature: 24,
    });
  }

  function stopSimulation() {
    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }
  }

  // ===== Onboarding =====
  function initOnboarding() {
    const done = localStorage.getItem(STORAGE_KEYS.onboarding);
    if (done === 'true') {
      dom.onboardingModal.classList.add('modal-overlay--hidden');
    }
  }

  function closeOnboarding() {
    if (dom.dontShowAgain.checked) {
      localStorage.setItem(STORAGE_KEYS.onboarding, 'true');
    }
    dom.onboardingModal.classList.add('modal-overlay--hidden');
  }

  function showOnboarding() {
    dom.onboardingModal.classList.remove('modal-overlay--hidden');
  }

  // ===== Event Listeners =====
  function bindEvents() {
    dom.btnCloseOnboarding.addEventListener('click', closeOnboarding);
    dom.btnHelp.addEventListener('click', showOnboarding);

    dom.btnPower.addEventListener('click', () => {
      if (state.protectionActive) return;
      state.power = !state.power;
      updatePowerUI();
      sendCommand({ power: state.power });
    });

    dom.powerSlider.addEventListener('input', (e) => {
      state.powerLevel = parseInt(e.target.value, 10);
      updateGauge(state.powerLevel);
      sendCommand({ power_level: state.powerLevel });
    });

    dom.autoTempEnabled.addEventListener('change', (e) => {
      state.autoTempEnabled = e.target.checked;
      updateTempControlUI();
      sendCommand({ auto_temp_enabled: state.autoTempEnabled });
    });

    function syncTemp(value) {
      value = Math.max(20, Math.min(60, value));
      state.tempLimit = value;
      dom.tempLimit.value = value;
      dom.tempSlider.value = value;
      sendCommand({ temp_limit: value });
    }

    dom.tempLimit.addEventListener('change', (e) => {
      syncTemp(parseInt(e.target.value, 10) || 30);
    });

    dom.tempSlider.addEventListener('input', (e) => {
      syncTemp(parseInt(e.target.value, 10));
    });

    dom.btnTempDown.addEventListener('click', () => syncTemp(state.tempLimit - 1));
    dom.btnTempUp.addEventListener('click', () => syncTemp(state.tempLimit + 1));

    dom.btnResetProtection.addEventListener('click', hideProtectionAlert);

    dom.btnConnect.addEventListener('click', () => {
      state.simulation = dom.simulationMode.checked;
      saveSettings();

      if (state.simulation) {
        disconnectMQTT();
        startSimulation();
      } else {
        stopSimulation();
        connectMQTT();
      }
    });

    dom.simulationMode.addEventListener('change', (e) => {
      state.simulation = e.target.checked;
    });
  }

  // ===== Inicialização =====
  function init() {
    loadSettings();
    initOnboarding();
    bindEvents();

    updateGauge(state.powerLevel);
    updatePowerUI();
    updateTempControlUI();

    if (state.simulation || dom.simulationMode.checked) {
      startSimulation();
    } else {
      connectMQTT();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();

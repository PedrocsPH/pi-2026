package com.eldorado.irrigacao.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Locale;

import org.springframework.stereotype.Service;

import com.eldorado.irrigacao.config.IrrigacaoProperties;
import com.eldorado.irrigacao.domain.Device;
import com.eldorado.irrigacao.domain.Regime;
import com.eldorado.irrigacao.repository.AlertRepository;
import com.eldorado.irrigacao.repository.DeviceRepository;
import com.eldorado.irrigacao.repository.ReadingRepository;
import com.eldorado.irrigacao.web.ApiException;
import com.eldorado.irrigacao.web.dto.DeviceCommandDto;

/**
 * Recebe leituras de sensores (do Arduino real ou do simulador), grava o histórico,
 * atualiza o dispositivo, avalia alertas e controla a rega automática SOMENTE quando
 * o dispositivo estiver no Modo Automático (autoIrrigation = true):
 * - Liga a bomba quando moisture < minMoisture (ex.: < 40%)
 * - Mantém ligada até o sensor identificar que o solo está úmido o suficiente (moisture >= minMoisture),
 *   quando então para de irrigar automaticamente.
 */
@Service
public class IngestService {

    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");

    private final DeviceRepository devices;
    private final ReadingRepository readings;
    private final AlertRepository alerts;
    private final IrrigationService irrigation;
    private final IrrigacaoProperties props;
    private final Clock clock;

    private volatile String activeArduinoDeviceId = "ARD-IRR-0421";

    public IngestService(DeviceRepository devices, ReadingRepository readings, AlertRepository alerts,
            IrrigationService irrigation, IrrigacaoProperties props, Clock clock) {
        this.devices = devices;
        this.readings = readings;
        this.alerts = alerts;
        this.irrigation = irrigation;
        this.props = props;
        this.clock = clock;
    }

    public String getActiveArduinoDeviceId() {
        return activeArduinoDeviceId;
    }

    public String setActiveArduinoDeviceId(String deviceId) {
        String cleanId = deviceId == null ? "" : deviceId.trim().toUpperCase();
        if (!devices.existsById(cleanId)) {
            throw ApiException.notFound("Dispositivo '" + cleanId + "' não encontrado.");
        }
        this.activeArduinoDeviceId = cleanId;
        return this.activeArduinoDeviceId;
    }

    public String resolveTargetDevice(String requestedId, boolean fromHardwareEndpoint) {
        if (requestedId == null || requestedId.isBlank() || "ACTIVE".equalsIgnoreCase(requestedId)) {
            return activeArduinoDeviceId;
        }
        if (fromHardwareEndpoint && "ARD-IRR-0421".equalsIgnoreCase(requestedId)
                && devices.existsById(activeArduinoDeviceId)) {
            return activeArduinoDeviceId;
        }
        return requestedId;
    }

    public DeviceCommandDto ingest(String deviceId, double moisture, double temperature, double water, Double ph) {
        Device device = devices.findById(deviceId)
                .orElseThrow(() -> ApiException.notFound("Dispositivo '" + deviceId + "' não encontrado."));

        OffsetDateTime now = OffsetDateTime.now(clock);
        readings.insert(deviceId, moisture, temperature, water, ph, now);
        devices.applyReading(deviceId, moisture, temperature, water, ph, now);

        boolean lowMoisture = moisture < device.minMoisture();
        applyThresholdAlert(device, "LOW_MOISTURE", "high", lowMoisture,
                "Umidade abaixo do limite",
                "A umidade atingiu %.0f%%, abaixo do limite configurado de %d%% (%s)."
                        .formatted(moisture, device.minMoisture(),
                                device.autoIrrigation() ? "Modo Automático ativo — regando até atingir o ideal" : "Modo Manual — aguardando acionamento"));

        applyThresholdAlert(device, "LOW_WATER", "medium", water < props.limites().aguaBaixaPercentual(),
                "Nível de água reduzido",
                "O reservatório está com apenas %.0f%% da capacidade.".formatted(water));

        if (ph != null) {
            boolean below = ph < device.minPh();
            boolean above = ph > device.maxPh();
            applyThresholdAlert(device, "PH_OUT_OF_RANGE", "medium", below || above,
                    below ? "pH do solo abaixo da faixa" : "pH do solo acima da faixa",
                    "O pH atingiu %s, fora da faixa ideal de %s a %s."
                            .formatted(fmt(ph), fmt(device.minPh()), fmt(device.maxPh())));
        }

        // No Modo Automático:
        // - Liga automaticamente ao identificar insuficiência de umidade (moisture < minMoisture)
        // - Para automaticamente assim que o sensor identificar que o solo já está úmido o suficiente (moisture >= minMoisture)
        if (device.autoIrrigation()) {
            if (lowMoisture && !device.irrigatingAt(now)
                    && water >= props.limites().aguaMinimaIrrigacaoPercentual()) {
                try {
                    Regime autoRegime = irrigation.resolveRegime(device.defaultRegime(), Regime.MODERADA.key);
                    // Mantém ativa continuamente até a umidade atingir minMoisture (janela de segurança de 4h)
                    irrigation.startSeconds(device, 14400, autoRegime, "agendada", "Automática (sensor de umidade)");
                } catch (ApiException ignored) {
                }
            } else if (!lowMoisture && device.irrigatingAt(now)) {
                irrigation.stop(deviceId);
            }
        }

        alerts.resolveActive(deviceId, "OFFLINE");
        return getCommand(deviceId);
    }

    public DeviceCommandDto getCommand(String deviceId) {
        Device updated = devices.findById(deviceId)
                .orElseThrow(() -> ApiException.notFound("Dispositivo '" + deviceId + "' não encontrado."));
        OffsetDateTime now = OffsetDateTime.now(clock);
        boolean isIrrigating = updated.irrigatingAt(now);
        String regimeKey = isIrrigating && updated.irrigationRegime() != null
                ? updated.irrigationRegime()
                : updated.defaultRegime();
        Regime regime = Regime.fromKey(regimeKey);
        int pumpPower = isIrrigating ? (regime != null ? regime.pumpPower : 75) : 0;

        return new DeviceCommandDto(
                updated.id(),
                isIrrigating,
                regimeKey,
                pumpPower,
                updated.minMoisture(),
                updated.autoIrrigation(),
                updated.defaultDurationMin());
    }

    private static String fmt(double v) {
        return String.format(PT_BR, "%.1f", v);
    }

    private void applyThresholdAlert(Device device, String kind, String level, boolean breached, String title, String message) {
        if (breached) {
            if (!alerts.hasActive(device.id(), kind)) {
                alerts.insert(device.id(), kind, level, title, message);
            }
        } else {
            alerts.resolveActive(device.id(), kind);
        }
    }
}

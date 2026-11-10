package com.eldorado.irrigacao.service;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import com.eldorado.irrigacao.config.IrrigacaoProperties;
import com.eldorado.irrigacao.domain.Device;
import com.eldorado.irrigacao.domain.IrrigationLog;
import com.eldorado.irrigacao.domain.Regime;
import com.eldorado.irrigacao.repository.DeviceRepository;
import com.eldorado.irrigacao.repository.IrrigationLogRepository;
import com.eldorado.irrigacao.web.ApiException;
import com.eldorado.irrigacao.web.dto.IrrigationLogDto;
import com.eldorado.irrigacao.web.dto.RegimeDto;

/** Regras de início/fim de irrigação e histórico — suporta duração em minutos ou em segundos (mínimo 30s). */
@Service
public class IrrigationService {

    private final DeviceRepository devices;
    private final IrrigationLogRepository logs;
    private final IrrigacaoProperties props;
    private final Clock clock;

    /** Armazena a duração exata em segundos (mínimo 30s) configurada para cada dispositivo. */
    private final Map<String, Integer> customDurationSeconds = new ConcurrentHashMap<>();

    public IrrigationService(DeviceRepository devices, IrrigationLogRepository logs, IrrigacaoProperties props, Clock clock) {
        this.devices = devices;
        this.logs = logs;
        this.props = props;
        this.clock = clock;
    }

    public void setCustomDurationSeconds(String deviceId, int seconds) {
        if (deviceId != null) {
            customDurationSeconds.put(deviceId, Math.max(30, Math.min(14400, seconds)));
        }
    }

    public int getCustomDurationSeconds(String deviceId, int fallbackMinutes) {
        Integer sec = deviceId == null ? null : customDurationSeconds.get(deviceId);
        if (sec != null && sec >= 30) {
            return sec;
        }
        return Math.max(30, fallbackMinutes * 60);
    }

    public List<RegimeDto> regimes() {
        return java.util.Arrays.stream(Regime.values())
                .map(r -> new RegimeDto(r.key, r.label, r.description, r.pumpPower, r.mmPerHour)).toList();
    }

    /** Converte a chave recebida em regime válido; vazio => usa o padrão informado. */
    public Regime resolveRegime(String requested, String fallbackKey) {
        String key = requested == null || requested.isBlank() ? fallbackKey : requested;
        Regime regime = Regime.fromKey(key);
        if (regime == null) {
            throw ApiException.badRequest("Regime de chuva inválido. Use: garoa, leve, moderada ou forte.");
        }
        return regime;
    }

    /** Liga a rega usando minutos. */
    public void start(Device device, int minutes, Regime regime, String mode, String scheduleName) {
        startSeconds(device, Math.max(30, minutes * 60), regime, mode, scheduleName);
    }

    /** Liga a rega com precisão em segundos (mínimo 30 segundos). */
    public void startSeconds(Device device, int seconds, Regime regime, String mode, String scheduleName) {
        int validSeconds = Math.max(30, Math.min(14400, seconds));
        OffsetDateTime now = OffsetDateTime.now(clock);
        if (device.irrigatingAt(now)) {
            throw ApiException.conflict("Este dispositivo já está irrigando. Interrompa o ciclo atual antes de iniciar outro.");
        }
        int minWater = props.limites().aguaMinimaIrrigacaoPercentual();
        if (device.water() != null && device.water() < minWater) {
            throw ApiException.badRequest("Nível de água insuficiente para iniciar a irrigação.");
        }
        int displayMinutes = Math.max(1, (int) Math.ceil(validSeconds / 60.0));
        devices.startIrrigation(device.id(), now.plusSeconds(validSeconds), mode, displayMinutes, regime.key);
        logs.insert(device.id(), now, displayMinutes, null, mode, regime.key, scheduleName);
    }

    public void stop(String deviceId) {
        devices.stopIrrigation(deviceId);
        logs.closeOpen(deviceId, OffsetDateTime.now(clock));
    }

    /** Encerra um ciclo que chegou ao fim natural (chamado pelo job de 1 s). */
    public void finish(Device device) {
        OffsetDateTime end = device.irrigatingUntil() != null ? device.irrigatingUntil() : OffsetDateTime.now(clock);
        devices.stopIrrigation(device.id());
        logs.closeOpen(device.id(), end);
    }

    public List<IrrigationLogDto> historyForDevice(String deviceId, int limit) {
        return logs.findByDevice(deviceId, limit).stream().map(this::toDto).toList();
    }

    public List<IrrigationLog> since(OffsetDateTime since) {
        return logs.findSince(since);
    }

    public IrrigationLogDto toDto(IrrigationLog l) {
        boolean running = l.endedAt() == null;
        double minutes = actualMinutes(l);
        Regime regime = Regime.fromKey(l.regime());
        double mm = regime == null ? 0 : regime.mmFor(minutes);
        return new IrrigationLogDto(l.id(), l.deviceId(), l.deviceName(), l.startedAt().toString(),
                l.endedAt() == null ? null : l.endedAt().toString(), l.plannedMinutes(),
                (int) Math.round(minutes), running, l.mode(), l.regime(), l.scheduleName(), mm);
    }

    /** Minutos efetivamente irrigados (ciclo em andamento conta até agora, limitado ao planejado). */
    public double actualMinutes(IrrigationLog l) {
        OffsetDateTime end = l.endedAt() != null ? l.endedAt() : OffsetDateTime.now(clock);
        double minutes = Duration.between(l.startedAt(), end).toSeconds() / 60.0;
        return Math.max(0, Math.min(minutes, l.plannedMinutes()));
    }
}

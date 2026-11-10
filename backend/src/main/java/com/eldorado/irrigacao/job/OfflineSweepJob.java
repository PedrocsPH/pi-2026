package com.eldorado.irrigacao.job;

import java.time.Clock;
import java.time.OffsetDateTime;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.eldorado.irrigacao.config.IrrigacaoProperties;
import com.eldorado.irrigacao.domain.Device;
import com.eldorado.irrigacao.repository.AlertRepository;
import com.eldorado.irrigacao.repository.DeviceRepository;

/** A cada minuto, cria um alerta de "dispositivo desconectado" para quem passou do limite sem enviar dados. */
@Component
public class OfflineSweepJob {

    private final DeviceRepository devices;
    private final AlertRepository alerts;
    private final IrrigacaoProperties props;
    private final Clock clock;

    public OfflineSweepJob(DeviceRepository devices, AlertRepository alerts, IrrigacaoProperties props, Clock clock) {
        this.devices = devices;
        this.alerts = alerts;
        this.props = props;
        this.clock = clock;
    }

    @Scheduled(fixedDelay = 60_000)
    public void sweep() {
        OffsetDateTime now = OffsetDateTime.now(clock);
        int limitMinutes = props.limites().offlineMinutos();
        for (Device d : devices.findAll()) {
            boolean neverSeen = d.lastSeenAt() == null;
            boolean staleReading = d.lastSeenAt() != null && d.lastSeenAt().plusMinutes(limitMinutes).isBefore(now);
            if (d.disconnectAlerts() && (neverSeen || staleReading) && !alerts.hasActive(d.id(), "OFFLINE")) {
                alerts.insert(d.id(), "OFFLINE", "medium", "Dispositivo desconectado",
                        "O dispositivo não envia dados há mais de %d minutos.".formatted(limitMinutes));
            }
        }
    }
}

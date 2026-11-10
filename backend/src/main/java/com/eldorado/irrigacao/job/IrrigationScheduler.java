package com.eldorado.irrigacao.job;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.eldorado.irrigacao.domain.Device;
import com.eldorado.irrigacao.domain.Regime;
import com.eldorado.irrigacao.repository.AlertRepository;
import com.eldorado.irrigacao.repository.DeviceRepository;
import com.eldorado.irrigacao.service.IrrigationService;

/** A cada 1s, encerra irrigações cujo tempo programado (em segundos ou minutos) já passou. */
@Component
public class IrrigationScheduler {

    private final DeviceRepository devices;
    private final AlertRepository alerts;
    private final IrrigationService irrigation;
    private final Clock clock;

    public IrrigationScheduler(DeviceRepository devices, AlertRepository alerts, IrrigationService irrigation, Clock clock) {
        this.devices = devices;
        this.alerts = alerts;
        this.irrigation = irrigation;
        this.clock = clock;
    }

    @Scheduled(fixedDelay = 1_000)
    public void stopFinishedIrrigations() {
        OffsetDateTime now = OffsetDateTime.now(clock);
        List<Device> finished = devices.findWithIrrigationEndingBefore(now);
        for (Device d : finished) {
            irrigation.finish(d);
            Regime regime = Regime.fromKey(d.irrigationRegime());
            String regimeLabel = regime == null ? "" : " (%s)".formatted(regime.label.toLowerCase());
            alerts.insert(d.id(), "IRRIGATION_DONE", "low", "Irrigação concluída",
                    "O ciclo de irrigação%s foi concluído com sucesso.".formatted(regimeLabel));
        }
    }
}

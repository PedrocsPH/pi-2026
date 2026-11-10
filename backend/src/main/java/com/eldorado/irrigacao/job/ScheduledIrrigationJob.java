package com.eldorado.irrigacao.job;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.eldorado.irrigacao.domain.Device;
import com.eldorado.irrigacao.domain.Regime;
import com.eldorado.irrigacao.domain.Schedule;
import com.eldorado.irrigacao.repository.AlertRepository;
import com.eldorado.irrigacao.repository.DeviceRepository;
import com.eldorado.irrigacao.repository.ScheduleRepository;
import com.eldorado.irrigacao.service.IrrigationService;
import com.eldorado.irrigacao.web.ApiException;

/**
 * A cada 20 s, dispara as programações de rega cujo horário chegou. Cada programação roda no máximo uma vez por dia
 * e só dentro de uma janela de tolerância (se o servidor ficou fora do ar na hora marcada, a rega do dia é pulada
 * em vez de disparar horas depois).
 */
@Component
public class ScheduledIrrigationJob {

    private static final int GRACE_MINUTES = 10;

    private final ScheduleRepository schedules;
    private final DeviceRepository devices;
    private final AlertRepository alerts;
    private final IrrigationService irrigation;
    private final Clock clock;

    public ScheduledIrrigationJob(ScheduleRepository schedules, DeviceRepository devices, AlertRepository alerts,
            IrrigationService irrigation, Clock clock) {
        this.schedules = schedules;
        this.devices = devices;
        this.alerts = alerts;
        this.irrigation = irrigation;
        this.clock = clock;
    }

    @Scheduled(fixedDelay = 20_000)
    public void runDueSchedules() {
        LocalDate today = LocalDate.now(clock);
        LocalTime nowTime = LocalTime.now(clock);
        int isoDay = today.getDayOfWeek().getValue();

        for (Schedule s : schedules.findAllEnabled()) {
            if (!s.days().contains(isoDay) || today.equals(s.lastRunOn())) {
                continue;
            }
            long minutesSinceStart = Duration.between(s.startTime(), nowTime).toMinutes();
            if (minutesSinceStart < 0 || minutesSinceStart > GRACE_MINUTES) {
                continue;
            }
            Optional<Device> device = devices.findById(s.deviceId());
            if (device.isEmpty()) {
                continue;
            }
            Device d = device.get();
            if (d.irrigatingAt(java.time.OffsetDateTime.now(clock))) {
                continue; // já regando: tenta de novo no próximo ciclo, dentro da janela de tolerância
            }
            try {
                irrigation.start(d, s.durationMin(), Regime.fromKey(s.regime()) == null ? Regime.MODERADA : Regime.fromKey(s.regime()),
                        "agendada", s.name());
            } catch (ApiException e) {
                alerts.insert(d.id(), "SCHEDULE_SKIPPED", "medium", "Rega programada não executada",
                        "A programação \"%s\" não foi executada: %s".formatted(s.name(), e.getMessage()));
            }
            schedules.markRan(s.id(), today);
        }
    }
}

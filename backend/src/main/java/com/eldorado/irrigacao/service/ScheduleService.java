package com.eldorado.irrigacao.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Objects;
import java.util.TreeSet;

import org.springframework.stereotype.Service;

import com.eldorado.irrigacao.domain.Regime;
import com.eldorado.irrigacao.domain.Schedule;
import com.eldorado.irrigacao.repository.DeviceRepository;
import com.eldorado.irrigacao.repository.ScheduleRepository;
import com.eldorado.irrigacao.web.ApiException;
import com.eldorado.irrigacao.web.dto.ScheduleDto;
import com.eldorado.irrigacao.web.dto.ScheduleRequest;

@Service
public class ScheduleService {

    private static final int MAX_PER_DEVICE = 12;

    private final ScheduleRepository schedules;
    private final DeviceRepository devices;
    private final Clock clock;

    public ScheduleService(ScheduleRepository schedules, DeviceRepository devices, Clock clock) {
        this.schedules = schedules;
        this.devices = devices;
        this.clock = clock;
    }

    public List<ScheduleDto> listForDevice(String deviceId) {
        return schedules.findByDevice(deviceId).stream().map(this::toDto).toList();
    }

    public ScheduleDto create(String deviceId, ScheduleRequest req) {
        ensureDevice(deviceId);
        if (schedules.findByDevice(deviceId).size() >= MAX_PER_DEVICE) {
            throw ApiException.badRequest("Limite de " + MAX_PER_DEVICE + " programações por dispositivo atingido.");
        }
        Validated v = validate(req);
        long id = schedules.insert(deviceId, v.name, v.days, v.start, req.durationMin(), v.regime.key, v.enabled);
        return toDto(schedules.findById(id).orElseThrow());
    }

    public ScheduleDto update(String deviceId, long scheduleId, ScheduleRequest req) {
        ensureOwned(deviceId, scheduleId);
        Validated v = validate(req);
        schedules.update(scheduleId, v.name, v.days, v.start, req.durationMin(), v.regime.key, v.enabled);
        return toDto(schedules.findById(scheduleId).orElseThrow());
    }

    public ScheduleDto setEnabled(String deviceId, long scheduleId, boolean enabled) {
        ensureOwned(deviceId, scheduleId);
        schedules.setEnabled(scheduleId, enabled);
        return toDto(schedules.findById(scheduleId).orElseThrow());
    }

    public void delete(String deviceId, long scheduleId) {
        ensureOwned(deviceId, scheduleId);
        schedules.delete(scheduleId);
    }

    /** Próxima execução de cada programação ativa, da mais próxima para a mais distante. */
    public List<Upcoming> upcoming(int limit) {
        return schedules.findAllEnabled().stream()
                .map(s -> new Upcoming(s, nextRun(s)))
                .filter(u -> u.runAt != null)
                .sorted(java.util.Comparator.comparing(u -> u.runAt))
                .limit(limit)
                .toList();
    }

    public record Upcoming(Schedule schedule, ZonedDateTime runAt) {
    }

    /** Próximo disparo da programação (hoje, se o horário ainda não passou e ainda não rodou hoje; senão o próximo dia marcado). */
    public ZonedDateTime nextRun(Schedule s) {
        if (!s.enabled() || s.days().isEmpty()) {
            return null;
        }
        ZonedDateTime now = ZonedDateTime.now(clock);
        for (int offset = 0; offset <= 7; offset++) {
            LocalDate date = now.toLocalDate().plusDays(offset);
            if (!s.days().contains(date.getDayOfWeek().getValue())) {
                continue;
            }
            ZonedDateTime candidate = date.atTime(s.startTime()).atZone(clock.getZone());
            if (candidate.isAfter(now) && !(offset == 0 && date.equals(s.lastRunOn()))) {
                return candidate;
            }
        }
        return null;
    }

    private ScheduleDto toDto(Schedule s) {
        ZonedDateTime next = nextRun(s);
        Regime regime = Regime.fromKey(s.regime());
        return new ScheduleDto(s.id(), s.deviceId(), s.name(), s.days(), s.startTime().toString().substring(0, 5),
                s.durationMin(), s.regime(), regime == null ? 0 : regime.mmFor(s.durationMin()), s.enabled(),
                next == null ? null : next.toOffsetDateTime().toString());
    }

    private record Validated(String name, List<Integer> days, LocalTime start, Regime regime, boolean enabled) {
    }

    private Validated validate(ScheduleRequest req) {
        TreeSet<Integer> days = new TreeSet<>(req.days().stream().filter(Objects::nonNull).toList());
        if (days.isEmpty() || days.first() < 1 || days.last() > 7) {
            throw ApiException.badRequest("Dias inválidos. Use números de 1 (segunda) a 7 (domingo).");
        }
        Regime regime = Regime.fromKey(req.regime());
        if (regime == null) {
            throw ApiException.badRequest("Regime de chuva inválido. Use: garoa, leve, moderada ou forte.");
        }
        return new Validated(req.name().trim(), List.copyOf(days), LocalTime.parse(req.startTime()), regime,
                req.enabled() == null || req.enabled());
    }

    private void ensureDevice(String deviceId) {
        if (!devices.existsById(deviceId)) {
            throw ApiException.notFound("Dispositivo não encontrado.");
        }
    }

    private void ensureOwned(String deviceId, long scheduleId) {
        ensureDevice(deviceId);
        Schedule s = schedules.findById(scheduleId).orElseThrow(() -> ApiException.notFound("Programação não encontrada."));
        if (!s.deviceId().equals(deviceId)) {
            throw ApiException.notFound("Programação não encontrada.");
        }
    }
}

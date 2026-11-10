package com.eldorado.irrigacao.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.eldorado.irrigacao.domain.Device;
import com.eldorado.irrigacao.domain.IrrigationLog;
import com.eldorado.irrigacao.domain.Regime;
import com.eldorado.irrigacao.repository.DeviceRepository;
import com.eldorado.irrigacao.repository.ReadingRepository;
import com.eldorado.irrigacao.repository.SettingsRepository;
import com.eldorado.irrigacao.web.dto.AlertDto;
import com.eldorado.irrigacao.web.dto.DailyIrrigationDto;
import com.eldorado.irrigacao.web.dto.DashboardResponse;
import com.eldorado.irrigacao.web.dto.DeviceCountsDto;
import com.eldorado.irrigacao.web.dto.DeviceSummaryDto;
import com.eldorado.irrigacao.web.dto.SeriesPointDto;
import com.eldorado.irrigacao.web.dto.UpcomingRunDto;

@Service
public class DashboardService {

    private final DeviceRepository deviceRepo;
    private final ReadingRepository readingRepo;
    private final AlertService alertService;
    private final SettingsRepository settingsRepo;
    private final DeviceService deviceService;
    private final DeviceStatusResolver statusResolver;
    private final IrrigationService irrigation;
    private final ScheduleService scheduleService;
    private final Clock clock;

    public DashboardService(DeviceRepository deviceRepo, ReadingRepository readingRepo, AlertService alertService,
            SettingsRepository settingsRepo, DeviceService deviceService, DeviceStatusResolver statusResolver,
            IrrigationService irrigation, ScheduleService scheduleService, Clock clock) {
        this.deviceRepo = deviceRepo;
        this.readingRepo = readingRepo;
        this.alertService = alertService;
        this.settingsRepo = settingsRepo;
        this.deviceService = deviceService;
        this.statusResolver = statusResolver;
        this.irrigation = irrigation;
        this.scheduleService = scheduleService;
        this.clock = clock;
    }

    public DashboardResponse build() {
        List<Device> devices = deviceRepo.findAll();
        int online = 0, offline = 0, alerta = 0;
        double moistureSum = 0, waterSum = 0, phSum = 0, tempSum = 0;
        int moistureCount = 0, waterCount = 0, phCount = 0, tempCount = 0;
        for (Device d : devices) {
            switch (statusResolver.resolve(d)) {
                case ONLINE -> online++;
                case OFFLINE -> offline++;
                case ALERTA -> alerta++;
            }
            if (d.moisture() != null) { moistureSum += d.moisture(); moistureCount++; }
            if (d.water() != null) { waterSum += d.water(); waterCount++; }
            if (d.ph() != null) { phSum += d.ph(); phCount++; }
            if (d.temperature() != null) { tempSum += d.temperature(); tempCount++; }
        }
        Double avgMoisture = moistureCount == 0 ? null : moistureSum / moistureCount;
        Double avgWater = waterCount == 0 ? null : waterSum / waterCount;
        Double avgPh = phCount == 0 ? null : phSum / phCount;
        Double avgTemp = tempCount == 0 ? null : tempSum / tempCount;

        OffsetDateTime now = OffsetDateTime.now(clock);
        List<SeriesPointDto> series = readingRepo.fleetAverageSeries(now.minusHours(24), 60).stream()
                .map(p -> new SeriesPointDto(p.t().toString(), p.moisture(), p.temperature(), p.water(), p.ph())).toList();

        Double delta = null;
        if (avgMoisture != null) {
            Double previousDayAvg = readingRepo.fleetAverageMoistureSince(now.minusHours(48));
            Double last24hAvg = readingRepo.fleetAverageMoistureSince(now.minusHours(24));
            if (previousDayAvg != null && last24hAvg != null && previousDayAvg > 0) {
                delta = last24hAvg - previousDayAvg;
            }
        }

        List<AlertDto> recent = alertService.recent(3);
        List<DeviceSummaryDto> summaries = deviceService.listSummaries();

        // Água aplicada nos últimos 7 dias (hoje incluído), somando por dia no fuso da propriedade.
        LocalDate today = LocalDate.now(clock);
        OffsetDateTime weekStart = today.minusDays(6).atStartOfDay(clock.getZone()).toOffsetDateTime();
        Map<LocalDate, int[]> runsAndMinutes = new HashMap<>();
        Map<LocalDate, Double> mmByDay = new HashMap<>();
        for (IrrigationLog l : irrigation.since(weekStart)) {
            LocalDate day = l.startedAt().atZoneSameInstant(clock.getZone()).toLocalDate();
            double minutes = irrigation.actualMinutes(l);
            Regime regime = Regime.fromKey(l.regime());
            int[] acc = runsAndMinutes.computeIfAbsent(day, k -> new int[2]);
            acc[0]++;
            acc[1] += (int) Math.round(minutes);
            mmByDay.merge(day, regime == null ? 0 : regime.mmFor(minutes), Double::sum);
        }
        List<DailyIrrigationDto> weekly = java.util.stream.IntStream.rangeClosed(0, 6)
                .mapToObj(i -> today.minusDays(6 - i))
                .map(day -> {
                    int[] acc = runsAndMinutes.getOrDefault(day, new int[2]);
                    double mm = Math.round(mmByDay.getOrDefault(day, 0.0) * 10) / 10.0;
                    return new DailyIrrigationDto(day.toString(), acc[0], acc[1], mm);
                }).toList();
        DailyIrrigationDto todayTotals = weekly.get(weekly.size() - 1);

        Map<String, String> names = devices.stream().collect(Collectors.toMap(Device::id, Device::name));
        List<UpcomingRunDto> upcoming = scheduleService.upcoming(4).stream()
                .map(u -> new UpcomingRunDto(u.schedule().id(), u.schedule().name(), u.schedule().deviceId(),
                        names.getOrDefault(u.schedule().deviceId(), u.schedule().deviceId()),
                        u.runAt().toOffsetDateTime().toString(), u.schedule().durationMin(), u.schedule().regime()))
                .toList();

        return new DashboardResponse(
                settingsRepo.get().fullName().split(" ")[0],
                new DeviceCountsDto(devices.size(), online, offline, alerta),
                avgMoisture, delta, avgWater, avgPh, avgTemp,
                (int) summaries.stream().filter(s -> "alerta".equals(s.status())).count(),
                alertService.list(true).summary().highPriority(),
                (int) summaries.stream().filter(DeviceSummaryDto::irrigating).count(),
                todayTotals.runs(), todayTotals.mm(),
                series, weekly, upcoming, recent, summaries);
    }
}

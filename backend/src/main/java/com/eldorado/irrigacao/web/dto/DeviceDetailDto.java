package com.eldorado.irrigacao.web.dto;

import java.util.List;

public record DeviceDetailDto(
        String id,
        String name,
        String location,
        String type,
        String status,
        Double moisture,
        Double temperature,
        Double water,
        Double ph,
        String lastSeenAt,
        String firmware,
        String connectivity,
        String installedAt,
        String crop,
        int minMoisture,
        double minPh,
        double maxPh,
        int defaultDurationMin,
        String defaultRegime,
        boolean autoIrrigation,
        boolean disconnectAlerts,
        String scheduleTime,
        boolean irrigating,
        int irrigationMinutes,
        String irrigationMode,
        String irrigationRegime,
        String irrigatingUntil,
        List<SeriesPointDto> series,
        List<ScheduleDto> schedules,
        List<IrrigationLogDto> history) {
}

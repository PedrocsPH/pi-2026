package com.eldorado.irrigacao.domain;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

public record Device(
        String id,
        String name,
        String location,
        String type,
        Double moisture,
        Double temperature,
        Double water,
        Double ph,
        OffsetDateTime lastSeenAt,
        String firmware,
        String connectivity,
        Integer rssi,
        LocalDate installedAt,
        int minMoisture,
        int defaultDurationMin,
        boolean autoIrrigation,
        boolean disconnectAlerts,
        LocalTime scheduleTime,
        OffsetDateTime irrigatingUntil,
        String irrigationMode,
        int irrigationMinutes,
        String crop,
        double minPh,
        double maxPh,
        String defaultRegime,
        String irrigationRegime) {

    public boolean irrigatingAt(OffsetDateTime now) {
        return irrigatingUntil != null && irrigatingUntil.isAfter(now);
    }
}

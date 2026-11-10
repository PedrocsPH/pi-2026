package com.eldorado.irrigacao.web.dto;

public record UpcomingRunDto(
        long scheduleId,
        String scheduleName,
        String deviceId,
        String deviceName,
        String runAt,
        int durationMin,
        String regime) {
}

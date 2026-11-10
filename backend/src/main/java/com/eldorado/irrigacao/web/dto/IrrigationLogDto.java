package com.eldorado.irrigacao.web.dto;

public record IrrigationLogDto(
        long id,
        String deviceId,
        String deviceName,
        String startedAt,
        String endedAt,
        int plannedMinutes,
        int actualMinutes,
        boolean running,
        String mode,
        String regime,
        String scheduleName,
        double estimatedMm) {
}

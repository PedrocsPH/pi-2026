package com.eldorado.irrigacao.web.dto;

import java.util.List;

public record ScheduleDto(
        long id,
        String deviceId,
        String name,
        List<Integer> days,
        String startTime,
        int durationMin,
        String regime,
        double estimatedMm,
        boolean enabled,
        String nextRunAt) {
}

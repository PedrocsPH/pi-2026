package com.eldorado.irrigacao.domain;

import java.time.OffsetDateTime;

/** Uma irrigação já iniciada (em andamento ou concluída). */
public record IrrigationLog(
        long id,
        String deviceId,
        String deviceName,
        OffsetDateTime startedAt,
        int plannedMinutes,
        OffsetDateTime endedAt,
        String mode,
        String regime,
        String scheduleName) {
}

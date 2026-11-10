package com.eldorado.irrigacao.domain;

import java.time.OffsetDateTime;

public record Alert(
        long id,
        String deviceId,
        String deviceName,
        String kind,
        String level,
        String title,
        String message,
        OffsetDateTime createdAt,
        boolean read,
        OffsetDateTime resolvedAt) {
}

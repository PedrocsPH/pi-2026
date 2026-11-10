package com.eldorado.irrigacao.web.dto;

public record AlertDto(
        long id,
        String deviceId,
        String deviceName,
        String kind,
        String level,
        String title,
        String message,
        String createdAt,
        boolean read) {
}

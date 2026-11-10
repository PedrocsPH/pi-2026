package com.eldorado.irrigacao.web.dto;

public record DeviceSummaryDto(
        String id,
        String name,
        String location,
        String type,
        String status,
        Double moisture,
        Double temperature,
        Double water,
        Double ph,
        String crop,
        boolean irrigating,
        String lastSeenAt) {
}

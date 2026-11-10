package com.eldorado.irrigacao.web.dto;

/**
 * Estado e comando atual da bomba devolvido ao Arduino/ESP32 após cada ingestão de leitura
 * ou na rota rápida de sincronização GET /api/ingest/{deviceId}/command.
 */
public record DeviceCommandDto(
        String deviceId,
        boolean irrigating,
        String regime,
        int pumpPower,
        int minMoisture,
        boolean autoIrrigation,
        int defaultDurationMin) {
}

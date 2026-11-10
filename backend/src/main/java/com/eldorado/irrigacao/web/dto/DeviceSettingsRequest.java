package com.eldorado.irrigacao.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record DeviceSettingsRequest(
        @Min(value = 0, message = "O limite mínimo de umidade não pode ser negativo.")
        @Max(value = 100, message = "O limite mínimo de umidade não pode passar de 100%.")
        int minMoisture,
        @Min(value = 1, message = "A duração padrão deve ser de pelo menos 1 minuto (ou 30 segundos).")
        int defaultDurationMin,
        boolean autoIrrigation,
        boolean disconnectAlerts,
        Double minPh,
        Double maxPh,
        String defaultRegime,
        Integer defaultDurationSec) {
}

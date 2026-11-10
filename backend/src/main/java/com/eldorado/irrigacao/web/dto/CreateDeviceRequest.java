package com.eldorado.irrigacao.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Cadastro de dispositivo. Tudo depois de "location" é opcional e tem padrão sensato no serviço. */
public record CreateDeviceRequest(
        @NotBlank(message = "Informe o nome do dispositivo.") String name,
        @NotBlank(message = "Selecione o tipo do dispositivo.") String type,
        @NotBlank(message = "Informe o código de identificação.")
        @Pattern(regexp = "[A-Z0-9-]{4,40}", message = "Código de identificação inválido. Use apenas letras maiúsculas, números e hífen (mínimo de 4 caracteres).")
        String id,
        String location,
        String crop,
        String connectivity,
        @Min(value = 0, message = "O limite mínimo de umidade não pode ser negativo.")
        @Max(value = 100, message = "O limite mínimo de umidade não pode passar de 100%.")
        Integer minMoisture,
        @Min(value = 1, message = "A duração padrão deve ser de pelo menos 1 minuto.")
        @Max(value = 240, message = "A duração máxima é de 240 minutos.")
        Integer defaultDurationMin,
        Boolean autoIrrigation,
        Boolean disconnectAlerts,
        Double minPh,
        Double maxPh,
        String defaultRegime) {
}

package com.eldorado.irrigacao.web.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateDeviceRequest(
        @NotBlank(message = "Informe o nome do dispositivo.") String name,
        @NotBlank(message = "Selecione o tipo do dispositivo.") String type,
        String location,
        String crop,
        String connectivity) {
}

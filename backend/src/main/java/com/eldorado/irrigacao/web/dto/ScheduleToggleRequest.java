package com.eldorado.irrigacao.web.dto;

import jakarta.validation.constraints.NotNull;

public record ScheduleToggleRequest(@NotNull(message = "Informe se a programação fica ativa.") Boolean enabled) {
}

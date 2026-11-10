package com.eldorado.irrigacao.web.dto;

import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record ScheduleRequest(
        @NotBlank(message = "Dê um nome à programação.") String name,
        @NotEmpty(message = "Escolha pelo menos um dia da semana.") List<Integer> days,
        @NotNull(message = "Informe o horário de início.")
        @Pattern(regexp = "([01]\\d|2[0-3]):[0-5]\\d", message = "Horário inválido. Use o formato HH:mm.")
        String startTime,
        @Min(value = 1, message = "A duração deve ser de pelo menos 1 minuto.")
        @Max(value = 240, message = "A duração máxima é de 240 minutos.")
        int durationMin,
        @NotBlank(message = "Escolha um regime de chuva.") String regime,
        Boolean enabled) {
}

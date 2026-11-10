package com.eldorado.irrigacao.web.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/** Leitura enviada pelo Arduino. O pH é opcional: sondas de pH são um acessório a parte. */
public record ReadingIngestRequest(
        @NotNull Double moisture,
        @NotNull Double temperature,
        @NotNull Double water,
        @DecimalMin(value = "0.0", message = "pH inválido (0 a 14).")
        @DecimalMax(value = "14.0", message = "pH inválido (0 a 14).")
        Double ph) {
}

package com.eldorado.irrigacao.domain;

import java.time.OffsetDateTime;

/** Média de leituras dentro de um intervalo (usado nos gráficos). */
public record ReadingPoint(OffsetDateTime t, Double moisture, Double temperature, Double water, Double ph) {
}

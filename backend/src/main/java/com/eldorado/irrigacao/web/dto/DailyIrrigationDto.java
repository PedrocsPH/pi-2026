package com.eldorado.irrigacao.web.dto;

/** Total de rega aplicada em um dia (usado no gráfico de barras do painel). */
public record DailyIrrigationDto(String date, int runs, int minutes, double mm) {
}

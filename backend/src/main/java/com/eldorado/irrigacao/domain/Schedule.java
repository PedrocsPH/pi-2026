package com.eldorado.irrigacao.domain;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/** Programação de rega: nos dias da semana (ISO: 1 = segunda ... 7 = domingo), no horário, por N minutos. */
public record Schedule(
        long id,
        String deviceId,
        String name,
        List<Integer> days,
        LocalTime startTime,
        int durationMin,
        String regime,
        boolean enabled,
        LocalDate lastRunOn) {
}

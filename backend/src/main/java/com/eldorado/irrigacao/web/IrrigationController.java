package com.eldorado.irrigacao.web;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.eldorado.irrigacao.service.IrrigationService;
import com.eldorado.irrigacao.web.dto.IrrigationLogDto;
import com.eldorado.irrigacao.web.dto.RegimeDto;

@RestController
@RequestMapping("/api")
public class IrrigationController {

    private final IrrigationService irrigation;
    private final Clock clock;

    public IrrigationController(IrrigationService irrigation, Clock clock) {
        this.irrigation = irrigation;
        this.clock = clock;
    }

    /** Catálogo dos regimes de chuva (garoa, leve, moderada, forte) com potência da bomba e lâmina estimada. */
    @GetMapping("/regimes")
    public List<RegimeDto> regimes() {
        return irrigation.regimes();
    }

    /** Histórico de irrigações de todos os dispositivos nos últimos N dias (padrão 7, máximo 90). */
    @GetMapping("/irrigations")
    public List<IrrigationLogDto> history(@RequestParam(defaultValue = "7") int days) {
        int period = Math.max(1, Math.min(90, days));
        return irrigation.since(OffsetDateTime.now(clock).minusDays(period)).stream().map(irrigation::toDto).toList();
    }
}

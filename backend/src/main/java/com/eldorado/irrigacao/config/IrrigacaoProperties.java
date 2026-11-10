package com.eldorado.irrigacao.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Propriedades "irrigacao.*" do application.yml. */
@ConfigurationProperties(prefix = "irrigacao")
public record IrrigacaoProperties(
        String zonaHoraria,
        Limites limites,
        Ingestao ingestao,
        Cors cors,
        Seed seed,
        Simulador simulador) {

    public record Limites(int offlineMinutos, int aguaBaixaPercentual, int aguaMinimaIrrigacaoPercentual) {
    }

    public record Ingestao(String chaveApi) {
    }

    public record Cors(List<String> origens) {
    }

    public record Seed(boolean demo) {
    }

    public record Simulador(boolean ativo, long intervaloMs, List<String> ignorar) {
    }
}

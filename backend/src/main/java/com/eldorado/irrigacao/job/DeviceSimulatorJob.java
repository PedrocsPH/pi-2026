package com.eldorado.irrigacao.job;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.eldorado.irrigacao.config.IrrigacaoProperties;
import com.eldorado.irrigacao.domain.Device;
import com.eldorado.irrigacao.repository.DeviceRepository;
import com.eldorado.irrigacao.service.IngestService;

/**
 * Gera leituras plausíveis (passeio aleatório em torno do último valor) para dar vida à demonstração
 * enquanto nenhum Arduino real está conectado. Desligue com irrigacao.simulador.ativo=false quando
 * dispositivos de verdade começarem a enviar dados via /api/ingest/{deviceId}/readings.
 */
@Component
public class DeviceSimulatorJob {

    private final DeviceRepository devices;
    private final IngestService ingest;
    private final IrrigacaoProperties props;

    public DeviceSimulatorJob(DeviceRepository devices, IngestService ingest, IrrigacaoProperties props) {
        this.devices = devices;
        this.ingest = ingest;
        this.props = props;
    }

    @Scheduled(fixedDelayString = "${irrigacao.simulador.intervalo-ms:60000}")
    public void tick() {
        if (!props.simulador().ativo()) {
            return;
        }
        List<String> ignorados = props.simulador().ignorar();
        ThreadLocalRandom rnd = ThreadLocalRandom.current();

        for (Device d : devices.findAll()) {
            if (ignorados != null && ignorados.contains(d.id())) {
                continue; // este dispositivo permanece "offline" de propósito na demonstração
            }
            double moisture = clamp(orDefault(d.moisture(), 55) + rnd.nextDouble(-2.5, 2.5)
                    + (d.irrigatingAt(java.time.OffsetDateTime.now()) ? rnd.nextDouble(0.5, 2) : 0), 0, 100);
            double temperature = clamp(orDefault(d.temperature(), 24) + rnd.nextDouble(-0.6, 0.6), 5, 45);
            double water = clamp(orDefault(d.water(), 80)
                    - (d.irrigatingAt(java.time.OffsetDateTime.now()) ? rnd.nextDouble(0.3, 0.9) : rnd.nextDouble(0, 0.15)), 0, 100);

            // pH: passeio aleatório curto que tende a voltar ao centro da faixa ideal do dispositivo.
            double phCenter = (d.minPh() + d.maxPh()) / 2.0;
            double ph = clamp(orDefault(d.ph(), phCenter) + rnd.nextDouble(-0.06, 0.06)
                    + (phCenter - orDefault(d.ph(), phCenter)) * 0.05, 3.5, 9.5);

            ingest.ingest(d.id(), round1(moisture), round1(temperature), round1(water), Math.round(ph * 100) / 100.0);
        }
    }

    private static double orDefault(Double v, double fallback) {
        return v == null ? fallback : v;
    }

    private static double clamp(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }
}

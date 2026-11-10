package com.eldorado.irrigacao.job;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import com.eldorado.irrigacao.config.IrrigacaoProperties;
import com.eldorado.irrigacao.domain.Device;
import com.eldorado.irrigacao.repository.AlertRepository;
import com.eldorado.irrigacao.repository.DeviceRepository;
import com.eldorado.irrigacao.repository.IrrigationLogRepository;
import com.eldorado.irrigacao.repository.ReadingRepository;
import com.eldorado.irrigacao.repository.ScheduleRepository;

/**
 * Popula o banco vazio com os 4 dispositivos de demonstração e uma semana de histórico de leituras (umidade,
 * temperatura, nível de água e pH), programações de rega e histórico de irrigações, para o painel não nascer vazio.
 * Também completa bancos criados pela versão anterior (sem pH/programações). Desative com irrigacao.seed.demo=false.
 */
@Component
@Order(1)
public class DemoSeedRunner implements ApplicationRunner {

    private final DeviceRepository devices;
    private final ReadingRepository readings;
    private final AlertRepository alerts;
    private final ScheduleRepository schedules;
    private final IrrigationLogRepository logs;
    private final IrrigacaoProperties props;
    private final Clock clock;

    public DemoSeedRunner(DeviceRepository devices, ReadingRepository readings, AlertRepository alerts,
            ScheduleRepository schedules, IrrigationLogRepository logs, IrrigacaoProperties props, Clock clock) {
        this.devices = devices;
        this.readings = readings;
        this.alerts = alerts;
        this.schedules = schedules;
        this.logs = logs;
        this.props = props;
        this.clock = clock;
    }

    private record Seed(String id, String name, String location, String type,
            double moisture, double temperature, double water, int minutesSinceLastSeen,
            String crop, double minPh, double maxPh, double ph, String regime) {
    }

    private static final List<Seed> SEEDS = List.of(
            new Seed("ARD-IRR-0421", "Horta Norte", "Setor A • Canteiros 1–8", "Irrigador Pro", 68, 24.8, 82, 0,
                    "Hortaliças folhosas", 6.0, 7.0, 6.5, "leve"),
            new Seed("ARD-IRR-0418", "Estufa de tomates", "Estufa 02", "Irrigador Pro", 29, 31.2, 54, 2,
                    "Tomate", 5.8, 6.8, 6.2, "moderada"),
            new Seed("ARD-IRR-0396", "Pomar Sul", "Talhão C", "Irrigador Mini", 61, 26.4, 76, 4,
                    "Citros", 5.5, 6.5, 6.0, "forte"),
            new Seed("ARD-IRR-0312", "Jardim da sede", "Área administrativa", "Irrigador Mini", 54, 23.9, 74, 1,
                    "Gramado e ornamentais", 5.8, 7.2, 6.6, "garoa"));

    @Override
    public void run(ApplicationArguments args) {
        if (!props.seed().demo()) {
            return;
        }
        boolean freshDatabase = devices.findAll().isEmpty();
        if (freshDatabase) {
            seedDevices();
        } else {
            upgradeFromV1();
        }
        seedSchedulesAndHistoryIfEmpty();
    }

    private void seedDevices() {
        OffsetDateTime now = OffsetDateTime.now(clock);
        ThreadLocalRandom rnd = ThreadLocalRandom.current();

        for (Seed s : SEEDS) {
            Device toInsert = new Device(s.id(), s.name(), s.location(), s.type(), null, null, s.water(), null, null,
                    "v2.4.1", "Wi-Fi", -52, LocalDate.now(clock).minusMonths(6), 40, 15, false, true,
                    LocalTime.of(18, 0), null, null, 0, s.crop(), s.minPh(), s.maxPh(), s.regime(), null);
            devices.insert(toInsert);

            // Sete dias de leituras horárias em passeio aleatório, convergindo para o valor "atual" declarado acima.
            double moisture = s.moisture() + rnd.nextDouble(-8, 8);
            double temperature = s.temperature() + rnd.nextDouble(-2, 2);
            double water = Math.min(100, s.water() + rnd.nextDouble(5, 15));
            double ph = s.ph();
            for (int hoursAgo = 168; hoursAgo >= 1; hoursAgo--) {
                moisture = clamp(moisture + rnd.nextDouble(-3, 3), 15, 95);
                temperature = clamp(temperature + rnd.nextDouble(-0.8, 0.8), 15, 38);
                water = clamp(water - rnd.nextDouble(-0.2, 0.6), 20, 100);
                // pH oscila em torno do valor de referência (onda diária suave + ruído), sem sair da faixa ideal
                ph = s.ph() + 0.2 * Math.sin(hoursAgo / 3.8 + s.id().hashCode() % 7) + rnd.nextDouble(-0.05, 0.05);
                readings.insert(s.id(), round1(moisture), round1(temperature), round1(water), round2(ph),
                        now.minusHours(hoursAgo));
            }
            OffsetDateTime lastSeenAt = now.minusMinutes(s.minutesSinceLastSeen());
            readings.insert(s.id(), s.moisture(), s.temperature(), s.water(), s.ph(), lastSeenAt);
            devices.applyReading(s.id(), s.moisture(), s.temperature(), s.water(), s.ph(), lastSeenAt);
        }

        seedAlerts();
    }

    /** Banco criado antes do pH existir: completa cultura, faixa de pH e histórico dos dispositivos de exemplo. */
    private void upgradeFromV1() {
        for (Seed s : SEEDS) {
            if (devices.existsById(s.id())) {
                devices.applyDemoPhProfile(s.id(), s.crop(), s.minPh(), s.maxPh(), s.ph());
                readings.backfillDemoPh(s.id(), s.ph(), s.id().hashCode() % 7);
            }
        }
    }

    private void seedSchedulesAndHistoryIfEmpty() {
        OffsetDateTime now = OffsetDateTime.now(clock);
        if (schedules.count() == 0) {
            if (devices.existsById("ARD-IRR-0421")) {
                schedules.insert("ARD-IRR-0421", "Rega da manhã", List.of(1, 2, 3, 4, 5, 6, 7), LocalTime.of(6, 30), 15, "leve", true);
                schedules.insert("ARD-IRR-0421", "Reforço de fim de tarde", List.of(1, 3, 5), LocalTime.of(17, 45), 10, "garoa", true);
            }
            if (devices.existsById("ARD-IRR-0418")) {
                schedules.insert("ARD-IRR-0418", "Ciclo da estufa", List.of(1, 2, 3, 4, 5, 6, 7), LocalTime.of(7, 0), 20, "moderada", true);
                schedules.insert("ARD-IRR-0418", "Ciclo da tarde", List.of(1, 2, 3, 4, 5, 6, 7), LocalTime.of(15, 30), 12, "moderada", true);
            }
            if (devices.existsById("ARD-IRR-0396")) {
                schedules.insert("ARD-IRR-0396", "Irrigação profunda", List.of(2, 4, 6), LocalTime.of(5, 30), 40, "forte", true);
            }
            if (devices.existsById("ARD-IRR-0312")) {
                schedules.insert("ARD-IRR-0312", "Jardim — fim de semana", List.of(6, 7), LocalTime.of(18, 0), 15, "garoa", false);
            }
        }
        if (logs.count() == 0) {
            // Histórico dos últimos 7 dias: uma rega diária por dispositivo ativo, com pequena variação de horário/duração.
            ThreadLocalRandom rnd = ThreadLocalRandom.current();
            for (int daysAgo = 7; daysAgo >= 1; daysAgo--) {
                for (Seed s : SEEDS) {
                    if (!devices.existsById(s.id()) || s.id().equals("ARD-IRR-0312") || (s.id().equals("ARD-IRR-0396") && daysAgo % 2 == 0)) {
                        continue;
                    }
                    int planned = switch (s.regime()) {
                        case "forte" -> 30 + rnd.nextInt(0, 15);
                        case "leve" -> 15 + rnd.nextInt(0, 8);
                        default -> 12 + rnd.nextInt(0, 10);
                    };
                    OffsetDateTime start = now.minusDays(daysAgo).withHour(6 + rnd.nextInt(0, 2)).withMinute(rnd.nextInt(0, 45));
                    logs.insert(s.id(), start, planned, start.plusMinutes(planned), rnd.nextInt(0, 4) == 0 ? "manual" : "agendada",
                            s.regime(), null);
                }
            }
        }
    }

    private void seedAlerts() {
        alerts.insert("ARD-IRR-0418", "LOW_MOISTURE", "high", "Umidade abaixo do limite",
                "A umidade atingiu 29%, abaixo do limite configurado de 40%.");
        alerts.insert("ARD-IRR-0312", "OFFLINE", "medium", "Dispositivo desconectado",
                "O dispositivo não envia dados há mais de 3 horas.");
        alerts.insert("ARD-IRR-0312", "LOW_WATER", "medium", "Nível de água reduzido",
                "O reservatório está com apenas 38% da capacidade.");

        long doneId = alerts.insert("ARD-IRR-0396", "IRRIGATION_DONE", "low", "Irrigação concluída",
                "O ciclo automático de 15 minutos foi concluído com sucesso.");
        alerts.markRead(doneId);
        alerts.resolveActive("ARD-IRR-0396", "IRRIGATION_DONE");

        long firmwareId = alerts.insert("ARD-IRR-0421", "FIRMWARE", "low", "Firmware atualizado",
                "O dispositivo foi atualizado para a versão 2.4.1.");
        alerts.markRead(firmwareId);
        alerts.resolveActive("ARD-IRR-0421", "FIRMWARE");
    }

    private static double clamp(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }

    private static double round2(double v) {
        return Math.round(v * 100) / 100.0;
    }
}

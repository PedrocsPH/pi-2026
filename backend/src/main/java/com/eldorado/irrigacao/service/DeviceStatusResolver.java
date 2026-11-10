package com.eldorado.irrigacao.service;

import java.time.Clock;
import java.time.OffsetDateTime;

import org.springframework.stereotype.Component;

import com.eldorado.irrigacao.config.IrrigacaoProperties;
import com.eldorado.irrigacao.domain.Device;

/**
 * Deriva o status exibido ("online"/"offline"/"alerta") a partir dos dados brutos do dispositivo,
 * em vez de guardar um campo "status" que pudesse ficar dessincronizado das leituras.
 */
@Component
public class DeviceStatusResolver {

    private final IrrigacaoProperties props;
    private final Clock clock;

    public DeviceStatusResolver(IrrigacaoProperties props, Clock clock) {
        this.props = props;
        this.clock = clock;
    }

    public DeviceStatus resolve(Device d) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        if (d.lastSeenAt() == null
                || d.lastSeenAt().plusMinutes(props.limites().offlineMinutos()).isBefore(now)) {
            return DeviceStatus.OFFLINE;
        }
        if (d.moisture() != null && d.moisture() < d.minMoisture()) {
            return DeviceStatus.ALERTA;
        }
        if (d.water() != null && d.water() < props.limites().aguaBaixaPercentual()) {
            return DeviceStatus.ALERTA;
        }
        if (d.ph() != null && (d.ph() < d.minPh() || d.ph() > d.maxPh())) {
            return DeviceStatus.ALERTA;
        }
        return DeviceStatus.ONLINE;
    }
}

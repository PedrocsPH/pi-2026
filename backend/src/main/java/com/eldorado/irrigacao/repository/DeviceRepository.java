package com.eldorado.irrigacao.repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.eldorado.irrigacao.domain.Device;

@Repository
public class DeviceRepository {

    private static final String SELECT = "SELECT * FROM verda.device";

    private final JdbcTemplate jdbc;
    private final DeviceRowMapper mapper = new DeviceRowMapper();

    public DeviceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Device> findAll() {
        return jdbc.query(SELECT + " ORDER BY created_at", mapper);
    }

    public Optional<Device> findById(String id) {
        return jdbc.query(SELECT + " WHERE id = ?", mapper, id).stream().findFirst();
    }

    public boolean existsById(String id) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM verda.device WHERE id = ?", Integer.class, id);
        return count != null && count > 0;
    }

    public void insert(Device d) {
        jdbc.update("""
                INSERT INTO verda.device
                    (id, name, location, type, connectivity, min_moisture, default_duration_min,
                     auto_irrigation, disconnect_alerts, schedule_time, water, crop, min_ph, max_ph, default_regime)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                d.id(), d.name(), d.location(), d.type(), d.connectivity(), d.minMoisture(), d.defaultDurationMin(),
                d.autoIrrigation(), d.disconnectAlerts(), d.scheduleTime(), d.water(), d.crop(), d.minPh(), d.maxPh(),
                d.defaultRegime());
    }

    /**
     * Chamado a cada leitura recebida (real ou simulada): grava a última leitura no cabeçalho do dispositivo.
     * O pH é opcional (nem todo Arduino tem sonda): sem ele, o último valor conhecido é mantido.
     */
    public void applyReading(String id, double moisture, double temperature, double water, Double ph, OffsetDateTime at) {
        if (ph == null) {
            jdbc.update("""
                    UPDATE verda.device
                       SET moisture = ?, temperature = ?, water = ?, last_seen_at = ?
                     WHERE id = ?
                    """, moisture, temperature, water, at, id);
        } else {
            jdbc.update("""
                    UPDATE verda.device
                       SET moisture = ?, temperature = ?, water = ?, ph = ?, last_seen_at = ?
                     WHERE id = ?
                    """, moisture, temperature, water, ph, at, id);
        }
    }

    public void updateSettings(String id, int minMoisture, int defaultDurationMin, boolean autoIrrigation,
            boolean disconnectAlerts, double minPh, double maxPh, String defaultRegime) {
        jdbc.update("""
                UPDATE verda.device
                   SET min_moisture = ?, default_duration_min = ?, auto_irrigation = ?, disconnect_alerts = ?,
                       min_ph = ?, max_ph = ?, default_regime = ?
                 WHERE id = ?
                """, minMoisture, defaultDurationMin, autoIrrigation, disconnectAlerts, minPh, maxPh, defaultRegime, id);
    }

    public void updateProfile(String id, String name, String type, String location, String crop, String connectivity) {
        jdbc.update("""
                UPDATE verda.device SET name = ?, type = ?, location = ?, crop = ?, connectivity = ?
                 WHERE id = ?
                """, name, type, location, crop, connectivity, id);
    }

    /** Remove o dispositivo e, em cascata, suas leituras, alertas, programações e histórico. */
    public void delete(String id) {
        jdbc.update("DELETE FROM verda.device WHERE id = ?", id);
    }

    /** Usado só pelo carregador de dados de demonstração: define cultura e faixa de pH dos dispositivos de exemplo. */
    public void applyDemoPhProfile(String id, String crop, double minPh, double maxPh, double ph) {
        jdbc.update("""
                UPDATE verda.device
                   SET crop = ?, min_ph = ?, max_ph = ?, ph = COALESCE(ph, ?)
                 WHERE id = ? AND crop = ''
                """, crop, minPh, maxPh, ph, id);
    }

    public void startIrrigation(String id, OffsetDateTime until, String mode, int minutes, String regime) {
        jdbc.update("""
                UPDATE verda.device
                   SET irrigating_until = ?, irrigation_mode = ?, irrigation_minutes = ?, irrigation_regime = ?
                 WHERE id = ?
                """, until, mode, minutes, regime, id);
    }

    public void stopIrrigation(String id) {
        jdbc.update("""
                UPDATE verda.device
                   SET irrigating_until = NULL, irrigation_mode = NULL, irrigation_minutes = 0, irrigation_regime = NULL
                 WHERE id = ?
                """, id);
    }

    public List<Device> findWithIrrigationEndingBefore(OffsetDateTime moment) {
        return jdbc.query(SELECT + " WHERE irrigating_until IS NOT NULL AND irrigating_until <= ?", mapper, moment);
    }
}

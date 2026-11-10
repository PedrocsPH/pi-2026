package com.eldorado.irrigacao.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.eldorado.irrigacao.domain.Settings;

@Repository
public class SettingsRepository {

    private final JdbcTemplate jdbc;

    public SettingsRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Settings get() {
        return jdbc.queryForObject("SELECT * FROM verda.app_settings WHERE id = 1", (rs, n) -> new Settings(
                rs.getString("full_name"),
                rs.getString("email"),
                rs.getString("phone"),
                rs.getString("role"),
                rs.getString("property_name"),
                rs.getString("property_location"),
                rs.getBoolean("notify_critical"),
                rs.getBoolean("notify_offline"),
                rs.getBoolean("notify_routines"),
                rs.getBoolean("notify_weekly"),
                rs.getString("language"),
                rs.getString("timezone"),
                rs.getString("temperature_unit"),
                rs.getString("date_format")));
    }

    public void update(Settings s) {
        jdbc.update("""
                UPDATE verda.app_settings SET
                    full_name = ?, email = ?, phone = ?, role = ?,
                    property_name = ?, property_location = ?,
                    notify_critical = ?, notify_offline = ?, notify_routines = ?, notify_weekly = ?,
                    language = ?, timezone = ?, temperature_unit = ?, date_format = ?
                 WHERE id = 1
                """,
                s.fullName(), s.email(), s.phone(), s.role(),
                s.propertyName(), s.propertyLocation(),
                s.notifyCritical(), s.notifyOffline(), s.notifyRoutines(), s.notifyWeekly(),
                s.language(), s.timezone(), s.temperatureUnit(), s.dateFormat());
    }
}

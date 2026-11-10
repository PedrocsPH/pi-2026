package com.eldorado.irrigacao.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

import org.springframework.jdbc.core.RowMapper;

import com.eldorado.irrigacao.domain.Device;

class DeviceRowMapper implements RowMapper<Device> {

    @Override
    public Device mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new Device(
                rs.getString("id"),
                rs.getString("name"),
                rs.getString("location"),
                rs.getString("type"),
                (Double) rs.getObject("moisture"),
                (Double) rs.getObject("temperature"),
                (Double) rs.getObject("water"),
                (Double) rs.getObject("ph"),
                rs.getObject("last_seen_at", OffsetDateTime.class),
                rs.getString("firmware"),
                rs.getString("connectivity"),
                (Integer) rs.getObject("rssi"),
                rs.getObject("installed_at", LocalDate.class),
                rs.getInt("min_moisture"),
                rs.getInt("default_duration_min"),
                rs.getBoolean("auto_irrigation"),
                rs.getBoolean("disconnect_alerts"),
                rs.getObject("schedule_time", LocalTime.class),
                rs.getObject("irrigating_until", OffsetDateTime.class),
                rs.getString("irrigation_mode"),
                rs.getInt("irrigation_minutes"),
                rs.getString("crop"),
                rs.getDouble("min_ph"),
                rs.getDouble("max_ph"),
                rs.getString("default_regime"),
                rs.getString("irrigation_regime"));
    }
}

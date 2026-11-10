package com.eldorado.irrigacao.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import com.eldorado.irrigacao.domain.IrrigationLog;

@Repository
public class IrrigationLogRepository {

    private static final RowMapper<IrrigationLog> MAPPER = IrrigationLogRepository::mapRow;

    private static final String SELECT = """
            SELECT l.*, d.name AS device_name FROM verda.irrigation_log l
            JOIN verda.device d ON d.id = l.device_id
            """;

    private final JdbcTemplate jdbc;

    public IrrigationLogRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static IrrigationLog mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new IrrigationLog(
                rs.getLong("id"),
                rs.getString("device_id"),
                rs.getString("device_name"),
                rs.getObject("started_at", OffsetDateTime.class),
                rs.getInt("planned_minutes"),
                rs.getObject("ended_at", OffsetDateTime.class),
                rs.getString("mode"),
                rs.getString("regime"),
                rs.getString("schedule_name"));
    }

    public long count() {
        Long n = jdbc.queryForObject("SELECT count(*) FROM verda.irrigation_log", Long.class);
        return n == null ? 0 : n;
    }

    public void insert(String deviceId, OffsetDateTime startedAt, int plannedMinutes, OffsetDateTime endedAt,
            String mode, String regime, String scheduleName) {
        jdbc.update("""
                INSERT INTO verda.irrigation_log (device_id, started_at, planned_minutes, ended_at, mode, regime, schedule_name)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, deviceId, startedAt, plannedMinutes, endedAt, mode, regime, scheduleName);
    }

    /** Fecha o registro em aberto do dispositivo (fim natural ou interrupção manual). */
    public void closeOpen(String deviceId, OffsetDateTime endedAt) {
        jdbc.update("""
                UPDATE verda.irrigation_log SET ended_at = ?
                 WHERE device_id = ? AND ended_at IS NULL
                """, endedAt, deviceId);
    }

    public List<IrrigationLog> findByDevice(String deviceId, int limit) {
        return jdbc.query(SELECT + " WHERE l.device_id = ? ORDER BY l.started_at DESC LIMIT ?", MAPPER, deviceId, limit);
    }

    public List<IrrigationLog> findSince(OffsetDateTime since) {
        return jdbc.query(SELECT + " WHERE l.started_at >= ? ORDER BY l.started_at DESC", MAPPER, since);
    }
}

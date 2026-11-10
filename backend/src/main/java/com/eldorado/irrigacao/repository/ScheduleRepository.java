package com.eldorado.irrigacao.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import com.eldorado.irrigacao.domain.Schedule;

@Repository
public class ScheduleRepository {

    private static final RowMapper<Schedule> MAPPER = ScheduleRepository::mapRow;

    private final JdbcTemplate jdbc;

    public ScheduleRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static Schedule mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new Schedule(
                rs.getLong("id"),
                rs.getString("device_id"),
                rs.getString("name"),
                parseDays(rs.getString("days")),
                rs.getObject("start_time", LocalTime.class),
                rs.getInt("duration_min"),
                rs.getString("regime"),
                rs.getBoolean("enabled"),
                rs.getObject("last_run_on", LocalDate.class));
    }

    static List<Integer> parseDays(String csv) {
        List<Integer> days = new ArrayList<>();
        if (csv != null && !csv.isBlank()) {
            Arrays.stream(csv.split(",")).map(String::trim).filter(s -> !s.isEmpty()).map(Integer::parseInt).forEach(days::add);
        }
        return days;
    }

    static String joinDays(List<Integer> days) {
        return days.stream().sorted().map(String::valueOf).reduce((a, b) -> a + "," + b).orElse("");
    }

    public List<Schedule> findByDevice(String deviceId) {
        return jdbc.query("SELECT * FROM verda.irrigation_schedule WHERE device_id = ? ORDER BY start_time, id", MAPPER, deviceId);
    }

    public List<Schedule> findAllEnabled() {
        return jdbc.query("SELECT * FROM verda.irrigation_schedule WHERE enabled = TRUE ORDER BY start_time, id", MAPPER);
    }

    public Optional<Schedule> findById(long id) {
        return jdbc.query("SELECT * FROM verda.irrigation_schedule WHERE id = ?", MAPPER, id).stream().findFirst();
    }

    public long count() {
        Long n = jdbc.queryForObject("SELECT count(*) FROM verda.irrigation_schedule", Long.class);
        return n == null ? 0 : n;
    }

    public long insert(String deviceId, String name, List<Integer> days, LocalTime start, int durationMin, String regime, boolean enabled) {
        KeyHolder key = new GeneratedKeyHolder();
        jdbc.update(con -> {
            var ps = con.prepareStatement("""
                    INSERT INTO verda.irrigation_schedule (device_id, name, days, start_time, duration_min, regime, enabled)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, new String[] { "id" });
            ps.setString(1, deviceId);
            ps.setString(2, name);
            ps.setString(3, joinDays(days));
            ps.setObject(4, start);
            ps.setInt(5, durationMin);
            ps.setString(6, regime);
            ps.setBoolean(7, enabled);
            return ps;
        }, key);
        return key.getKey().longValue();
    }

    public void update(long id, String name, List<Integer> days, LocalTime start, int durationMin, String regime, boolean enabled) {
        jdbc.update("""
                UPDATE verda.irrigation_schedule
                   SET name = ?, days = ?, start_time = ?, duration_min = ?, regime = ?, enabled = ?
                 WHERE id = ?
                """, name, joinDays(days), start, durationMin, regime, enabled, id);
    }

    public void setEnabled(long id, boolean enabled) {
        jdbc.update("UPDATE verda.irrigation_schedule SET enabled = ? WHERE id = ?", enabled, id);
    }

    public void markRan(long id, LocalDate day) {
        jdbc.update("UPDATE verda.irrigation_schedule SET last_run_on = ? WHERE id = ?", day, id);
    }

    public void delete(long id) {
        jdbc.update("DELETE FROM verda.irrigation_schedule WHERE id = ?", id);
    }
}

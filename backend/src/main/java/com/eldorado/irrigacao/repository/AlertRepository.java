package com.eldorado.irrigacao.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import com.eldorado.irrigacao.domain.Alert;

@Repository
public class AlertRepository {

    private static final RowMapper<Alert> MAPPER = AlertRepository::mapRow;

    private final JdbcTemplate jdbc;

    public AlertRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static Alert mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new Alert(
                rs.getLong("id"),
                rs.getString("device_id"),
                rs.getString("device_name"),
                rs.getString("kind"),
                rs.getString("level"),
                rs.getString("title"),
                rs.getString("message"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getBoolean("is_read"),
                rs.getObject("resolved_at", OffsetDateTime.class));
    }

    private static final String SELECT = """
            SELECT a.*, d.name AS device_name FROM verda.alert a
            LEFT JOIN verda.device d ON d.id = a.device_id
            """;

    public List<Alert> findAll() {
        return jdbc.query(SELECT + " ORDER BY a.created_at DESC", MAPPER);
    }

    public List<Alert> findUnread() {
        return jdbc.query(SELECT + " WHERE a.is_read = FALSE ORDER BY a.created_at DESC", MAPPER);
    }

    public int countUnread() {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM verda.alert WHERE is_read = FALSE", Integer.class);
        return n == null ? 0 : n;
    }

    public int countActiveByLevel(String level) {
        Integer n = jdbc.queryForObject(
                "SELECT count(*) FROM verda.alert WHERE level = ? AND resolved_at IS NULL", Integer.class, level);
        return n == null ? 0 : n;
    }

    public int countResolvedSince(OffsetDateTime since) {
        Integer n = jdbc.queryForObject(
                "SELECT count(*) FROM verda.alert WHERE resolved_at IS NOT NULL AND resolved_at >= ?", Integer.class, since);
        return n == null ? 0 : n;
    }

    /** Já existe um alerta ativo (não resolvido) deste tipo para o dispositivo? Evita duplicar a cada leitura. */
    public boolean hasActive(String deviceId, String kind) {
        Integer n = jdbc.queryForObject("""
                SELECT count(*) FROM verda.alert WHERE device_id = ? AND kind = ? AND resolved_at IS NULL
                """, Integer.class, deviceId, kind);
        return n != null && n > 0;
    }

    public long insert(String deviceId, String kind, String level, String title, String message) {
        KeyHolder key = new GeneratedKeyHolder();
        jdbc.update(con -> {
            var ps = con.prepareStatement("""
                    INSERT INTO verda.alert (device_id, kind, level, title, message)
                    VALUES (?, ?, ?, ?, ?)
                    """, new String[] { "id" });
            ps.setString(1, deviceId);
            ps.setString(2, kind);
            ps.setString(3, level);
            ps.setString(4, title);
            ps.setString(5, message);
            return ps;
        }, key);
        return key.getKey().longValue();
    }

    public void resolveActive(String deviceId, String kind) {
        jdbc.update("""
                UPDATE verda.alert SET resolved_at = now()
                 WHERE device_id = ? AND kind = ? AND resolved_at IS NULL
                """, deviceId, kind);
    }

    public void markRead(long id) {
        jdbc.update("UPDATE verda.alert SET is_read = TRUE WHERE id = ?", id);
    }

    public void markAllRead() {
        jdbc.update("UPDATE verda.alert SET is_read = TRUE WHERE is_read = FALSE");
    }
}

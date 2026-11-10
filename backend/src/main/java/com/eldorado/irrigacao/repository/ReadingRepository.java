package com.eldorado.irrigacao.repository;

import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.eldorado.irrigacao.domain.ReadingPoint;

@Repository
public class ReadingRepository {

    private final JdbcTemplate jdbc;

    public ReadingRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(String deviceId, double moisture, double temperature, double water, Double ph, OffsetDateTime at) {
        jdbc.update("""
                INSERT INTO verda.reading (device_id, moisture, temperature, water, ph, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """, deviceId, moisture, temperature, water, ph, at);
    }

    /**
     * Série de um dispositivo, agrupada em "buckets" (ex.: 24 baldes de 1h, ou 7 dias em baldes de 3h),
     * usada para desenhar o gráfico de histórico sem devolver toda leitura bruta.
     */
    public List<ReadingPoint> seriesForDevice(String deviceId, OffsetDateTime since, int bucketMinutes) {
        return jdbc.query("""
                SELECT to_timestamp(floor(extract(epoch FROM recorded_at) / (? * 60)) * (? * 60)) AS bucket,
                       avg(moisture) AS moisture, avg(temperature) AS temperature, avg(water) AS water, avg(ph) AS ph
                  FROM verda.reading
                 WHERE device_id = ? AND recorded_at >= ?
                 GROUP BY bucket ORDER BY bucket
                """, this::mapPoint, bucketMinutes, bucketMinutes, deviceId, since);
    }

    /** Média entre todos os dispositivos por bucket — alimenta os gráficos do dashboard. */
    public List<ReadingPoint> fleetAverageSeries(OffsetDateTime since, int bucketMinutes) {
        return jdbc.query("""
                SELECT to_timestamp(floor(extract(epoch FROM recorded_at) / (? * 60)) * (? * 60)) AS bucket,
                       avg(moisture) AS moisture, avg(temperature) AS temperature, avg(water) AS water, avg(ph) AS ph
                  FROM verda.reading
                 WHERE recorded_at >= ?
                 GROUP BY bucket ORDER BY bucket
                """, this::mapPoint, bucketMinutes, bucketMinutes, since);
    }

    public Double fleetAverageMoistureSince(OffsetDateTime since) {
        return jdbc.queryForObject(
                "SELECT avg(moisture) FROM verda.reading WHERE recorded_at >= ?", Double.class, since);
    }

    /** Usado só pela demonstração: preenche o pH histórico (uma onda diária suave + ruído) onde ele ainda não existe. */
    public int backfillDemoPh(String deviceId, double base, double phase) {
        return jdbc.update("""
                UPDATE verda.reading
                   SET ph = round(CAST(? + 0.22 * sin(CAST(extract(epoch FROM recorded_at) AS double precision) / 13750.0 + ?)
                                       + (random() - 0.5) * 0.10 AS numeric), 2)
                 WHERE device_id = ? AND ph IS NULL
                """, base, phase, deviceId);
    }

    private ReadingPoint mapPoint(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new ReadingPoint(
                rs.getObject("bucket", OffsetDateTime.class),
                (Double) rs.getObject("moisture"),
                (Double) rs.getObject("temperature"),
                (Double) rs.getObject("water"),
                (Double) rs.getObject("ph"));
    }
}

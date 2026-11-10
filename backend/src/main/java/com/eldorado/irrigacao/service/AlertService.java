package com.eldorado.irrigacao.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.stereotype.Service;

import com.eldorado.irrigacao.domain.Alert;
import com.eldorado.irrigacao.repository.AlertRepository;
import com.eldorado.irrigacao.web.dto.AlertDto;
import com.eldorado.irrigacao.web.dto.AlertsResponse;
import com.eldorado.irrigacao.web.dto.AlertsSummaryDto;

@Service
public class AlertService {

    private final AlertRepository alerts;
    private final Clock clock;

    public AlertService(AlertRepository alerts, Clock clock) {
        this.alerts = alerts;
        this.clock = clock;
    }

    public AlertsResponse list(boolean onlyUnread) {
        List<Alert> items = onlyUnread ? alerts.findUnread() : alerts.findAll();
        AlertsSummaryDto summary = new AlertsSummaryDto(
                alerts.countUnread(),
                alerts.countActiveByLevel("high"),
                alerts.countActiveByLevel("medium"),
                alerts.countResolvedSince(OffsetDateTime.now(clock).minus(30, ChronoUnit.DAYS)));
        return new AlertsResponse(items.stream().map(this::toDto).toList(), summary);
    }

    public List<AlertDto> recent(int limit) {
        return alerts.findAll().stream().limit(limit).map(this::toDto).toList();
    }

    public void markRead(long id) {
        alerts.markRead(id);
    }

    public void markAllRead() {
        alerts.markAllRead();
    }

    private AlertDto toDto(Alert a) {
        return new AlertDto(a.id(), a.deviceId(), a.deviceName(), a.kind(), a.level(), a.title(), a.message(),
                a.createdAt().toString(), a.read());
    }
}

package com.eldorado.irrigacao.web.dto;

import java.util.List;

public record DashboardResponse(
        String greetingName,
        DeviceCountsDto deviceCounts,
        Double avgMoisture,
        Double avgMoistureDeltaPercent,
        Double avgWaterLevel,
        Double avgPh,
        Double avgTemperature,
        int activeAlerts,
        int highPriorityAlerts,
        int irrigatingNow,
        int irrigationsToday,
        double waterMmToday,
        List<SeriesPointDto> moistureSeries,
        List<DailyIrrigationDto> weeklyIrrigation,
        List<UpcomingRunDto> upcomingRuns,
        List<AlertDto> recentAlerts,
        List<DeviceSummaryDto> devices) {
}

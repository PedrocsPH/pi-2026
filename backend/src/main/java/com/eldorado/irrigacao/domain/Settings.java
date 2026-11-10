package com.eldorado.irrigacao.domain;

public record Settings(
        String fullName,
        String email,
        String phone,
        String role,
        String propertyName,
        String propertyLocation,
        boolean notifyCritical,
        boolean notifyOffline,
        boolean notifyRoutines,
        boolean notifyWeekly,
        String language,
        String timezone,
        String temperatureUnit,
        String dateFormat) {
}

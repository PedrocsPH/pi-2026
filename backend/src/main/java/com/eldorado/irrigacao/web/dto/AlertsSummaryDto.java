package com.eldorado.irrigacao.web.dto;

public record AlertsSummaryDto(int unread, int highPriority, int attention, int resolvedThisMonth) {
}

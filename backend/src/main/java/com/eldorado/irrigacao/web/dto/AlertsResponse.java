package com.eldorado.irrigacao.web.dto;

import java.util.List;

public record AlertsResponse(List<AlertDto> items, AlertsSummaryDto summary) {
}

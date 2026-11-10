package com.eldorado.irrigacao.web.dto;

public record IrrigationStartRequest(Integer minutes, Integer seconds, String regime) {
}

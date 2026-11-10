package com.eldorado.irrigacao.web;

import java.util.Map;
import jakarta.validation.Valid;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import com.eldorado.irrigacao.service.IngestService;
import com.eldorado.irrigacao.web.dto.DeviceCommandDto;
import com.eldorado.irrigacao.web.dto.ReadingIngestRequest;

/** Endpoint que o firmware do Arduino/ESP32 chama para enviar leituras e consultar o comando da bomba. */
@RestController
@RequestMapping("/api/ingest")
public class IngestController {

    private final IngestService service;

    @Value("${irrigacao.ingestao.chave-api:}")
    private String apiKey;

    public IngestController(IngestService service) {
        this.service = service;
    }

    @PostMapping("/{deviceId}/readings")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public DeviceCommandDto ingest(@PathVariable String deviceId, @Valid @RequestBody ReadingIngestRequest req,
            @RequestHeader(value = "X-Device-Key", required = false) String deviceKey) {
        if (apiKey != null && !apiKey.isBlank() && !apiKey.equals(deviceKey)) {
            throw new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Chave de dispositivo inválida.");
        }
        String targetId = service.resolveTargetDevice(deviceId, true);
        return service.ingest(targetId, req.moisture(), req.temperature(), req.water(), req.ph());
    }

    @GetMapping("/{deviceId}/command")
    public DeviceCommandDto command(@PathVariable String deviceId,
            @RequestHeader(value = "X-Device-Key", required = false) String deviceKey) {
        if (apiKey != null && !apiKey.isBlank() && !apiKey.equals(deviceKey)) {
            throw new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Chave de dispositivo inválida.");
        }
        String targetId = service.resolveTargetDevice(deviceId, true);
        return service.getCommand(targetId);
    }

    @GetMapping("/active-device")
    public Map<String, String> getActiveDevice() {
        return Map.of("deviceId", service.getActiveArduinoDeviceId());
    }

    @PutMapping("/active-device/{deviceId}")
    public Map<String, String> setActiveDevice(@PathVariable String deviceId) {
        return Map.of("deviceId", service.setActiveArduinoDeviceId(deviceId));
    }
}

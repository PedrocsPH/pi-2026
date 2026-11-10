package com.eldorado.irrigacao.web;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import com.eldorado.irrigacao.service.DeviceService;
import com.eldorado.irrigacao.service.ScheduleService;
import com.eldorado.irrigacao.web.dto.*;

@RestController
@RequestMapping("/api/devices")
public class DeviceController {

    private final DeviceService service;
    private final ScheduleService schedules;

    public DeviceController(DeviceService service, ScheduleService schedules) {
        this.service = service;
        this.schedules = schedules;
    }

    @GetMapping
    public List<DeviceSummaryDto> list() {
        return service.listSummaries();
    }

    @GetMapping("/{id}")
    public DeviceDetailDto get(@PathVariable String id, @RequestParam(defaultValue = "1") int days) {
        return service.getDetail(id, days);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DeviceSummaryDto create(@Valid @RequestBody CreateDeviceRequest req) {
        return service.create(req);
    }

    @PutMapping("/{id}")
    public DeviceDetailDto updateProfile(@PathVariable String id, @Valid @RequestBody UpdateDeviceRequest req) {
        return service.updateProfile(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        service.delete(id);
    }

    @PatchMapping("/{id}/settings")
    public DeviceDetailDto updateSettings(@PathVariable String id, @Valid @RequestBody DeviceSettingsRequest req) {
        return service.updateSettings(id, req);
    }

    @PostMapping("/{id}/irrigation/start")
    public DeviceDetailDto startIrrigation(@PathVariable String id, @RequestBody(required = false) IrrigationStartRequest req) {
        return service.startIrrigation(
                id,
                req == null ? null : req.minutes(),
                req == null ? null : req.seconds(),
                req == null ? null : req.regime());
    }

    @PostMapping("/{id}/irrigation/stop")
    public DeviceDetailDto stopIrrigation(@PathVariable String id) {
        return service.stopIrrigation(id);
    }

    // ---- Programações de rega ----

    @GetMapping("/{id}/schedules")
    public List<ScheduleDto> listSchedules(@PathVariable String id) {
        return schedules.listForDevice(id);
    }

    @PostMapping("/{id}/schedules")
    @ResponseStatus(HttpStatus.CREATED)
    public ScheduleDto createSchedule(@PathVariable String id, @Valid @RequestBody ScheduleRequest req) {
        return schedules.create(id, req);
    }

    @PutMapping("/{id}/schedules/{scheduleId}")
    public ScheduleDto updateSchedule(@PathVariable String id, @PathVariable long scheduleId,
            @Valid @RequestBody ScheduleRequest req) {
        return schedules.update(id, scheduleId, req);
    }

    @PatchMapping("/{id}/schedules/{scheduleId}")
    public ScheduleDto toggleSchedule(@PathVariable String id, @PathVariable long scheduleId,
            @Valid @RequestBody ScheduleToggleRequest req) {
        return schedules.setEnabled(id, scheduleId, req.enabled());
    }

    @DeleteMapping("/{id}/schedules/{scheduleId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSchedule(@PathVariable String id, @PathVariable long scheduleId) {
        schedules.delete(id, scheduleId);
    }
}

package com.eldorado.irrigacao.web;

import org.springframework.web.bind.annotation.*;

import com.eldorado.irrigacao.domain.Settings;
import com.eldorado.irrigacao.service.SettingsService;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsService service;

    public SettingsController(SettingsService service) {
        this.service = service;
    }

    @GetMapping
    public Settings get() {
        return service.get();
    }

    @PutMapping
    public Settings update(@RequestBody Settings settings) {
        return service.update(settings);
    }
}

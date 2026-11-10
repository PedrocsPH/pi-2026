package com.eldorado.irrigacao.web;

import org.springframework.web.bind.annotation.*;

import com.eldorado.irrigacao.service.AlertService;
import com.eldorado.irrigacao.web.dto.AlertsResponse;

@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    private final AlertService service;

    public AlertController(AlertService service) {
        this.service = service;
    }

    @GetMapping
    public AlertsResponse list(@RequestParam(defaultValue = "false") boolean onlyUnread) {
        return service.list(onlyUnread);
    }

    @PostMapping("/{id}/read")
    public void markRead(@PathVariable long id) {
        service.markRead(id);
    }

    @PostMapping("/read-all")
    public void markAllRead() {
        service.markAllRead();
    }
}

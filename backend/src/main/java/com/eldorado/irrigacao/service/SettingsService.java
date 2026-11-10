package com.eldorado.irrigacao.service;

import org.springframework.stereotype.Service;

import com.eldorado.irrigacao.domain.Settings;
import com.eldorado.irrigacao.repository.SettingsRepository;

@Service
public class SettingsService {

    private final SettingsRepository repo;

    public SettingsService(SettingsRepository repo) {
        this.repo = repo;
    }

    public Settings get() {
        return repo.get();
    }

    public Settings update(Settings s) {
        repo.update(s);
        return repo.get();
    }
}

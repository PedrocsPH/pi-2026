package com.eldorado.irrigacao.web;

import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import com.eldorado.irrigacao.domain.Settings;
import com.eldorado.irrigacao.service.SettingsService;

/**
 * Endpoints de Login e Cadastro de Usuários integrados ao PostgreSQL (tabela verda.app_user)
 * com proteção exclusiva para as contas administradoras de Pedro Henrique e Dori Amado.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Set<String> PROTECTED_ADMIN_EMAILS = Set.of(
            "pedro@senacrs.edu.br",
            "dori@senacrs.edu.br"
    );

    private final JdbcTemplate jdbc;
    private final SettingsService settingsService;

    public AuthController(JdbcTemplate jdbc, SettingsService settingsService) {
        this.jdbc = jdbc;
        this.settingsService = settingsService;
    }

    public record LoginRequest(String email, String password) {}

    public record RegisterRequest(
            String fullName,
            String email,
            String password,
            String phone,
            String role,
            String propertyName,
            String propertyLocation) {}

    @PostMapping("/login")
    public Settings login(@RequestBody LoginRequest req) {
        String email = req.email() == null ? "" : req.email().trim().toLowerCase();
        String pass = req.password() == null ? "" : req.password().trim();
        if (email.isBlank() || pass.isBlank()) {
            throw ApiException.badRequest("Informe seu e-mail e senha para entrar.");
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT full_name, email, password_hash, phone, role, property_name, property_location FROM verda.app_user WHERE LOWER(email) = ?",
                email);

        if (rows.isEmpty()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "E-mail não encontrado. Cadastre sua conta na aba 'Criar Nova Conta'.");
        }

        Map<String, Object> user = rows.get(0);
        String storedPass = String.valueOf(user.get("password_hash"));
        if (!storedPass.equals(pass)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Senha incorreta. Acesso negado.");
        }

        Settings current = settingsService.get();
        Settings updated = new Settings(
                String.valueOf(user.get("full_name")),
                String.valueOf(user.get("email")),
                String.valueOf(user.get("phone")),
                String.valueOf(user.get("role")),
                String.valueOf(user.get("property_name")),
                String.valueOf(user.get("property_location")),
                current.notifyCritical(),
                current.notifyOffline(),
                current.notifyRoutines(),
                current.notifyWeekly(),
                current.language(),
                current.timezone(),
                current.temperatureUnit(),
                current.dateFormat());
        return settingsService.update(updated);
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public Settings register(@RequestBody RegisterRequest req) {
        String name = req.fullName() == null ? "" : req.fullName().trim();
        String email = req.email() == null ? "" : req.email().trim().toLowerCase();
        String pass = req.password() == null ? "" : req.password().trim();
        if (name.isBlank() || email.isBlank() || pass.length() < 4) {
            throw ApiException.badRequest("Preencha nome completo, e-mail válido e uma senha de pelo menos 4 caracteres.");
        }

        // Impede que terceiros cadastrem ou sobrescrevam as contas de Administrador do Pedro Henrique e do Dori
        if (PROTECTED_ADMIN_EMAILS.contains(email)) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "Este e-mail pertence a uma conta Administradora protegida (Pedro Henrique / Dori Amado). Faça login com a senha de administrador.");
        }

        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT email FROM verda.app_user WHERE LOWER(email) = ?", email);
        if (!existing.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "Já existe uma conta cadastrada com este e-mail. Use a aba de Login com sua senha.");
        }

        String phone = req.phone() == null ? "" : req.phone().trim();
        String requestedRole = req.role() == null ? "" : req.role().trim();
        // Cargo de Administrador(a) é exclusivo de Pedro Henrique e Dori Amado
        String role = (requestedRole.isBlank() || requestedRole.toLowerCase().startsWith("administrador"))
                ? "Operador(a) de Irrigação"
                : requestedRole;
        String propName = req.propertyName() == null || req.propertyName().isBlank() ? "Horta Inteligente Verda" : req.propertyName().trim();
        String propLoc = req.propertyLocation() == null || req.propertyLocation().isBlank() ? "Porto Alegre, RS" : req.propertyLocation().trim();

        jdbc.update("""
                INSERT INTO verda.app_user (full_name, email, password_hash, phone, role, property_name, property_location)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, name, email, pass, phone, role, propName, propLoc);

        Settings current = settingsService.get();
        Settings updated = new Settings(
                name, email, phone, role, propName, propLoc,
                current.notifyCritical(), current.notifyOffline(), current.notifyRoutines(), current.notifyWeekly(),
                current.language(), current.timezone(), current.temperatureUnit(), current.dateFormat());
        return settingsService.update(updated);
    }
}

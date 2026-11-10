package com.eldorado.irrigacao.config;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class AppConfig implements WebMvcConfigurer {

    private final IrrigacaoProperties props;

    public AppConfig(IrrigacaoProperties props) {
        this.props = props;
    }

    /** Relógio único da aplicação, no fuso configurado (mantém "hoje/amanhã" e horários coerentes). */
    @Bean
    public Clock clock() {
        return Clock.system(ZoneId.of(props.zonaHoraria()));
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // Libera tanto localhost quanto o IP da rede local (para acesso pelo navegador do celular no Wi-Fi)
        registry.addMapping("/api/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}

package com.eldorado.irrigacao.domain;

/**
 * Regime de chuva: perfil de intensidade da rega. Na prática define a potência da bomba (PWM no Arduino)
 * e a lâmina d'água nominal aplicada por hora. A chave ("garoa", "leve"...) é a mesma usada pelo front-end.
 */
public enum Regime {
    GAROA("garoa", "Garoa", "Gotejamento bem suave. Ideal para mudas, sementeiras e substratos leves.", 30, 2.5),
    LEVE("leve", "Chuva leve", "Aplicação lenta que favorece a infiltração. Bom para hortaliças e jardins.", 50, 5.0),
    MODERADA("moderada", "Chuva moderada", "Equilíbrio entre tempo e volume. Regime padrão para a maioria dos cultivos.", 75, 10.0),
    FORTE("forte", "Chuva forte", "Vazão máxima para molhar rápido e fundo. Use em solos secos ou pomares.", 100, 20.0);

    public final String key;
    public final String label;
    public final String description;
    /** Potência da bomba, em % (duty cycle do PWM). */
    public final int pumpPower;
    /** Lâmina nominal aplicada, em milímetros por hora (estimativa; depende da vazão real da instalação). */
    public final double mmPerHour;

    Regime(String key, String label, String description, int pumpPower, double mmPerHour) {
        this.key = key;
        this.label = label;
        this.description = description;
        this.pumpPower = pumpPower;
        this.mmPerHour = mmPerHour;
    }

    /** Devolve o regime da chave informada, ou null se ela não existir. */
    public static Regime fromKey(String key) {
        if (key != null) {
            for (Regime r : values()) {
                if (r.key.equals(key)) {
                    return r;
                }
            }
        }
        return null;
    }

    /** Lâmina estimada (mm) para uma irrigação de N minutos neste regime. */
    public double mmFor(double minutes) {
        return Math.round(mmPerHour * minutes / 60.0 * 10) / 10.0;
    }
}
